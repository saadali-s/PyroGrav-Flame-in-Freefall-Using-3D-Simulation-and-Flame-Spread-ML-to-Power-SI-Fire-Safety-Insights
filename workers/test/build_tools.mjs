import { build } from "esbuild";
import { fileURLToPath } from "node:url";
await build({entryPoints:[fileURLToPath(new URL("../../web/src/lib/guide-tools.ts",import.meta.url))],
  outfile:fileURLToPath(new URL("../../tmp/guide-tool-test.cjs",import.meta.url)),bundle:true,platform:"node",format:"cjs",
  tsconfig:fileURLToPath(new URL("../../web/tsconfig.json",import.meta.url))});
await build({entryPoints:[fileURLToPath(new URL("../../web/src/lib/guide-agent.ts",import.meta.url))],
  outfile:fileURLToPath(new URL("../../tmp/guide-agent-test.cjs",import.meta.url)),bundle:true,platform:"node",format:"cjs",
  external:["onnxruntime-node"],
  tsconfig:fileURLToPath(new URL("../../web/tsconfig.json",import.meta.url))});
await build({entryPoints:[fileURLToPath(new URL("../../web/src/lib/guide-starters.ts",import.meta.url))],
  outfile:fileURLToPath(new URL("../../tmp/guide-starters-test.cjs",import.meta.url)),bundle:true,platform:"node",format:"cjs"});
await build({entryPoints:[fileURLToPath(new URL("../../web/src/lib/hosted-guide.ts",import.meta.url))],
  outfile:fileURLToPath(new URL("../../tmp/hosted-guide-test.cjs",import.meta.url)),bundle:true,platform:"node",format:"cjs",
  tsconfig:fileURLToPath(new URL("../../web/tsconfig.json",import.meta.url))});
