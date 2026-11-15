"""Record the complete localhost -> INDUS -> Cloudflare pilot without credentials."""
import json
import time
import urllib.request
from pathlib import Path

questions = [
    "What does FLEX measure and in what units?",
    "What is the PMMA model error on ISS?",
    "Predict the PMMA spread rate on the Moon at 34% oxygen and 8.2 psi.",
    "What is the capital of France?",
]
results = []
for question in questions:
    started = time.time()
    request = urllib.request.Request("http://127.0.0.1:3000/api/guide",
        data=json.dumps({"question": question}).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=155) as response:
        result = json.load(response)
    results.append({"question": question, "seconds": round(time.time()-started, 2), "result": result})
    print(question, result.get("status"), result.get("answer"), flush=True)
destination = Path(__file__).resolve().parents[2] / "docs/live-chat-2026-11-14"
destination.mkdir(exist_ok=True)
(destination / "results.json").write_text(json.dumps(results, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
assert results[0]["result"]["status"] == "generated"
assert any(e["id"] == "flex" for e in results[0]["result"]["evidence"])
assert "mm²/s" in results[0]["result"]["answer"] or "mm^2/s" in results[0]["result"]["answer"]
assert results[1]["result"]["status"] == "generated"
assert any(e["id"] == "pmma" for e in results[1]["result"]["evidence"])
assert "0.01049" in results[1]["result"]["answer"]
assert all(r["result"]["status"] == "insufficient_evidence" for r in results[2:])
