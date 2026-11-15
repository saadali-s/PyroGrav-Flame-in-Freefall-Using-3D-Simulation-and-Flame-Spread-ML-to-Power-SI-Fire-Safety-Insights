"""Independent numerical reconstruction; no training runner imports or refits."""
from pathlib import Path
from collections import Counter, defaultdict
import csv
import hashlib
import json
import math
import numpy as np
from catboost import CatBoostRegressor

ROOT=Path(__file__).resolve().parents[3]
RUN=ROOT/'backend/training/runs/round2-2026-11-14'
DATA=ROOT/'backend/training/datasets/pmma-v1'
def load(name): return json.loads((RUN/name).read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def csvrows(p): return list(csv.DictReader(p.open(encoding='utf8')))
def close(a,b): assert math.isclose(float(a),float(b),rel_tol=1e-8,abs_tol=1e-11),(a,b)
protocol=load('protocol.json')
for name,h in load('artifact-manifest.json').items(): assert sha(RUN/name)==h,name
assert sha(DATA/'candidate_training.csv')==protocol['candidate_sha256']
assert sha(RUN/'splits.json')==protocol['split_sha256']
assert sha(RUN/'protocol.json')==load('environment.json')['protocol_sha256']
assert sha(RUN/'training-script-as-run.py')==load('environment.json')['script_sha256']
assert sha(ROOT/'backend/training/train_round2.py')==load('reporting-recovery.json')['corrected_script_sha256']
sources={r['observation_id']:r for r in csvrows(DATA/'candidate_training.csv')}
predictions=csvrows(RUN/'heldout_predictions.csv')
folds={f"{s['evaluation']}--{s['held_out_group']}":s for s in load('splits.json')}
assert len(predictions)==504 and len(folds)==37
features=['oxygen_pct','diameter_mm','opposed_flow_cms']
def raw(rows): return np.array([[float(r[f]) for f in features] for r in rows])
def basis(x):
    return np.array([[o-19,1/d,math.log(v),(o-19)*math.log(v)] for o,d,v in x])
checked=0
for fold,split in folds.items():
    assert not set(split['train_ids'])&set(split['test_ids'])
    assert not set(split['train_groups'])&set(split['test_groups'])
    train=[sources[i] for i in split['train_ids']];test=[sources[i] for i in split['test_ids']]
    assert sorted({r['group_id'] for r in train})==split['train_groups']
    assert sorted({r['group_id'] for r in test})==split['test_groups']
    x=raw(train);xt=raw(test);y=np.log([float(r['rate_mms']) for r in train])
    counts=Counter(r['group_id'] for r in train)
    w=np.array([1/counts[r['group_id']] for r in train]);w/=w.mean()
    for model,settings in protocol['models'].items():
        smear=1.
        if model=='log_catboost_gpu':
            fitted=CatBoostRegressor();fitted.load_model(str(RUN/'models'/f'{fold}.cbm'))
            assert fitted.get_all_params()['task_type']=='GPU'
            logs=fitted.predict(xt)
        else:
            xx,tt=(x,xt) if settings['features']=='raw' else (basis(x),basis(xt))
            mean=np.average(xx,axis=0,weights=w)
            scale=np.sqrt(np.average((xx-mean)**2,axis=0,weights=w));scale[scale==0]=1
            z=(xx-mean)/scale;zt=(tt-mean)/scale
            ym=np.average(y,weights=w)
            coeff=np.linalg.solve(z.T@(w[:,None]*z)+np.eye(z.shape[1])*settings['alpha'],z.T@(w*(y-ym)))
            logs=zt@coeff+ym
            if settings['smearing']: smear=np.average(np.exp(y-(z@coeff+ym)),weights=w)
        selected={r['observation_id']:r for r in predictions if r['fold_id']==fold and r['model']==model}
        assert set(selected)==set(split['test_ids'])
        for src,log in zip(test,logs):
            row=selected[src['observation_id']];value=math.exp(log)*smear;target=float(src['rate_mms'])
            assert value>0 and math.isfinite(value)
            close(row['observed_mms'],target);close(row['predicted_log_rate'],log);close(row['smear_factor'],smear)
            close(row['predicted_mms'],value);close(row['raw_predicted_mms'],value)
            close(row['error_mms'],value-target);close(row['absolute_error_mms'],abs(value-target))
            assert row['group_id']==src['group_id']
            outside=[f for j,f in enumerate(features) if float(src[f])<x[:,j].min() or float(src[f])>x[:,j].max()]
            assert row['outside_features']==';'.join(outside)
            assert (row['outside_training_box']=='True')==bool(outside)
            checked+=1
scores=csvrows(RUN/'metrics.csv')
for score in scores:
    part=[r for r in predictions if r['evaluation']==score['evaluation'] and r['model']==score['model']]
    assert len(part)==len({r['observation_id'] for r in part})==int(score['rows'])
    groups=defaultdict(list)
    for r in part:groups[r['group_id']].append(float(r['predicted_mms'])-float(r['observed_mms']))
    close(score['groups'],len(groups))
    close(score['group_mae_mms'],np.mean([np.mean(np.abs(es)) for es in groups.values()]))
    close(score['group_rmse_mms'],np.sqrt(np.mean([np.mean(np.square(es)) for es in groups.values()])))
    errors=np.array([float(r['error_mms']) for r in part]);targets=np.array([float(r['observed_mms']) for r in part])
    close(score['row_mae_mms'],np.mean(abs(errors)));close(score['row_rmse_mms'],np.sqrt(np.mean(errors**2)))
    close(score['row_r2'],1-sum(errors**2)/sum((targets-targets.mean())**2))
old=json.loads((ROOT/'backend/training/runs/round1-2026-11-14/results.json').read_text())
for comparison in load('comparisons.json'):
    current=next(s for s in scores if s['evaluation']==comparison['evaluation'] and s['model']==comparison['model'])
    previous=next(s for s in old['evaluations'] if s['evaluation']==comparison['evaluation'] and s['model']==comparison['reference'])
    close(comparison['relative_mae_improvement'],1-float(current['group_mae_mms'])/previous['group_mae_mms'])
for g in load('results.json')['gates']:
    get=lambda e,m:next(float(s['group_mae_mms']) for s in scores if s['evaluation']==e and s['model']==m)
    oldget=lambda e,m:next(s['group_mae_mms'] for s in old['evaluations'] if s['evaluation']==e and s['model']==m)
    assert g['transfer_20pct_gate']==(get('earth_to_microgravity',g['model'])<=.8*oldget('earth_to_microgravity','nearest'))
    assert g['improves_both_within_domains']==all(get(e,g['model'])<oldget(e,'ridge') for e in ['earth_logo','microgravity_logo'])
rawfiles=json.loads((DATA/'raw_data_manifest.json').read_text())
for name,h in {**rawfiles,**load('round1-hashes.json')}.items(): assert sha(ROOT/name)==h,name
samples=[r['output'].split(',') for r in load('gpu-monitor.json') if r.get('returncode')==0]
fits=load('fit-log.json')
output=dict(passed=True,predictions_reconstructed=checked,splits_checked=len(folds),gpu_models_reloaded=37,
    metrics_recomputed=len(scores),comparisons_checked=48,gates_checked=4,raw_files_unchanged=len(rawfiles),round1_artifacts_unchanged=len(load('round1-hashes.json')),
    gpu_samples=len(samples),sampled_peak_gpu_utilization_pct=max(int(s[-2]) for s in samples),sampled_peak_memory_mib=max(int(s[-1]) for s in samples),
    gpu_fit_check_save_seconds=sum(f['seconds'] for f in fits if f['execution']=='GPU:0'),
    limits='Numerical reproduction is not independent experimental validation; Round 2 reuses development folds.')
(ROOT/'backend/training/reports/round2-independent-verification.json').write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps(output,indent=2))
