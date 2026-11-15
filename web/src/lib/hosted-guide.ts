import researchService from "../../../workers/src/index.mjs";
import { evidenceFor } from "../../../workers/src/evidence.mjs";
import type { retrieveIndus } from "./indus";
import { executeGuideTool, type GuideToolResult } from "./guide-tools";
import { predictionAnswer } from "./guide-tool-answer";

type Retrieval = Awaited<ReturnType<typeof retrieveIndus>> | null;
type StudySummary = { title:string; measurement:string; units:string; interpretation:string; limit:string };
const gatewayModels = {
  "@cf/deepseek-ai/deepseek-v4.1-flash-1017": "deepseek/deepseek-v4.1-flash-1017",
} as Record<string, string>;

export const hostedGeneration = () => process.env.GUIDE_GROQ_API_KEY
  ? "groq" : process.env.GUIDE_FREE_GATEWAY === "1" ? "gateway" : undefined;

export function hostedResearchChat(payload: object, oidc: string, signal: AbortSignal) {
  const groqKey = process.env.GUIDE_GROQ_API_KEY;
  const provider = groqKey ? "Groq" : "Vercel AI Gateway";
  const endpoint = groqKey ? "https://api.groq.com/openai/v1/chat/completions" : "https://ai-gateway.vercel.sh/v1/chat/completions";
  const request = new Request("https://pyrograv.internal/chat", {
    method: "POST",
    headers: { authorization: "Bearer internal", "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return researchService.fetch(request, {
    CHAT_TOKEN: "internal",
    GUIDE_MODEL: groqKey ? "groq" : "deepseek",
    DEPLOYMENT_CONTEXT: `The pinned NASA INDUS encoder runs on Vercel and retrieves reviewed study summaries. The configured generation model writes answers through ${provider}. Exact read-only calculations use the same saved model as the lab.`,
    AI: {
      async run(model: string, input: {tools?: unknown}) {
        const response = await fetch(endpoint, {
          method: "POST", redirect: "error", signal, cache: "no-store",
          headers: { authorization: `Bearer ${groqKey ?? oidc}`, "content-type": "application/json" },
          body: JSON.stringify(groqKey ? {
            ...input, model, ...(input.tools ? {parallel_tool_calls: false} : {}),
          } : { ...input, model: gatewayModels[model] }),
        });
        if (!response.ok) {
          console.warn(`${provider} returned HTTP`, response.status);
          throw new Error("Generation unavailable");
        }
        return response.json();
      },
    },
  });
}

export function hostedEvidenceAnswer(retrieval: Retrieval, tools: GuideToolResult[] = []) {
  const evidence: StudySummary[] = evidenceFor(retrieval?.hits.slice(0, 2) ?? []);
  const summaries = evidence.map(record => `**${record.title}** — ${record.measurement} · ${record.units}\n\n${record.interpretation}\n\n${record.limit}`);
  return Response.json({
    status: evidence.length ? "generated" : "insufficient_evidence",
    mode: evidence.length ? "research" : "insufficient_evidence",
    origin: "indus_evidence",
    answer: evidence.length
      ? ["Closest reviewed records from NASA INDUS:", ...summaries].join("\n\n")
      : "The NASA INDUS search is temporarily unavailable. The saved evaluations and lab results are available below.",
    evidence, tools, encoder_revision: retrieval?.revision ?? null,
    retrieval_status: retrieval ? "available" : "unavailable",
    actions: [{ label: "Explore investigations", href: "/dashboard" }, { label: "Inspect model evaluations", href: "/training" }],
  }, { headers: { "cache-control": "no-store" } });
}

export function hostedLabAnswer(question: string) {
  if (/\bFLEX\b/i.test(question) && /\b(?:look\s*up|list|show|find|query)\b/i.test(question)
      && !/\b(?:rank|stronger|better|effective|effectiveness|vs|versus)\b/i.test(question)) {
    const fuels = [/\bmethanol\b/i.test(question) ? "Methanol" : null, /\bheptane\b/i.test(question) ? "Heptane" : null].filter(Boolean);
    const gases = [/\bCO[2₂](?!\w)|\bcarbon dioxide\b/i.test(question) ? "CO2" : null, /\bHe\b/.test(question) || /\bhelium\b/i.test(question) ? "He" : null].filter(Boolean);
    if (fuels.length === 1 && gases.length === 1) {
      const tool = executeGuideTool({name:"query_flex_cohort",arguments:{fuel:fuels[0],diluent:gases[0]}});
      return labRecordsAnswer(tool, `Found **${tool.matched_rows}** eligible ${fuels[0]} FLEX records containing ${gases[0]}. The table shows up to five published burning constants (K, mm²/s) and saved held-out estimates. The gas filter describes the recorded conditions. The results do not measure causal suppressant efficacy.`);
    }
  }
  if (!/\bPMMA\b/i.test(question)) return;
  const measured = /\b(?:published|curated|measured|recorded|look\s*up)\b/i.test(question);
  if (!measured && !/\b(?:predict|estimate|check)\b/i.test(question)) return;
  if (/\b(?:moon|mars|lunar|martian)\b/i.test(question)) return;
  const earth = /\bearth\b|(?<![\d.])\b1\s*g\b/i.test(question);
  const iss = /\b(?:iss|microgravity)\b|(?<![\d.])\b0\s*g\b/i.test(question);
  if (!earth && !iss) return;
  const diameters = [...question.matchAll(/(?<![\d.+-])(\d+(?:\.\d+)?)\s*(mm|cm)(?!\s*[/²³]|\w)/gi)];
  const oxygen = [...question.matchAll(/(?<![\d.+-])(\d+(?:\.\d+)?)\s*%\s*(?:oxygen|o₂|o2)(?!\w)/gi)];
  const airflow = [...question.matchAll(/(?<![\d.+-])(\d+(?:\.\d+)?)\s*cm\s*\/\s*s\b/gi)];
  if (diameters.length !== 1 || oxygen.length !== 1 || airflow.length !== 1) return;
  const diameter_mm = Number(diameters[0][1]) * (diameters[0][2].toLowerCase() === "cm" ? 10 : 1);
  const oxygen_pct = Number(oxygen[0][1]);
  const airflow_cms = Number(airflow[0][1]);
  if (![diameter_mm, oxygen_pct, airflow_cms].every(value => Number.isFinite(value) && value > 0)) return;
  if (measured) {
    const tool = executeGuideTool({name:"lookup_pmma_records",arguments:{
      environment: earth && iss ? "both" : earth ? "earth" : "iss", diameter_mm, oxygen_pct, airflow_cms,
    }});
    return labRecordsAnswer(tool, tool.reason ?? "Inspect the source and review flags for each matching PMMA condition.");
  }
  const environments = [earth ? "earth" : null, iss ? "iss" : null].filter(Boolean);
  const tools = environments.map(environment => executeGuideTool({
    name: "predict_pmma_rate", arguments: { environment, diameter_mm, oxygen_pct, airflow_cms },
  }));
  return Response.json(predictionAnswer(tools), {headers: {"cache-control": "no-store"}});
}

function labRecordsAnswer(tool: GuideToolResult, answer: string) {
  return Response.json({
    status:"generated", mode:"research", origin:"tool_result", answer, tools:[tool],
    evidence: evidenceFor([{id:tool.evidence_id,score:0}]),
    actions: [{label:"Inspect model evaluations",href:"/training"}],
  }, {headers: {"cache-control": "no-store"}});
}
