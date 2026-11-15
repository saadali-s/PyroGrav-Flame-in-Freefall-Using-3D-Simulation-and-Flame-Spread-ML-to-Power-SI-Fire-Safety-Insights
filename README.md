# PyroGrav

**Flame in Freefall — using 3D simulation and flame spread ML to explore fire safety in space.**

Built for the 2026 NASA Space Apps challenge, [Flame in Freefall](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/). PyroGrav brings published combustion observations, model evaluations and source-linked explanations into one research dashboard.

## Explore the workbench

- **Dashboard** ranks six investigation families against research questions and displays measured model performance.
- **PMMA lab** compares acrylic-rod flame spread measurements with an analytical physics baseline and separate Earth/ISS ML models. Synchronized 3D views animate rate-driven front positions. Flame appearance is illustrative and the displayed timeline is a visualization choice.
- **FLEX lab** compares recorded liquid-droplet burning constants with held-out model estimates and provides performance and source views.
- **Analytics** compares held-out groups, traces excluded records and compares 12 investigations by apparatus and observable. Download the workbook or use Space Guide to inspect the selected result.
- **Evidence** exposes the data selection, four PMMA development rounds, the FLEX experiment, numerical results and source limitations.
- **Space Guide** uses NASA INDUS to retrieve reviewed study summaries and Cloudflare-hosted DeepSeek to explain the evidence. Read-only tools execute the same frozen PMMA support checks used by the lab and look up recorded FLEX cohorts.

## Measured results

| Task | Records / groups | Nearest baseline group MAE | Retained model group MAE | MAE reduction |
| --- | --- | --- | --- | --- |
| Earth PMMA flame spread | 35 / 19 | 0.02243 mm/s | 0.01333 mm/s | 40.58% |
| ISS PMMA flame spread | 34 / 11 | 0.02152 mm/s | 0.01049 mm/s | 51.26% |
| FLEX droplet burning constant | 198 / 79 | 0.07234 mm²/s | 0.05371 mm²/s | 25.76% |

These comparisons use held-out groups in reused development evaluations. The percentages measure reduction in group mean absolute error relative to the stated baselines. Independent verification scripts reproduce the saved predictions and metrics. Time and financial savings have yet to be measured.

The retained PMMA estimator is Round 2 log-geometry ridge. Subsequent physics-guided and pooled experiments failed their improvement criteria, so their results remain available for inspection. Training experiments used the local NVIDIA Blackwell GPU with CUDA where supported and CPU baselines. Frozen exports supply web inference and visualization.

Eleven ISS records retain inferred-unit flags, and specimen grouping remains provisional. Earth-only transfer performs poorly on ISS measurements. Moon/Mars predictions lack matched validation. FLEX models the burning constant K in mm²/s. Extinction probability, suppressant dose and causal CO₂-versus-helium rankings require additional targets and validation.

See [verified utility](docs/utility-ui-2026-11-15/README.md), [PMMA Round 2](docs/round2-2026-11-14/README.md), [Round 4](docs/round4-2026-11-14/README.md) and [FLEX](docs/flex-round1-2026-11-14/README.md).

## Repository layout

| Path | Contents |
| --- | --- |
| `web/` | Next.js application, React/Three.js scenes, shared frozen estimators and chat orchestration |
| `web/src/data/` | Published data snapshots and model/evidence exports consumed by the app |
| `web/public/training/` | Downloadable evaluation and provenance artifacts |
| `backend/data/` | Original source downloads and consolidated research archive |
| `backend/training/datasets/` | Derived PMMA/FLEX tables, review queues, source identifiers and manifests |
| `backend/training/runs/` | Frozen scripts, splits, predictions, models and results for every round |
| [`backend/training/`](backend/training/README.md) | Training entry points and protocols, with dedicated preparation, publication, verification and report folders |
| `backend/physics/` | Analytical rod model, protocol and frozen baseline evaluation |
| `workers/src/` | Cloudflare explanation service, tool schemas and reviewed evidence |
| `workers/encoder/` | Python INDUS retrieval service and evaluation code |
| `workers/test/` | Offline regression tests and explicitly invoked live probes |
| `docs/` | Research audits, protocols, results, source decisions and implementation records |

The document index records the development history. Later dated reports supersede earlier prototype status statements. Frozen script copies inside run folders preserve the implementation that produced each result. [Documentation index](docs/README.md)

## Run the web application

Install Node.js with npm, then run from the repository root.

```powershell
cd web
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The primary routes are `/dashboard`, `/simulation?experiment=pmma`, `/simulation?experiment=flex` `/analytics` and `/training`. Saved data, model comparisons and PMMA estimates are bundled with the web application. Supabase is unnecessary for the current runtime.

For the research guide, copy `web/.env.example` to a local environment file and configure the authenticated Worker and encoder endpoints. The current development setup runs INDUS on the laptop. Its model is `nasa-impact/indus-sde-st-v0.2`, pinned at revision `92b505b65c35b5842167786de403061d06dedef9`. The conversational guide searches six study families, and Analytics searches an additional index covering 12 investigations and four applications. DeepSeek generates conversational explanations on Cloudflare. Analytics resolves selected results through a deterministic lookup.

The existing Windows environment can start retrieval with `backend/venv/Scripts/python.exe workers/encoder/serve.py`. That launcher expects the private encoder credential file described in the Worker documentation. For a fresh environment, follow the explicit environment-variable and Uvicorn setup there. [Assistant setup](workers/README.md)

## Verify the project

```powershell
cd web
npx tsc --noEmit
npm run lint
node scripts/verify-utility.mjs
cd ../workers
npm ci
npm test
```

`verify-utility.mjs` independently recomputes all three displayed group-MAE reductions and verifies the 214-file scientific preservation manifest. Individual training verification programs live alongside the training scripts. Re-running training or rebuilding datasets is a deliberate experiment and can overwrite derived outputs, so use the frozen run reports to reproduce the exact environment and protocol.

## Sources and attribution

Core evidence includes [NASA PSI BASS-II](https://psi.nasa.gov/physci/repo/data/investigations/PSI-25), [Link et al. (2018)](https://doi.org/10.1038/s41598-017-18398-4), [NASA PSI FLEX](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69) and [NASA/TP-2015-216046](https://ntrs.nasa.gov/citations/20150023456). Investigation summaries also cover LUCI, Saffire, DAFT and SAME. Source registers record URLs, table/page locations, measurement definitions and file hashes. Research archive membership does not imply acceptance into training.

Third-party papers, images, datasets and software retain their respective terms and attribution. The source audit and original Figure 1 attribution should accompany any redistribution. [Evidence register](docs/evidence-register.md)

## SI use

Codex and Gemini assisted research review, implementation, debugging, documentation and design. Their suggestions were checked against primary sources and measured experiments, with rejected claims and failed evaluations recorded in the audits. Training labels originate in published measurements. NASA INDUS and DeepSeek are also explicit runtime components of the research guide. Generated explanations carry source links and require verification against those sources.

## Deployment status

Deploy from GitHub with Vercel's Next.js preset and `web` as the root directory. The Vercel application includes the trained PMMA estimator, saved FLEX evaluations and a server-side CPU export of the pinned NASA INDUS encoder. It can serve exact lab results, source-linked INDUS retrieval and Analytics explanations without any external service credentials.

The PyroGrav production project authenticates to the Cloudflare DeepSeek Worker using its signed Vercel OIDC identity. The Worker verifies the issuing team and exact production project. Other installations can set `GUIDE_WORKER_URL` and the server-only `GUIDE_CHAT_TOKEN`. If generation is unavailable, the guide can still return reviewed INDUS sources and run supported lab lookups.
