import {catalog, revision, evidenceFor} from "./evidence.mjs";
import {generate, plan, modelFor, toolConversation} from "./model.mjs";
import {buildResearchContext} from "./research-context.mjs";
import {toolNames} from "./tool-schema.mjs";
import {relevantRecordAudits} from "./record-audits.mjs";
import { actions, appContext, normalizeHistory, systemPrompt } from "./guide-context.mjs";

const json = (value, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });
const unsupported = (usage = null) => json({ status: "insufficient_evidence", mode: "insufficient_evidence", answer: "I couldn't verify that answer from the available records. Try a specific study or inspect the saved evaluations.", evidence: [], actions: [actions.evidence], usage });


export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health") return json({ service: "pyrograv-evidence", catalog: catalog.version });
    if (path !== "/chat") return json({ error: "Unknown route" }, 404);
    if (request.method !== "POST") return json({ error: "POST required" }, 405);
    if (!env.CHAT_TOKEN || !env.AI) return json({ error: "Service unconfigured" }, 503);
    if (request.headers.get("authorization") !== `Bearer ${env.CHAT_TOKEN}`) return json({ error: "Unauthorized" }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 1000) return json({ error: "Send a question of 1–1000 characters" }, 400);
    const history = normalizeHistory(body.history);
    const requestedPage = body.page === "/simulation" ? actions.pmma.href : body.page;
    const page = Object.values(actions).some(a => a.href === requestedPage) ? requestedPage : "/dashboard";

    try {
      const model=modelFor(env), generator=model.id;
      let retrieved = body.retrieval;
      if (retrieved === undefined) {
        if (!env.ENCODER_URL || !env.ENCODER_TOKEN) return json({ error: "INDUS retrieval required" }, 503);
        const result = await fetch(env.ENCODER_URL, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { authorization: `Bearer ${env.ENCODER_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ question })
      });
      if (!result.ok) return json({ error: "Encoder unavailable" }, 503);
        retrieved = await result.json();
      }
      // A trusted server may explicitly report an outage: guidance remains usable,
      // but no scientific records or claims may be substituted from model memory.
      if (retrieved !== null && (retrieved?.revision !== revision || !Array.isArray(retrieved.hits) || retrieved.hits.length > 3))
        return json({ error: "Unexpected encoder response" }, 502);
      if(body.tool_results!==undefined && (!Array.isArray(body.tool_results)||body.tool_results.length>2)) return json({error:"Invalid tool result count"},400);
      const toolResults = body.tool_results ?? [];
      const toolHits = toolResults.filter(r=>["pmma","flex"].includes(r.evidence_id)).map(r=>({id:r.evidence_id,score:0}));
      const candidates = evidenceFor([...new Map([...(retrieved?.hits ?? []),...toolHits].map(h=>[h.id,h])).values()]);
      const recordAudits=relevantRecordAudits(question);
      if(recordAudits.length){
        let pmma=candidates.find(d=>d.id==="pmma");
        if(!pmma){pmma=evidenceFor([{id:"pmma",score:0}])[0];candidates.push(pmma);}
        pmma.audited_facts=[...(pmma.audited_facts??[]),...recordAudits.flatMap(a=>[a.title,...a.findings,a.disposition])];
        pmma.sources=[...pmma.sources,...recordAudits.flatMap(a=>a.sources)];
      }
      const {comparison,promptRecords,planetaryQuestion}=buildResearchContext(question,candidates);
      const architecture = env.DEPLOYMENT_CONTEXT ?? (body.indus_host === "vercel"
        ? "Next.js, the pinned NASA INDUS retrieval encoder and PyroGrav’s read-only PMMA/FLEX tools run on Vercel. INDUS searches six reviewed investigation families. Cloudflare Workers AI hosts the configured answer-writing model."
        : appContext.architecture);
      const productContext = {...appContext, architecture, active_generator:model.label};
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ question, recent_conversation: history, current_page: page,
          product_context: productContext, retrieval_available: retrieved !== null,
          required_transfer_comparison: comparison, tool_results: toolResults, record_audits:recordAudits, allowed_evidence_ids:candidates.map(d=>d.id), records: promptRecords }) }
      ];
      messages.push(...toolConversation(body.tool_message, toolResults));
      let planningUsage=null;
      let response;
      if(!toolResults.length && body.routing_hint!=="answer_from_context"){
        response=await plan(env,messages);
        planningUsage=response.usage;
        if(response.reply?.mode==="answer_from_context") response=await generate(env,messages,{allowTools:false});
      }else response=await generate(env,messages,{allowTools:false});
      let reply = response.reply;
      if(reply?.mode==="tool_request") {
        if(toolResults.length || !Array.isArray(reply.calls) || reply.calls.length<1 || reply.calls.length>2 || reply.calls.some(c=>
          !toolNames.has(c?.name) || !c.arguments || typeof c.arguments!=="object" || Array.isArray(c.arguments))) return unsupported(response.usage);
        return json({status:"tool_request",calls:reply.calls.map(({id,name,arguments:args})=>({id,name,arguments:args})),tool_message:response.assistant, generator, usage:response.usage??null});
      }
      const missingComparison = () => comparison.length && !comparison.every(m=>reply?.answer?.includes(m.group_mae));
      const irrelevantPlanet = () => !planetaryQuestion && /\b(Moon|Mars|lunar|martian)\b/i.test(reply?.answer??"");
      let firstUsage = null;
      if(missingComparison() || irrelevantPlanet()) {
        firstUsage=response.usage??null;
        response=await generate(env,[
          {role:"system",content:systemPrompt+"\nCorrect omitted evidence and unrelated scenarios. Include every required_transfer_comparison value with units, model and reused-development caveat. Never request tools during repair."},
          {role:"user",content:JSON.stringify({question,product_context:productContext,required_transfer_comparison:comparison,records:promptRecords,record_audits:recordAudits,allowed_evidence_ids:candidates.map(d=>d.id),tool_results:toolResults,draft:reply?.answer})}
        ],{allowTools:false});
        reply=response.reply;
      }
      if(missingComparison() && candidates.some(d=>d.id==="pmma")) {
        // A clearly identified, source-derived fallback is preferable to a fluent answer that omits the result.
        const transfer=comparison.find(m=>m.evaluation==="earth_to_microgravity"&&m.model==="log_geometry_ridge");
        const nearest=comparison.find(m=>m.model==="nearest");
        const iss=comparison.find(m=>m.evaluation==="microgravity_logo");
        const includeFlex=/\bFLEX\b/i.test(question)&&candidates.some(d=>d.id==="flex");
        return json({status:"generated",mode:"research",origin:"verified_summary",answer:
          `The Round 2 Earth-trained log-geometry ridge scored ${transfer.group_mae} mm/s group MAE on ISS, worse than nearest lookup at ${nearest.group_mae} mm/s. The separately trained ISS model scored ${iss.group_mae} mm/s. These are reused development evaluations, not independent validation or per-condition error bars.\n\nEarth observations cover only 2 and 25 cm/s. An ISS airflow falling inside its marginal range does not establish joint support: oxygen and rod diameter must also pass the existing hull gate. Use the ISS model for a supported experimental estimate, rather than transferring the Earth model.`+
          (includeFlex?"\n\nFLEX estimates the burning constant K in mm²/s for eligible recorded burns. It does not estimate extinction probability or causal CO2-versus-helium effectiveness. Use its measured-versus-held-out comparisons to inspect errors, not to choose an extinguisher.":""),
          evidence:candidates.filter(d=>d.id==="pmma"||(includeFlex&&d.id==="flex")),actions:[actions.evidence],
          usage:response.usage??null,first_pass_usage:firstUsage,encoder_revision:retrieved?revision:null,retrieval_status:retrieved?"available":"unavailable"});
      }
      if(irrelevantPlanet()) return unsupported(response.usage);
      if (!["guidance", "general", "research", "insufficient_evidence"].includes(reply?.mode) || !Array.isArray(reply.ids)
        || reply.ids.some(id => !candidates.some(doc => doc.id === id))) return unsupported(response.usage);
      if ((reply.mode === "research" && !reply.ids.length)
        || (["guidance", "general"].includes(reply.mode) && reply.ids.length)) return unsupported(response.usage);
      const evidence = candidates.filter(doc => reply.ids.includes(doc.id));
      if (typeof reply.answer !== "string" || !reply.answer.trim() || reply.answer.length > 4000) return unsupported(response.usage);
      const selectedActions = Array.isArray(reply.actions) ? [...new Set(reply.actions)].filter(id => Object.hasOwn(actions, id)).slice(0, 2).map(id => actions[id]) : [];
      return json({status: reply.mode === "insufficient_evidence" ? "insufficient_evidence" : "generated", mode: reply.mode,
        answer: reply.answer.trim(), evidence, actions: selectedActions, generator,
        encoder_revision: retrieved ? revision : null, retrieval_status: retrieved ? "available" : "unavailable",
        usage: response.usage ?? null, routing_usage:planningUsage, first_pass_usage:firstUsage});
    } catch {
      return json({ error: "Research service could not complete this question" }, 502);
    }
  }
};
