"""Publish verified results, comparisons and source-linked review documents; no fits."""
import csv,json,shutil,hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[3]
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2)+'\n',encoding='utf8')
def read(p):return json.loads(p.read_text())
R4=ROOT/'backend/training/runs/round4-2026-11-14';FLEX=ROOT/'backend/training/runs/flex-round1-2026-11-14'
r4=read(R4/'results.json');flex=read(FLEX/'results.json');data=read(FLEX/'data.json')
v4=read(ROOT/'backend/training/reports/round4-independent-verification.json');vf=read(ROOT/'backend/training/reports/flex-independent-verification.json');assert v4['passed'] and vf['passed']
r2=list(csv.DictReader((ROOT/'backend/training/runs/round2-2026-11-14/heldout_predictions.csv').open()))
comparisons=[];rng=np.random.default_rng(20261114)
for model in r4['protocol']['models']:
    for env,ev in [('earth','earth_logo'),('microgravity','microgravity_logo')]:
        current=[r for r in r4['predictions'] if r['model']==model and r['evaluation']=='pooled_logo' and r['environment']==env]
        ref={r['observation_id']:r for r in r2 if r['evaluation']==ev and r['model']=='log_geometry_ridge'}
        delta=[np.mean([r['absolute_error_mms']-float(ref[r['observation_id']]['absolute_error_mms']) for r in current if r['group_id']==g]) for g in sorted({r['group_id'] for r in current})]
        samples=rng.choice(delta,(2000,len(delta)),replace=True).mean(axis=1)
        comparisons.append(dict(model=model,environment=env,groups_improved=int(sum(d<0 for d in delta)),groups=len(delta),mean_delta_mms=float(np.mean(delta)),descriptive_bootstrap_95pct=np.quantile(samples,[.025,.975]).tolist()))
fits=read(R4/'fit-log.json');peaks=[]
for ev in r4['protocol']['evaluations']:
    fs=[f for f in fits if f['model']=='mixed_concave' and f['fold_id'].startswith(ev+'--')]
    logs=[f['artifact']['peak_log_flow_at_19pct'] for f in fs if f['artifact']['peak_log_flow_at_19pct'] is not None]
    peaks.append(dict(evaluation=ev,folds=len(fs),active_constraints=sum(f['artifact']['constraint_active'] for f in fs),peak_log_flow_range=[min(logs),max(logs)] if logs else None,peak_flow_cms_range=[float(np.exp(min(logs))),float(np.exp(max(logs)))] if logs and max(logs)<700 else None))
DOC=ROOT/'docs/round4-2026-11-14';DOC.mkdir(exist_ok=True)
write(DOC/'diagnostics.json',dict(comparisons=comparisons,peaks=peaks))
for folder,run,verification in [('round4',R4,ROOT/'backend/training/reports/round4-independent-verification.json'),('flex-v1',FLEX,ROOT/'backend/training/reports/flex-independent-verification.json')]:
    public=ROOT/'web/public/training'/folder;public.mkdir(parents=True,exist_ok=True)
    for name in ['results.json','protocol.json','metrics.csv', 'heldout_predictions.csv' if folder=='round4' else 'predictions.csv']:
        shutil.copyfile(run/name,public/name)
    shutil.copyfile(verification,public/'verification.json')
for name in ['candidate_training.csv','review_queue.csv','data.json']:
    shutil.copyfile(ROOT/'backend/training/datasets/flex-v1'/name,ROOT/'web/public/training/flex-v1'/name)
