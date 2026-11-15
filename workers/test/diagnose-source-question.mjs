import {getPlatformProxy} from "wrangler";
import {readFile,writeFile} from "node:fs/promises";
import worker from "../src/index.mjs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {executeGuideTool}=require("../../tmp/guide-tool-test.cjs");
const folder=new URL("../../docs/agent-upgrade-2026-11-15/",import.meta.url);
const filename=process.argv[2]==="simple"?"simple-prediction-failure":"source-question-failure";
const {question}=JSON.parse(await readFile(new URL(filename+".json",folder),"utf8"));
const proxy=await getPlatformProxy({configPath:new URL("./wrangler-eval.jsonc",import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,"$1"),persist:false});
const outputs=[];
try{
 const env={CHAT_TOKEN:"test",GUIDE_MODEL:"deepseek",AI:{run:async(model,input)=>{
  try{const result=await proxy.env.AI.run(model,input);outputs.push({stage:input.tool_choice??"answer",content:result.choices?.[0]?.message?.content??result.response,tool_calls:result.choices?.[0]?.message?.tool_calls??result.tool_calls,finish_reason:result.choices?.[0]?.finish_reason});return result;}
  catch(error){outputs.push({error:error.message});throw error;}
 }}};
 const payload={question,retrieval:{revision:"92b505b65c35b5842167786de403061d06dedef9",hits:[{id:"pmma",score:1}]}};
 const ask=body=>worker.fetch(new Request("https://test.invalid/chat",{method:"POST",headers:{authorization:"Bearer test"},body:JSON.stringify(body)}),env);
 let response=await ask(payload),result=await response.json();
 if(result.status==="tool_request"){
  const tool_results=result.calls.map(call=>({...executeGuideTool(call),call_id:call.id}));
  response=await ask({...payload,tool_results,tool_message:result.tool_message});result=await response.json();
 }
 // Reasoning content is deliberately neither logged nor persisted.
await writeFile(new URL(filename+"-diagnostic-v2.json",folder),JSON.stringify({status:response.status,result:{status:result.status,error:result.error,calls:result.calls},outputs},null,2)+"\n");
 console.log(JSON.stringify({status:response.status,outputs}));
}finally{await proxy.dispose();}
