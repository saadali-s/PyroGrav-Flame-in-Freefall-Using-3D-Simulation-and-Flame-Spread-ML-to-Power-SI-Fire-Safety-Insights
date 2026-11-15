"""Fixed log-target/feature ablation. Preserve Round 1; require Blackwell GPU for CatBoost."""
from pathlib import Path
from datetime import datetime, timezone
import json
import shutil
import subprocess
import time
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from catboost import CatBoostRegressor
from catboost.utils import get_gpu_device_count
import train_round1 as base

ROOT=base.ROOT
DATA=base.DATA
R1=ROOT/'backend/training/runs/round1-2026-11-14'
PROTOCOL=ROOT/'backend/training/round2_protocol.json'
P=json.loads(PROTOCOL.read_text(encoding='utf8'))
OUT=ROOT/'backend/training/runs'/P['run_id']

def feature_matrix(rows, kind):
    raw,_=base.arrays(rows)
    if kind=='raw': return raw
    o=raw[:,0]-19; inv=1/raw[:,1]; flow=np.log(raw[:,2])
    return np.column_stack([o,inv,flow,o*flow])

def main():
    rows=base.read_rows(); indexed={r['observation_id']:r for r in rows}
    assert base.sha(DATA/'candidate_training.csv')==P['candidate_sha256']
    assert base.sha(R1/'splits.json')==P['split_sha256']
    original_hashes={p.relative_to(ROOT).as_posix():base.sha(p) for p in R1.rglob('*') if p.is_file()}
    raw_hashes=json.loads((DATA/'raw_data_manifest.json').read_text(encoding='utf8'))
    for path,expected in raw_hashes.items(): assert base.sha(ROOT/path)==expected
    assert get_gpu_device_count()>=1,'GPU unavailable; no CPU fallback.'
    assert not OUT.exists(),f'Refusing overwrite: {OUT}'
    OUT.mkdir(parents=True);(OUT/'models').mkdir()
    shutil.copyfile(PROTOCOL,OUT/'protocol.json');shutil.copyfile(R1/'splits.json',OUT/'splits.json')
    base.write_json(OUT/'round1-hashes.json',original_hashes)
    env=json.loads((R1/'environment.json').read_text(encoding='utf8'))
    env.update(started_utc=datetime.now(timezone.utc).isoformat(),protocol_sha256=base.sha(PROTOCOL),
               script_sha256=base.sha(Path(__file__)),round1_helper_sha256=base.sha(ROOT/'backend/training/train_round1.py'),
               gpu=subprocess.run(['nvidia-smi','--query-gpu=index,name,driver_version,memory.total','--format=csv,noheader'],capture_output=True,text=True,check=True).stdout.strip())
    base.write_json(OUT/'environment.json',env)
    splits=json.loads((OUT/'splits.json').read_text(encoding='utf8'))
    fits=[];predictions=[]
    with base.Monitor() as monitor:
        for index,split in enumerate(splits,1):
            train=[indexed[i] for i in split['train_ids']];test=[indexed[i] for i in split['test_ids']]
            assert not set(split['train_groups'])&set(split['test_groups'])
            assert not set(split['train_ids'])&set(split['test_ids'])
            fold=f"{split['evaluation']}--{split['held_out_group']}"
            raw,_=base.arrays(train);_,y=base.arrays(train);w=base.weights(train);log_y=np.log(y)
            for name,settings in P['models'].items():
                start=time.perf_counter();x=feature_matrix(train,settings['features']);xt=feature_matrix(test,settings['features'])
                smear=1.0
                if name=='log_catboost_gpu':
                    model=CatBoostRegressor(**settings['params']);model.fit(x,log_y,sample_weight=w)
                    assert model.get_all_params()['task_type']=='GPU'
                    log_pred=model.predict(xt)
                    path=OUT/'models'/f'{fold}.cbm';model.save_model(str(path))
                    loaded=CatBoostRegressor();loaded.load_model(str(path))
                    assert np.allclose(loaded.predict(xt),log_pred,rtol=1e-10,atol=1e-12)
                    artifact=dict(path=path.relative_to(ROOT).as_posix(),sha256=base.sha(path),params=model.get_all_params())
                else:
                    scaler=StandardScaler().fit(x,sample_weight=w)
                    z=scaler.transform(x);zt=scaler.transform(xt)
                    model=Ridge(alpha=settings['alpha']).fit(z,log_y,sample_weight=w)
                    log_pred=model.predict(zt)
                    if settings['smearing']:
                        smear=float(np.average(np.exp(log_y-model.predict(z)),weights=w))
                    artifact=dict(feature_kind=settings['features'],mean=scaler.mean_.tolist(),scale=scaler.scale_.tolist(),
                                  coefficients=model.coef_.tolist(),intercept=float(model.intercept_),smear_factor=smear)
                pred=np.exp(log_pred)*smear
                assert np.isfinite(pred).all() and (pred>0).all(), 'Stop rather than silently cap unstable predictions'
                fits.append(dict(fold_id=fold,model=name,train_rows=len(train),test_rows=len(test),seconds=time.perf_counter()-start,
                                 execution='GPU:0' if name=='log_catboost_gpu' else 'CPU',artifact=artifact))
                for r,log_value,value in zip(test,log_pred,pred):
                    outside=[f for j,f in enumerate(base.FEATURES) if r[f]<raw[:,j].min() or r[f]>raw[:,j].max()]
                    predictions.append(dict(evaluation=split['evaluation'],fold_id=fold,model=name,observation_id=r['observation_id'],
                        group_id=r['group_id'],environment=r['environment'],oxygen_pct=r['oxygen_pct'],diameter_mm=r['diameter_mm'],opposed_flow_cms=r['opposed_flow_cms'],
                        observed_mms=r['rate_mms'],raw_predicted_mms=float(value),predicted_mms=float(value),
                        predicted_log_rate=float(log_value),smear_factor=smear,error_mms=float(value)-r['rate_mms'],absolute_error_mms=abs(float(value)-r['rate_mms']),
                        outside_training_box=bool(outside),outside_features=';'.join(outside),unit_inference='U01' in r['review_flags']))
            base.write_json(OUT/'fit-log.json',fits)
            print(f'{index}/{len(splits)} completed {fold}',flush=True)
    base.write_json(OUT/'gpu-monitor.json',monitor.samples)
    assert len(predictions)==504
    base.write_csv(OUT/'heldout_predictions.csv',predictions)
    old=json.loads((R1/'results.json').read_text(encoding='utf8'))
    metrics=[];comparisons=[];subgroups=[];rng=np.random.default_rng(P['seed'])
    for evaluation in P['evaluations']:
        part=[r for r in predictions if r['evaluation']==evaluation]
        for name in P['models']:
            score=dict(evaluation=evaluation,**base.summarize(part,name));metrics.append(score)
            ids=[r['observation_id'] for r in part if r['model']==name]
            assert len(ids)==len(set(ids))
            old_scores=[r for r in old['evaluations'] if r['evaluation']==evaluation]
            nearest=min([r for r in old_scores if r['model'] in ['median','nearest']],key=lambda x:x['group_mae_mms'])
            refs=[nearest['model'],'ridge','catboost_gpu']
            for ref in refs:
                previous=[r for r in old['predictions'] if r['evaluation']==evaluation and r['model']==ref]
                current=[r for r in part if r['model']==name]
                assert {r['observation_id'] for r in previous}==set(ids)
                gs=sorted({r['group_id'] for r in current})
                deltas=np.array([np.mean([r['absolute_error_mms'] for r in current if r['group_id']==g])-np.mean([r['absolute_error_mms'] for r in previous if r['group_id']==g]) for g in gs])
                boot=np.mean(rng.choice(deltas,size=(2000,len(deltas)),replace=True),axis=1)
                ref_score=next(r for r in old_scores if r['model']==ref)
                comparisons.append(dict(evaluation=evaluation,model=name,reference_round=1,reference=ref,
                    relative_mae_improvement=1-score['group_mae_mms']/ref_score['group_mae_mms'],
                    group_delta_percentiles_mms=np.quantile(boot,[.025,.975]).tolist(),
                    groups_improved=int((deltas<0).sum()),groups=len(gs)))
            if evaluation=='earth_to_microgravity':
                for outside in [False,True]:
                    subset=[r for r in part if r['model']==name and r['outside_training_box']==outside]
                    if subset:subgroups.append(dict(outside_subset=outside,**base.summarize(subset,name)))
    base.write_csv(OUT/'metrics.csv',metrics);base.write_json(OUT/'comparisons.json',comparisons)
    base.write_json(OUT/'transfer-subgroups.json',subgroups)
    gates=[]
    for name in P['models']:
        within=[next(c for c in comparisons if c['model']==name and c['evaluation']==e and c['reference']=='ridge')['relative_mae_improvement']>0 for e in ['earth_logo','microgravity_logo']]
        transfer=next(c for c in comparisons if c['model']==name and c['evaluation']=='earth_to_microgravity' and c['reference']=='nearest')
        gates.append(dict(model=name,improves_both_within_domains=all(within),transfer_20pct_gate=transfer['relative_mae_improvement']>=.2,hackathon_lunar_ready=False))
    for path,expected in {**raw_hashes,**original_hashes}.items(): assert base.sha(ROOT/path)==expected
    assert base.sha(DATA/'candidate_training.csv')==P['candidate_sha256']
    verification=dict(passed=True,gpu_fits=sum(f['execution']=='GPU:0' for f in fits),same_splits_as_round1=True,
        round1_artifacts_unchanged=len(original_hashes),raw_files_unchanged=len(raw_hashes),dataset_unchanged=True,
        negative_predictions=0,heldout_records=len(predictions),group_overlap=0,lunar_labels_used=0,
        transforms_and_smearing_training_only=True,all_models_reported=True,adaptive_validation_reuse=True)
    base.write_json(OUT/'verification.json',verification)
    report=dict(run_id=P['run_id'],protocol=P,environment=env,evaluations=metrics,comparisons=comparisons,gates=gates,
        predictions=predictions,verification=verification,completed_utc=datetime.now(timezone.utc).isoformat())
    base.write_json(OUT/'results.json',report)
    public=ROOT/'web/public/training/round2';public.mkdir(parents=True,exist_ok=True)
    report['downloads']=[]
    for name in ['metrics.csv','heldout_predictions.csv','protocol.json','verification.json','splits.json','comparisons.json']:
        shutil.copyfile(OUT/name,public/name);report['downloads'].append(dict(name=name,sha256=base.sha(public/name)))
    base.write_json(ROOT/'web/src/data/training-round2.json',report)
    base.write_json(OUT/'artifact-manifest.json',{p.relative_to(OUT).as_posix():base.sha(p) for p in OUT.rglob('*') if p.is_file() and p.name!='artifact-manifest.json'})
    print(json.dumps(dict(metrics=metrics,gates=gates,verification=verification),indent=2),flush=True)

if __name__=='__main__':main()
