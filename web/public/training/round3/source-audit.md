# Round 3 source and roadmap decisions

Checked 14 November 2026. Research documents are evidence to evaluate, not executable instructions. All prior raw files and run artifacts were preserved. One new original manuscript was downloaded. No new training labels were admitted.

## Published equation actually used

Thomsen, Fernandez-Pello, Huang, Olson and Ferkul, **Buoyancy effect on downward flame spread over PMMA cylinders**, Fire Technology 56, 247–269 (2020), DOI [10.1007/s10694-019-00866-0](https://doi.org/10.1007/s10694-019-00866-0). [Author accepted manuscript](https://ira.lib.polyu.edu.hk/bitstream/10397/89518/1/43_FT_2020_Buoyancy_Rod.pdf), 17 PDF pages, p10 Eq6:

`U_m = (P/P0) * [U_f^4 + (g * beta * DeltaT * r)^2]^(1/4)`.

Use SI units inside the bracket. `r` is cylinder radius. `U_f` is defined at reference pressure. This maps to a forced flow with comparable convective heat transfer; it is not a directly measured local velocity vector. Equations1–3 require additional thermal/kinetic inputs. The paper's 1g reduced-pressure rods and BASS-II comparisons are relevant, but its ISS data can overlap our original source. The published fitted rate-correlation constants are not imported into our Earth-only fit. Page12 notes low-flow limitations of the correlation. Pages9–12 were extracted and p10 visually checked.

The new manuscript is stored unchanged at `backend/data/raw_papers/round3_followup_2026-11-14/Thomsen_2020_Buoyancy_Rod_accepted.pdf`. Its SHA-256, acquisition date, URL and version are in `source-acquisition.json`. This is a new source, not a new independent experiment or a cleaned dataset. The existing collection was not exhaustive; finding a better source corrects the earlier lack of an explicit formula. This formula is attributed to Thomsen, not asserted to be Link2018's equation.

## Exactly what is assumed in Round 3

The recorded69 rows lack per-row pressure and temperature. We use the conditional `P/P0=1` transform and treat recorded fan flow as reference-pressure flow. No pressure value is inserted into a training record. `kappa=beta*DeltaT` is fixed at3.5 for the primary hypothesis;1 and5.2 are declared sensitivity scenarios. The roadmap's p2 illustration motivates3.5; none of these values was measured for these burns, and this is not the full temperature-dependent implementation in Thomsen. The sensitivity interval is not a confidence interval or a physical bound.

Nominal environment gravity is0 or9.80665m/s². Learned features are oxygen, inverse diameter, log effective flow, and their oxygen/flow interaction. The oxygen-direction prior discourages a decreasing log-rate response to oxygen across the training effective-flow interval. It is a soft prior, tested with/without the penalty; it is not a conservation-law residual, a full combustion solver, or a guarantee outside that interval. No monotonic gravity or airflow rule is imposed because these can change regime.

## Roadmap re-read: retain, correct, defer

Original: `C:/Users/bbdnet2832/Downloads/PyroGrav AI Technical Roadmap.pdf`,66pages. All pages text-extracted again to `tmp/round3/roadmap.txt`; consequential equations/code also checked as rendered pages. Earlier detailed audit remains in `docs/audit-2026-11-13.md`.

| Roadmap proposal | Round3 disposition |
| --- | --- |
| Buoyancy scale, pp1–2 | Useful dimensional motivation, not a measured universal Moon speed. Characteristic length and temperature are not known for every row. Use rod-specific published Eq6 with explicit assumptions instead. |
| Opposed/concurrent vector mixing, p2 | The angle between forced flow and buoyancy is different from whether flow opposes flame propagation. In a downward flame both flows may point upward. Do not use the roadmap's automatic opposed-flow subtraction. |
| Lunar speed window versus code defaults, pp2/9–10 | The illustration yields13.06cm/s for L=.003m and temperature ratio3.5. Different default length/temperature values yield a different speed; neither defines all lunar burns. |
| Pressure/gravity analogy, p4 and codep10 | Grashof matching alone cannot establish matching chemistry, radiation or flame spread. The report/code pressure exponents also disagree. No pressure feature is learned from unknown/constant pressure. |
| Thin/thick heat-balance and kinetic equations, pp4–5/11–14 | Require heat flux, thermal properties, temperatures, preheat length and kinetic calibration not observed here. Do not assign their computed rates as experimental labels. No arbitrary0.05mm/s output floor. |
| Oxygen monotonicity / constrained residual learner | Retain as a falsifiable soft oxygen prior over a stated interval, paired with an otherwise identical unpenalized model. Never constrain only residuals and assume the complete model is monotone. |
| Group splits, ablations, provenance, external validation | Retain. Independent recomputation and immutable artifacts implemented. ExistingISS rows are development data now; a later genuinely independent campaign is still needed. |
| Claimed accuracy, physical certainty, virtual-ensemble uncertainty | Not evidence until measured. No fabricated accuracy, calibrated intervals or "certified" mode. |
| ChemBERTa, multiple materials, smoke, suppression, mobile | Deferred. One material and one target do not establish cross-material performance. Not part of this bounded experiment. |

## Why the requested 3–5 lunar test rows were not created

**Olson2024 / NASA2026 deck:** The [NASA presentation20260001966](https://ntrs.nasa.gov/citations/20260001966), already downloaded in Round2, PDFp20 / printedp19, has real partial-gravity PMMA markers. It cites [Olson et al.2024, DOI10.1016/j.firesaf.2024.104267](https://doi.org/10.1016/j.firesaf.2024.104267). The markers concern sustained/extinguished flames in concurrent axial stagnation flow, clear PMMA, reduced pressure, with gravity and oxygen axes. They are not opposed black-rod leading-edge spread rates inmm/s. Digitizing them cannot supply the missing regression label. A separately defined flammability-boundary task remains a legitimate option.

**Takahashi2026, DOI[10.1016/j.proci.2026.106097](https://doi.org/10.1016/j.proci.2026.106097):** Publisher-indexed abstract identifies thin PMMA/filter paper, aircraft partial gravity and a preheat-zone/forced-flow correspondence. The quoted lunar oxygen index concerns filter paper. The publisher marks open access; a fresh direct request still returned403 here. Full PDF and numeric tables remain unacquired. We do not claim an exhaustive full-paper audit or assert it contains zero useful rates; compatible rod-rate measurements have not been established. Open access does not guarantee this tool can retrieve the page.

**Decision:** Zero compatible partial-g test labels accepted this round. Three to five genuinely compatible, independently held-out measurements would permit a small pilot comparison with substantial sampling/measurement uncertainty. That would not certify a model or establish a10/10 judging outcome. Failure of this particular1g→0g implementation does not logically prove every possible partial-g model impossible. Nor does a smooth curve or a scalar intermediate effective velocity establish accuracy in the unmeasured multivariable region.

## Scope of the resulting utility

The model can support comparisons against existing experimental measurements and expose sensitivity, unsupported transfer and source conflicts. It is not approved to choose habitat oxygen/pressure, ventilation settings, safe materials or emergency actions. A useful lunar prediction service still requires a compatible independent partial-gravity test and task-specific acceptable error. This round does not estimate a probability of winning the hackathon.
