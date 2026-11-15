"""User-reported failure plus read-only lab tool checks, through the real web API."""
import json
import time
import urllib.request
from pathlib import Path

root=Path(__file__).resolve().parents[2]
cases=[
    {"name":"engineer", "question":"An engineer wants to use our Earth-trained PMMA model to predict flame spread in a slow 1.5 cm/s ISS ventilation draft, and also wants to rank whether CO2 or Helium is a stronger fire extinguisher using our FLEX model. Based on our measured validation results and data audits, why are both of those decisions scientifically flawed, and what can our models legitimately tell them instead?",
     "history":[{"role":"user","content":"What about 34% oxygen on the Moon?"},{"role":"assistant","content":"Moon 0.16g at 34% oxygen is outside the validated domain."}]},
    {"name":"iss_tool","question":"Use predict_pmma_rate to check an ISS PMMA rod at 9.5 mm diameter, 19% oxygen and 1.5 cm/s airflow. Give the actual tool result."},
    {"name":"earth_tool","question":"Use predict_pmma_rate for Earth, 9.5 mm diameter, 19% oxygen and 1.5 cm/s airflow."},
    {"name":"flex_tool","question":"Use query_flex_cohort to show recorded Methanol burns containing CO2, with measured K and held-out predictions."},
    {"name":"missing_inputs","question":"Predict the PMMA rate on ISS at 1.5 cm/s. I have not supplied diameter or oxygen."}
]
results=[]
for case in cases:
    start=time.time()
    req=urllib.request.Request("http://127.0.0.1:3000/api/guide",data=json.dumps(case).encode(),headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=150) as response: result=json.load(response)
    results.append({"case":case["name"],"seconds":round(time.time()-start,2),"result":result})
    (root/"docs/chat-guidance-2026-11-14/engineering-results.json").write_text(json.dumps(results,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(case["name"],result.get("mode"),result.get("answer"),flush=True)
    print("tools",json.dumps(result.get("tools",[]),ensure_ascii=True),flush=True)
by={r["case"]:r["result"] for r in results}
answer=by["engineer"]["answer"]
assert all(x in answer for x in ("0.02644","0.01662","0.01049"))
assert not any(x in answer.lower() for x in ("moon","mars","34%","0.16g"))
assert by["iss_tool"]["tools"][0]["status"]=="estimated"
assert by["earth_tool"]["tools"][0]["status"]=="abstained" and by["earth_tool"]["tools"][0]["rate_mms"] is None
assert by["flex_tool"]["tools"][0]["matched_rows"]>0 and len(by["flex_tool"]["tools"][0]["rows"])<=5
assert not by["missing_inputs"].get("tools")
print("Five live engineering/tool checks passed; inspect prose for semantic faithfulness.")
