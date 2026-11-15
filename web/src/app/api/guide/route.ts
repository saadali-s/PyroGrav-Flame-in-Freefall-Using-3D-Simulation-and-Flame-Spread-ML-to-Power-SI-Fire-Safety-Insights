import {guideConfigured, guideMode, runGuideTurn} from "@/lib/guide-agent";
import {sameOrigin} from "@/lib/same-origin";

export async function GET() {
  return Response.json({ configured: guideConfigured(), mode: guideMode() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!guideConfigured()) return Response.json({ error: "AI not connected" }, { status: 503 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origin mismatch" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 1000) return Response.json({ error: "Enter a question of 1–1000 characters." }, { status: 400 });
  const history = Array.isArray(body.history) ? body.history.slice(-6)
    .filter((m: {role?:unknown;content?:unknown}) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m: {role:string;content:string}) => ({role:m.role,content:m.content.slice(0,1800)})) : [];
  const page = typeof body.page === "string" ? body.page.slice(0,100) : "/dashboard";
  return runGuideTurn({question,history,page},request.signal,request.headers.get("x-vercel-oidc-token") ?? process.env.VERCEL_OIDC_TOKEN);
}



