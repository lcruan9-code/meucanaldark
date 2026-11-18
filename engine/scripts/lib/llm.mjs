import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateFixture } from "./llm-fixture.mjs";
import { generateOllama } from "./llm-ollama.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

export async function callLLM({
  stage,
  projectId,
  prompt,
  systemPrompt = "",
  forceBackend = null,
}) {
  const backend = forceBackend || process.env.LLM_BACKEND || "fixture";

  if (backend === "fixture") {
    return generateFixture({ projectId, stage });
  }

  // Cache lookup for live backends
  const cacheKey = crypto
    .createHash("sha256")
    .update(`${backend}:${systemPrompt}:${prompt}`)
    .digest("hex");

  const cacheDir = path.resolve(ROOT, ".llm-cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  const cacheFile = path.resolve(cacheDir, `${cacheKey}.json`);

  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    return {
      ...cached,
      meta: { ...cached.meta, cached: true },
    };
  }

  let result;
  if (backend === "ollama") {
    const model = process.env.OLLAMA_MODEL || "llama3";
    const host = process.env.OLLAMA_HOST || "http://localhost:11434";
    result = await generateOllama({ prompt, systemPrompt, model, host });
  } else {
    throw new Error(`[llm] Unknown backend: ${backend}. Supported: fixture, ollama.`);
  }

  fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), "utf-8");
  return result;
}
