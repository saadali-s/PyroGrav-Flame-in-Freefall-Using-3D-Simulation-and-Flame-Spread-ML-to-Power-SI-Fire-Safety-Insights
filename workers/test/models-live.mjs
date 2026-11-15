// Bounded, real Workers AI evaluation through Wrangler's remote binding, no public deploy.
import {getPlatformProxy} from "wrangler";
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import worker from "../src/index.mjs";
const require=createRequire(import.meta.url);
const {executeGuideTool}=require("../../tmp/guide-tool-test.cjs");
const destination=new URL("../../docs/agent-upgrade-2026-11-15/",import.meta.url);
await mkdir(destination,{recursive:true});
const cases=[
 {id:"measured_trap",question:"An Artemis safety engineer asks for the exact opposed-flow flame spread rate of a 0.64 cm diameter PMMA rod at 18% O2 and 2 cm/s flow in microgravity versus 1g, and wants to know if we can directly extrapolate that result to 0.36 mm silicone sheets in a 0.16g lunar cabin. Pull the exact numbers from our curated NASA records, flag any source-data or unit anomalies on those specific rows, and state clearly what our system can predict versus where it must flag uncertainty.",hits:["pmma","saffire"]},
 {id:"transfer",question:"An engineer wants to use our Earth-trained PMMA model to predict flame spread in a slow 1.5 cm/s ISS ventilation draft, and rank whether CO2 or Helium is a stronger fire extinguisher using FLEX. Based on measured validation results, why are both decisions flawed and what can the models tell them instead?",hits:["pmma","flex"]},
 {id:"identity",question:"What are you made of, and how can you help me?",hits:[]},
];
const proxy=await getPlatformProxy({configPath:new URL("./wrangler-eval.jsonc",import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,"$1"),persist:false});
const results=[];
let calls=0;
try{
 for(const model of ["deepseek","glm"]){
  for(const item of cases){
   const started=performance.now(), providerErrors=[], modelOutputs=[];
   const env={CHAT_TOKEN:"local-evaluation",GUIDE_MODEL:model,AI:{run:async(id,input)=>{
    if(++calls>18)throw new Error("Evaluation call budget exceeded");
    try{const output=await proxy.env.AI.run(id,input);modelOutputs.push({content:output.choices?.[0]?.message?.content??output.response,finish_reason:output.choices?.[0]?.finish_reason,usage:output.usage});return output;}catch(error){providerErrors.push(String(error.message).slice(0,800));throw error;}
   }}};
   const payload={question:item.question,retrieval:{revision:"92b505b65c35b5842167786de403061d06dedef9",hits:item.hits.map(id=>({id,score:1}))}};
   const ask=async body=>(await worker.fetch(new Request("https://evaluation.invalid/chat",{method:"POST",headers:{authorization:"Bearer local-evaluation"},body:JSON.stringify(body)}),env)).json();
   let result=await ask(payload), planned=[], toolResults=[];
   if(result.status==="tool_request"){
    planned=result.calls;
    toolResults=planned.map(call=>({...executeGuideTool(call),call_id:call.id}));
    result=await ask({...payload,tool_results:toolResults,tool_message:result.tool_message});
   }
   const answer=result.answer??"";
   const checks=item.id==="measured_trap"?{
    lookup:planned.some(c=>c.name==="lookup_pmma_records"&&c.arguments.environment==="both"&&c.arguments.diameter_mm===6.4),
    both_values:answer.includes("0.0469")&&answer.includes("0.0313"),
    no_tool_name_leak:!/(lookup_pmma_records|predict_pmma_rate|query_flex_cohort)/.test(answer),
    no_invented_silicone_rate:!/1\.98\s*(?:mm\/s|millimet)/i.test(answer),
   }:item.id==="transfer"?{metrics:["0.02644","0.01662","0.01049"].every(n=>answer.includes(n))}:{answered:result.mode==="guidance"};
   results.push({model,case:item.id,seconds:(performance.now()-started)/1000,planned,toolResults,result,checks,providerErrors,modelOutputs});
   await writeFile(new URL("model-comparison.json",destination),JSON.stringify(results,null,2)+"\n");
   console.log(JSON.stringify({model,case:item.id,seconds:results.at(-1).seconds,status:result.status,checks,providerErrors}));
   if(providerErrors.length)break; // Do not repeat paid-access/quota/provider failures.
  }
 }
}finally{await proxy.dispose();}
