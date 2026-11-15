"""Independent CPU least-squares reconstruction; never imports the trainer."""
import csv, hashlib, json
from collections import Counter
from pathlib import Path
import numpy as np
from scipy.optimize import lsq_linear

ROOT=Path(__file__).resolve().parents[3]; RUN=ROOT/'backend/training/runs/round4-2026-11-14'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report=json.loads((RUN/'results.json').read_text());splits=json.loads((RUN/'splits.json').read_text())
rows=list(csv.DictReader((ROOT/'backend/training/datasets/pmma-v1/candidate_training.csv').open()))
index={r['observation_id']:r for r in rows};results=report['predictions']
fits={(f['fold_id'],f['model']):f['artifact'] for f in json.loads((RUN/'fit-log.json').read_text())}
maxdiff=0.;n=0
for s in splits:
    assert not set(s['train_ids'])&set(s['test_ids'])
    tr=[index[k] for k in s['train_ids']];te=[index[k] for k in s['test_ids']]
    assert not {r['group_id'] for r in tr}&{r['group_id'] for r in te}
    if s['evaluation']=='earth_to_microgravity':assert all(r['environment']=='earth' for r in tr)
    if s['evaluation']=='pooled_strict_units_logo':assert all('U01' not in r['review_flags'] for r in tr+te)
    counts=Counter(r['group_id'] for r in tr);w=np.array([1/counts[r['group_id']] for r in tr]);w/=w.mean()
    y=np.log([float(r['rate_mms']) for r in tr]);ym=np.average(y,weights=w)
    def design(part,quad):
        out=[]
        for r in part:
            d=float(r['diameter_mm']);o=float(r['oxygen_pct'])-19;fan=float(r['opposed_flow_cms'])
            buoyancy=9.80665*3.5*d/2000 if r['environment']=='earth' else 0
            logu=np.log(np.hypot((fan/100)**2,buoyancy)**.5*100)
            out.append([o,1/d,logu,o*logu]+([-logu**2] if quad else []))
        return np.array(out)
    for model in report['protocol']['models']:
        x=design(tr,model!='mixed_linear_control');xt=design(te,model!='mixed_linear_control')
        mu=np.average(x,axis=0,weights=w);sd=np.sqrt(np.average((x-mu)**2,axis=0,weights=w));sd[sd<1e-15]=1
        z=(x-mu)/sd;zt=(xt-mu)/sd;dim=x.shape[1]
        A=np.vstack([z*np.sqrt(w[:,None]),np.eye(dim)]);b=np.r_[(y-ym)*np.sqrt(w),np.zeros(dim)]
        if model=='mixed_concave':
            low=np.full(dim,-np.inf);low[-1]=0
            sol=lsq_linear(A,b,bounds=(low,np.full(dim,np.inf)),method='bvls',tol=1e-13);assert sol.success;coef=sol.x
        else:coef=np.linalg.lstsq(A,b,rcond=None)[0]
        pred=np.exp(ym+zt@coef);fold=s['evaluation']+'--'+s['held_out_group'];a=fits[(fold,model)]
        np.testing.assert_allclose(mu,a['mean'],atol=1e-11);np.testing.assert_allclose(sd,a['scale'],atol=1e-11)
        np.testing.assert_allclose(coef,a['coefficients'],atol=1e-10)
        for r,p in zip(te,pred):
            rec=next(v for v in results if v['fold_id']==fold and v['model']==model and v['observation_id']==r['observation_id'])
            assert float(r['rate_mms'])==rec['observed_mms'];delta=abs(p-rec['predicted_mms']);assert delta<1e-9;maxdiff=max(maxdiff,delta);n+=1
for m in report['metrics']:
    rr=[r for r in results if r['evaluation']==m['evaluation'] and r['model']==m['model'] and (m['subset']=='all' or r['environment']==m['subset'])]
    groups={r['group_id'] for r in rr};gmae=[];gmse=[]
    for g in groups:
        err=np.array([r['predicted_mms']-r['observed_mms'] for r in rr if r['group_id']==g]);gmae.append(abs(err).mean());gmse.append((err**2).mean())
    assert abs(np.mean(gmae)-m['group_mae_mms'])<1e-12
    assert abs(np.sqrt(np.mean(gmse))-m['group_rmse_mms'])<1e-12
    y=np.array([r['observed_mms'] for r in rr]);p=np.array([r['predicted_mms'] for r in rr])
    assert abs((1-np.sum((y-p)**2)/np.sum((y-y.mean())**2))-m['row_r2'])<1e-8
r3=json.loads((ROOT/'backend/training/runs/round3-2026-11-14/results.json').read_text())
control=0
for r in results:
    if r['model']!='mixed_linear_control':continue
    prev=next(v for v in r3['predictions'] if v['model']=='mixed_3p5' and v['evaluation']==r['evaluation'] and v['observation_id']==r['observation_id'])
    assert abs(prev['predicted_mms']-r['predicted_mms'])<1e-10;control+=1
for path,h in json.loads((RUN/'preserved-hashes.json').read_text()).items():assert sha(ROOT/path)==h,path
for path,h in json.loads((RUN/'manifest.json').read_text()).items():assert sha(RUN/path)==h,path
for gate in report['gates']:
    score=lambda subset:next(m['group_mae_mms'] for m in report['metrics'] if m['evaluation']=='pooled_logo' and m['model']==gate['model'] and m['subset']==subset)
    assert gate['passed']==(score('microgravity')<=.9*.010490585024313702 and score('earth')<=.013327813827982137)
out=dict(passed=True,independent_cpu=True,predictions=n,max_difference_mms=float(maxdiff),metrics=len(report['metrics']),folds=len(splits),round3_control_predictions_reproduced=control,preserved_files=report['verification']['preserved_files'],candidate_sha256=sha(ROOT/'backend/training/datasets/pmma-v1/candidate_training.csv'))
(ROOT/'backend/training/reports/round4-independent-verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
