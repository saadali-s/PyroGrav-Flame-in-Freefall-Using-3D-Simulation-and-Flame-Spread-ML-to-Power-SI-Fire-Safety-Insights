"""Independent CPU reconstruction. Does not import the training implementation."""
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path
import numpy as np
from scipy.optimize import minimize

ROOT=Path(__file__).resolve().parents[3]
RUN=ROOT/'backend/training/runs/round3-2026-11-14'
def read(name):return json.loads((RUN/name).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load_csv(p):return list(csv.DictReader(p.open(encoding='utf8')))
def matrices(rows,k):
    oxygen=np.array([float(r['oxygen_pct']) for r in rows]);diameter=np.array([float(r['diameter_mm']) for r in rows])
    forced=np.array([float(r['opposed_flow_cms']) for r in rows])/100
    g=np.array([9.80665 if r['environment']=='earth' else 0 for r in rows])
    # Independently arranged Eq6: sqrt(hypot(Uf^2, g*kappa*r)).
    effective=np.sqrt(np.hypot(forced**2,g*k*(diameter*.0005)))*100
    logu=np.log(effective)
    x=np.stack([oxygen-19,diameter**-1,logu,(oxygen-19)*logu],axis=1)
    return x,effective
def main():
    p=read('protocol.json');splits=read('splits.json');fits=read('fit-log.json');report=read('results.json')
    rows=load_csv(ROOT/'backend/training/datasets/pmma-v1/candidate_training.csv');indexed={r['observation_id']:r for r in rows}
    for name,h in read('artifact-manifest.json').items():assert sha(RUN/name)==h
    for name,h in {**read('raw-hashes.json'),**read('preserved-hashes.json')}.items():assert sha(ROOT/name)==h
    assert sha(ROOT/'backend/training/datasets/pmma-v1/candidate_training.csv')==p['candidate_sha256']
    original=json.loads((ROOT/'backend/training/runs/round1-2026-11-14/splits.json').read_text())
    assert splits[:37]==original
    records={(r['fold_id'],r['model'],r['observation_id']):r for r in report['predictions']}
    fitmap={(f['fold_id'],f['model']):f for f in fits};count=0;max_error=0;max_gradient=0
    # Unit/limit checks outside fitting; no test outcomes used.
    sample=[dict(environment='microgravity',oxygen_pct=20,diameter_mm=10,opposed_flow_cms=2)]
    assert np.allclose(matrices(sample,3.5)[1],[2])
    natural=dict(sample[0],environment='earth',opposed_flow_cms=0)
    assert np.isclose(matrices([natural],3.5)[1][0],100*np.sqrt(9.80665*3.5*.005))
    for sp in splits:
        train=[indexed[i] for i in sp['train_ids']];test=[indexed[i] for i in sp['test_ids']]
        assert not set(sp['train_ids'])&set(sp['test_ids'])
        assert not {r['group_id'] for r in train}&{r['group_id'] for r in test}
        if sp['evaluation']=='earth_to_microgravity':assert all(r['environment']=='earth' for r in train)
        if 'strict' in sp['evaluation']:assert all('U01' not in r['review_flags'] for r in train+test)
        fold=sp['evaluation']+'--'+sp['held_out_group']
        groupcount=Counter(r['group_id'] for r in train);w=np.array([1/groupcount[r['group_id']] for r in train]);w/=w.mean()
        rates=np.array([float(r['rate_mms']) for r in train]);ly=np.log(rates);ym=np.average(ly,weights=w)
        for name in ['median','nearest',*p['models']]:
            if name=='median':
                order=np.argsort(rates);mid=np.searchsorted(np.cumsum(w[order]),w.sum()/2)
                prediction=np.repeat(rates[order[mid]],len(test));ut=np.array([float(r['opposed_flow_cms']) for r in test])
            elif name=='nearest':
                keys=['oxygen_pct','diameter_mm','opposed_flow_cms']
                x=np.array([[float(r[k]) for k in keys] for r in train]);xt=np.array([[float(r[k]) for k in keys] for r in test])
                var=np.average((x-np.average(x,axis=0,weights=w))**2,axis=0,weights=w)
                ds=((xt[:,None]-x[None,:])**2/var).sum(axis=2)
                prediction=[]
                for distances in ds:
                    tied=np.isclose(distances,distances.min(),rtol=1e-10,atol=1e-12)
                    prediction.append(np.average(rates[tied],weights=w[tied]))
                prediction=np.array(prediction);ut=xt[:,2]
            else:
                settings=p['models'][name];x,u=matrices(train,settings['kappa']);xt,ut=matrices(test,settings['kappa'])
                mean=np.average(x,weights=w,axis=0);scale=np.sqrt(np.average((x-mean)**2,weights=w,axis=0));scale[scale==0]=1
                z=(x-mean)/scale;zt=(xt-mean)/scale
                so=np.sqrt(np.average((x[:,0]-mean[0])**2,weights=w))
                d=np.zeros((2,4));d[:,0]=so/scale[0];d[:,3]=so*np.log([u.min(),u.max()])/scale[3]
                strength=settings['penalty']*len(train)/2
                def objective(b):
                    residual=z@b+ym-ly;v=np.minimum(d@b,0)
                    return np.sum(w*residual**2)+b@b+strength*(v@v)
                def gradient(b):return 2*(z.T@(w*(z@b+ym-ly))+b+strength*d.T@np.minimum(d@b,0))
                def hessian(b):
                    active=d[(d@b)<0]
                    return 2*(z.T@(w[:,None]*z)+np.eye(4)+strength*active.T@active)
                opt=minimize(objective,np.zeros(4),jac=gradient,hess=hessian,method='trust-exact',options={'gtol':1e-9,'maxiter':1000})
                b=opt.x;grad=float(np.max(np.abs(gradient(b))));max_gradient=max(max_gradient,grad)
                assert grad<1e-6,(fold,name,opt.message,grad)
                saved=fitmap[(fold,name)]['artifact'];savedb=np.array(saved['coefficients'])
                assert np.allclose(b,savedb,rtol=1e-6,atol=1e-7),(fold,name,b,savedb)
                assert np.allclose(d,saved['constraint_matrix'],rtol=1e-10,atol=1e-10)
                prediction=np.exp(zt@b+ym)
            for row,pred,flow in zip(test,prediction,ut):
                rec=records[(fold,name,row['observation_id'])]
                assert rec['observed_mms']==float(row['rate_mms'])
                assert np.isclose(pred,rec['predicted_mms'],rtol=1e-6,atol=1e-8),(fold,name,pred,rec['predicted_mms'])
                assert np.isclose(flow,rec['derived_flow_cms'],rtol=1e-12,atol=1e-12)
                max_error=max(max_error,abs(pred-rec['predicted_mms']));count+=1
    assert count==len(records)==1771
    for m in report['evaluations']:
        part=[r for r in report['predictions'] if r['model']==m['model'] and r['evaluation']==m['evaluation'] and (m['subset']=='all' or r['environment']==m['subset'])]
        gs=sorted({r['group_id'] for r in part});errs=np.array([r['predicted_mms']-r['observed_mms'] for r in part]);ys=np.array([r['observed_mms'] for r in part])
        mae=np.mean([np.mean([abs(r['predicted_mms']-r['observed_mms']) for r in part if r['group_id']==g]) for g in gs])
        rmse=np.sqrt(np.mean([np.mean([(r['predicted_mms']-r['observed_mms'])**2 for r in part if r['group_id']==g]) for g in gs]))
        for key,value in [('group_mae_mms',mae),('group_rmse_mms',rmse),('row_r2',1-np.sum(errs**2)/np.sum((ys-ys.mean())**2))]:assert np.isclose(value,m[key],rtol=1e-10,atol=1e-12)
    r2=json.loads((ROOT/'backend/training/runs/round2-2026-11-14/results.json').read_text())
    old={(r['fold_id'],r['observation_id']):r['predicted_mms'] for r in r2['predictions'] if r['model']=='log_geometry_ridge'}
    for (fold,obs),pred in old.items():assert np.isclose(pred,records[(fold,'geometry_control',obs)]['predicted_mms'],rtol=1e-10,atol=1e-12)
    for c in report['comparisons']:
        current=next(m['group_mae_mms'] for m in report['evaluations'] if m['evaluation']=='earth_to_microgravity' and m['model']==c['model'])
        reference=next(m['group_mae_mms'] for m in report['evaluations'] if m['evaluation']=='earth_to_microgravity' and m['model']==c['reference'])
        assert np.isclose(c['relative_mae_improvement'],1-current/reference)
        assert c['exploratory_gate']==(current<reference)
        assert c['twenty_percent_gate']==(current<=.8*reference)
    # Preserve full failures: no capping, hidden subgroup selection or lunar metrics.
    assert report['verification']['compatible_lunar_rows']==0
    result=dict(passed=True,predictions_reproduced=count,metrics_recomputed=len(report['evaluations']),
        round2_control_predictions_reproduced=len(old),maximum_prediction_difference_mms=max_error,maximum_optimizer_gradient=max_gradient,
        optimizer='Independent NumPy features and SciPy trust-exact CPU optimization; no training module imported',
        cuda_fits=report['verification']['cuda_regression_fits'],prior_artifacts_unchanged=len(read('preserved-hashes.json')),
        raw_files_unchanged=len(read('raw-hashes.json')),unit_limits_checked=True,group_disjoint=True,earth_transfer_uses_no_flight_training_labels=True,
        source_model_not_independent_of_BASS=True,not_a_blind_test=True)
    (ROOT/'backend/training/round3-independent-verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
