"""Display-only provenance, copied from the frozen compilation; never changes IDs or labels."""
import csv
import hashlib
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=root/"backend/training/datasets/pmma-v1/candidate_training.csv"
with source.open(encoding="utf-8",newline="") as stream:
    rows=list(csv.DictReader(stream))
snapshot=json.loads((root/"web/src/data/simulation-evidence.json").read_text("utf-8"))
assert {r["id"] for r in snapshot["rows"]}=={r["observation_id"] for r in rows}
data={"source":"backend/training/datasets/pmma-v1/candidate_training.csv","sha256":hashlib.sha256(source.read_bytes()).hexdigest(),
    "note":"S1/S2-L/R-NN is our extraction locator, not an official NASA run ID. Source row numbers are counted table entries; sample names are copied from the printed-label field.",
    "rows":{r["observation_id"]:{"sample":r["sample_label"],"table":r["source_table"],"half":r["source_half"],"row":int(r["source_row"]),"page":int(r["source_page"]),"source_url":r["source_url"]} for r in rows}}
(root/"web/src/data/pmma-display-provenance.json").write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
print(f"Copied {len(rows)} source locators; no scientific data modified.")
