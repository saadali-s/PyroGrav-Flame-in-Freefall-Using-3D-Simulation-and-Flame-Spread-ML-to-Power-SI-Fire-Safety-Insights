# Round 3: physics bridge development experiment

Completed 14 November 2026. **No tested Earth-only physics variant passed transfer.** A pooled physics feature model improves over a pooled geometry control but is worse than separate within-domain models on the full69-row cohort. A promising strict-unit subgroup needs source repair/confirmation, not promotion as the headline score. Lunar accuracy is still unmeasured. This round rejects the tested implementations for deployment; it does not prove partial-gravity prediction impossible.

## What ran

Same 69 real published candidate rows:35 Earth means/19 condition groups and34 ISS segments/11 provisional specimen groups. No new labels, synthetic observations or lunar rates. A strict sensitivity cohort removes all 11 U01 flagged flight rows from training and evaluation, leaving58 rows total/25 groups and23 flight rows/6 groups.

Five fixed log-ridge variants plus median/nearest baselines. The physical coordinate uses Thomsen 2020 Eq. 6 with explicit pressure/thermal assumptions; the penalty is an oxygen-direction prior, not a full physical-rate residual. See [source audit](source-audit.md). Compare transform-only versus transform+penalty to separate their effects. Three thermal scenarios were declared before the run; do not choose one post hoc based onISS outcomes.

All 37 old folds reused;30 pooled and25 pooled-strict folds added.92 folds,460 CUDA regression fits,184 CPU baseline calculations,1771held-out records,70score rows. No training/test group overlap, no held-out standardization, no clipping, no final production model. Every variant and failure is retained.

## Primary transfer result: train35 Earth rows, test34 ISS rows

Equal-group MAE(mm/s), lower is better:

| Model | MAE |
| --- | ---: |
| Nearest baseline | 0.016623485 |
| Round 2 geometry control, exactly reproduced | 0.026444255 |
| Mixed transform,kappa 3.5 | 3.523299288 |
| Mixed transform,kappa 3.5 + oxygen penalty (primary) | 3.523299288 |
| kappa 1 + penalty sensitivity | 0.109620435 |
| kappa 5.2 + penalty sensitivity | 6.288723401 |

Both the user's below-nearest screen and the earlier 20% improvement gate fail. The old Round 1 raw ridge transfer was0.027722287 mm/s; Round 2 log CatBoost was0.016087221. None of those is a lunar validation result. Reusing theISS test after seeing earlier results means this is development evaluation, even though noISS labels enter these Earth-only fits.

The primary assumed transform puts Earth at23.43–47.62 cm/s andISS at0.48–4.00 cm/s. All 34 ISS rows lie below Earth's transformed flow range. Standardized log-flow spans-17.53 to-8.86 training standard deviations. The fitted flow slope extrapolates badly; exponentiation magnifies the error. Predictions span0.667976–13.909232 mm/s, versus observedISS 0.0203–0.1000 mm/s. These implausible predictions are exposed, not capped into apparent success. The oxygen penalty is inactive on the Earth-only fit because its oxygen slopes already meet that prior. It cannot repair the missing low-flow response. Units, limiting cases and independent CPU optimization reproduce the failure.

## What pooling does and does not establish

Full pooled group MAE: geometry control0.017215714; primary physics0.015338186 mm/s, a10.91% reduction. However, pooled primary Earth's MAE is0.014530072 and flight's is0.016734020. Separate Round 2 geometry models achieve0.013327814 and0.010490585 respectively on the same held-out domain groups. Pooling therefore has not established a full-cohort utility improvement over available separate models.

Strict-unit sensitivity: pooled primary flight MAE0.006216608 mm/s versus same 23-row separate control0.010167488, a38.86% reduction. This is23 rows/6 groups with 11flagged rows excluded, not all 34 ISS rows. Their removal also changes pooled training. It cannot prove the unit flags caused the discrepancy, nor can the smaller-cohort score replace the full result. This is a concrete lead to investigate by resolving original source units and specimen mapping.

