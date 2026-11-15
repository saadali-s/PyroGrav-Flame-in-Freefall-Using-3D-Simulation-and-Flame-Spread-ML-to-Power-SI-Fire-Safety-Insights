import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "node:path";

const ortBinaries = "./node_modules/onnxruntime-node/bin/napi-v6";
const inferenceRoutes = ["/api/guide", "/api/analytics/explain"];
const unusedBinaries = ["darwin/arm64", "linux/arm64", "linux/x64", "win32/arm64", "win32/x64"]
  .filter(platform => platform !== `${process.platform}/${process.arch}`)
  .map(platform => `${ortBinaries}/${platform}/**`);
const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["onnxruntime-node"],
  outputFileTracingIncludes: Object.fromEntries(inferenceRoutes.map(route => [route, [
    "./models/indus/**", `${ortBinaries}/${process.platform}/${process.arch}/**`,
  ]])),
  outputFileTracingExcludes: Object.fromEntries(inferenceRoutes.map(route => [route, unusedBinaries])),
  turbopack: {
    root: path.resolve(import.meta.dirname, ".."),
    rules: {
      "*.css": {
        // CSS Modules need Next's native processing to retain class exports.
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Isolate local production builds while keeping Vercel's expected output directory.
export default function config(phase: string): NextConfig {
  return { ...nextConfig, distDir: phase === PHASE_DEVELOPMENT_SERVER || process.env.VERCEL === "1" ? ".next" : ".next-production" };
}
