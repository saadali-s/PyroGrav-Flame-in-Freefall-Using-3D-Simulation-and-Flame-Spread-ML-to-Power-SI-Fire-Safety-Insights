import { tools, toolNames } from "./tool-schema.mjs";

export const models = {
  deepseek: {id:"@cf/deepseek-ai/deepseek-v4.1-flash-1017",label:"DeepSeek V4.1 Flash",reasoning:"none"},
  glm: {id:"@cf/zai-org/glm-5.3",label:"GLM-5.3",reasoning:"low"},
  llama: {id:"@cf/meta/llama-3.3-70b-instruct-fp8-fast",label:"Llama 3.3 70B",legacy:true},
  groq: {id:"openai/gpt-oss-120b",label:"GPT-OSS 120B",reasoning:"low"},
};
const handoff={type:"function",function:{name:"respond_from_evidence",description:"Hand off to the answer writer when no row lookup or prediction is needed: app help, conceptual science, model metrics, or a clarification for missing numeric inputs. Do NOT choose this for complete measured-record or supported-prediction requests.",parameters:{type:"object",properties:{},additionalProperties:false}}};
export function modelFor(env) {
  const model = models[env.GUIDE_MODEL ?? "deepseek"];
  if (!model) throw new Error("Unsupported configured model");
  return model;
}
export function parseModelResponse(response) {
  const message = response.choices?.[0]?.message;
  if (response.choices?.[0]?.finish_reason === "length") throw new Error("Truncated model response");
  const rawCalls = message?.tool_calls ?? response.tool_calls;
  if (rawCalls?.length) {
    if (!Array.isArray(rawCalls) || rawCalls.length>4) throw new Error("Tool limit exceeded");
    let calls = rawCalls.map((call,i) => {
      const name=call.function?.name ?? call.name;
      const raw=call.function?.arguments ?? call.arguments;
      const args=typeof raw === "string" ? JSON.parse(raw) : raw;
      if(!(toolNames.has(name)||name==="respond_from_evidence")||!args||typeof args!=="object"||Array.isArray(args)) throw new Error("Invalid tool call");
      return {id:call.id ?? `call_${i}`,name,arguments:args};
    });
    if(new Set(calls.map(c=>c.id)).size!==calls.length)throw new Error("Duplicate call IDs");
    // A measured-record lookup already runs the same domain support checks and
    // estimator. Remove only numerically identical, fully covered predictions.
    calls=calls.filter(c=>c.name!=="predict_pmma_rate"||!calls.some(other=>
      other.name==="lookup_pmma_records"&&
      (other.arguments.environment==="both"||other.arguments.environment===c.arguments.environment)&&
      ["diameter_mm","oxygen_pct","airflow_cms"].every(key=>
        typeof c.arguments[key]==="number"&&other.arguments[key]===c.arguments[key])));
    if(calls.filter(c=>c.name!=="respond_from_evidence").length>2)throw new Error("Tool limit exceeded");
    const assistant={role:"assistant",content:message?.content ?? null,
      ...(typeof message?.reasoning_content==="string"?{reasoning_content:message.reasoning_content}:{}),
      tool_calls:calls.map(c=>({id:c.id,type:"function",function:{name:c.name,arguments:JSON.stringify(c.arguments)}}))};
    return {reply:{mode:"tool_request",calls},assistant,usage:response.usage??null};
  }
  const content=message?.content ?? response.response;
  return {reply:typeof content==="string"?JSON.parse(content):content,usage:response.usage??null};
}
export async function generate(env, messages, {allowTools=true}={}) {
  const model=modelFor(env);
  const input={messages,temperature:0,response_format:{type:"json_object"},
    ...(model.legacy?{max_tokens:1400}:{max_completion_tokens:3072,reasoning_effort:model.reasoning}),
    ...(!model.legacy&&allowTools?{tools,tool_choice:"auto"}:{}),
  };
  const response=await env.AI.run(model.id,input);
  return {...parseModelResponse(response),generator:model.id};
}

export async function plan(env, messages) {
  const model=modelFor(env);
  if(model.legacy)return generate(env,messages);
  const response=await env.AI.run(model.id,{
    messages:[{role:"system",content:"You route a PyroGrav request. Call one or two provided functions; do not write an answer. Choose lookup_pmma_records for exact published/curated rates, including duplicate/unit anomalies. It includes excluded rows AND the frozen model support checks/estimates: do not also call predict_pmma_rate for the same conditions. Both Earth/1g and ISS/microgravity comparisons use environment both. Convert diameter cm to mm (x10). Choose predict_pmma_rate only for NEW predicted rates/support checks. Do the supported part of a mixed question even if lunar silicone cannot be answered. If a required input is absent, or this is conceptual/metric/app discussion, call respond_from_evidence. Never invent missing inputs. Prior conversation only resolves follow-ups, not a new self-contained question."},...messages.slice(1)],
    tools:[...tools,handoff],tool_choice:"required",temperature:0,
    max_completion_tokens:2048,reasoning_effort:model.reasoning,
  });
  const parsed=parseModelResponse(response);
  if(parsed.reply?.mode!=="tool_request")throw new Error("Planner did not choose a route");
  // A compound question can need both data and explanation. Handoff is a routing
  // marker, not an executable tool; retain real calls and let the final writer answer both parts.
  const executable=parsed.reply.calls.filter(c=>c.name!=="respond_from_evidence");
  if(!executable.length)return {reply:{mode:"answer_from_context"},usage:parsed.usage};
  parsed.reply.calls=executable;
  parsed.assistant.tool_calls=parsed.assistant.tool_calls.filter(c=>c.function.name!=="respond_from_evidence");
  return parsed;
}

// Only the authenticated Next.js server supplies this continuation; never browser history.
export function toolConversation(assistant, results) {
  if(!assistant) return [];
  if(assistant.role!=="assistant"||!Array.isArray(assistant.tool_calls)||assistant.tool_calls.length<1||assistant.tool_calls.length>2||assistant.tool_calls.length!==results.length)
    throw new Error("Invalid tool continuation");
  const calls=assistant.tool_calls;
  if(calls.some((c,i)=>!toolNames.has(c.function?.name)||c.function.name!==results[i].name||typeof c.id!=="string"||c.id!==results[i].call_id))
    throw new Error("Tool/result mismatch");
  return [{role:"assistant",content:typeof assistant.content==="string"?assistant.content:null,tool_calls:calls,
    ...(typeof assistant.reasoning_content==="string"?{reasoning_content:assistant.reasoning_content}:{})},
    ...results.map((result,i)=>({role:"tool",tool_call_id:calls[i].id,content:JSON.stringify(result)}))];
}
