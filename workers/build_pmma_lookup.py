"""Publish a read-only lookup of frozen candidate AND review rows, never training labels."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rows, sources = [], []
for name in ("candidate_training.csv", "review_queue.csv"):
    path = ROOT / "backend/training/datasets/pmma-v1" / name
    sources.append({"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    with path.open(encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream):
            rows.append({
                "id": row["observation_id"], "environment": "iss" if row["environment"] == "microgravity" else "earth",
                "diameter_mm": float(row["diameter_mm"]), "oxygen_pct": float(row["oxygen_pct"]),
                "airflow_cms": float(row["opposed_flow_cms"]), "color": row["color"], "sample": row["sample_label"],
                "rate_mms": float(row["rate_mms"]) if row["rate_mms"] else None,
                "reported_rate": row["reported_rate_text"], "printed_unit": row["printed_scaled_rate_unit"],
                "unit_basis": row["unit_basis"], "review_flags": row["review_flags"],
                "cohort": "candidate" if name.startswith("candidate") else "review",
                "disposition": row["disposition_reason"], "source_url": row["source_url"],
                "source_sha256": row["source_sha256"], "page": int(row["source_page"]),
                "locator": f'Table {row["source_table"]}, {row["source_half"]} row {row["source_row"]}',
            })
assert len(rows) == 98 and len({row["id"] for row in rows}) == 98
out = ROOT / "web/src/data/pmma-records.json"
out.write_text(json.dumps({"sources": sources, "rows": rows}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Published {len(rows)} traceable records, including review rows, to {out.relative_to(ROOT)}")
