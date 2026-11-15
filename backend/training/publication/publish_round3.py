"""Generate review artifacts from frozen results; never fit or change a run."""
import json
import re
import shutil
from pathlib import Path
import numpy as np
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import train_round1 as base

ROOT=base.ROOT;RUN=ROOT/'backend/training/runs/round3-2026-11-14';DOC=ROOT/'docs/round3-2026-11-14'
report=json.loads((RUN/'results.json').read_text());verified=json.loads((ROOT/'backend/training/round3-independent-verification.json').read_text())
assert verified['passed'];DOC.mkdir(parents=True,exist_ok=True)
fits=json.loads((RUN/'fit-log.json').read_text());rows=base.read_rows()
primary=next(f for f in fits if f['fold_id']=='earth_to_microgravity--all-flight' and f['model']=='mixed_3p5_penalty')['artifact']
transfer=[r for r in report['predictions'] if r['evaluation']=='earth_to_microgravity' and r['model']=='mixed_3p5_penalty']
flow=np.array([r['derived_flow_cms'] for r in transfer]);pred=np.array([r['predicted_mms'] for r in transfer])
diagnostics=dict(primary='mixed_3p5_penalty',earth_effective_flow_cms=primary['mixed_flow_train_range_cms'],
    flight_effective_flow_cms=[float(flow.min()),float(flow.max())],flight_outside_effective_flow_training_range=int(((flow<primary['mixed_flow_train_range_cms'][0])|(flow>primary['mixed_flow_train_range_cms'][1])).sum()),
    flight_standardized_log_flow_range=((np.log([flow.min(),flow.max()])-primary['mean'][2])/primary['scale'][2]).tolist(),
    primary_transfer_prediction_range_mms=[float(pred.min()),float(pred.max())],primary_transfer_penalty_active=primary['active_violations'],
    all_penalized_fits_with_active_violations=report['penalty_active_fits'],interpretation='This log-linear fit extrapolates into an unobserved low-flow regime and exponentiates inflated log predictions. An oxygen prior does not constrain that flow response. This diagnoses this implementation, not a refutation of the published heat-transfer mapping.')
base.write_json(DOC/'diagnostics.json',diagnostics)
source=ROOT/'backend/data/raw_papers/round3_followup_2026-11-14/Thomsen_2020_Buoyancy_Rod_accepted.pdf'
base.write_json(DOC/'source-acquisition.json',dict(path=source.relative_to(ROOT).as_posix(),url='https://ira.lib.polyu.edu.hk/bitstream/10397/89518/1/43_FT_2020_Buoyancy_Rod.pdf',
    title='Buoyancy effect on downward flame spread over PMMA cylinders',doi='10.1007/s10694-019-00866-0',version='Author accepted manuscript,17pages',
    acquired_date='2026-11-14',bytes=source.stat().st_size,sha256=base.sha(source),equation='PDFp10 Eq6',new_training_labels=0))