No partial-gravity rate score exists. The NASA deck's real partial-g markers have a different label/configuration; Takahashi full text remains unacquired. No new lunar predictions, pressure sliders or certified mode were released.

## Verification and Blackwell

PyTorch CUDA float64 executed all 460 regression solves on NVIDIA RTX PRO500 Blackwell GenerationLaptopGPU; CPU handled preprocessing, baselines and independent verification. These small solves do not need a large GPU for speed. Device records and GPU monitoring are retained (observed peak5% utilization/182 MiB; process-specific attribution is not inferred from the utilization snapshot alone).

Independent NumPy/SciPy code, without importing the training runner, reproduced all 1771 predictions and70 metrics; max prediction difference1.14e-12 mm/s. It reproduced126 Round 2 control predictions, checked all 92 group splits, Earth-only training, strict-unit exclusions and formula limits.53 raw source files and100 prior run artifacts match their original hashes. No original files were deleted or changed.

Protocol and script copies were frozen before fitting. Run: `backend/training/runs/round3-2026-11-14/`. Independent check: `backend/training/round3-independent-verification.json`. Re-run verification with `backend/venv/Scripts/python.exe backend/training/verify_round3.py`; the trainer refuses to overwrite an existing run.

## Research handoff: problems to solve before another model

1. **Source ambiguity:** resolve U01 for 11 flight rows against original supplement units and independent records, preserving all labels until evidence supports changes. Never infer corrected units from improved scores.
2. **Low-flow identification:** a transformed Earth-only sample still has no observedISS-like low-flow region. Need compatible experiments or a separately justified low-flow heat-loss/chemistry model with measured inputs. Changing a scalar axis alone is insufficient here.
3. **Thermal/pressure inputs:** kappa is assumed and highly consequential. Find original measured ambient/thermal/pressure metadata; separate the model-form uncertainty from fit uncertainty. Do not tune kappa on this reused test and call it a prediction.
4. **Partial gravity:** acquire full Takahashi paper/supplement to establish precise geometry, units, target, timing and grouping; alternatively define a new boundary-classification contract for Olson 2024. Do not merge extinction/oxygen-index or thin-sheet labels with rod rates.
5. **Independent confirmation:** BASS-informed theory and repeatedly seenISS outcomes do not provide independent validation. Preserve a compatible new campaign for confirmation, with task-specific error and uncertainty criteria.

Recommended next bounded step: resolve the 11 U01 source-unit flags. Do not run an automatic Round 4. The user should review the all-results page first. Continue the research question; do not deploy this bridge for lunar fire decisions.

## Every score

MAE/RMSE equal-weight experimental groups; R² is row-level. Different strict cohorts are not directly interchangeable. Large negative transfer R² values are real failures of these fitted variants.

