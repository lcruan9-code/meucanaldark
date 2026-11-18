#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLM } from "./lib/llm.mjs";
import { loadChannel } from "./lib/channel.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let scriptPath = null;
  let channelId = "invisible-systems";
  let projectId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--channel" && args[i + 1]) {
      channelId = args[++i];
    } else if (args[i] === "--project" && args[i + 1]) {
      projectId = args[++i];
    } else if (!args[i].startsWith("--") && !scriptPath) {
      scriptPath = args[i];
    }
  }

  if (!scriptPath) {
    console.error("Usage: node scripts/segment.mjs <screenplay.txt|md> [--channel <id>] [--project <id>]");
    process.exit(1);
  }

  const resolvedScript = path.resolve(process.cwd(), scriptPath);
  if (!fs.existsSync(resolvedScript)) {
    console.error(`Error: Screenplay not found at ${resolvedScript}`);
    process.exit(1);
  }

  if (!projectId) {
    const base = path.basename(resolvedScript, path.extname(resolvedScript));
    projectId = base.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  }

  return { resolvedScript, channelId, projectId };
}

export async function runSegment({ scriptPath, channelId, projectId }) {
  const start = Date.now();
  console.log(`[segment] Processing screenplay: ${scriptPath}`);
  console.log(`[segment] Project: ${projectId} | Channel: ${channelId}`);

  // Load channel configuration
  const channel = loadChannel(channelId);

  // Read screenplay
  const screenplayText = fs.readFileSync(scriptPath, "utf-8");

  // Read system prompt
  const promptPath = path.resolve(ROOT, "scripts", "prompts", "segment-system.md");
  const systemPrompt = fs.readFileSync(promptPath, "utf-8");

  // Call LLM adapter
  const userPrompt = `Project ID: ${projectId}\nChannel: ${channel.name} (${channelId})\n\nScreenplay Content:\n${screenplayText}`;
  const response = await callLLM({
    stage: "narrative",
    projectId,
    prompt: userPrompt,
    systemPrompt,
  });

  const narrative = response.data;

  // Validate basic schema expectations
  if (!narrative.chapters || !Array.isArray(narrative.chapters) || narrative.chapters.length === 0) {
    throw new Error("[segment] Invalid narrative: chapters array missing or empty");
  }

  for (const ch of narrative.chapters) {
    if (!ch.segments || !Array.isArray(ch.segments) || ch.segments.length === 0) {
      throw new Error(`[segment] Chapter ${ch.id || "unknown"} has no segments`);
    }
  }

  narrative.id = projectId;
  narrative.channelId = channelId;
  narrative.pipeline = {
    stage: "segment",
    backend: response.meta?.backend || "unknown",
    model: response.meta?.model || "unknown",
    cached: !!response.meta?.cached,
    generatedAt: new Date().toISOString(),
  };

  // Write output to projects/<projectId>/narrative.json
  const outDir = path.resolve(ROOT, "projects", projectId);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.resolve(outDir, "narrative.json");
  fs.writeFileSync(outFile, JSON.stringify(narrative, null, 2), "utf-8");

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[segment] ✓ Done in ${elapsed}s -> ${outFile}`);
  return { outFile, narrative };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { resolvedScript, channelId, projectId } = parseArgs();
  runSegment({ scriptPath: resolvedScript, channelId, projectId }).catch((err) => {
    console.error(`[segment] ✗ Error:`, err);
    process.exit(1);
  });
}
