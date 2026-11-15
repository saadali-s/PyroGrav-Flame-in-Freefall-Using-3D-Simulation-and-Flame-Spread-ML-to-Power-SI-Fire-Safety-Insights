"""Frozen no-local-fit audit experiment; preserve all existing data and runs."""
import csv,json,hashlib,shutil
from pathlib import Path
from datetime import datetime,timezone
from dataclasses import replace
import numpy as np
from rod_energy import Assumptions,predict
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,obj):p.write_text(json.dumps(obj,indent=2,allow_nan=False)+'\n')
def main():
    p=json.loads((HERE/'baseline_protocol.json').read_text())
    out=ROOT/'backend/physics/runs'/p['id'];assert not out.exists(),'Refusing overwrite'
    data=ROOT/'backend/training/datasets/pmma-v1/candidate_training.csv';assert sha(data)==p['candidate_sha256']
    rows=list(csv.DictReader(data.open()));assert len(rows)==69
    preserved={str(f.relative_to(ROOT)).replace('\\','/'):sha(f) for folder in ['backend/data','backend/training/runs'] for f in (ROOT/folder).rglob('*') if f.is_file()}
    old=json.loads((ROOT/'backend/training/runs/round2-2026-11-14/results.json').read_text())
    out.mkdir(parents=True);shutil.copyfile(HERE/'baseline_protocol.json',out/'protocol.json');shutil.copyfile(HERE/'rod_energy.py',out/'solver.py');shutil.copyfile(__file__,out/'evaluation.py')
    write(out/'preserved-hashes.json',preserved);records=[]
    for name,overrides in p['scenarios'].items():
        assumptions=replace(Assumptions(**p['parameters']),**overrides)
        for row in rows:
            env=row['environment'];ev='earth_logo' if env=='earth' else 'microgravity_logo'
            model=next(r for r in old['predictions'] if r['model']=='log_geometry_ridge' and r['evaluation']==ev and r['observation_id']==row['observation_id'])
            r=predict(float(row['oxygen_pct']),float(row['diameter_mm']),float(row['opposed_flow_cms']),1 if env=='earth' else 0,assumptions)
            records.append(dict(id=row['observation_id'],group=row['group_id'],environment=env,scenario=name,
                observed_mms=float(row['rate_mms']),ml_heldout_mms=model['predicted_mms'],unit_flag='U01' in row['review_flags'],**r))
        print(name,'complete',flush=True)
    metrics=[]
    for name in p['scenarios']:
        for env in ['earth','microgravity','microgravity_strict']:
            part=[r for r in records if r['scenario']==name and r['environment']==env.replace('_strict','') and (not env.endswith('strict') or not r['unit_flag'])]
            good=[r for r in part if r['rate_mms'] is not None];groups=sorted({r['group'] for r in good})
            def metric(key,power):return float(np.mean([np.mean([abs(r[key]-r['observed_mms'])**power for r in good if r['group']==g]) for g in groups]))**(1/power) if groups else None
            metrics.append(dict(scenario=name,environment=env,rows=len(part),predicted_rows=len(good),coverage=len(good)/len(part),groups=len(groups),
                group_mae_mms=metric('rate_mms',1) if len(good)==len(part) else None,group_rmse_mms=metric('rate_mms',2) if len(good)==len(part) else None,
                paired_available_mae_mms=metric('rate_mms',1),ml_same_rows_mae_mms=metric('ml_heldout_mms',1)))
    for path,h in preserved.items():assert sha(ROOT/path)==h,path
    write(out/'results.json',dict(protocol=p,records=records,metrics=metrics,completed_utc=datetime.now(timezone.utc).isoformat(),local_fitted_parameters=0))
    write(out/'manifest.json',{f.name:sha(f) for f in out.iterdir() if f.is_file()})
    print(json.dumps(metrics,indent=2))
if __name__=='__main__':main()
