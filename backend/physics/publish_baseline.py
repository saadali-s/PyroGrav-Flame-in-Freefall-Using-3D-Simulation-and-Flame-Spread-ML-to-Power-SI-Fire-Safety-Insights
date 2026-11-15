import json,hashlib,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];RUN=ROOT/'backend/physics/runs/physics-baseline-v1-2026-11-14';DOC=ROOT/'docs/physics-baseline-2026-11-14'
DOC.mkdir(exist_ok=True,parents=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report=json.loads((RUN/'results.json').read_text());verify=json.loads((ROOT/'backend/physics/baseline-verification.json').read_text());assert verify['passed']
sources=[('Delichatsios_2000_Creeping_Cylinders.pdf','https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=910108','NIST scanned reprint;9PDFpages,printed2835–2842'),('Thomsen_2019_Normoxic_PMMA_rod.pdf','https://ira.lib.polyu.edu.hk/bitstream/10397/89519/1/38_FSJ_2019_Normoxic_PMMA_rod.pdf','Author manuscript;12pages;DOI10.1016/j.firesaf.2019.102903'),('Thomsen_2019_Concurrent_PMMA.pdf','https://ntrs.nasa.gov/api/citations/20200000557/downloads/20200000557.pdf','NASA accepted manuscript;DOI10.1016/j.combustflame.2018.10.016')]
manifest=[]
for name,url,version in sources:
    p=ROOT/'backend/data/raw_papers/physics_baseline_2026-11-14'/name
    manifest.append(dict(path=p.relative_to(ROOT).as_posix(),url=url,version=version,date='2026-11-14',bytes=p.stat().st_size,sha256=sha(p),training_labels_added=0))
(DOC/'source-acquisition.json').write_text(json.dumps(manifest,indent=2)+'\n')
physics={r['id']:dict(rate=r['rate_mms'],status=r['status'],roots=r['roots_mms'],terms=r['terms']) for r in report['records'] if r['scenario']=='published_closure_primary'}
snapshot=dict(rows=physics,metrics=report['metrics'],protocol=report['protocol'],verification=verify)
(ROOT/'web/src/data/physics-baseline.json').write_text(json.dumps(snapshot,indent=2)+'\n')
public=ROOT/'web/public/training/physics-baseline';public.mkdir(exist_ok=True,parents=True)
for p in [RUN/'results.json',RUN/'protocol.json',ROOT/'backend/physics/baseline-verification.json']:shutil.copyfile(p,public/p.name)
table='\n'.join('| '+ ' | '.join([m['scenario'],m['environment'],f"{m['predicted_rows']}/{m['rows']}",'—' if m['group_mae_mms'] is None else f"{m['group_mae_mms']:.6f}",'—' if m['paired_available_mae_mms'] is None else f"{m['paired_available_mae_mms']:.6f}"])+' |' for m in report['metrics'])
(DOC/'README.md').write_text('''# Physics-only baseline v1 — 14 November 2026

Implemented and tested a conditional cylindrical energy balance, with **zero locally fitted parameters and no ML predictor**. This is not yet an accurate simulator: primary Earth group MAE is **0.182500 mm/s** versus Round2 ML **0.013328**. Only8/34 ISS rows have a bracketed unique solution;26 abstain. No full-ISS score is reported. These missing solutions are failures to describe observed spreading burns, not measured extinction. No Moon/Mars accuracy or production-readiness claim.

## Equation and provenance audit

Original [Delichatsios et al.2000, NIST reprint](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=910108), PDFp3 Eq1 and p5 Eq7 (printed2836/2838), provides a cylindrical energy balance. Let v be spread speed, r radius, Vr=U+v, Lh=alpha_h/Vr, Lc=alpha_c/Vr, and d=min(r,sqrt(alpha_s*Lh/v)). Solve:

`rho_s cp_s (Tp-Ta) v d (1-d/(2r)) = F(C Lc/r) E_FL - epsilon sigma (Tp^4-Ta^4) Lh`, where `F(x)=x/log(1+x)`.

Each side has W/m units. The finite-depth annulus joins thin and thick heating without an arbitrary harmonic average. Solid diffusivity is ks/(rho_s cp_s). Unknown v also enters relative flow; the nonlinear solve returns a speed only when a unique sign-changing root is found. Missing/multiple roots abstain. A fixed1e-10–1m/s search interval is a numerical limitation, not a validated physical bound. Tangential roots are not guaranteed detectable.

**Inherited calibration matters:** the original source obtains effective flame energy and diffusivities from numerical flat-flame results. We have no local fitting, but cannot call this fully first-principles or calibration-free. The source's 40cm/s forced-flow coefficients do not establish validity at our low ISS velocities.

| Input | Value and units | Evidence status |
| --- | --- | --- |
| Rod diameter, imposed flow, oxygen | Each frozen candidate row, converted to SI | Published data with existing group/unit flags preserved |
| rho_s, cp_s, Tp |1190kg/m³,1465J/(kg K),640K | Delichatsios PDFp5/printed2838 model inputs; not per-run measurements |
| alpha_h, alpha_c |8.8e-4,1.7e-4m²/s | PDFp6/printed2839 effective coefficients; not interchangeable measured gas properties |
| C |3.21 | Forced-flow curvature coefficient, PDFp5; retained for all environments as an explicit simplification |
| E_FL at air |127W/m at oxygen mass fraction0.233 | PDFp5; derived by the authors from numerical thin-fuel results at40cm/s |
| Oxygen dependence |E_FL=127*(Y/0.233), Y=32x/(32x+28(1-x)) | Our proportional continuation below air oxygen, assuming O2/N2; not measured flame energy |
| ks |0.19W/(m K) | Thomsen concurrent-PMMA NASA manuscript Table1 PDFp17; borrowed material property, not evidence of same thermal regime |
| Ta |300K | Scenario assumption |
| Emissivity |1 | Source idealization, not measured black-rod emissivity |
| P/P0 |1 | Scenario assumption, not a recovered row label |
| Gravity flow map |Thomsen2020 Eq6, kappa=3.5 | Our extension of the energy balance using the previously declared thermal assumption; not source-exact reproduction |

The source gives a separate natural-flow treatment and explicitly warns that gas radiation changes low-flow behavior and effective length scales. We do not combine its air forced-flow E_FL with claims that low-flow gas radiation is fully solved. Surface reradiation is present; a condition-dependent gas radiative-loss/chemistry closure is absent. This distinction is a major unresolved modeling issue.

Companion [Thomsen2019 normoxic rods](https://ira.lib.polyu.edu.hk/bitstream/10397/89519/1/38_FSJ_2019_Normoxic_PMMA_rod.pdf), PDFp8 Eq1–3, supports thermal limiting models, but not automatic applicability near extinction. Three original PDFs were acquired unchanged; hashes/versions are in source-acquisition.json. No new experimental labels were extracted.

### Expressions not copied verbatim

The2020 accepted manuscript PDFp10 prints a surface-radiation expression with a temperature difference rather than fourth powers; interpreted literally with Stefan–Boltzmann sigma, it is dimensionally inconsistent. PDFp11 Eq7–10 uses P in positions where a density-based Reynolds scaling would need an equation of state or dimensional constants. We did not silently repair these into a claimed exact published solver. The2000 energy balance states fourth-power radiation explicitly and supports unit-consistent implementation. Differences from the final typeset2020 version remain unverified; these are manuscript observations, not an allegation about all versions of the paper.

## Fixed experiment and results

Protocol frozen before execution: backend/physics/baseline_protocol.json. Five scenarios: primary, no surface radiation, half flame energy, kappa1 and5.2. None chosen or retuned after scoring. All69 real candidate rows preserved. Primary constants do not depend on their labels; data were already seen in prior development, and theory is not independent experimental validation. No new ML round or calibration was performed. CPU scalar numerical solving is appropriate; no Blackwell execution is claimed for this step.

Equal-group MAE inmm/s. Coverage is reported before error. An available-row score is explicitly conditional, never the full-cohort score. The strict subset excludes11U01 flight rows; its ML comparator is the full-flight Round2 model's predictions restricted to those rows, not a separately retrained strict model.

| Scenario | Environment | Predictions/rows | Full-cohort MAE | Available-row MAE |
| --- | --- | ---: | ---: | ---: |
'''+table+'''

For the primary8-row ISS subset, physics MAE0.047259 versus paired ML0.014211mm/s. Do not compare this physics score to the full34-row ML score as if the cohorts match. With surface radiation removed, all34ISS predictions exist but MAE is0.274592mm/s versus ML0.010491. Removing a loss term is an ablation, not a physically justified fix. All tested Earth variants are worse than the earlier nearest baseline0.022429mm/s.

## Independent verification

345 scenario/row outputs were independently reconstructed without importing the solver: an annular-area formulation,20,001-point scan and80-step bisection reproduce rates to within2.81e-13mm/s and all missing-root statuses. Existing raw files and prior training artifacts passed hashes. This verifies implementation consistency, not physical accuracy. Frozen outputs: backend/physics/runs/physics-baseline-v1-2026-11-14/. Verification: backend/physics/baseline-verification.json.

## What this permits next

The baseline is suitable for exposing a model discrepancy and for developing a testable heat-transfer model. It is not a good pseudo-label generator, an uncertainty bound, or a safety decision tool. Do not train ML to imitate its failed low-flow behavior. Future hybrid work should first test a corrected/calibrated closure, split calibration groups from evaluation groups, and compare against the existing ML. Intermediate gravity remains an unvalidated extension.

Recommended next scientific step: resolve the low-flow energy/length closures from the original paper's cited microgravity studies or measured heat-feedback data, then propose one fixed calibration/validation experiment. Missing quantities are now specific enough for targeted Gemini research: effective gas thermal length versus imposed flow; independent flame energy/heat feedback for17–21% O2 black PMMA opposed rods; gas-radiation correction and chemistry near the spreading limit; and corresponding uncertainties. Do not return guessed coefficients or substitute surface regression for leading-edge spread.

The requested simulation workbench uses this baseline as an explicitly conditional comparison, alongside frozen Round2 held-out ML and measured-rate kinematics. Geometry/glow are illustrations, not CFD or recorded video. No automatic next training round.
''',encoding='utf8')
print('Published physics baseline and evidence documentation.')
