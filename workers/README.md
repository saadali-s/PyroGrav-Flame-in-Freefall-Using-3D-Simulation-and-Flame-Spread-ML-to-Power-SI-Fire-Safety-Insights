# PyroGrav research assistant

Active generator is DeepSeek V4.1 Flash; INDUS remains the local retrieval encoder. The native planner, JSON writer, audited facts and read-only tools are separate modules. Use `npm test` for bounded offline regressions. `test/robustness-live.mjs` makes paid live requests through localhost and records the results; run it only for an authorized verification. Historical Llama and deployment statements below describe earlier versions.

The guide now handles product questions, bounded history and exact lab results; the deployed Worker is live. Historical future-deployment statements below describe the earlier pilot. The remaining hosting dependency is INDUS, which still runs locally, not Cloudflare Llama or Worker deployment.

The live localhost integration is recorded in `docs/live-chat-2026-11-14/README.md`. The deployed Worker is `pyrograv-nasa-guide`. Next.js calls the local INDUS encoder and forwards its IDs to the authenticated Worker. The Worker resolves those IDs against its bundled evidence. The direct Worker-to-encoder route remains available for a hosted encoder.

Run `backend/venv/Scripts/python.exe workers/encoder/serve.py` from the project root to start INDUS with the ignored development credential. Start Next.js with `npm run dev` in web. The development environment file supplies the Worker URL, chat token, encoder URL and encoder token. Future deployment requires a reachable `GUIDE_ENCODER_URL` and the corresponding secret in the Vercel environment. Startup uses a private local credential file for this pilot.

This folder contains a Cloudflare Worker, a small authenticated Python retrieval service and the reviewed evidence bundled with both. It can be packaged independently of the Next.js app. Regeneration of the evidence bundle uses the project checkout.

## Local entry points

From the project root on Windows:

```powershell
python workers/build_evidence.py
backend/venv/Scripts/python.exe workers/encoder/evaluate.py
cd workers
npm.cmd ci
npm.cmd test
npm.cmd run bundle
```

The Python probe uses the existing project Python environment and a cached copy of the model. These commands measure retrieval and test Worker orchestration with a substituted generation binding. The bundle command runs Wrangler in dry-run mode.

To serve retrieval locally, set a private session value for `ENCODER_TOKEN`, then run this from the project root:

```powershell
backend/venv/Scripts/python.exe -m uvicorn retrieval:app --app-dir workers/encoder --host 127.0.0.1 --port 8011
```

`POST /retrieve` takes a JSON object with a `question` field and a bearer token. It returns three catalog IDs and cosine similarities. The model loads on the first successful request. Provision the pinned snapshot in the host's Hugging Face cache before starting an independent instance. The adapter loads local files only. The implementation was exercised with PyTorch 2.12.0.dev20260408+cu128, Transformers 5.22.2, FastAPI 0.162.4 and Uvicorn 0.54.0 on the current machine.

## Worker contract

| Interface | Purpose |
| --- | --- |
| GET /health | Service identity and evidence bundle version. This route does not probe either inference dependency. |
| POST /chat | Accept one question of up to 1,000 characters with a server-side bearer token. Returns generated text plus reviewed records and their source locators, an insufficient-evidence response, or an explicit service error. |
| AI | Cloudflare Workers AI binding used for the explanation. |
| ENCODER_URL | Operator-configured HTTPS URL including the retrieval endpoint path. A deployed Worker needs a reachable host. |
| ENCODER_TOKEN | Worker secret matching the encoder's server-side environment value. |
| CHAT_TOKEN | Worker secret shared with a future server-side Vercel route. Keep it out of browser JavaScript and source control. |

The Worker sends the question to the encoder, resolves retrieved IDs against its own catalog and attaches available project metrics. The generator receives that evidence and is asked to return a short explanation plus supporting IDs. The Worker rejects unknown IDs, attaches canonical source links itself and returns generation errors explicitly. Citation membership alone cannot verify entailment, numerical faithfulness or translation quality. Parallel-language questions have not been evaluated. A future public Vercel API must also limit public traffic to control inference costs.

## Cloud deployment dependency

A production query must use the same model revision, tokenizer, pooling and normalization as the indexed documents. Precomputing six document vectors alone cannot encode arbitrary new questions. The local encoder is loopback-only. The design requires a persistent reachable encoder or an independently verified equivalent runtime. For this six-document pilot it holds normalized document vectors in memory and performs exact search. Supabase and Vectorize add no retrieval capability needed at this scale.

The future Vercel route can call the Worker's authenticated endpoint and return the cited evidence to the Space Guide. The preview currently remains local. The configured Worker can be deployed directly through Wrangler independently of any GitHub push. Live deployment, credentials, inference quota and answer quality are outstanding.
