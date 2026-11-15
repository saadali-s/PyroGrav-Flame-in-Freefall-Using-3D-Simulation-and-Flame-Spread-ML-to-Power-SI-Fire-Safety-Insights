"""First fixed FLEX average-rate experiment, separate from PMMA."""
import json, shutil
from pathlib import Path
from datetime import datetime,timezone
from collections import Counter
import numpy as np
import torch
from catboost import CatBoostRegressor
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
import train_round1 as base
ROOT=base.ROOT;DATA=ROOT/'backend/training/datasets/flex-v1';PROTOCOL=ROOT/'backend/training/flex_protocol.json'
P=json.loads(PROTOCOL.read_text());OUT=ROOT/'backend/training/runs'/P['run_id']

def xrows(rows):
    return np.array([[float(r['fuel']=='Heptane'),np.log(r['pressure_mmhg']),r['o2'],r['co2'],r['he'],np.log(r['diameter_mm'])] for r in rows])

def main():
    dataset=json.loads((DATA/'data.json').read_text());rows=[r for r in dataset['rows'] if r['accepted']];assert len(rows)==198
    for name,h in json.loads((DATA/'manifest.json').read_text()).items():assert base.sha(DATA/name)==h
    assert not OUT.exists();assert torch.cuda.is_available() and 'Blackwell' in torch.cuda.get_device_name(0)
    protected={p.relative_to(ROOT).as_posix():base.sha(p) for folder in ['backend/data','backend/training/runs','backend/physics/runs'] for p in (ROOT/folder).rglob('*') if p.is_file()}
    OUT.mkdir();(OUT/'models').mkdir()
    for src,name in [(PROTOCOL,'protocol.json'),(Path(__file__),'training-script.py'),(Path(base.__file__),'base-helper.py'),(DATA/'data.json','data.json'),(ROOT/'backend/training/build_flex.py','dataset-builder.py')]:shutil.copyfile(src,OUT/name)
    base.write_json(OUT/'preserved-hashes.json',protected)
    base.write_json(OUT/'environment.json',dict(gpu=torch.cuda.get_device_name(0),torch=torch.__version__,cuda=torch.version.cuda,started_utc=datetime.now(timezone.utc).isoformat(),protocol_sha256=base.sha(PROTOCOL),data_sha256=base.sha(DATA/'data.json')))
    splits=[]
    for ev,key in [('condition_group_5fold','group'),('date_group_5fold','date')]:
        labels=[r[key] for r in rows]
        for fold,(ti,vi) in enumerate(GroupKFold(5).split(rows,groups=labels)):
            splits.append(dict(evaluation=ev,fold=fold,key=key,train_ids=[rows[i]['id'] for i in ti],test_ids=[rows[i]['id'] for i in vi]))
    base.write_json(OUT/'splits.json',splits);idx={r['id']:r for r in rows};predictions=[];fits=[]
    with base.Monitor() as monitor:
        for s in splits:
            tr=[idx[k] for k in s['train_ids']];te=[idx[k] for k in s['test_ids']];key=s['key'];assert not {r[key] for r in tr}&{r[key] for r in te}
            counts=Counter(r[key] for r in tr);w=np.array([1/counts[r[key]] for r in tr]);w/=w.mean()
            x=xrows(tr);xt=xrows(te);y=np.array([r['burning_rate_mm2s'] for r in tr]);ly=np.log(y)
            scaler=StandardScaler().fit(x,sample_weight=w);z=scaler.transform(x);zt=scaler.transform(xt)
            for model in P['models']:
                artifact=None
                if model=='fuel_median':
                    pred=np.array([base.weighted_median(y[[t['fuel']==r['fuel'] for t in tr]],w[[t['fuel']==r['fuel'] for t in tr]]) for r in te])
                elif model=='same_fuel_nearest':
                    pred=[]
                    for r,a in zip(te,zt):
                        dist=((z-a)**2).sum(axis=1);dist[[t['fuel']!=r['fuel'] for t in tr]]=np.inf
                        mask=np.isclose(dist,dist.min(),rtol=1e-10,atol=1e-12);pred.append(np.average(y[mask],weights=w[mask]))
                    pred=np.array(pred)
                elif model=='log_ridge':
                    mean=float(np.average(ly,weights=w));t=lambda a:torch.as_tensor(a,device='cuda:0',dtype=torch.float64)
                    Z,W,Y=t(z),t(w),t(ly-mean);b=torch.linalg.solve(Z.T@(W[:,None]*Z)+torch.eye(6,device='cuda:0',dtype=torch.float64),Z.T@(W*Y))
                    pred=torch.exp(t(zt)@b+mean).cpu().numpy();artifact=dict(mean=scaler.mean_.tolist(),scale=scaler.scale_.tolist(),coefficients=b.cpu().tolist(),intercept=mean,device='cuda:0')
                else:
                    cb=CatBoostRegressor(**P['catboost']);cb.fit(x,ly,sample_weight=w);assert cb.get_all_params()['task_type']=='GPU'
                    pred=np.exp(cb.predict(xt));path=OUT/'models'/f"{s['evaluation']}-{s['fold']}.cbm";cb.save_model(str(path));artifact=dict(path=path.relative_to(OUT).as_posix(),params=cb.get_all_params())
                assert np.isfinite(pred).all() and (pred>0).all()
                fits.append(dict(evaluation=s['evaluation'],fold=s['fold'],model=model,artifact=artifact))
                for r,p in zip(te,pred):predictions.append(dict(evaluation=s['evaluation'],fold=s['fold'],id=r['id'],source_test=r['source_test'],model=model,group=r[key],fuel=r['fuel'],co2=r['co2'],he=r['he'],observed=r['burning_rate_mm2s'],predicted=float(p),error=float(p-r['burning_rate_mm2s'])))
            print(f"FLEX {s['evaluation']} fold{s['fold']+1}/5 complete",flush=True)
    metrics=[]
    for ev in P['evaluations']:
        for model in P['models']:
            for subset in ['all','Methanol','Heptane','CO2-present','He-present']:
                rr=[r for r in predictions if r['evaluation']==ev and r['model']==model and (subset=='all' or r['fuel']==subset or subset=='CO2-present' and r['co2']>0 or subset=='He-present' and r['he']>0)]
                groups=sorted({r['group'] for r in rr});err=np.array([r['error'] for r in rr]);obs=np.array([r['observed'] for r in rr]);gm=[np.mean([abs(r['error']) for r in rr if r['group']==g]) for g in groups];gs=[np.mean([r['error']**2 for r in rr if r['group']==g]) for g in groups]
                metrics.append(dict(evaluation=ev,model=model,subset=subset,rows=len(rr),groups=len(groups),group_mae=float(np.mean(gm)),group_rmse=float(np.sqrt(np.mean(gs))),row_r2=float(1-sum(err**2)/sum((obs-obs.mean())**2))))
    def score(model,subset):return next(m['group_mae'] for m in metrics if m['evaluation']=='condition_group_5fold' and m['model']==model and m['subset']==subset)
    gates=[]
    for model in ['log_ridge','log_catboost']:
        gains={s:1-score(model,s)/min(score(b,s) for b in ['fuel_median','same_fuel_nearest']) for s in ['all','Methanol','Heptane']}
        gates.append(dict(model=model,gains=gains,passed=gains['all']>=.1 and min(gains['Methanol'],gains['Heptane'])>=-.1))
    for path,h in protected.items():assert base.sha(ROOT/path)==h,path
    base.write_json(OUT/'gpu-monitor.json',monitor.samples);base.write_json(OUT/'fit-log.json',fits)
    base.write_csv(OUT/'predictions.csv',predictions);base.write_csv(OUT/'metrics.csv',metrics)
    report=dict(protocol=P,summary=dataset['summary'],metrics=metrics,gates=gates,predictions=predictions,cuda_ridge_fits=10,cuda_catboost_fits=10)
    base.write_json(OUT/'results.json',report);base.write_json(OUT/'manifest.json',{p.relative_to(OUT).as_posix():base.sha(p) for p in OUT.rglob('*') if p.is_file()})
    print(json.dumps(dict(gates=gates,primary=[m for m in metrics if m['evaluation']=='condition_group_5fold' and m['subset']=='all']),indent=2))
if __name__=='__main__':main()
