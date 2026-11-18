import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

export async function generateFixture({ projectId, stage }) {
  if (!projectId) {
    throw new Error(`[llm-fixture] projectId is required`);
  }
  const fixturePath = path.resolve(ROOT, "scripts", "fixtures", projectId, `${stage}.json`);
  if (!fs.existsSync(fixturePath)) {
    throw new Error(
      `[llm-fixture] No fixture found at ${fixturePath}. Available fixtures or switch LLM_BACKEND=ollama.`
    );
  }
  const raw = fs.readFileSync(fixturePath, "utf-8");
  const data = JSON.parse(raw);
  return {
    rawText: raw,
    data,
    meta: {
      backend: "fixture",
      model: "fixture",
      cached: true,
      fixturePath,
    },
  };
}
