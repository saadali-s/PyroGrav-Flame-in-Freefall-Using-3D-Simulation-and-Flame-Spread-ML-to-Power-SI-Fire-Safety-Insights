"""Frozen three-variant curved-flow test. No modification of earlier runs."""
import json
import shutil
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import torch
from sklearn.preprocessing import StandardScaler
import train_round1 as base

ROOT=base.ROOT
PROTOCOL=ROOT/'backend/training/round4_protocol.json'
P=json.loads(PROTOCOL.read_text())
OUT=ROOT/'backend/training/runs'/P['run_id']

def features(rows, quadratic):
    a,_=base.arrays(rows)
    g=np.array([r['environment']=='earth' for r in rows])
    u=100*((a[:,2]/100)**4+(9.80665*g*3.5*a[:,1]/2000)**2)**.25
    o=a[:,0]-19; x=np.column_stack([o,1/a[:,1],np.log(u),o*np.log(u)])
    return (np.column_stack([x,-np.log(u)**2]) if quadratic else x),u

def fit(train,test,model):
    x,u=features(train,model!='mixed_linear_control');xt,ut=features(test,model!='mixed_linear_control')
    w=base.weights(train);y=np.log(base.arrays(train)[1]);mean_y=float(np.average(y,weights=w))
    scaler=StandardScaler().fit(x,sample_weight=w);z=scaler.transform(x);zt=scaler.transform(xt)
    t=lambda a:torch.as_tensor(a,dtype=torch.float64,device='cuda:0')
    zz,ww,yy=t(z),t(w),t(y-mean_y)
    A=zz.T@(ww[:,None]*zz)+torch.eye(x.shape[1],device='cuda:0',dtype=torch.float64)
    rhs=zz.T@(ww*yy);b=torch.linalg.solve(A,rhs);active=False
    if model=='mixed_concave' and b[-1].item()<0:
        active=True;b=torch.cat([torch.linalg.solve(A[:-1,:-1],rhs[:-1]),t([0.])])
    gradient=A@b-rhs
    assert torch.max(torch.abs(gradient[:-1] if active else gradient)).item()<1e-8
    if active:assert gradient[-1].item()>=-1e-8
    pred=torch.exp(t(zt)@b+mean_y).cpu().numpy();assert np.isfinite(pred).all() and (pred>0).all()
    coef=b.cpu().numpy();physical=coef/scaler.scale_
    peak_log=float(physical[2]/(2*physical[-1])) if len(coef)==5 and physical[-1]>1e-12 else None
    return pred,ut,dict(mean=scaler.mean_.tolist(),scale=scaler.scale_.tolist(),coefficients=coef.tolist(),intercept=mean_y,
        constraint_active=active,peak_log_flow_at_19pct=peak_log,peak_status='concave maximum' if peak_log is not None else 'no concave maximum',
        train_flow_cms=[float(u.min()),float(u.max())],device='cuda:0',dtype='float64')

def main():
    rows=base.read_rows();index={r['observation_id']:r for r in rows}
    assert base.sha(base.DATA/'candidate_training.csv')==P['candidate_sha256']
    assert torch.cuda.is_available() and 'Blackwell' in torch.cuda.get_device_name(0),'No CUDA fallback'
    assert not OUT.exists(),'Refusing overwrite'
    protected={p.relative_to(ROOT).as_posix():base.sha(p) for folder in ['backend/data','backend/training/runs','backend/physics/runs'] for p in (ROOT/folder).rglob('*') if p.is_file()}
    splits=[s for s in json.loads((ROOT/'backend/training/runs/round3-2026-11-14/splits.json').read_text()) if s['evaluation'] in P['evaluations']]
    assert len(splits)==56
    OUT.mkdir();shutil.copyfile(PROTOCOL,OUT/'protocol.json');shutil.copyfile(__file__,OUT/'training-script.py')
    shutil.copyfile(Path(base.__file__),OUT/'base-helper.py')
    base.write_json(OUT/'preserved-hashes.json',protected);base.write_json(OUT/'splits.json',splits)
    base.write_json(OUT/'environment.json',dict(gpu=torch.cuda.get_device_name(0),torch=torch.__version__,cuda=torch.version.cuda,device='cuda:0',dtype='float64',started_utc=datetime.now(timezone.utc).isoformat(),protocol_sha256=base.sha(PROTOCOL)))
    predictions=[];fits=[]
    with base.Monitor() as monitor:
        for i,s in enumerate(splits,1):
            train=[index[k] for k in s['train_ids']];test=[index[k] for k in s['test_ids']]
            assert not set(s['train_groups'])&set(s['test_groups'])
            fold=s['evaluation']+'--'+s['held_out_group']
            for model in P['models']:
                pred,u,artifact=fit(train,test,model);fits.append(dict(fold_id=fold,model=model,artifact=artifact))
                for r,v,flow in zip(test,pred,u):
                    predictions.append(dict(evaluation=s['evaluation'],fold_id=fold,model=model,observation_id=r['observation_id'],group_id=r['group_id'],environment=r['environment'],observed_mms=r['rate_mms'],predicted_mms=float(v),raw_predicted_mms=float(v),error_mms=float(v)-r['rate_mms'],absolute_error_mms=abs(float(v)-r['rate_mms']),outside_training_box=bool(flow<artifact['train_flow_cms'][0] or flow>artifact['train_flow_cms'][1]),unit_inference='U01' in r['review_flags']))
            if i%10==0 or i==56:print(f'{i}/56 folds, {i*3} CUDA fits',flush=True)
    base.write_json(OUT/'gpu-monitor.json',monitor.samples);base.write_json(OUT/'fit-log.json',fits)
    metrics=[]
    for ev in P['evaluations']:
        for subset in ['all']+(['earth','microgravity'] if ev.startswith('pooled') else []):
            part=[r for r in predictions if r['evaluation']==ev and (subset=='all' or r['environment']==subset)]
            for model in P['models']:metrics.append(dict(evaluation=ev,subset=subset,**base.summarize(part,model)))
    base.write_csv(OUT/'heldout_predictions.csv',predictions);base.write_csv(OUT/'metrics.csv',metrics)
    def score(model,subset):return next(m['group_mae_mms'] for m in metrics if m['evaluation']=='pooled_logo' and m['subset']==subset and m['model']==model)
    gates=[dict(model=m,iss_gain=1-score(m,'microgravity')/.010490585024313702,earth_gain=1-score(m,'earth')/.013327813827982137,passed=score(m,'microgravity')<=.9*.010490585024313702 and score(m,'earth')<=.013327813827982137) for m in P['models']]
    for path,h in protected.items():assert base.sha(ROOT/path)==h,path
    verification=dict(passed=True,cuda_fits=len(fits),folds=len(splits),predictions=len(predictions),preserved_files=len(protected),added_rows=0,compatible_lunar_labels=0)
    report=dict(protocol=P,metrics=metrics,gates=gates,predictions=predictions,verification=verification)
    base.write_json(OUT/'results.json',report)
    base.write_json(OUT/'manifest.json',{p.name:base.sha(p) for p in OUT.iterdir() if p.is_file()})
    print(json.dumps(dict(verification=verification,gates=gates,metrics=metrics),indent=2))

if __name__=='__main__':main()
