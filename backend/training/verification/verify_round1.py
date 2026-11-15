"""Independent reconstruction of held-out predictions/metrics; no model fitting."""
from pathlib import Path
from collections import defaultdict, Counter
import csv
import hashlib
import json
import math
import numpy as np
from catboost import CatBoostRegressor

ROOT=Path(__file__).resolve().parents[3]
RUN=ROOT/'backend/training/runs/round1-2026-11-14'
DATA=ROOT/'backend/training/datasets/pmma-v1'

def load(name): return json.loads((RUN/name).read_text(encoding='utf8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read_csv(path): return list(csv.DictReader(path.open(encoding='utf8')))

protocol=load('protocol.json')
assert sha(DATA/'candidate_training.csv')==protocol['candidate_sha256']
assert sha(RUN/'protocol.json')==load('environment.json')['protocol_sha256']
assert sha(ROOT/'backend/training/train_round1.py')==load('environment.json')['script_sha256']
for name,expected in load('artifact-manifest.json').items(): assert sha(RUN/name)==expected,name
sources={r['observation_id']:r for r in read_csv(DATA/'candidate_training.csv')}
predictions=read_csv(RUN/'heldout_predictions.csv')
features=protocol['features']
folds={f"{s['evaluation']}--{s['held_out_group']}":s for s in load('splits.json')}
by_fold=defaultdict(list)
for row in predictions:
    assert row['observation_id'] in sources
    original=sources[row['observation_id']]
    assert float(row['observed_mms'])==float(original['rate_mms'])
    assert row['group_id']==original['group_id']
    by_fold[row['fold_id']].append(row)
assert len(folds)==37 and len(predictions)==504
rechecked=0
for fold, split in folds.items():
    assert not set(split['train_ids']) & set(split['test_ids'])
    assert not set(split['train_groups']) & set(split['test_groups'])
    train=[sources[i] for i in split['train_ids']]
    test=[sources[i] for i in split['test_ids']]
    assert sorted({r['group_id'] for r in train})==split['train_groups']
    assert sorted({r['group_id'] for r in test})==split['test_groups']
    x=np.array([[float(r[k]) for k in features] for r in train])
    xt=np.array([[float(r[k]) for k in features] for r in test])
    y=np.array([float(r['rate_mms']) for r in train])
    counts=Counter(r['group_id'] for r in train)
    weights=np.array([1/counts[r['group_id']] for r in train]);weights/=weights.mean()
    mean=np.average(x,axis=0,weights=weights)
    variance=np.average((x-mean)**2,axis=0,weights=weights)
    scale=np.sqrt(variance);scale[scale==0]=1
    z=(x-mean)/scale;zt=(xt-mean)/scale
    y_mean=np.average(y,weights=weights)
    coefficients=np.linalg.solve(z.T@(weights[:,None]*z)+np.eye(len(features))*protocol['models']['ridge']['alpha'],z.T@(weights*(y-y_mean)))
    ridge=zt@coefficients+y_mean
    nearest=[]
    for point in zt:
        distances=np.sum((z-point)**2,axis=1)
        tied=np.isclose(distances,distances.min(),rtol=1e-10,atol=1e-12)
        nearest.append(np.average(y[tied],weights=weights[tied]))
    # A weighted median may be nonunique at an exact half-weight boundary.
    # Verify its defining optimality condition independently, avoiding a different
    # floating-point summation order arbitrarily selecting the other endpoint.
    median_rows=[r for r in by_fold[fold] if r['model']=='median']
    median=float(median_rows[0]['raw_predicted_mms'])
    assert all(float(r['raw_predicted_mms'])==median for r in median_rows)
    assert weights[y<median].sum()<=weights.sum()/2+1e-10
    assert weights[y>median].sum()<=weights.sum()/2+1e-10
    gpu=CatBoostRegressor();gpu.load_model(str(RUN/'models'/f'{fold}.cbm'))
    assert gpu.get_all_params()['task_type']=='GPU'
    expected={'median':np.full(len(test),median),'nearest':nearest,'ridge':ridge,'catboost_gpu':gpu.predict(xt)}
    for name, values in expected.items():
        actual={r['observation_id']:r for r in by_fold[fold] if r['model']==name}
        assert set(actual)==set(split['test_ids'])
        for original, prediction in zip(test,values):
            row=actual[original['observation_id']]
            assert math.isclose(float(row['raw_predicted_mms']),float(prediction),rel_tol=1e-8,abs_tol=1e-10),(fold,name)
            clipped=max(0,float(prediction));target=float(original['rate_mms'])
            assert math.isclose(float(row['predicted_mms']),clipped,abs_tol=1e-10)
            assert math.isclose(float(row['absolute_error_mms']),abs(clipped-target),abs_tol=1e-10)
            outside=[f for j,f in enumerate(features) if float(original[f])<x[:,j].min() or float(original[f])>x[:,j].max()]
            assert row['outside_features']==';'.join(outside)
            rechecked+=1
for score in read_csv(RUN/'metrics.csv'):
    selected=[r for r in predictions if r['evaluation']==score['evaluation'] and r['model']==score['model']]
    grouped=defaultdict(list)
    for r in selected:grouped[r['group_id']].append(float(r['predicted_mms'])-float(r['observed_mms']))
    mae=sum(sum(abs(e) for e in es)/len(es) for es in grouped.values())/len(grouped)
    rmse=math.sqrt(sum(sum(e*e for e in es)/len(es) for es in grouped.values())/len(grouped))
    assert math.isclose(mae,float(score['group_mae_mms']),abs_tol=1e-12)
    assert math.isclose(rmse,float(score['group_rmse_mms']),abs_tol=1e-12)
raw=json.loads((DATA/'raw_data_manifest.json').read_text(encoding='utf8'))
for path,expected in raw.items():assert sha(ROOT/path)==expected
monitor=load('gpu-monitor.json')
samples=[r['output'].split(',') for r in monitor if r.get('returncode')==0]
result=dict(passed=True,rechecked_predictions=rechecked,checked_splits=len(folds),gpu_models_reloaded=37,
            metrics_recomputed=16,source_files_unchanged=len(raw),gpu_samples=len(samples),
            sampled_peak_gpu_utilization_pct=max(int(s[-2]) for s in samples),sampled_peak_memory_mib=max(int(s[-1]) for s in samples),
            median_check='Verified weighted-median defining inequalities; an exact half-weight boundary may admit multiple equally valid medians.',
            limits='Checks reproducibility and internal consistency, not independent experimental replication or lunar validity.')
(ROOT/'backend/training/reports/round1-independent-verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print(json.dumps(result,indent=2))
