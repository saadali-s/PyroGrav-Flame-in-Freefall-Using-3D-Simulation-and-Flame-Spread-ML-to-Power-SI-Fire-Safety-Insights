import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import worker, { verifyProductionIdentity } from "../src/cloudflare.mjs";

test("only the signed PyroGrav production identity passes", async () => {
  const {privateKey, publicKey} = await generateKeyPair("RS256");
  const keys = createLocalJWKSet({keys:[await exportJWK(publicKey)]});
  const audience = "https://vercel.com/saads-projects-c422c56f";
  const issuer = "https://oidc.vercel.com/saads-projects-c422c56f";
  const subject = "owner:saads-projects-c422c56f:project:pyrograv-space-apps:environment:production";
  const issue = (sub = subject, aud = audience, iss = issuer, expires = "1h") => new SignJWT({})
    .setProtectedHeader({alg:"RS256"})
    .setIssuer(iss).setAudience(aud).setSubject(sub)
    .setIssuedAt().setNotBefore("0s").setExpirationTime(expires).sign(privateKey);
  assert.equal((await verifyProductionIdentity(await issue(),keys)).payload.sub,subject);
  await assert.rejects(verifyProductionIdentity(await issue(subject.replace("production","preview")),keys));
  await assert.rejects(verifyProductionIdentity(await issue(subject.replace("pyrograv-space-apps","other")),keys));
  await assert.rejects(verifyProductionIdentity(await issue(subject,"https://vercel.com/other"),keys));
  await assert.rejects(verifyProductionIdentity(await issue(subject,audience,"https://oidc.vercel.com/other"),keys));
  await assert.rejects(verifyProductionIdentity(await issue(subject,audience,issuer,"-1h"),keys));
});

test("public Worker OIDC route rejects missing tokens before inference", async () => {
  const response = await worker.fetch(new Request("https://worker.invalid/vercel/chat",{method:"POST"}),{
    AI:{run:()=>assert.fail("Unauthorized request reached inference")},
  });
  assert.equal(response.status,401);
});
