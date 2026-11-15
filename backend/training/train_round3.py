"""One fixed physics-feature/oxygen-prior ablation; all regression solves on Blackwell."""
from pathlib import Path
from datetime import datetime, timezone
import itertools
import json
import shutil
import time
import numpy as np
import torch
from sklearn.preprocessing import StandardScaler
import train_round1 as base

ROOT, DATA = base.ROOT, base.DATA
PROTOCOL = ROOT/'backend/training/round3_protocol.json'
P = json.loads(PROTOCOL.read_text())
OUT = ROOT/'backend/training/runs'/P['run_id']

def features(rows, kappa):
    raw, _ = base.arrays(rows)
    gravity = np.array([1.0 if r['environment']=='earth' else 0.0 for r in rows])
    u = 100*((raw[:,2]/100)**4+(9.80665*gravity*kappa*raw[:,1]/2000)**2)**.25
    o = raw[:,0]-19
    return np.column_stack([o, 1/raw[:,1], np.log(u), o*np.log(u)]), u

def fit(train, test, settings):
    x, u = features(train, settings['kappa']); xt, ut = features(test, settings['kappa'])
    w = base.weights(train); y = np.log(base.arrays(train)[1]); ym = np.average(y,weights=w)
    scaler = StandardScaler().fit(x,sample_weight=w)
    z = scaler.transform(x); zt = scaler.transform(xt)
    so = np.sqrt(np.average((x[:,0]-np.average(x[:,0],weights=w))**2,weights=w))
    d = np.array([[so/scaler.scale_[0],0,0,so*lv/scaler.scale_[3]] for lv in [np.log(u.min()),np.log(u.max())]])
    t = lambda a: torch.as_tensor(a,dtype=torch.float64,device='cuda:0')
    zz, ww, yy, dd = t(z), t(w), t(y-ym), t(d)
    a = zz.T@(ww[:,None]*zz)+torch.eye(4,dtype=torch.float64,device='cuda:0')
    rhs = zz.T@(ww*yy)
    strength = settings['penalty']*len(train)/2
    candidates = []
    for active in itertools.product([False,True],repeat=2) if strength else [(False,False)]:
        da = dd[list(active)]
        b = torch.linalg.solve(a+strength*(da.T@da),rhs)
        signs = (dd@b).cpu().numpy()
        if strength and any((s>1e-9 if on else s<-1e-9) for s,on in zip(signs,active)): continue
        violation = torch.minimum(dd@b,torch.zeros(2,dtype=torch.float64,device='cuda:0'))
        loss = torch.sum(ww*(zz@b-yy)**2)+torch.sum(b*b)+strength*torch.sum(violation**2)
        grad = 2*(a@b-rhs+strength*dd.T@violation)
        assert torch.max(torch.abs(grad)).item()<1e-7
        candidates.append((loss.item(),b,signs))
    assert candidates, 'No consistent convex active set; stop.'
    _, b, signs = min(candidates,key=lambda c:c[0])
    pred = torch.exp(t(zt)@b+ym).cpu().numpy()
    assert np.isfinite(pred).all() and (pred>0).all()
    artifact = dict(mean=scaler.mean_.tolist(),scale=scaler.scale_.tolist(),coefficients=b.cpu().tolist(),
                    intercept=float(ym),constraint_matrix=d.tolist(),constraint_values=signs.tolist(),
                    active_violations=int((signs<-1e-9).sum()),penalty_strength=strength,
                    mixed_flow_train_range_cms=[float(u.min()),float(u.max())],settings=settings)
    return pred, ut, artifact

