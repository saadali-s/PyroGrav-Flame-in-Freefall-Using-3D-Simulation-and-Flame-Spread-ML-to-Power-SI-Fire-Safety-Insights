# Combustion model training

The PMMA experiments estimate opposed flame spread along black acrylic rods in mm/s. The FLEX experiment estimates the burning constant of a fuel droplet in mm²/s. Each experiment uses its own cohort, grouping rules and evaluation metric.

## Reproduce an evaluation

From the project root, run these commands with the scientific Python environment used for the saved runs. Each verifier reconstructs predictions or checks measurements against a source, then writes a verification report.

```powershell
backend/venv/Scripts/python.exe backend/training/verification/verify_round2.py
# Use a Python interpreter with pypdf installed for the PDF source check.
python -m pip install pypdf
python backend/training/verification/verify_flex_source.py
backend/venv/Scripts/python.exe backend/training/verification/verify_flex.py
```

Round 2 supplies the separate Earth and ISS estimates in the PMMA workbench. Round 3 tested cross-gravity transfer and Round 4 tested a pooled model. Neither displaced Round 2. FLEX uses 198 eligible records in 79 condition groups. See the [measured baseline comparisons](../../docs/utility-ui-2026-11-15/README.md).

## Folder guide

| Location | Contents |
| --- | --- |
| `preparation/` | PMMA and FLEX dataset builders |
| `source_extracts/` | Source text used to reconcile FLEX measurements |
| `datasets/` | Derived measurements, excluded records, provenance and input hashes |
| `train_*.py` and `*_protocol.json` | Training entry points and their fixed experiment definitions |
| `runs/` | Frozen splits, fit artifacts, predictions and metrics, grouped by experiment |
| `verification/` | Independent numerical checks, FLEX source reconciliation and historical HTTP check |
| `reports/` | Saved verification results |
| `publication/` | Scripts that package results for the dashboard and research reports |

The trainers remain together because later experiments import the Round 1 implementation and the first two verifiers check the original source hashes. The Round 3 verification report stays at its published path because the dashboard download manifest references it directly. The reporting recovery script `finalize_round2.py` belongs to the original Round 2 run.

The [compilation history](../../docs/round1-2026-11-14/training-history.md) records extraction decisions and the original layout. For current science and limitations see the [Round 4 report](../../docs/round4-2026-11-14/README.md) and [FLEX report](../../docs/flex-round1-2026-11-14/README.md).
