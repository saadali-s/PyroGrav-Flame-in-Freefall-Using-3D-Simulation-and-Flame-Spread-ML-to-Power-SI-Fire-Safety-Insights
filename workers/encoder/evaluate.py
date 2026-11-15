import json
import re
from pathlib import Path
from retrieval import MODEL, REVISION, Retriever

# One question per family, written before the first local inference run.
CASES = [
    ("Which investigation measures the advance of a flame along a plastic rod in opposing airflow?", "pmma"),
    ("Which tests measure how fast a burning liquid sphere shrinks in a mixture containing helium?", "flex"),
    ("Where can I find aged smoke aerosol measurements for spacecraft detectors?", "same"),
    ("Which study checked particulate monitoring instruments on orbit before the smoke trials?", "daft"),
    ("Where were larger fabric fires studied aboard departing cargo vehicles?", "saffire"),
    ("Which experiment used a spinning vehicle to study flames under Moon-like acceleration?", "luci"),
]

if __name__ == "__main__":
    model = Retriever()
    rows = []
    for question, target in CASES:
        hits = model.search(question)
        terms = set(re.findall(r"[a-z0-9]+", question.lower()))
        def overlap(doc):
            text = " ".join([doc["name"], *doc["facts"], doc["limit"]])
            return len(terms.intersection(re.findall(r"[a-z0-9]+", text.lower())))
        lexical = sorted(model.docs, key=lambda doc: (-overlap(doc), doc["id"]))
        rows.append(dict(question=question, expected=target, semantic=hits, token_overlap_first=lexical[0]["id"]))
    report = dict(model=MODEL, revision=REVISION, device=model.device, dimension=model.vectors.shape[1],
                  documents=len(model.docs), hits_at_1=sum(r["semantic"][0]["id"] == r["expected"] for r in rows),
                  hits_at_3=sum(any(h["id"] == r["expected"] for h in r["semantic"]) for r in rows),
                  token_overlap_hits_at_1=sum(r["token_overlap_first"] == r["expected"] for r in rows), queries=rows)
    destination = Path(__file__).resolve().parents[2] / "docs/project-audit-2026-11-14/retrieval.json"
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k != "queries"}))