| Evaluation | Subset | Model | Rows | Groups | Group MAE(mm/s) | Group RMSE(mm/s) | Row R² |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| earth_logo | all | median | 35 | 19 | 0.042044737 | 0.054270262 | -0.214240 |
| earth_logo | all | nearest | 35 | 19 | 0.022428947 | 0.025229168 | 0.752112 |
| earth_logo | all | geometry_control | 35 | 19 | 0.013327814 | 0.021557071 | 0.810214 |
| earth_logo | all | mixed_3p5 | 35 | 19 | 0.013174240 | 0.018206458 | 0.865591 |
| earth_logo | all | mixed_3p5_penalty | 35 | 19 | 0.013174240 | 0.018206458 | 0.865591 |
| earth_logo | all | mixed_1_penalty | 35 | 19 | 0.013468570 | 0.020267345 | 0.836119 |
| earth_logo | all | mixed_5p2_penalty | 35 | 19 | 0.013173520 | 0.018140761 | 0.864348 |
| microgravity_logo | all | median | 34 | 11 | 0.019487121 | 0.022750473 | -0.171025 |
| microgravity_logo | all | nearest | 34 | 11 | 0.021521970 | 0.025124706 | -0.268235 |
| microgravity_logo | all | geometry_control | 34 | 11 | 0.010490585 | 0.013621110 | 0.565077 |
| microgravity_logo | all | mixed_3p5 | 34 | 11 | 0.010490585 | 0.013621110 | 0.565077 |
| microgravity_logo | all | mixed_3p5_penalty | 34 | 11 | 0.010487822 | 0.013617720 | 0.565287 |
| microgravity_logo | all | mixed_1_penalty | 34 | 11 | 0.010487822 | 0.013617720 | 0.565287 |
| microgravity_logo | all | mixed_5p2_penalty | 34 | 11 | 0.010487822 | 0.013617720 | 0.565287 |
| microgravity_strict_units_logo | all | median | 23 | 6 | 0.011770833 | 0.016195871 | -0.269264 |
| microgravity_strict_units_logo | all | nearest | 23 | 6 | 0.022593056 | 0.027449486 | -1.859022 |
| microgravity_strict_units_logo | all | geometry_control | 23 | 6 | 0.010167488 | 0.013034063 | 0.277044 |
| microgravity_strict_units_logo | all | mixed_3p5 | 23 | 6 | 0.010167488 | 0.013034063 | 0.277044 |
| microgravity_strict_units_logo | all | mixed_3p5_penalty | 23 | 6 | 0.010060558 | 0.012924119 | 0.288550 |
| microgravity_strict_units_logo | all | mixed_1_penalty | 23 | 6 | 0.010060558 | 0.012924119 | 0.288550 |
| microgravity_strict_units_logo | all | mixed_5p2_penalty | 23 | 6 | 0.010060558 | 0.012924119 | 0.288550 |
| earth_to_microgravity | all | median | 34 | 11 | 0.019399242 | 0.023125430 | -0.361065 |
| earth_to_microgravity | all | nearest | 34 | 11 | 0.016623485 | 0.023560044 | -0.625404 |
| earth_to_microgravity | all | geometry_control | 34 | 11 | 0.026444255 | 0.031628373 | -1.350732 |
| earth_to_microgravity | all | mixed_3p5 | 34 | 11 | 3.523299288 | 4.344647219 | -57206.606042 |
| earth_to_microgravity | all | mixed_3p5_penalty | 34 | 11 | 3.523299288 | 4.344647219 | -57206.606042 |
| earth_to_microgravity | all | mixed_1_penalty | 34 | 11 | 0.109620435 | 0.132704362 | -53.571197 |
| earth_to_microgravity | all | mixed_5p2_penalty | 34 | 11 | 6.288723401 | 7.947923418 | -191471.245021 |
| pooled_logo | all | median | 69 | 30 | 0.032586944 | 0.045521614 | -0.083145 |
| pooled_logo | all | nearest | 69 | 30 | 0.021437500 | 0.025950016 | 0.576959 |
| pooled_logo | all | geometry_control | 69 | 30 | 0.017215714 | 0.022399107 | 0.738805 |
| pooled_logo | all | mixed_3p5 | 69 | 30 | 0.015351880 | 0.020817702 | 0.754029 |
| pooled_logo | all | mixed_3p5_penalty | 69 | 30 | 0.015338186 | 0.020795641 | 0.754647 |
| pooled_logo | all | mixed_1_penalty | 69 | 30 | 0.015700866 | 0.021813842 | 0.731261 |
| pooled_logo | all | mixed_5p2_penalty | 69 | 30 | 0.015281509 | 0.020672569 | 0.757668 |
| pooled_logo | earth | median | 35 | 19 | 0.039934211 | 0.054370336 | -0.233480 |
| pooled_logo | earth | nearest | 35 | 19 | 0.023981579 | 0.027425226 | 0.702600 |
| pooled_logo | earth | geometry_control | 35 | 19 | 0.015778297 | 0.021925360 | 0.838346 |
| pooled_logo | earth | mixed_3p5 | 35 | 19 | 0.014534341 | 0.021026779 | 0.818241 |
| pooled_logo | earth | mixed_3p5_penalty | 35 | 19 | 0.014530072 | 0.021010551 | 0.818531 |
| pooled_logo | earth | mixed_1_penalty | 35 | 19 | 0.014647734 | 0.022192041 | 0.799298 |
| pooled_logo | earth | mixed_5p2_penalty | 35 | 19 | 0.014544457 | 0.020925823 | 0.819627 |
| pooled_logo | microgravity | median | 34 | 11 | 0.019896212 | 0.023354938 | -0.345873 |
| pooled_logo | microgravity | nearest | 34 | 11 | 0.017043182 | 0.023181855 | -0.652922 |
| pooled_logo | microgravity | geometry_control | 34 | 11 | 0.019698524 | 0.023194616 | -0.154874 |
| pooled_logo | microgravity | mixed_3p5 | 34 | 11 | 0.016763992 | 0.020451537 | 0.092986 |
| pooled_logo | microgravity | mixed_3p5_penalty | 34 | 11 | 0.016734020 | 0.020419106 | 0.096284 |
| pooled_logo | microgravity | mixed_1_penalty | 34 | 11 | 0.017519914 | 0.021144661 | 0.021983 |
| pooled_logo | microgravity | mixed_5p2_penalty | 34 | 11 | 0.016554599 | 0.020227664 | 0.114368 |
| pooled_strict_units_logo | all | median | 58 | 25 | 0.037186333 | 0.051706566 | -0.180341 |
| pooled_strict_units_logo | all | nearest | 58 | 25 | 0.022142333 | 0.026679365 | 0.616607 |
| pooled_strict_units_logo | all | geometry_control | 58 | 25 | 0.014205284 | 0.020282310 | 0.795661 |
| pooled_strict_units_logo | all | mixed_3p5 | 58 | 25 | 0.012363052 | 0.018489572 | 0.845086 |
| pooled_strict_units_logo | all | mixed_3p5_penalty | 58 | 25 | 0.012363052 | 0.018489572 | 0.845086 |
| pooled_strict_units_logo | all | mixed_1_penalty | 58 | 25 | 0.012945208 | 0.020187925 | 0.817007 |
| pooled_strict_units_logo | all | mixed_5p2_penalty | 58 | 25 | 0.012302394 | 0.018259888 | 0.848606 |
| pooled_strict_units_logo | earth | median | 35 | 19 | 0.042334211 | 0.057918098 | -0.412825 |
| pooled_strict_units_logo | earth | nearest | 35 | 19 | 0.023476316 | 0.026948213 | 0.713675 |
| pooled_strict_units_logo | earth | geometry_control | 35 | 19 | 0.014787699 | 0.021233412 | 0.821539 |
| pooled_strict_units_logo | earth | mixed_3p5 | 35 | 19 | 0.014304034 | 0.020554562 | 0.822789 |
| pooled_strict_units_logo | earth | mixed_3p5_penalty | 35 | 19 | 0.014304034 | 0.020554562 | 0.822789 |
| pooled_strict_units_logo | earth | mixed_1_penalty | 35 | 19 | 0.014924410 | 0.022537990 | 0.786959 |
| pooled_strict_units_logo | earth | mixed_5p2_penalty | 35 | 19 | 0.014227081 | 0.020280603 | 0.827474 |
| pooled_strict_units_logo | microgravity | median | 23 | 6 | 0.020884722 | 0.022743531 | -1.025751 |
| pooled_strict_units_logo | microgravity | nearest | 23 | 6 | 0.017918056 | 0.025809545 | -2.482421 |
| pooled_strict_units_logo | microgravity | geometry_control | 23 | 6 | 0.012360970 | 0.016921411 | -0.432890 |
| pooled_strict_units_logo | microgravity | mixed_3p5 | 23 | 6 | 0.006216608 | 0.009303196 | 0.599685 |
| pooled_strict_units_logo | microgravity | mixed_3p5_penalty | 23 | 6 | 0.006216608 | 0.009303196 | 0.599685 |
| pooled_strict_units_logo | microgravity | mixed_1_penalty | 23 | 6 | 0.006677734 | 0.009465279 | 0.587814 |
| pooled_strict_units_logo | microgravity | mixed_5p2_penalty | 23 | 6 | 0.006207551 | 0.009316951 | 0.597998 |
