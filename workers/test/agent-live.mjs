import {writeFile} from "node:fs/promises";
import assert from "node:assert/strict";
const cases=[
 {id:"measured_trap",question:"An Artemis engineer wants exact published flame spread rates for a 0.64 cm PMMA rod, 18% O2, 2 cm/s, in microgravity versus 1g. Retrieve the curated rows and any duplicate/unit anomalies. Can these be extrapolated to 0.36 mm silicone sheets in a 0.16g lunar cabin?"},
 {id:"iss_prediction",question:"Predict a NEW black PMMA condition on ISS: 9.5 mm rod diameter, 19% oxygen and 1.5 cm/s airflow. Check support and give the frozen model estimate."},
 {id:"earth_abstention",question:"Predict a NEW black PMMA condition on Earth: 9.5 mm rod diameter, 19% oxygen and 1.5 cm/s airflow. Check support."},
 {id:"flex_records",question:"Show recorded Methanol burns with CO2 and with Helium, including measured K and held-out estimates. Does this establish which gas is the better extinguisher?"},
 {id:"missing_inputs",question:"Predict a PMMA rate in ISS airflow of 1.5 cm/s. I have not supplied rod diameter or oxygen."},
 {id:"identity",question:"What are you made of?"},
];
const results=[];
for(const item of cases){
 const start=performance.now();
 const response=await fetch("http://localhost:3000/api/guide",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...item,page:"/simulation?experiment=pmma"}),signal:AbortSignal.timeout(100000)});
 const result=await response.json();
 results.push({case:item.id,http:response.status,seconds:(performance.now()-start)/1000,result});
 await writeFile(new URL("../../docs/agent-upgrade-2026-11-15/localhost-results.json",import.meta.url),JSON.stringify(results,null,2)+"\n");
 console.log(JSON.stringify({case:item.id,http:response.status,seconds:results.at(-1).seconds,status:result.status,generator:result.generator,retrieval:result.retrieval_status,tools:result.tools?.map(t=>({name:t.name,status:t.status}))}));
}
const get=id=>results.find(r=>r.case===id).result;
assert.ok(results.every(r=>r.http===200));
const measured=get("measured_trap");
assert.ok(measured.answer.includes("0.0469")&&measured.answer.includes("0.0313"));
assert.equal(measured.tools[0].name,"lookup_pmma_records");
assert.equal(measured.retrieval_status,"available");
assert.equal(get("iss_prediction").tools[0].rate_mms,0.04510522128989724);
assert.equal(get("earth_abstention").tools[0].status,"abstained");
assert.equal(get("flex_records").tools.length,2);
assert.ok(get("flex_records").tools.every(t=>t.name==="query_flex_cohort"&&t.status==="records"));
assert.ok(!get("missing_inputs").tools?.length);
assert.equal(get("identity").origin,"product_context");
assert.match(get("identity").answer,/DeepSeek/);
assert.ok(!results.some(r=>/(tool_message|reasoning_content)/.test(JSON.stringify(r.result))));
console.log("All six localhost integration checks passed. Read saved prose for semantic limitations.");