def main():
    rows=base.read_rows(); indexed={r['observation_id']:r for r in rows}
    assert base.sha(DATA/'candidate_training.csv')==P['candidate_sha256']
    r1=ROOT/'backend/training/runs/round1-2026-11-14'
    assert base.sha(r1/'splits.json')==P['round1_split_sha256']
    assert torch.cuda.is_available(), 'No CUDA fallback.'
    gpu=torch.cuda.get_device_name(0);assert 'Blackwell' in gpu
    assert not OUT.exists(), f'Refusing overwrite {OUT}'
    preserved={p.relative_to(ROOT).as_posix():base.sha(p) for rd in [r1,ROOT/'backend/training/runs/round2-2026-11-14'] for p in rd.rglob('*') if p.is_file()}
    raw=json.loads((DATA/'raw_data_manifest.json').read_text())
    for folder in ['round2_followup_2026-11-14','round3_followup_2026-11-14']:
        raw.update({p.relative_to(ROOT).as_posix():base.sha(p) for p in (ROOT/'backend/data/raw_papers'/folder).glob('*.pdf')})
    for path,h in {**preserved,**raw}.items():assert base.sha(ROOT/path)==h
    OUT.mkdir(parents=True)
    shutil.copyfile(PROTOCOL,OUT/'protocol.json');shutil.copyfile(__file__,OUT/'training-script.py')
    base.write_json(OUT/'preserved-hashes.json',preserved);base.write_json(OUT/'raw-hashes.json',raw)
    base.write_json(OUT/'environment.json',dict(gpu=gpu,torch=torch.__version__,cuda=torch.version.cuda,dtype='float64',device='cuda:0',
        started_utc=datetime.now(timezone.utc).isoformat(),protocol_sha256=base.sha(PROTOCOL),script_sha256=base.sha(Path(__file__))))
    splits=json.loads((r1/'splits.json').read_text())
    for evaluation, subset in [('pooled_logo',rows),('pooled_strict_units_logo',[r for r in rows if 'U01' not in r['review_flags']])]:
        for group in sorted({r['group_id'] for r in subset}):
            train=[r for r in subset if r['group_id']!=group];test=[r for r in subset if r['group_id']==group]
            splits.append(dict(evaluation=evaluation,held_out_group=group,train_ids=[r['observation_id'] for r in train],
                test_ids=[r['observation_id'] for r in test],train_groups=sorted({r['group_id'] for r in train}),test_groups=[group]))
    assert len(splits)==92
    base.write_json(OUT/'splits.json',splits)
    predictions=[];fits=[]
    with base.Monitor() as monitor:
        for idx,sp in enumerate(splits,1):
            train=[indexed[i] for i in sp['train_ids']];test=[indexed[i] for i in sp['test_ids']]
            assert not set(sp['train_ids'])&set(sp['test_ids']) and not set(sp['train_groups'])&set(sp['test_groups'])
            fold=sp['evaluation']+'--'+sp['held_out_group'];rawx,y=base.arrays(train);rawt,_=base.arrays(test);w=base.weights(train)
            scaler=StandardScaler().fit(rawx,sample_weight=w);z=scaler.transform(rawx);zt=scaler.transform(rawt)
            distances=((zt[:,None]-z[None,:])**2).sum(axis=2)
            nearest=np.array([np.average(y[np.isclose(v,v.min(),rtol=1e-10,atol=1e-12)],weights=w[np.isclose(v,v.min(),rtol=1e-10,atol=1e-12)]) for v in distances])
            for name in ['median','nearest',*P['models']]:
                start=time.perf_counter();artifact=None;ut=rawt[:,2]
                if name=='median':pred=np.full(len(test),base.weighted_median(y,w))
                elif name=='nearest':pred=nearest
                else:pred,ut,artifact=fit(train,test,P['models'][name])
                fits.append(dict(fold_id=fold,model=name,train_rows=len(train),test_rows=len(test),seconds=time.perf_counter()-start,
                    execution='CUDA:0' if artifact else 'CPU',artifact=artifact))
                for r,value,u in zip(test,pred,ut):
                    outside=[f for j,f in enumerate(base.FEATURES) if r[f]<rawx[:,j].min() or r[f]>rawx[:,j].max()]
                    predictions.append(dict(evaluation=sp['evaluation'],fold_id=fold,model=name,observation_id=r['observation_id'],group_id=r['group_id'],
                        environment=r['environment'],observed_mms=r['rate_mms'],predicted_mms=float(value),raw_predicted_mms=float(value),
                        error_mms=float(value)-r['rate_mms'],absolute_error_mms=abs(float(value)-r['rate_mms']),
                        outside_training_box=bool(outside),outside_features=';'.join(outside),unit_inference='U01' in r['review_flags'],
                        derived_flow_cms=float(u),flow_is_assumed_transform=name in P['models'] and P['models'][name]['kappa']>0))
            base.write_json(OUT/'fit-log.json',fits)
            if idx%10==0 or idx==92:print(f'{idx}/92 folds completed',flush=True)
    base.write_json(OUT/'gpu-monitor.json',monitor.samples)
    assert len(predictions)==1771
    base.write_csv(OUT/'heldout_predictions.csv',predictions)
    metrics=[]
    for evaluation in P['evaluations']:
        part=[r for r in predictions if r['evaluation']==evaluation]
        for subset in ['all']+(['earth','microgravity'] if evaluation.startswith('pooled') else []):
            chunk=[r for r in part if subset=='all' or r['environment']==subset]
            for name in ['median','nearest',*P['models']]:metrics.append(dict(evaluation=evaluation,subset=subset,**base.summarize(chunk,name)))
    base.write_csv(OUT/'metrics.csv',metrics)
    comparisons=[];rng=np.random.default_rng(P['seed'])
    transfer=[r for r in predictions if r['evaluation']=='earth_to_microgravity']
    for name in P['models']:
        for reference in ['nearest','geometry_control','mixed_3p5']:
            current=[r for r in transfer if r['model']==name];ref=[r for r in transfer if r['model']==reference]
            groups=sorted({r['group_id'] for r in current})
            deltas=np.array([np.mean([r['absolute_error_mms'] for r in current if r['group_id']==g])-np.mean([r['absolute_error_mms'] for r in ref if r['group_id']==g]) for g in groups])
            refmae=base.summarize(ref,reference)['group_mae_mms'];mae=base.summarize(current,name)['group_mae_mms']
            boot=rng.choice(deltas,(2000,len(groups)),replace=True).mean(axis=1)
            comparisons.append(dict(model=name,reference=reference,relative_mae_improvement=1-mae/refmae,
                groups_improved=int((deltas<0).sum()),groups=len(groups),group_delta_percentiles_mms=np.quantile(boot,[.025,.975]).tolist(),
                exploratory_gate=mae<refmae,twenty_percent_gate=mae<=.8*refmae))
    base.write_json(OUT/'comparisons.json',comparisons)
    for path,h in {**preserved,**raw}.items():assert base.sha(ROOT/path)==h
    verification=dict(passed=True,cuda_regression_fits=sum(f['execution']=='CUDA:0' for f in fits),baseline_fits=sum(f['execution']=='CPU' for f in fits),
        folds=len(splits),prediction_records=len(predictions),raw_files_unchanged=len(raw),prior_artifacts_unchanged=len(preserved),
        compatible_lunar_rows=0,added_training_rows=0,adaptive_reuse=True,training_only_transforms=True)
    base.write_json(OUT/'verification.json',verification)
    report=dict(run_id=P['run_id'],protocol=P,evaluations=metrics,comparisons=comparisons,verification=verification,
        predictions=predictions,penalty_active_fits=sum(f['artifact'] is not None and f['artifact']['settings']['penalty']>0 and f['artifact']['active_violations']>0 for f in fits))
    base.write_json(OUT/'results.json',report)
    base.write_json(OUT/'artifact-manifest.json',{p.relative_to(OUT).as_posix():base.sha(p) for p in OUT.rglob('*') if p.is_file() and p.name!='artifact-manifest.json'})
    print(json.dumps(dict(verification=verification,transfer=[m for m in metrics if m['evaluation']=='earth_to_microgravity'],penalty_active_fits=report['penalty_active_fits']),indent=2))

if __name__=='__main__':main()
