import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {runGuideTurn,guideMode}=require("../../tmp/guide-agent-test.cjs");
const {guideStarters}=require("../../tmp/guide-starters-test.cjs");
test("app introduction does not depend on INDUS or Cloudflare availability",async t=>{
 t.mock.method(globalThis,"fetch",()=>{throw new Error("Must not call network for app intro");});
 const result=await(await runGuideTurn({question:guideStarters[0].question,history:[],page:"/dashboard"},new AbortController().signal)).json();
 assert.equal(result.origin,"product_context");assert.equal(result.mode,"guidance");
 assert.match(result.answer,/NASA INDUS/);assert.match(result.answer,/DeepSeek/);
});
test("a greeting returns app help without a retrieval warning or unrelated sources",async t=>{
 t.mock.method(globalThis,"fetch",()=>{throw new Error("A greeting must not call a research service");});
 for(const question of ["yo", "Hey there!", "Hi, Space Guide!"]){
  const response=await runGuideTurn({question,history:[{role:"user",content:"Tell me about LUCI"}],page:"/dashboard"},new AbortController().signal);
  const result=await response.json();
  assert.equal(result.origin,"product_context");assert.equal(result.mode,"guidance");
  assert.equal(result.retrieval_status,undefined);assert.deepEqual(result.evidence,[]);
  assert.match(result.answer,/^Hey!/);
 }
 const {productAnswer}=require("../../tmp/guide-starters-test.cjs");
 assert.equal(productAnswer("Hi, what did LUCI measure?","hosted"),null);
});
test("model-check starter needs no network and returns exact frozen result",async t=>{
 t.mock.method(globalThis,"fetch",()=>{throw new Error("Starter must not need network");});
 const result=await(await runGuideTurn({question:guideStarters[2].question,history:[],page:"/simulation"},new AbortController().signal)).json();
 assert.equal(result.origin,"tool_result");assert.equal(result.tools[0].rate_mms,.04510522128989724);
 assert.match(result.answer,/joint support gate/);
});

test("Vercel uses the configured Cloudflare Worker even when the optional Groq key is set",async t=>{
 const overrides={GUIDE_HOSTED_INDUS:"1",GUIDE_WORKER_URL:"https://worker.invalid",GUIDE_CHAT_TOKEN:"test",GUIDE_GROQ_API_KEY:"unused"};
 const previous=Object.fromEntries(Object.keys(overrides).map(key=>[key,process.env[key]]));
 Object.assign(process.env,overrides);
 t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 assert.equal(guideMode(),"cloudflare");
 const result=await(await runGuideTurn({question:guideStarters[0].question,history:[],page:"/dashboard"},new AbortController().signal)).json();
 assert.match(result.answer,/DeepSeek V4\.1 Flash/);
 assert.match(result.answer,/INDUS runs on Vercel/);
});

test("completed tool survives explanation outage",async t=>{
 const overrides={GUIDE_WORKER_URL:"https://worker.invalid",GUIDE_CHAT_TOKEN:"test",GUIDE_ENCODER_TOKEN:""};
 const previous=Object.fromEntries(Object.keys(overrides).map(key=>[key,process.env[key]]));
 Object.assign(process.env,overrides);
 t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 let calls=0;
 t.mock.method(globalThis,"fetch",async(url,options)=>{
  calls++;const payload=JSON.parse(options.body);
  if(calls===1)return Response.json({status:"tool_request",calls:[{name:"predict_pmma_rate",arguments:{environment:"iss",diameter_mm:9.5,oxygen_pct:19,airflow_cms:1.5}}]});
  assert.equal(payload.tool_results[0].name,"predict_pmma_rate");
  throw new Error("Provider unavailable");
 });
 const result=await(await runGuideTurn({question:"Check ISS at 9.5 mm, 19% oxygen, 1.5 cm/s and explain the audit.",history:[],page:"/simulation"},new AbortController().signal)).json();
 assert.equal(calls,2);assert.equal(result.origin,"tool_result");assert.equal(result.tools[0].rate_mms,.04510522128989724);
});