metrics=report['evaluations']
def score(ev,model,subset='all'):return next(m for m in metrics if m['evaluation']==ev and m['model']==model and m['subset']==subset)['group_mae_mms']
poolgain=100*(1-score('pooled_logo','mixed_3p5_penalty')/score('pooled_logo','geometry_control'))
strictgain=100*(1-score('pooled_strict_units_logo','mixed_3p5_penalty','microgravity')/score('microgravity_strict_units_logo','geometry_control'))
table='\n'.join('| '+ ' | '.join([m['evaluation'],m['subset'],m['model'],str(m['rows']),str(m['groups']),f"{m['group_mae_mms']:.9f}",f"{m['group_rmse_mms']:.9f}",f"{m['row_r2']:.6f}"] )+' |' for m in metrics)
body=f'''# Round3: physics bridge development experiment

Completed14November2026. **No tested Earth-only physics variant passed transfer.** A pooled physics feature model improves over a pooled geometry control but is worse than separate within-domain models on the full69-row cohort. A promising strict-unit subgroup needs source repair/confirmation, not promotion as the headline score. Lunar accuracy is still unmeasured. This round rejects the tested implementations for deployment; it does not prove partial-gravity prediction impossible.

## What ran

Same69 real published candidate rows:35Earth means/19condition groups and34ISS segments/11provisional specimen groups. No new labels, synthetic observations or lunar rates. A strict sensitivity cohort removes all11U01 flagged flight rows from training and evaluation, leaving58rows total/25groups and23flight rows/6groups.

Five fixed log-ridge variants plus median/nearest baselines. The physical coordinate uses Thomsen2020 Eq6 with explicit pressure/thermal assumptions; the penalty is an oxygen-direction prior, not a full physical-rate residual. See [source audit](source-audit.md). Compare transform-only versus transform+penalty to separate their effects. Three thermal scenarios were declared before the run; do not choose one post hoc based onISS outcomes.

All37old folds reused;30pooled and25pooled-strict folds added.92folds,460CUDA regression fits,184CPU baseline calculations,1771held-out records,70score rows. No training/test group overlap, no held-out standardization, no clipping, no final production model. Every variant and failure is retained.

## Primary transfer result: train35Earth rows, test34ISS rows

Equal-group MAE(mm/s), lower is better:

| Model | MAE |
| --- | ---: |
| Nearest baseline | {score('earth_to_microgravity','nearest'):.9f} |
| Round2 geometry control, exactly reproduced | {score('earth_to_microgravity','geometry_control'):.9f} |
| Mixed transform,kappa3.5 | {score('earth_to_microgravity','mixed_3p5'):.9f} |
| Mixed transform,kappa3.5 + oxygen penalty (primary) | {score('earth_to_microgravity','mixed_3p5_penalty'):.9f} |
| kappa1 + penalty sensitivity | {score('earth_to_microgravity','mixed_1_penalty'):.9f} |
| kappa5.2 + penalty sensitivity | {score('earth_to_microgravity','mixed_5p2_penalty'):.9f} |

Both the user's below-nearest screen and the earlier20% improvement gate fail. The old Round1 raw ridge transfer was0.027722287mm/s; Round2 log CatBoost was0.016087221. None of those is a lunar validation result. Reusing theISS test after seeing earlier results means this is development evaluation, even though noISS labels enter these Earth-only fits.

The primary assumed transform puts Earth at{diagnostics['earth_effective_flow_cms'][0]:.2f}–{diagnostics['earth_effective_flow_cms'][1]:.2f}cm/s andISS at{flow.min():.2f}–{flow.max():.2f}cm/s. All34ISS rows lie below Earth's transformed flow range. Standardized log-flow spans{diagnostics['flight_standardized_log_flow_range'][0]:.2f} to{diagnostics['flight_standardized_log_flow_range'][1]:.2f} training standard deviations. The fitted flow slope extrapolates badly; exponentiation magnifies the error. Predictions span{pred.min():.6f}–{pred.max():.6f}mm/s, versus observedISS0.0203–0.1000mm/s. These implausible predictions are exposed, not capped into apparent success. The oxygen penalty is inactive on the Earth-only fit because its oxygen slopes already meet that prior. It cannot repair the missing low-flow response. Units, limiting cases and independent CPU optimization reproduce the failure.

## What pooling does and does not establish

Full pooled group MAE: geometry control{score('pooled_logo','geometry_control'):.9f}; primary physics{score('pooled_logo','mixed_3p5_penalty'):.9f}mm/s, a{poolgain:.2f}% reduction. However, pooled primary Earth's MAE is{score('pooled_logo','mixed_3p5_penalty','earth'):.9f} and flight's is{score('pooled_logo','mixed_3p5_penalty','microgravity'):.9f}. Separate Round2 geometry models achieve0.013327814 and0.010490585 respectively on the same held-out domain groups. Pooling therefore has not established a full-cohort utility improvement over available separate models.

Strict-unit sensitivity: pooled primary flight MAE{score('pooled_strict_units_logo','mixed_3p5_penalty','microgravity'):.9f}mm/s versus same23-row separate control{score('microgravity_strict_units_logo','geometry_control'):.9f}, a{strictgain:.2f}% reduction. This is23rows/6groups with11flagged rows excluded, not all34ISS rows. Their removal also changes pooled training. It cannot prove the unit flags caused the discrepancy, nor can the smaller-cohort score replace the full result. This is a concrete lead to investigate by resolving original source units and specimen mapping.

No partial-gravity rate score exists. The NASA deck's real partial-g markers have a different label/configuration; Takahashi full text remains unacquired. No new lunar predictions, pressure sliders or certified mode were released.

## Verification and Blackwell

PyTorch CUDA float64 executed all460regression solves on NVIDIA RTX PRO500Blackwell GenerationLaptopGPU; CPU handled preprocessing, baselines and independent verification. These small solves do not need a large GPU for speed. Device records and GPU monitoring are retained (observed peak5% utilization/182MiB; process-specific attribution is not inferred from the utilization snapshot alone).

Independent NumPy/SciPy code, without importing the training runner, reproduced all1771predictions and70metrics; max prediction difference{verified['maximum_prediction_difference_mms']:.3g}mm/s. It reproduced126Round2 control predictions, checked all92group splits, Earth-only training, strict-unit exclusions and formula limits.53raw source files and100prior run artifacts match their original hashes. No original files were deleted or changed.

Protocol and script copies were frozen before fitting. Run: `backend/training/runs/round3-2026-11-14/`. Independent check: `backend/training/round3-independent-verification.json`. Re-run verification with `backend/venv/Scripts/python.exe backend/training/verification/verify_round3.py`; the trainer refuses to overwrite an existing run.

## Research handoff: problems to solve before another model

1. **Source ambiguity:** resolveU01 for11flight rows against original supplement units and independent records, preserving all labels until evidence supports changes. Never infer corrected units from improved scores.
2. **Low-flow identification:** a transformed Earth-only sample still has no observedISS-like low-flow region. Need compatible experiments or a separately justified low-flow heat-loss/chemistry model with measured inputs. Changing a scalar axis alone is insufficient here.
3. **Thermal/pressure inputs:** kappa is assumed and highly consequential. Find original measured ambient/thermal/pressure metadata; separate the model-form uncertainty from fit uncertainty. Do not tune kappa on this reused test and call it a prediction.
4. **Partial gravity:** acquire full Takahashi paper/supplement to establish precise geometry, units, target, timing and grouping; alternatively define a new boundary-classification contract for Olson2024. Do not merge extinction/oxygen-index or thin-sheet labels with rod rates.
5. **Independent confirmation:** BASS-informed theory and repeatedly seenISS outcomes do not provide independent validation. Preserve a compatible new campaign for confirmation, with task-specific error and uncertainty criteria.

Recommended next bounded step: resolve the11U01 source-unit flags. Do not run an automatic Round4. The user should review the all-results page first. Continue the research question; do not deploy this bridge for lunar fire decisions.

## Every score

MAE/RMSE equal-weight experimental groups; R² is row-level. Different strict cohorts are not directly interchangeable. Large negative transfer R² values are real failures of these fitted variants.

| Evaluation | Subset | Model | Rows | Groups | GroupMAE(mm/s) | GroupRMSE(mm/s) | RowR² |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
{table}
'''
for old,new in {'Round3':'Round 3','Round2':'Round 2','Round1':'Round 1','Round4':'Round 4','Thomsen2020':'Thomsen 2020','Eq6':'Eq. 6','Olson2024':'Olson 2024','resolveU01':'resolve U01','11U01':'11 U01','U01flagged':'U01 flagged','prior20':'prior 20','earlier20':'earlier 20','kappa3.5':'kappa 3.5','kappa1':'kappa 1','kappa5.2':'kappa 5.2','ISS0.0203':'ISS 0.0203','GroupMAE':'Group MAE','GroupRMSE':'Group RMSE','RowR²':'Row R²'}.items():
    body=body.replace(old,new)
