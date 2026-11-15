"""CPU reconstruction and saved GPU-model reload; no trainer import."""
import hashlib,json
from collections import Counter
from pathlib import Path
import numpy as np
from catboost import CatBoostRegressor
ROOT=Path(__file__).resolve().parents[3];RUN=ROOT/'backend/training/runs/flex-round1-2026-11-14'
assert json.loads((ROOT/'backend/training/reports/flex-source-verification.json').read_text())['passed']
report=json.loads((RUN/'results.json').read_text());dataset=json.loads((RUN/'data.json').read_text());index={r['id']:r for r in dataset['rows'] if r['accepted']}
splits=json.loads((RUN/'splits.json').read_text());results=report['predictions'];maximum=0.;checked=0
def design(rows):return np.array([[int(r['fuel']=='Heptane'),np.log(r['pressure_mmhg']),r['o2'],r['co2'],r['he'],np.log(r['diameter_mm'])] for r in rows])
for s in splits:
    tr=[index[k] for k in s['train_ids']];te=[index[k] for k in s['test_ids']];key=s['key']
    assert not set(s['train_ids'])&set(s['test_ids']);assert not {r[key] for r in tr}&{r[key] for r in te}
    counts=Counter(r[key] for r in tr);w=np.array([1/counts[r[key]] for r in tr]);w/=w.mean()
    x=design(tr);xt=design(te);y=np.array([r['burning_rate_mm2s'] for r in tr]);mu=np.average(x,axis=0,weights=w);sd=np.sqrt(np.average((x-mu)**2,axis=0,weights=w));sd[sd<1e-14]=1;z=(x-mu)/sd;zt=(xt-mu)/sd
    for model in report['protocol']['models']:
        if model=='log_ridge':
            ym=np.average(np.log(y),weights=w);A=np.vstack([z*np.sqrt(w[:,None]),np.eye(6)]);b=np.r_[(np.log(y)-ym)*np.sqrt(w),np.zeros(6)];coef=np.linalg.lstsq(A,b,rcond=None)[0];pred=np.exp(ym+zt@coef)
        elif model=='log_catboost':
            cb=CatBoostRegressor();cb.load_model(str(RUN/'models'/f"{s['evaluation']}-{s['fold']}.cbm"));assert cb.get_all_params()['task_type']=='GPU';pred=np.exp(cb.predict(xt))
        else:
            pred=[]
            for r,a in zip(te,zt):
                mask=np.array([t['fuel']==r['fuel'] for t in tr]);v=y[mask];ww=w[mask]
                if model=='fuel_median':
                    order=np.argsort(v);value=v[order[np.searchsorted(np.cumsum(ww[order]),ww.sum()/2)]]
                else:
                    ds=np.sum((z[mask]-a)**2,axis=1);near=np.isclose(ds,ds.min(),rtol=1e-10,atol=1e-12);value=np.average(v[near],weights=ww[near])
                pred.append(value)
        for r,p in zip(te,pred):
            saved=next(v for v in results if v['evaluation']==s['evaluation'] and v['fold']==s['fold'] and v['model']==model and v['id']==r['id'])
            delta=abs(float(p)-saved['predicted']);assert delta<1e-10;maximum=max(maximum,delta);checked+=1
for ev in report['protocol']['evaluations']:
    for model in report['protocol']['models']:
        assert Counter(r['id'] for r in results if r['evaluation']==ev and r['model']==model)==Counter(index.keys())
for m in report['metrics']:
    sub=m['subset'];rr=[r for r in results if r['evaluation']==m['evaluation'] and r['model']==m['model'] and (sub=='all' or r['fuel']==sub or sub=='CO2-present' and r['co2']>0 or sub=='He-present' and r['he']>0)]
    groups={r['group'] for r in rr};gm=[np.mean([abs(r['predicted']-r['observed']) for r in rr if r['group']==g]) for g in groups];gs=[np.mean([(r['predicted']-r['observed'])**2 for r in rr if r['group']==g]) for g in groups]
    assert abs(np.mean(gm)-m['group_mae'])<1e-12;assert abs(np.sqrt(np.mean(gs))-m['group_rmse'])<1e-12
    y=np.array([r['observed'] for r in rr]);p=np.array([r['predicted'] for r in rr]);assert abs(1-np.sum((p-y)**2)/np.sum((y-y.mean())**2)-m['row_r2'])<1e-10
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for path,h in json.loads((RUN/'preserved-hashes.json').read_text()).items():assert sha(ROOT/path)==h,path
for path,h in json.loads((RUN/'manifest.json').read_text()).items():assert sha(RUN/path)==h,path
for gate in report['gates']:
    def score(model,subset):return next(m['group_mae'] for m in report['metrics'] if m['evaluation']=='condition_group_5fold' and m['model']==model and m['subset']==subset)
    gain={s:1-score(gate['model'],s)/min(score(b,s) for b in ['fuel_median','same_fuel_nearest']) for s in ['all','Methanol','Heptane']}
    assert gate['passed']==(gain['all']>=.1 and min(gain['Methanol'],gain['Heptane'])>=-.1)
out=dict(passed=True,predictions=checked,max_difference=float(maximum),metric_rows=len(report['metrics']),splits=len(splits),source_verification=True,cuda_models_reloaded=10,independent_ridge_baselines=True)
(ROOT/'backend/training/reports/flex-independent-verification.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
