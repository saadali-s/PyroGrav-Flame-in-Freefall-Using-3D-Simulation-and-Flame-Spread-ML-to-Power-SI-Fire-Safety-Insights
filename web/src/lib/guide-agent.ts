import { executeGuideTool, type GuideToolCall, type GuideToolResult } from "@/lib/guide-tools";
import {guideStarters,productAnswer} from "./guide-starters";
import {predictionAnswer} from "./guide-tool-answer";
import {hostedIndus, retrieveIndus} from "./indus";
import {hostedEvidenceAnswer, hostedGeneration, hostedLabAnswer, hostedResearchChat} from "./hosted-guide";
function cloudflareConfigured(){
  return Boolean(process.env.GUIDE_WORKER_URL && process.env.GUIDE_CHAT_TOKEN);
}
function productionCloudflare(){
  return process.env.VERCEL==="1" && process.env.VERCEL_ENV==="production"
    && process.env.VERCEL_PROJECT_PRODUCTION_URL==="pyrograv-space-apps.vercel.app";
}
export function guideConfigured(){return hostedIndus() || cloudflareConfigured();}
export function guideMode(){
  if(!hostedIndus())return "worker";
  return cloudflareConfigured() || productionCloudflare() ? "cloudflare" : hostedGeneration() ?? "hosted";
}
export type GuideTurnInput={question:string;history:{role:string;content:string}[];page:string};
/** Bounded plan → read-only execution → explanation. Tool state stays server-side. */
export async function runGuideTurn({question,history,page}:GuideTurnInput,signal:AbortSignal,oidc?:string){
  const hosted=hostedIndus();
  const mode=guideMode();
  const introduction=productAnswer(question,mode);
  if(introduction)return Response.json(introduction,{headers:{"cache-control":"no-store"}});
  const turnSignal=AbortSignal.any([signal,AbortSignal.timeout(45000)]);
  const researchStarter=question===guideStarters[1].question;
  const conditionStarter=question===guideStarters[2].question;
  const starterTools=conditionStarter?[{...executeGuideTool({name:"predict_pmma_rate",arguments:{environment:"iss",diameter_mm:9.5,oxygen_pct:19,airflow_cms:1.5}}),call_id:undefined}]:null;
  if(starterTools)return Response.json(predictionAnswer(starterTools),{headers:{"cache-control":"no-store"}});
  const useCloudflare=mode==="worker"||mode==="cloudflare";
  const sharedWorker=cloudflareConfigured();
  const canGenerate=(useCloudflare && (sharedWorker || Boolean(oidc)))||mode==="groq"||(mode==="gateway"&&Boolean(oidc));
  const exactHostedResult=()=>hostedLabAnswer(question);
  if(hosted&&!canGenerate){
    const result=exactHostedResult();
    if(result)return result;
  }
  let completedTools:(GuideToolResult & {call_id?:string})[]=starterTools??[];
  const partial=()=>Response.json({status:"insufficient_evidence",mode:"insufficient_evidence",origin:"tool_result",
    answer:"The read-only result is ready below. The explanation service did not finish in time; the result and its limits are still available.",evidence:[],tools:completedTools},{headers:{"cache-control":"no-store"}});
  // Include recent user questions to resolve follow-ups; previous answers are not retrieval evidence.
  const selfContained = /\b(PMMA|BASS|FLEX|LUCI|SAME|DAFT|Saffire)\b/i.test(question);
  const retrievalQuestion = selfContained ? question : [...history.filter((m: {role:string})=>m.role==="user").slice(-1)
    .map((m: {content:string})=>m.content.slice(0,250)), question].join("\n").slice(-1000);
  try {
    const retrieval = !hosted && process.env.GUIDE_ENCODER_TOKEN ? await fetch(process.env.GUIDE_ENCODER_URL ?? "http://127.0.0.1:8011/retrieve", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GUIDE_ENCODER_TOKEN}` },
      body: JSON.stringify({ question: retrievalQuestion }), signal: AbortSignal.any([turnSignal,AbortSignal.timeout(8000)]), cache: "no-store"
    }).catch(()=>null) : null;
    const hits = hosted ? await retrieveIndus(retrievalQuestion,"guide").catch(error=>{
      console.error("Hosted INDUS guide request failed",error);
      return null;
    }) : retrieval?.ok ? await retrieval.json().catch(()=>null) : null;
    if(hosted && !canGenerate)return hostedEvidenceAnswer(hits);
    const askWorker = async (toolResults?:unknown[], toolMessage?:unknown) => {
      const payload = { question, history, page, retrieval: hits, tool_results:toolResults, tool_message:toolMessage,
        indus_host: hosted ? "vercel" : undefined,routing_hint:researchStarter?"answer_from_context":undefined };
      const predictionSignal=AbortSignal.any([turnSignal,AbortSignal.timeout(30000)]);
      if(!useCloudflare)return hostedResearchChat(payload,oidc??"",predictionSignal);
      const endpoint=sharedWorker
        ? new URL("/chat",process.env.GUIDE_WORKER_URL)
        : "https://pyrograv-nasa-guide.saadali-acer.workers.dev/vercel/chat";
      return fetch(endpoint, {
      method: "POST", redirect: "error", headers: { "content-type": "application/json", authorization: `Bearer ${sharedWorker ? process.env.GUIDE_CHAT_TOKEN : oidc}` },
      body: JSON.stringify(payload), signal: predictionSignal, cache: "no-store"
      });
    };
    const result = await askWorker(starterTools??undefined);
    if(!result.ok && completedTools.length)return partial();
    if (!result.ok) return hosted ? exactHostedResult() ?? hostedEvidenceAnswer(hits) : Response.json({error:"Cloudflare could not complete this question."}, {status:502});
    const data = await result.json();
    if(data.status!=="tool_request"){
      if(hosted && hits && data.status==="insufficient_evidence" && !data.generator)return hostedEvidenceAnswer(hits);
      return Response.json(data,{headers:{"cache-control":"no-store"}});
    }
    if(!Array.isArray(data.calls)||data.calls.length<1||data.calls.length>2) return Response.json({error:"Invalid tool request."},{status:502});
    if(data.calls.some((call:GuideToolCall)=>!call||typeof call.name!=="string")) return Response.json({error:"Invalid tool call."},{status:502});
    const tools:(GuideToolResult & {call_id?:string})[] = data.calls.map((call:GuideToolCall)=>({...executeGuideTool(call),call_id:call.id}));
    completedTools=tools;
    const asksForAudit=/\b(audit|accept|grouped|quarantin\w*|discrepanc\w*|M8|C25|C3a|C3b|P22b|T15)\b/i.test(question);
    const unsupportedPrediction=/^predict\b/i.test(question)&&tools.every(tool=>tool.name==="lookup_pmma_records"&&tool.matched_rows===0&&tool.support_checks?.every(check=>check.rate_mms===null));
    if(!asksForAudit&&unsupportedPrediction)return Response.json(predictionAnswer(tools),{headers:{"cache-control":"no-store"}});
    if(!asksForAudit&&tools.every(tool=>["abstained","invalid_arguments"].includes(tool.status))) return Response.json({status:"insufficient_evidence",mode:"insufficient_evidence",origin:"tool_result",
      answer:tools.map(tool=>`${tool.inputs.environment==="iss"?"ISS":tool.inputs.environment==="earth"?"Earth":"Requested condition"}: no estimate was produced. ${tool.reason}`).join("\n\n"),evidence:[],tools,generator:data.generator,planning_usage:data.usage},{headers:{"cache-control":"no-store"}});
    const completed = await askWorker(tools, data.tool_message);
    const answer = completed.ok ? await completed.json() : null;
    if(!answer || answer.status==="tool_request" || !answer.answer) return partial();
    return Response.json({...answer,tools,planning_usage:data.usage},{headers:{"cache-control":"no-store"}});
  } catch {
    if(completedTools.length&&!signal.aborted)return partial();
    return Response.json({error:"The research service is unavailable. Please try again."}, {status:503});
  }
}