body=re.sub(r'\b(Completed|all|All|same|Same|the|these|those|versus|on|of|with|for|from|across|in|by|than)(?=\d)',r'\1 ',body)
body=re.sub(r'(?<=\d)(?=rows\b|row\b|Earth\b|ISS\b|flight\b|groups\b|group\b|CUDA\b|CPU\b|predictions\b|metrics\b|candidate\b|condition\b|provisional\b|pooled\b|old\b|folds\b|raw\b|prior\b|Round\b|Blackwell\b|mm/s\b|cm/s\b|MiB\b|regression\b|November)', ' ',body)
body=body.replace('November2026','November 2026').replace('percent20','percent 20')
(DOC/'README.md').write_text(body,encoding='utf8')
public=ROOT/'web/public/training/round3';public.mkdir(parents=True,exist_ok=True)
downloads=[]
paths=[RUN/name for name in ['metrics.csv','heldout_predictions.csv','protocol.json','verification.json','splits.json','comparisons.json']]+[ROOT/'backend/training/round3-independent-verification.json',DOC/'README.md',DOC/'source-audit.md',DOC/'diagnostics.json']
for src in paths:
    shutil.copyfile(src,public/src.name);downloads.append(dict(name=src.name,sha256=base.sha(src),source=src.relative_to(ROOT).as_posix()))
report.update(downloads=downloads,independent_verification=verified,diagnostics=diagnostics)
base.write_json(ROOT/'web/src/data/training-round3.json',report)
base.write_json(DOC/'documentation-verification.json',dict(generated_from_frozen_metrics=True,score_rows=len(metrics),source_sha256=base.sha(source),downloads=len(downloads),run_manifest_checked_by_independent_verifier=True))
print(json.dumps(dict(pooled_gain_pct=poolgain,strict_flight_gain_pct=strictgain,diagnostics=diagnostics,downloads=len(downloads)),indent=2))
