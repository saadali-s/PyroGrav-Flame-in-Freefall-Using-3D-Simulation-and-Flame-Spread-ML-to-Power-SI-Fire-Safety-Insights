"""Independent energy formulation, dense root scan and bisection; no solver import."""
import csv,json,hashlib,math
from pathlib import Path
from collections import Counter
import numpy as np
ROOT=Path(__file__).resolve().parents[2];RUN=ROOT/'backend/physics/runs/physics-baseline-v1-2026-11-14'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report=json.loads((RUN/'results.json').read_text());protocol=report['protocol']
for f,h in json.loads((RUN/'manifest.json').read_text()).items():assert sha(RUN/f)==h
for f,h in json.loads((RUN/'preserved-hashes.json').read_text()).items():assert sha(ROOT/f)==h
rows={r['observation_id']:r for r in csv.DictReader((ROOT/'backend/training/datasets/pmma-v1/candidate_training.csv').open())}
max_diff=0;counts=Counter()
for rec in report['records']:
    row=rows[rec['id']];a={**protocol['parameters'],**protocol['scenarios'][rec['scenario']]}
    radius=float(row['diameter_mm'])*.0005;g=9.80665 if row['environment']=='earth' else 0
    velocity=math.sqrt(math.hypot((float(row['opposed_flow_cms'])*.01)**2,g*a['kappa']*radius))
    xo=float(row['oxygen_pct'])/100;yo=32*xo/(28+4*xo)
    def residual(v):
        length=a['alpha_heating']/(velocity+v)
        depth=np.minimum(radius,np.sqrt(a['k_s']*length/(a['rho_s']*a['cp_s']*v)))
        # Annular volume divided by external circumference, independently expressed.
        heated_area=(radius**2-(radius-depth)**2)/(2*radius)
        demand=a['rho_s']*a['cp_s']*(a['t_pyrolysis']-a['t_ambient'])*v*heated_area
        arg=a['curvature_c']*a['alpha_curvature']/((velocity+v)*radius)
        supplied=arg/np.log1p(arg)*a['energy_air_w_per_m']*yo/a['reference_oxygen_mass_fraction']
        rerad=a['emissivity']*5.670374419e-8*(a['t_pyrolysis']**4-a['t_ambient']**4)*length
        return demand+rerad-supplied
    scan=np.geomspace(1e-10,1,20001);vals=residual(scan);indices=np.where(vals[:-1]*vals[1:]<0)[0];roots=[]
    for index in indices:
        lo,hi=scan[index:index+2];flo=residual(lo)
        for _ in range(80):
            mid=(lo+hi)/2;fm=residual(mid)
            if fm*flo>0:lo=mid;flo=fm
            else:hi=mid
        roots.append((lo+hi)*500)
    assert len(roots)==rec['root_count'],(rec['id'],rec['scenario'],roots,rec['roots_mms'])
    assert np.allclose(roots,rec['roots_mms'],rtol=1e-8,atol=1e-8)
    if len(roots)==1:
        max_diff=max(max_diff,abs(roots[0]-rec['rate_mms']))
        assert abs(float(residual(rec['rate_mms']/1000)))<1e-6
    else:assert rec['rate_mms'] is None
    counts[rec['scenario']+':'+rec['environment']+':'+rec['status']]+=1
for m in report['metrics']:
    part=[r for r in report['records'] if r['scenario']==m['scenario'] and r['environment']==m['environment'].replace('_strict','') and (not m['environment'].endswith('strict') or not r['unit_flag'])]
    good=[r for r in part if r['rate_mms'] is not None];assert m['predicted_rows']==len(good)
    if len(good)==len(part):
        gs={r['group'] for r in good}
        mae=np.mean([np.mean([abs(r['rate_mms']-r['observed_mms']) for r in good if r['group']==g]) for g in gs])
        assert np.isclose(mae,m['group_mae_mms'])
    else:assert m['group_mae_mms'] is None
result=dict(passed=True,records_checked=len(report['records']),independent_grid_points=20001,maximum_rate_difference_mms=max_diff,
            local_fitted_parameters=0,method='Independent annular energy formulation, NumPy dense scan and bisection',statuses=dict(counts))
(ROOT/'backend/physics/baseline-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
