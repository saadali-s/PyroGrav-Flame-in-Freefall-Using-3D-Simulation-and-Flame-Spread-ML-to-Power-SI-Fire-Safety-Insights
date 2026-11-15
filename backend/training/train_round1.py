"""One fixed, grouped experiment. CatBoost must use GPU; no CPU fallback.

Run backend/venv/Scripts/python.exe backend/training/train_round1.py.
Each run refuses to overwrite an existing run folder. No raw-data mutation.
"""
from pathlib import Path
from collections import Counter
import csv
import hashlib
import importlib.metadata
import json
import os
import platform
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sklearn.metrics import r2_score
from catboost import CatBoostRegressor
from catboost.utils import get_gpu_device_count

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'backend/training/datasets/pmma-v1'
PROTOCOL = ROOT / 'backend/training/round1_protocol.json'
P = json.loads(PROTOCOL.read_text(encoding='utf8'))
OUT = ROOT / 'backend/training/runs' / P['run_id']
MODELS = list(P['models'])
FEATURES = P['features']

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n', encoding='utf8')

def write_csv(path, rows):
    with path.open('w', encoding='utf8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader(); w.writerows(rows)

def read_rows():
    assert sha(DATA / 'candidate_training.csv') == P['candidate_sha256']
    for name, expected in json.loads((DATA / 'manifest.json').read_text(encoding='utf8')).items():
        assert sha(DATA / name) == expected, f'Dataset changed: {name}'
    rows = list(csv.DictReader((DATA / 'candidate_training.csv').open(encoding='utf8')))
    assert len(rows) == 69
    assert len({r['observation_id'] for r in rows}) == len(rows)
    for r in rows:
        assert r['review_status'] == 'candidate' and r['color'] == 'black'
        assert r['source_id'] == 'link2018_supp'
        for key in FEATURES + ['rate_mms']:
            r[key] = float(r[key]); assert np.isfinite(r[key])
        assert r['rate_mms'] > 0
    return rows

def weights(rows):
    counts = Counter(r['group_id'] for r in rows)
    w = np.array([1 / counts[r['group_id']] for r in rows])
    return w / w.mean()

def arrays(rows):
    return np.array([[r[k] for k in FEATURES] for r in rows]), np.array([r['rate_mms'] for r in rows])

def weighted_median(y, w):
    order = np.argsort(y)
    return float(y[order[np.searchsorted(np.cumsum(w[order]), w.sum()/2)]])

class Monitor:
    def __init__(self):
        self.stop_event = threading.Event(); self.samples = []
        self.thread = threading.Thread(target=self.run, daemon=True)
    def run(self):
        while not self.stop_event.is_set():
            try:
                result = subprocess.run(['nvidia-smi', '--query-gpu=timestamp,index,utilization.gpu,memory.used', '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=5)
                self.samples.append(dict(time_utc=datetime.now(timezone.utc).isoformat(), output=result.stdout.strip(), returncode=result.returncode))
            except Exception as e:
                self.samples.append(dict(error=str(e)))
            self.stop_event.wait(.5)
    def __enter__(self): self.thread.start(); return self
    def __exit__(self, *_): self.stop_event.set(); self.thread.join(timeout=6)

def fit_predict(train, test, name, fold_id, fits):
    x, y = arrays(train); xt, _ = arrays(test); w = weights(train)
    start = time.perf_counter()
    artifact = None
    if name == 'median':
        pred = np.full(len(test), weighted_median(y, w))
    elif name in ['nearest', 'ridge']:
        scaler = StandardScaler().fit(x, sample_weight=w)
        z, zt = scaler.transform(x), scaler.transform(xt)
        if name == 'nearest':
            ds = np.sum((zt[:,None,:] - z[None,:,:])**2, axis=2)
            pred = np.array([np.average(y[np.isclose(d, d.min(), rtol=1e-10, atol=1e-12)], weights=w[np.isclose(d, d.min(), rtol=1e-10, atol=1e-12)]) for d in ds])
        else:
            model = Ridge(alpha=P['models']['ridge']['alpha']).fit(z, y, sample_weight=w)
            pred = model.predict(zt)
            artifact = dict(kind='standardized_linear_ridge', features=FEATURES, mean=scaler.mean_.tolist(), scale=scaler.scale_.tolist(), coefficients=model.coef_.tolist(), intercept=float(model.intercept_))
    else:
        model = CatBoostRegressor(**P['models']['catboost_gpu'])
        model.fit(x, y, sample_weight=w)
        params = model.get_all_params()
        assert params['task_type'] == 'GPU', 'Refusing an unverified CPU fallback'
        pred = model.predict(xt)
        model_path = OUT / 'models' / f'{fold_id}.cbm'
        model.save_model(str(model_path))
        loaded = CatBoostRegressor(); loaded.load_model(str(model_path))
        assert np.allclose(loaded.predict(xt), pred, rtol=1e-10, atol=1e-12), 'Model reload mismatch'
        artifact = dict(path=model_path.relative_to(ROOT).as_posix(), sha256=sha(model_path), params=params)
    assert np.isfinite(pred).all()
    fits.append(dict(fold_id=fold_id, model=name, train_rows=len(train), test_rows=len(test),
                     seconds=time.perf_counter()-start, execution='GPU:0' if name=='catboost_gpu' else 'CPU', artifact=artifact))
    return np.asarray(pred)

def summarize(records, name):
    part = [r for r in records if r['model']==name]
    group_ids = sorted({r['group_id'] for r in part})
    group_mae = [np.mean([r['absolute_error_mms'] for r in part if r['group_id']==g]) for g in group_ids]
    group_mse = [np.mean([r['error_mms']**2 for r in part if r['group_id']==g]) for g in group_ids]
    actual=np.array([r['observed_mms'] for r in part]); pred=np.array([r['predicted_mms'] for r in part])
    return dict(model=name, rows=len(part), groups=len(group_ids), group_mae_mms=float(np.mean(group_mae)),
        group_rmse_mms=float(np.sqrt(np.mean(group_mse))), row_mae_mms=float(np.abs(actual-pred).mean()),
        row_rmse_mms=float(np.sqrt(np.mean((actual-pred)**2))), row_r2=float(r2_score(actual,pred)),
        clipped_predictions=sum(r['raw_predicted_mms']<0 for r in part), outside_training_box=sum(r['outside_training_box'] for r in part))

def main():
    rows=read_rows()
    assert get_gpu_device_count() >= 1, 'No CatBoost CUDA device; training stopped.'
    assert not OUT.exists(), f'Refusing overwrite: {OUT}'
    OUT.mkdir(parents=True); (OUT/'models').mkdir()
    shutil.copyfile(PROTOCOL, OUT/'protocol.json')
    raw_hashes=json.loads((DATA/'raw_data_manifest.json').read_text(encoding='utf8'))
    for path, expected in raw_hashes.items(): assert sha(ROOT/path)==expected
    gpu=subprocess.run(['nvidia-smi','--query-gpu=index,name,uuid,driver_version,memory.total','--format=csv,noheader'],capture_output=True,text=True,check=True).stdout.strip()
    env=dict(python=sys.version,platform=platform.platform(),packages={m:importlib.metadata.version(m) for m in ['numpy','scikit-learn','catboost']},gpu=gpu,
             cuda_devices=get_gpu_device_count(),cuda_visible_devices=os.environ.get('CUDA_VISIBLE_DEVICES'),protocol_sha256=sha(PROTOCOL),
             data_sha256=sha(DATA/'candidate_training.csv'),script_sha256=sha(Path(__file__)),started_utc=datetime.now(timezone.utc).isoformat())
    write_json(OUT/'environment.json',env)
    earth=[r for r in rows if r['environment']=='earth']; flight=[r for r in rows if r['environment']=='microgravity']
    strict=[r for r in flight if 'U01' not in r['review_flags']]
    tasks=[]
    for evaluation, subset in [('earth_logo',earth),('microgravity_logo',flight),('microgravity_strict_units_logo',strict)]:
        for group in sorted({r['group_id'] for r in subset}):
            tasks.append((evaluation,group,[r for r in subset if r['group_id']!=group],[r for r in subset if r['group_id']==group]))
    tasks.append(('earth_to_microgravity','all-flight',earth,flight))
    splits=[]
    for evaluation, group, train, test in tasks:
        train_groups={r['group_id'] for r in train}; test_groups={r['group_id'] for r in test}
        assert not train_groups & test_groups
        assert not {r['observation_id'] for r in train} & {r['observation_id'] for r in test}
        splits.append(dict(evaluation=evaluation,held_out_group=group,train_ids=[r['observation_id'] for r in train],test_ids=[r['observation_id'] for r in test],train_groups=sorted(train_groups),test_groups=sorted(test_groups)))
    # Persist every split before fitting; no early stopping or hyperparameter selection on test rows.
    write_json(OUT/'splits.json',splits)
    predictions=[];fits=[]
    with Monitor() as monitor:
        for index,(evaluation, group, train, test) in enumerate(tasks,1):
            fold_id=f'{evaluation}--{group}'
            x,_=arrays(train)
            for name in MODELS:
                pred=fit_predict(train,test,name,fold_id,fits)
                for r,value in zip(test,pred):
                    clipped=max(0,float(value)); actual=r['rate_mms']
                    outside=[f for j,f in enumerate(FEATURES) if r[f]<x[:,j].min() or r[f]>x[:,j].max()]
                    predictions.append(dict(evaluation=evaluation,fold_id=fold_id,model=name,observation_id=r['observation_id'],
                        group_id=r['group_id'],environment=r['environment'],oxygen_pct=r['oxygen_pct'],diameter_mm=r['diameter_mm'],opposed_flow_cms=r['opposed_flow_cms'],
                        observed_mms=actual,raw_predicted_mms=float(value),predicted_mms=clipped,error_mms=clipped-actual,absolute_error_mms=abs(clipped-actual),
                        outside_training_box=bool(outside),outside_features=';'.join(outside),unit_inference='U01' in r['review_flags']))
            # Keep recoverable evidence if a later GPU fit fails. Do not publish an incomplete snapshot.
            write_json(OUT/'fit-log.json',fits)
            print(f'{index}/{len(tasks)} completed {evaluation} holdout {group}',flush=True)
    write_json(OUT/'gpu-monitor.json',monitor.samples)
    write_csv(OUT/'heldout_predictions.csv',predictions)
    expected_counts={'earth_logo':35,'microgravity_logo':34,'earth_to_microgravity':34,'microgravity_strict_units_logo':len(strict)}
    for evaluation,count in expected_counts.items():
        for name in MODELS:
            part=[r for r in predictions if r['evaluation']==evaluation and r['model']==name]
            assert len(part)==count and len({r['observation_id'] for r in part})==count
    metrics=[];comparisons=[]
    rng=np.random.default_rng(P['seed'])
    for evaluation in expected_counts:
        part=[r for r in predictions if r['evaluation']==evaluation]
        evaluated=[dict(evaluation=evaluation,**summarize(part,name)) for name in MODELS]
        metrics.extend(evaluated)
        baseline=min([r for r in evaluated if r['model'] in ['median','nearest']],key=lambda r:r['group_mae_mms'])
        groups=sorted({r['group_id'] for r in part})
        for name in ['ridge','catboost_gpu']:
            model=next(r for r in evaluated if r['model']==name)
            deltas=np.array([np.mean([r['absolute_error_mms'] for r in part if r['model']==name and r['group_id']==g])-np.mean([r['absolute_error_mms'] for r in part if r['model']==baseline['model'] and r['group_id']==g]) for g in groups])
            samples=np.mean(rng.choice(deltas,size=(2000,len(deltas)),replace=True),axis=1)
            improvement=1-model['group_mae_mms']/baseline['group_mae_mms']
            comparisons.append(dict(evaluation=evaluation,model=name,reference=baseline['model'],relative_mae_improvement=improvement,
                passes_relative_gate=bool(improvement>=.2),group_delta_percentiles_mms=np.quantile(samples,[.025,.975]).tolist(),
                interpretation='Exploratory error resampling, not a prediction interval or independent CV significance test.'))
    write_csv(OUT/'metrics.csv',metrics)
    write_json(OUT/'comparisons.json',comparisons)
    for path,expected in raw_hashes.items(): assert sha(ROOT/path)==expected
    assert sha(DATA/'candidate_training.csv')==P['candidate_sha256']
    verification=dict(passed=True,source_files_unchanged=len(raw_hashes),dataset_unchanged=True,group_overlap=0,
        row_overlap=0,complete_heldout_coverage=True,gpu_fits=sum(f['execution']=='GPU:0' for f in fits),
        gpu_params_verified=True,model_reload_predictions_verified=True,lunar_labels_used=0,review_rows_used=0,
        feature_preprocessing_training_only=True,hyperparameter_search=False,prediction_rows=len(predictions))
    write_json(OUT/'verification.json',verification)
    report=dict(run_id=P['run_id'],dataset=P['dataset'],features=FEATURES,protocol=P,environment=env,
                evaluations=metrics,comparisons=comparisons,verification=verification,predictions=predictions,
                gpu_monitor_samples=len(monitor.samples),completed_utc=datetime.now(timezone.utc).isoformat(),
                limitations=P['limits'])
    write_json(OUT/'results.json',report)
    public=ROOT/'web/public/training/round1';public.mkdir(parents=True,exist_ok=True)
    for name in ['heldout_predictions.csv','metrics.csv','protocol.json','verification.json','splits.json']:
        shutil.copyfile(OUT/name,public/name)
    report['downloads']=[dict(name=name,sha256=sha(public/name)) for name in ['heldout_predictions.csv','metrics.csv','protocol.json','verification.json','splits.json']]
    write_json(ROOT/'web/src/data/training-round1.json',report)
    write_json(OUT/'artifact-manifest.json',{p.relative_to(OUT).as_posix():sha(p) for p in OUT.rglob('*') if p.is_file() and p.name!='artifact-manifest.json'})
    print(json.dumps(dict(metrics=metrics,comparisons=comparisons,verification=verification),indent=2),flush=True)

if __name__=='__main__': main()
