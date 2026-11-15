import {writeFile,readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import assert from "node:assert/strict";
const require=createRequire(import.meta.url);
const {guideStarters}=require("../../tmp/guide-starters-test.cjs");
const previous=JSON.parse(await readFile(new URL("../../docs/agent-upgrade-2026-11-15/source-question-failure.json",import.meta.url)));
const simple="Predict the opposed-flow flame spread rate for a 0.64 cm black PMMA rod at 21% O2 and 5 cm/s airflow in microgravity versus 1g";
const cases=[...guideStarters.map(s=>({id:s.kind,question:s.question})),
 {id:"compound",question:previous.question},{id:"simple",question:simple},{id:"simple_repeat",question:simple},
 {id:"flex",question:"Show recorded Methanol burns with CO2 and with Helium, including measured K and held-out estimates. Does this establish which gas is the better extinguisher?"}];
const results=[];
const selected=process.argv[2]==="compound"?cases.filter(item=>item.id==="compound"):cases;
for(const item of selected){
 const start=performance.now();
 const response=await fetch("http://localhost:3000/api/guide",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:item.question,page:"/dashboard"}),signal:AbortSignal.timeout(55000)});
 const result=await response.json();
 results.push({case:item.id,question:item.question,http:response.status,seconds:(performance.now()-start)/1000,result});
 await writeFile(new URL(`../../docs/agent-upgrade-2026-11-15/robustness-${process.argv[2]??"all"}-verified.json`,import.meta.url),JSON.stringify(results,null,2)+"\n");
 console.log(JSON.stringify({case:item.id,http:response.status,seconds:results.at(-1).seconds,status:result.status,origin:result.origin,tools:result.tools?.map(t=>({name:t.name,status:t.status}))}));
}
assert.ok(results.every(r=>r.http===200));
const get=id=>results.find(r=>r.case===id).result;
if(selected.length>1){
assert.equal(get("App guide").origin,"product_context");
assert.equal(get("INDUS research").retrieval_status,"available");
assert.equal(get("Live tool check").tools[0].rate_mms,.04510522128989724);
for(const id of ["simple","simple_repeat"]){
 const checks=get(id).tools.flatMap(t=>t.support_checks??[{environment:t.inputs.environment,rate_mms:t.rate_mms}]);
 assert.deepEqual(checks.map(c=>c.environment).sort(),["earth","iss"]);
 assert.ok(checks.every(c=>c.rate_mms===null));
}
}
assert.match(get("compound").answer,/39\.1/);assert.match(get("compound").answer,/0\.0637/);assert.match(get("compound").answer,/80\s*,\s*122/);
assert.ok(!results.some(r=>/(tool_message|reasoning_content)/.test(JSON.stringify(r.result))));
console.log("Live regression checks passed; review saved prose separately.");
