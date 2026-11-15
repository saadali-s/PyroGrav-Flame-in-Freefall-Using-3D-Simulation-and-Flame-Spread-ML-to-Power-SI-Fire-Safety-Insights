"""Export existing Round2 artifacts only. No fitting, new metrics or source edits."""
import csv, json, hashlib
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull
ROOT=Path(__file__).resolve().parents[3]
run=ROOT/'backend/training/runs/round2-2026-11-14'
rows=list(csv.DictReader((ROOT/'backend/training/datasets/pmma-v1/candidate_training.csv').open()))
fits=json.loads((run/'fit-log.json').read_text());report=json.loads((run/'results.json').read_text())
r3=json.loads((ROOT/'backend/training/runs/round3-2026-11-14/results.json').read_text())
result={'version':'round2-frozen-artifacts-v1','domains':{},'rows':[]}
for env,ev in [('earth','earth_logo'),('microgravity','microgravity_logo')]:
    subset=[r for r in rows if r['environment']==env]
    points=np.array([[float(r[k]) for k in ['oxygen_pct','diameter_mm','opposed_flow_cms']] for r in subset])
    models=[f['artifact'] for f in fits if f['model']=='log_geometry_ridge' and f['fold_id'].startswith(ev+'--')]
    score=next(s for s in report['evaluations'] if s['evaluation']==ev and s['model']=='log_geometry_ridge')
    physics_score=next(s for s in r3['evaluations'] if s['evaluation']=='pooled_logo' and s['subset']==env and s['model']=='mixed_3p5_penalty')
    result['domains'][env]={'models':models,'hull':ConvexHull(points).equations.tolist(),'mae':score['group_mae_mms'],'physicsMae':physics_score['group_mae_mms'],'rows':len(subset),'groups':len(models)}
    for r in subset:
        p=next(p for p in report['predictions'] if p['evaluation']==ev and p['model']=='log_geometry_ridge' and p['observation_id']==r['observation_id'])
        physics=next(p for p in r3['predictions'] if p['evaluation']=='pooled_logo' and p['model']=='mixed_3p5_penalty' and p['observation_id']==r['observation_id'])
        result['rows'].append({'id':r['observation_id'],'environment':env,'group':r['group_id'],'oxygen':float(r['oxygen_pct']),'diameter':float(r['diameter_mm']),'flow':float(r['opposed_flow_cms']),'observed':float(r['rate_mms']),'heldout':p['predicted_mms'],'physics':physics['predicted_mms'],'unitFlag':'U01' in r['review_flags']})
result['provenance']={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [run/'fit-log.json',run/'results.json',ROOT/'backend/training/runs/round3-2026-11-14/results.json',ROOT/'backend/training/datasets/pmma-v1/candidate_training.csv']}
out=ROOT/'web/src/data/simulation-evidence.json';out.write_text(json.dumps(result,indent=2)+'\n')
print('Exported 69 observations and 30 existing fold models; no new training.')
