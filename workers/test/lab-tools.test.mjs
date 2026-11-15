import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
const require=createRequire(import.meta.url);
const {executeGuideTool}=require("../../tmp/guide-tool-test.cjs");
const pmma=(environment,extra={})=>executeGuideTool({name:"predict_pmma_rate",arguments:{environment,diameter_mm:9.5,oxygen_pct:19,airflow_cms:1.5,...extra}});
test("measured lookup returns both excluded duplicate values without inventing an exact ISS match",()=>{
 const result=executeGuideTool({name:"lookup_pmma_records",arguments:{environment:"both",diameter_mm:6.4,oxygen_pct:18,airflow_cms:2}});
 const exact=result.records.filter(r=>r.match==="exact");
 assert.deepEqual(exact.map(r=>r.rate_mms),[.0469,.0313]);
 assert.ok(exact.every(r=>r.cohort==="review"&&r.review_flags.includes("D01")));
 assert.ok(result.records.filter(r=>r.environment==="iss").every(r=>r.match==="nearby"&&r.review_flags.includes("U01")));
 assert.match(result.reason,/No exact condition.*iss/);
 assert.equal(result.matched_rows,2);
 assert.equal(executeGuideTool({name:"lookup_pmma_records",arguments:{environment:"both"}}).status,"invalid_arguments");
});
test("21% oxygen / 5 cm/s / 6.4 mm yields no exact measurement and both model gates abstain",()=>{
 const result=executeGuideTool({name:"lookup_pmma_records",arguments:{environment:"both",diameter_mm:6.4,oxygen_pct:21,airflow_cms:5}});
 assert.equal(result.matched_rows,0);
 assert.ok(result.records.every(r=>r.match==="nearby"));
 assert.equal(result.support_checks.length,2);
 assert.ok(result.support_checks.every(r=>r.rate_mms===null));
});
test("same 1.5 cm/s condition is rejected on Earth and checked jointly on ISS",()=>{
  const earth=pmma("earth"),iss=pmma("iss");
  assert.equal(earth.status,"abstained");assert.equal(earth.rate_mms,null);
  assert.match(earth.reason,/2 and 25/);
  assert.equal(iss.status,"estimated");assert.ok(iss.rate_mms>0&&iss.rate_mms<1);
  assert.equal(iss.group_mae,0.010490585024313702);
  assert.equal(pmma("iss",{oxygen_pct:34}).status,"abstained");
  assert.equal(pmma("moon").status,"invalid_arguments");
  assert.equal(pmma("iss",{oxygen_pct:undefined}).status,"invalid_arguments");
  assert.equal(pmma("iss",{pressure_atm:.55}).status,"invalid_arguments");
});
test("FLEX lookup returns only eligible source rows and exact saved held-out predictions",()=>{
  const data=JSON.parse(readFileSync(new URL("../../web/src/data/flex-v1.json",import.meta.url),"utf8"));
  for(const fuel of ["Methanol","Heptane"])for(const diluent of ["CO2","He"]){
    const result=executeGuideTool({name:"query_flex_cohort",arguments:{fuel,diluent}});
    const expected=data.rows.filter(r=>r.accepted&&r.fuel===fuel&&(diluent==="CO2"?r.co2>0:r.he>0));
    assert.equal(result.matched_rows,expected.length);assert.ok(result.rows.length<=5);
    for(const row of result.rows){const source=expected.find(r=>r.source_test===row.id);assert.ok(source);
      assert.equal(row.observed,source.burning_rate_mm2s);
      assert.equal(row.predicted,data.predictions.find(p=>p.id===source.id&&p.model==="log_ridge"&&p.evaluation==="condition_group_5fold").predicted);}
    assert.match(result.note,/not ranked/);
  }
  assert.equal(executeGuideTool({name:"query_flex_cohort",arguments:{fuel:"anything",diluent:"CO2"}}).status,"invalid_arguments");
  assert.equal(executeGuideTool({name:"run_sql",arguments:{}}).status,"invalid_arguments");
});
