import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import { Tokenizer } from "@huggingface/tokenizers";

const assets = path.join(process.cwd(), "models", "indus");
const decompress = promisify(gunzip);
const aliases: Record<string, RegExp> = {
  pmma: /\b(?:pmma|bass(?:-ii)?)\b/i,
  flex: /\bflex\b/i,
  same: /\bSAME\b|\bsame-[Rr]\b/,
  daft: /\bdaft\b/i,
  saffire: /\bsaffire\b/i,
  luci: /\bluci\b/i,
};

type Index = { ids: string[]; vectors: number[][] };
type Manifest = {
  revision: string;
  guide: Index;
  analytics: Index;
  shards: { file: string; bytes: number; sha256: string }[];
};

async function loadEncoder() {
  const readAsset = (name: string) => readFile(path.join(assets, name), "utf8").then(JSON.parse);
  const [manifest, vocabulary, tokenizerConfig] = await Promise.all([
    readAsset("index.json") as Promise<Manifest>,
    readAsset("tokenizer.json"),
    readAsset("tokenizer_config.json"),
  ]);
  const { InferenceSession, Tensor } = await import("onnxruntime-node");
  const chunks = await Promise.all(manifest.shards.map(async ({file, bytes, sha256}) => {
    const chunk = await readFile(path.join(assets, file));
    if (chunk.length !== bytes || createHash("sha256").update(chunk).digest("hex") !== sha256) {
      throw new Error("INDUS asset integrity check failed");
    }
    return decompress(chunk);
  }));
  const session = await InferenceSession.create(Buffer.concat(chunks), {
    executionProviders: ["cpu"], intraOpNumThreads: 1, interOpNumThreads: 1,
  });
  return { manifest, tokenizer: new Tokenizer(vocabulary, tokenizerConfig), session, Tensor };
}

let encoder: ReturnType<typeof loadEncoder> | undefined;
export const hostedIndus = () => process.env.VERCEL === "1" || process.env.GUIDE_HOSTED_INDUS === "1";

export async function retrieveIndus(question: string, scope: "guide" | "analytics") {
  encoder ??= loadEncoder().catch(error => {
    encoder = undefined;
    throw error;
  });
  const { manifest, tokenizer, session, Tensor } = await encoder;
  const encoded = tokenizer.encode(question.slice(0, 1000), {add_special_tokens: true}).ids;
  const ids = encoded.length > 256 ? [...encoded.slice(0, 255), encoded.at(-1)!] : encoded;
  const shape = [1, ids.length];
  const { embedding } = await session.run({
    input_ids: new Tensor("int64", BigInt64Array.from(ids, value => BigInt(value)), shape),
    attention_mask: new Tensor("int64", new BigInt64Array(ids.length).fill(BigInt(1)), shape),
  });
  const vector = embedding.data as Float32Array;
  const index = manifest[scope];
  const hits = index.ids.map((id, position) => ({
    id,
    name_match: scope === "guide" && (aliases[id]?.test(question) ?? false),
    score: index.vectors[position].reduce((score, value, i) => score + value * vector[i], 0),
  })).sort((a, b) => Number(b.name_match) - Number(a.name_match) || b.score - a.score);
  return { revision: manifest.revision, hits: hits.slice(0, 3) };
}
