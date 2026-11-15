"""Bundle the reviewed catalog and selected frozen metrics for an independent Worker."""
import csv
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
catalog = json.loads((ROOT / "web/src/data/investigations.json").read_text("utf-8"))
for study in catalog["entries"]:
    for source in study["sources"]:
        assert hashlib.sha256((ROOT / source["path"]).read_bytes()).hexdigest() == source["sha256"]
(HERE / "src/catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
studies = {}
for study, folder, public, field, units in [
    ("pmma", "round2-2026-11-14", "round2", "group_mae_mms", "mm/s"),
    ("flex", "flex-round1-2026-11-14", "flex-v1", "group_mae", "mm²/s"),
]:
    path = ROOT / "backend/training/runs" / folder / "metrics.csv"
    artifact = f"/training/{public}/metrics.csv"
    assert path.read_bytes() == (ROOT / "web/public" / artifact.lstrip("/")).read_bytes()
    studies[study] = []
    with path.open(encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream):
            if study == "pmma":
                keep = row["model"] == "log_geometry_ridge" and row["evaluation"] in (
                    "earth_logo", "microgravity_logo", "earth_to_microgravity")
            else:
                keep = row["model"] in ("log_ridge", "same_fuel_nearest") and row["evaluation"] == "condition_group_5fold" and row["subset"] == "all"
            if keep:
                studies[study].append(dict(evaluation=row["evaluation"], model=row["model"], rows=int(row["rows"]),
                    groups=int(row["groups"]), group_mean_absolute_error=float(row[field]), units=units,
                    project_artifact=artifact, sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
assert len(studies["pmma"]) == 3 and len(studies["flex"]) == 2
# The unchanged nearest-lookup transfer baseline lives in Round 1, not Round 2.
baseline = ROOT / "backend/training/runs/round1-2026-11-14/metrics.csv"
assert baseline.read_bytes() == (ROOT / "web/public/training/round1/metrics.csv").read_bytes()
with baseline.open(encoding="utf-8", newline="") as stream:
    row = next(r for r in csv.DictReader(stream) if r["evaluation"] == "earth_to_microgravity" and r["model"] == "nearest")
studies["pmma"].append(dict(evaluation=row["evaluation"], model="nearest", rows=int(row["rows"]), groups=int(row["groups"]),
    group_mean_absolute_error=float(row["group_mae_mms"]), units="mm/s", project_artifact="/training/round1/metrics.csv",
    sha256=hashlib.sha256(baseline.read_bytes()).hexdigest()))
(HERE / "src/metrics.json").write_text(json.dumps(studies, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

# Read-only derivatives of the frozen UI cohort and reviewed source audits.
snapshot = json.loads((ROOT / "web/src/data/simulation-evidence.json").read_text("utf-8"))
support = {}
for domain in ("earth", "microgravity"):
    rows = [r for r in snapshot["rows"] if r["environment"] == domain]
    support[domain] = {"rows": len(rows), "nominal_gravity_g": 1 if domain == "earth" else 0,
        "oxygen_pct": [min(r["oxygen"] for r in rows), max(r["oxygen"] for r in rows)],
        "diameter_mm": sorted({r["diameter"] for r in rows}),
        "imposed_flow_cms": sorted({r["flow"] for r in rows})}
facts = {
    "pmma": {
        "support": support,
        "support_interpretation": "Marginal ranges/discrete observed values only; not all combinations were observed or validated. Per-row pressure unresolved.",
        "audited_facts": [
            "Link 2018 supplement Table S1 p1: left half prints scaled cm/s; right half prints scaled mm/s (Vf x1000 header). The 11 U01-flagged ISS rows are 6.4 mm rods, 17.0–18.9% O2. Their retained conversion is an inference: printed value x0.01 -> mm/s. Example printed 10.00: inferred 0.100 mm/s versus literal right-header 0.010 mm/s. No author-issued correction is established.",
            "Probable B16/P16 and B19/P19 crosswalks conflict: specialized paper opposed-flow designation versus campaign log concurrent-flow entries. Identity matches remain provisional, not a proven error in either source; eight corresponding B16/B19 segments are withheld from the candidate cohort.",
            "Moon 0.16g and Mars 0.38g lack matched validation for this opposed leading-edge target. 34% O2 is outside both Earth and ISS observed oxygen ranges. No measured per-row pressure is available for a new 8.2 psi prediction."
        ],
        "audit_basis": ["docs/training-iteration-2026-11-14.md", "docs/round4-research-audit-2026-11-14/README.md"]
    },
    "flex": {
        "audited_facts": [
            "Rate-unit defect: PSI-69 raw CSV 'Burning rate; mm' must be interpreted as K in mm²/s, according to NASA/TP-2015-216046 p25 and Table IX pp26–34. Separate gas-species defect: 'CO initial ambient composition; mole fraction' denotes CO2, not CO. CO2 is the gas species (carbon dioxide), NOT a unit; its mole fraction is dimensionless. Corrections are in derived data only; originals remain unchanged.",
            "K is the average slope magnitude of a linear fit to droplet diameter squared versus time shortly after ignition to extinction. It is not linear flame-front velocity, extinction probability or a causal suppressant effect.",
            "274 raw CSV records were reconciled to Table IX: 258 numeric K, 198 eligible records in 79 condition groups; 76 retained for review. This corpus is FLEX (PSI-69); do not relabel it FLEX-2 without a source."
        ],
        "audit_basis": ["docs/flex-round1-2026-11-14/README.md"]
    }
}
for value in facts.values():
    value["audit_basis"] = [{"path": p, "sha256": hashlib.sha256((ROOT / p).read_bytes()).hexdigest()} for p in value["audit_basis"]]
(HERE / "src/audit-facts.json").write_text(json.dumps(facts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