write(ROOT/'web/src/data/training-round4.json',dict(**r4,independent_verification=v4,diagnostics=dict(comparisons=comparisons,peaks=peaks)))
write(ROOT/'web/src/data/flex-v1.json',dict(**flex,rows=data['rows'],independent_verification=vf))
table='\n'.join(f"| {m['evaluation']} | {m['subset']} | {m['model']} | {m['group_mae_mms']:.9f} | {m['group_rmse_mms']:.9f} | {m['row_r2']:.6f} |" for m in r4['metrics'])
(DOC/'README.md').write_text(f'''# Round 4: curved-flow hypothesis

Completed14November2026. User authorized the corrected experiment after the report audit. **Primary gate failed.** No promotion to the PMMA simulator; Round2 remains its numerical model. Same69 real measurements, no labels changed, no lunar test rows.

Three fixed models: mixed log-linear control, one added negative squared log-flow feature unconstrained, and the same feature constrained nonnegative (concave log-rate). Fixed ridge alpha1, kappa3.5 and P/P0=1 assumptions, weighted training-only preprocessing. No8.5cm/s peak or planetary ranking imposed.56 reused group splits (30 full pooled,25 strict pooled,1 Earth-to-ISS),168 CUDA float64 fits on Blackwell. Concavity constraint was inactive in every fit; constrained and unconstrained variants therefore coincide. Protocol frozen before fitting; outputs refuse overwrite.

Full pooled curved model: Earth MAE0.013894506 and ISS0.015106519mm/s, versus separate Round2 Earth0.013327814 and ISS0.010490585. Thus Earth error increases4.25%, ISS44.00%. Relative to the pooled linear control, ISS improves9.89%, but this weaker comparison does not meet the utility gate. Predeclared gate required at least10% ISS improvement over separate Round2 with no Earth degradation.

Strict23-row flight sensitivity worsens from0.006216608 to0.006661709mm/s. Earth-only→ISS improves from3.523299288 to1.824486632mm/s but remains dramatically worse than nearest0.016623485. Do not present relative improvement from a failed model as usable transfer. Failure of these variants is not proof that lunar prediction is impossible.

Independent augmented CPU least squares and bounded least squares reproduced all483 predictions,21 metric rows,56 splits and161 Round3 control predictions; maximum difference{v4['max_difference_mms']:.3g}mm/s.176 pre-existing raw/run files passed preservation hashes. These are numerical checks, not independent experimental replication. `diagnostics.json` includes descriptive paired group-bootstrap differences and learned peaks; neither is calibrated predictive uncertainty or lunar evidence.

## All metrics

MAE/RMSE equal-weight groups; row R² is not percentage accuracy. Strict23 flight rows are9.5/12.7mm;11 U01 rows are6.4mm. Cohorts must not be interchanged.

| Evaluation | Subset | Model | Group MAE mm/s | Group RMSE mm/s | Row R² |
| --- | --- | --- | ---: | ---: | ---: |
{table}

## Artifacts and next decision

Frozen run: backend/training/runs/round4-2026-11-14/. Independent verifier: backend/training/verification/verify_round4.py. Web: /training. Protocol/gates/scripts/results are downloadable. No final predictor refit, no updated simulation model, no Round5.

Practical implication: another degree of flow curvature is insufficient on this cohort. Preserve separate within-domain models. Before further PMMA tuning, prioritize compatible new measurements, source-unit resolution or a materially different, justified physical closure. More reuse of the same folds is not new validation.

Worst full-pooled curved cases: Earth S2-R-11 observed0.184, predicted0.27003mm/s (absolute error0.08603); ISS S1-R-01 observed0.100, predicted0.05961mm/s (error0.04039, U01 flagged). Fitted19%-oxygen peak ranges vary by cohort: full pooled3.04–5.09cm/s, strict5.10–7.72cm/s, Earth-only0.0456cm/s. These are model diagnostics, not measured physical peaks. The historical field outside_training_box denotes the derived-flow range check only, not a joint-support guarantee.
''',encoding='utf8')
fd=ROOT/'docs/flex-round1-2026-11-14';fd.mkdir(exist_ok=True)
ft='\n'.join(f"| {m['evaluation']} | {m['subset']} | {m['model']} | {m['rows']} | {m['groups']} | {m['group_mae']:.6f} | {m['group_rmse']:.6f} | {m['row_r2']:.5f} |" for m in flex['metrics'])
secondary=[m for m in flex['metrics'] if m['evaluation']=='date_group_5fold' and m['subset']=='all']
(fd/'README.md').write_text(f'''# FLEX workbench and first measured-rate model

Completed14November2026. **A second exploratory ML target is supported, but it is average droplet burning rate, not validated extinguisher effectiveness or extinction control.** User authorized this optional work alongside PMMA Round4. The datasets and models remain separate.

## Source and compilation

NASA/TP2015-216046, NTRS20150023456, November2015, PDF p25/printed19 defines K as the average slope magnitude from a linear fit of droplet diameter squared versus time from shortly after ignition to extinction. Units **mm²/s**. TableIX pp26–34 gives pressure **mmHg**, initial O2/N2/**CO2**/He mole fractions, initial diameter, K and end labels. [Original NASA source](https://ntrs.nasa.gov/citations/20150023456).

Raw CSV has274 records,258 numeric K values. Original appendix extraction has276 rows and different test numbering. Matched all274 CSV records to original identifiers/times/fuel/end and all9 numeric fields; did not join by CSV row number. A fresh PDF extraction independently verified all274 values and dates and198 unique accepted source IDs. Original raw files unchanged. CSV mislabels K as mm and CO2 as CO; corrected names/units exist only in derived data.

Primary cohort: **198 records,79 conservative condition groups,72 dates;126 methanol and72 heptane**.93 include CO2,44 include He.76 review rows retained. Overlapping exclusion flags:61 disrupted trials,16 missing positive K,12 missing initial diameters,6 composition sums beyond1.1 percentage-point tolerance,2 ambiguous identifier/time records,1 invalid pressure. No imputed pressure0, no renormalized mixtures, no outcome relabeling. Tolerance accommodates nominal composition rounding; it is not a chemical measurement uncertainty. The two original appendix rows absent from CSV were not silently appended.

This is conditional on source-matched, positive-rate non-disrupted trials. Missing support-fiber/translation/residual-motion metadata can confound atmospheric relationships. Recorded end state is historical context, not an input or a predicted suppression label. Visible extinction does not certify absence of cool-flame chemistry. No causal CO2-vs-He ranking is learned here.

## Frozen experiment

Primary5-fold GroupKFold holds out entire fuel/composition/pressure-bin groups, retaining every diameter in its group. Pressure bins round to0.1atm for grouping only; original mmHg remains the feature. Secondary5-fold evaluation holds out complete dates (mixed two-/four-digit date spellings were checked not to split the same day). Condition and date grouping guard different dependencies; neither guarantees unobserved campaign factors are eliminated.

Predictors: fuel indicator, ln pressure, O2, CO2, He, ln initial diameter. No burn time, extinction diameter, test end, date or ID predictors. Baselines: training-only weighted fuel median and same-fuel nearest standardized condition. Models: fixed alpha1 log ridge on CUDA float64;100-tree depth2 log CatBoost on CUDA.10 GPU ridge fits and10 GPU CatBoost fits on NVIDIA RTX PRO500 Blackwell GenerationLaptopGPU; no CPU fallback. CPU independent reconstruction and saved GPU-model reload verify outputs.

Primary log ridge MAE **0.053709784mm²/s**, nearest **0.072343882**, fuel median **0.112910488**. **25.76% error reduction** versus stronger baseline, row R²0.6833. Methanol gain10.88%, heptane35.63% versus respective stronger simple baselines. Primary predefined development screen passes (>=10% overall gain and neither fuel deteriorates>10%). This does not establish a practical engineering error tolerance. CatBoost MAE0.069069361, only4.53% gain, fails the same screen. All results retained; no tuning after outcomes.

Independent check:1584 prediction records (same198 observations reused across4 models and2 evaluations, not1584 experiments),40 metric rows,10 splits; maximum reconstruction difference{vf['max_difference']:.3g}. Fresh source check and hashes retained in backend/training/reports/flex-source-verification.json and flex-independent-verification.json.

## Every score

Group-weighted MAE/RMSE in mm²/s, lower better. CO2/He slices overlap atmospheric/fuel conditions and are not causal treatment effects.

| Evaluation | Subset | Model | Rows | Groups | MAE | RMSE | Row R² |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
{ft}

## Workbench02 and utility

/simulation/flex shows recorded source-linked conditions, observed K and group-held-out predictions, both split schemes, all model scores and review exclusions. A constant-K diameter-squared illustration compares predictions with reported average rates. It is not a measured time series or extinction forecast: ignition transients, varying K and post-visible-flame behavior are not reconstructed. Observed end state and extinction diameter are displayed separately as source values. No arbitrary-input predictor, no suppressant dose recommendation and no claim of planetary validation.

Utility now: compare how well empirical models estimate average burning rate across held-out recorded mixtures/fuels/pressures and identify cases needing further study. For an actual suppression model, audit full time histories, support/motion metadata, gas history and extinction definitions, then define a separate validated target with a domain-relevant tolerance.

Frozen run: backend/training/runs/flex-round1-2026-11-14/. Derived198-row cohort and76-row review queue: backend/training/datasets/flex-v1/. Protocol/data/model hashes preserved. No automatic second FLEX round or PMMA Round5.

Worst primary ridge error: FLEX-130 reported K0.0500 versus predicted0.345257mm²/s, absolute error0.295257. FLEX-276 reported1.0600 versus predicted0.777133 (error0.282867). Large errors remain despite aggregate improvement. The workbench exposes the ten largest errors with condition selection. Secondary date-group ridge MAE0.054871641 versus nearest0.065856481 (16.68% error reduction). Web HTTP/CSS/script/download checks, TypeScript and targeted ESLint pass; visual browser interaction remains unverified because Work browser control is disabled.
''',encoding='utf8')
print(json.dumps(dict(round4_peaks=peaks,flex_secondary=secondary,docs=[str(DOC),str(fd)]),indent=2))
