import test from "node:test";
import assert from "node:assert/strict";
import {generate,plan,parseModelResponse,toolConversation} from "../src/model.mjs";
import worker from "../src/index.mjs";

test("native tool calls preserve IDs, arguments and private reasoning continuation",()=>{
 const message={role:"assistant",content:null,reasoning_content:"private continuation",tool_calls:[{id:"call_1",type:"function",function:{name:"lookup_pmma_records",arguments:JSON.stringify({environment:"both",diameter_mm:6.4,oxygen_pct:18,airflow_cms:2})}}]};
 const parsed=parseModelResponse({choices:[{message,finish_reason:"tool_calls"}]});
 assert.equal(parsed.reply.calls[0].arguments.diameter_mm,6.4);
 const result={name:"lookup_pmma_records",call_id:"call_1",status:"records"};
 const continuation=toolConversation(parsed.assistant,[result]);
 assert.equal(continuation[1].tool_call_id,"call_1");
 assert.equal(continuation[0].reasoning_content,"private continuation");
 assert.throws(()=>toolConversation(parsed.assistant,[{...result,call_id:"wrong"}]));
 assert.throws(()=>parseModelResponse({choices:[{finish_reason:"length",message:{content:"{}"}}]}));
 assert.throws(()=>parseModelResponse({tool_calls:[{name:"run_sql",arguments:{}}]}));
});
test("native routing stage cannot substitute a promise to fetch for a tool call",async()=>{
 await assert.rejects(()=>plan({AI:{run:async()=>({choices:[{message:{content:JSON.stringify({mode:"research",answer:"I will look it up",ids:["pmma"]})}}]})}},[{role:"system",content:""},{role:"user",content:"question"}]));
});
test("compound lookup plus response marker executes the lookup instead of throwing",async()=>{
 const output={choices:[{message:{tool_calls:[
  {id:"lookup",function:{name:"lookup_pmma_records",arguments:'{"environment":"both","diameter_mm":6.4,"oxygen_pct":21,"airflow_cms":5}'}},
  {id:"handoff",function:{name:"respond_from_evidence",arguments:"{}"}},
 ]}}]};
 const result=await plan({AI:{run:async()=>output}},[]);
 assert.equal(result.reply.calls.length,1);assert.equal(result.reply.calls[0].name,"lookup_pmma_records");
 assert.equal(result.assistant.tool_calls.length,1);
});
test("both prediction calls plus handoff marker stay within the two-executable limit",async()=>{
 const calls=["earth","iss"].map(environment=>({id:environment,function:{name:"predict_pmma_rate",arguments:JSON.stringify({environment,diameter_mm:6.4,oxygen_pct:21,airflow_cms:5})}}));
 calls.push({id:"explanation",function:{name:"respond_from_evidence",arguments:"{}"}});
 const result=await plan({AI:{run:async()=>({choices:[{message:{tool_calls:calls}}]})}},[]);
 assert.equal(result.reply.calls.length,2);assert.equal(result.assistant.tool_calls.length,2);
});
test("record lookup covers identical predictions but never drops different conditions",()=>{
 const conditions={diameter_mm:6.4,oxygen_pct:21,airflow_cms:5};
 const calls=[{id:"lookup",function:{name:"lookup_pmma_records",arguments:JSON.stringify({...conditions,environment:"both"})}},
  ...["earth","iss"].map(environment=>({id:environment,function:{name:"predict_pmma_rate",arguments:JSON.stringify({...conditions,environment})}}))];
 const result=parseModelResponse({tool_calls:calls});
 assert.equal(result.reply.calls.length,1);assert.equal(result.assistant.tool_calls[0].id,"lookup");
 calls[1].function.arguments=JSON.stringify({...conditions,environment:"earth",oxygen_pct:19});
 assert.equal(parseModelResponse({tool_calls:calls}).reply.calls.length,2);
});

test("native no-tool route is followed by a separate validated answer call",async()=>{
 let count=0;
 const request=new Request("https://worker.invalid/chat",{method:"POST",headers:{authorization:"Bearer test"},body:JSON.stringify({question:"What are you made of?",retrieval:null})});
 const response=await worker.fetch(request,{CHAT_TOKEN:"test",AI:{run:async(model,input)=>{
  count++;
  if(count===1){assert.equal(input.tool_choice,"required");assert.equal(input.response_format,undefined);return {choices:[{message:{tool_calls:[{id:"route",function:{name:"respond_from_evidence",arguments:"{}"}}]}}]};}
  assert.equal(input.tools,undefined);
  assert.match(JSON.parse(input.messages[1].content).product_context.architecture,/developer laptop/);
  return {choices:[{message:{content:JSON.stringify({mode:"guidance",answer:"INDUS retrieves; DeepSeek writes the explanation.",ids:[],actions:[]})}}]};
 }}});
 const data=await response.json();assert.equal(count,2);assert.equal(data.status,"generated");assert.match(data.generator,/deepseek/);
});
test("Vercel retrieval changes the authenticated Worker's deployment context",async()=>{
 const request=new Request("https://worker.invalid/chat",{method:"POST",headers:{authorization:"Bearer test"},body:JSON.stringify({
  question:"How is this guide deployed?",retrieval:null,indus_host:"vercel",routing_hint:"answer_from_context",
 })});
 const response=await worker.fetch(request,{CHAT_TOKEN:"test",AI:{run:async(model,input)=>{
  const data=JSON.parse(input.messages[1].content);
  assert.match(data.product_context.architecture,/NASA INDUS.*Vercel/);
  assert.equal(data.product_context.active_generator,"DeepSeek V4.1 Flash");
  return {response:JSON.stringify({mode:"guidance",answer:"INDUS runs on Vercel and Cloudflare runs DeepSeek.",ids:[]})};
 }}});
 assert.equal(response.status,200);
 assert.match((await response.json()).answer,/INDUS runs on Vercel/);
});
test("model configuration is allowlisted and the two providers use documented controls",async()=>{
 for(const [key,id,reasoning] of [["deepseek","@cf/deepseek-ai/deepseek-v4.1-flash-1017","none"],["glm","@cf/zai-org/glm-5.3","low"]]){
  await generate({GUIDE_MODEL:key,AI:{run:async(model,input)=>{
   assert.equal(model,id);assert.equal(input.reasoning_effort,reasoning);
   assert.equal(input.tools.length,3);
   return {choices:[{message:{content:JSON.stringify({mode:"guidance",answer:"Hello",ids:[]})}}]};
  }}},[]);
 }
 await assert.rejects(()=>generate({GUIDE_MODEL:"arbitrary"},[]));
});
