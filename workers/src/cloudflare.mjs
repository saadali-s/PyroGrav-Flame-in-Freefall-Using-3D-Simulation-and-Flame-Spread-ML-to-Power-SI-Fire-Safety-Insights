import { createRemoteJWKSet, jwtVerify } from "jose";
import researchService from "./index.mjs";

const team = "saads-projects-c422c56f";
const project = "pyrograv-space-apps";
const issuer = `https://oidc.vercel.com/${team}`;
const keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`), {timeoutDuration: 4000});

export function verifyProductionIdentity(token, keySet = keys) {
  return jwtVerify(token, keySet, {
    issuer,
    audience: `https://vercel.com/${team}`,
    subject: `owner:${team}:project:${project}:environment:production`,
    requiredClaims: ["iat", "exp", "nbf"],
    algorithms: ["RS256"],
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/vercel/chat") return researchService.fetch(request, env);
    if (request.method !== "POST") return new Response("Method not allowed", {status:405});
    const token = request.headers.get("authorization")?.match(/^Bearer (\S{1,8192})$/)?.[1];
    if (!token) return new Response("Unauthorized", {status:401});
    try {
      await verifyProductionIdentity(token);
    } catch {
      return new Response("Unauthorized", {status:401});
    }
    if (!env.CHAT_TOKEN) return new Response("Service unconfigured", {status:503});
    const payload = await request.text();
    const internal = new Request(new URL("/chat", url), {
      method:"POST",
      headers:{authorization:`Bearer ${env.CHAT_TOKEN}`,"content-type":"application/json"},
      body:payload,
    });
    return researchService.fetch(internal, env);
  },
};
