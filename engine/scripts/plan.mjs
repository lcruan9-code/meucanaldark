#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLM } from "./lib/llm.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let projectId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project" && args[i + 1]) {
      projectId = args[++i];
    } else if (!args[i].startsWith("--") && !projectId) {
      projectId = args[i];
    }
  }

  if (!projectId) {
    console.error("Usage: node scripts/plan.mjs <project-id>");
    process.exit(1);
  }

  return { projectId };
}

export async function runPlan({ projectId }) {
  const start = Date.now();
  console.log(`[plan] Planning audiovisual storyboard for project: ${projectId}`);

  const projectDir = path.resolve(ROOT, "projects", projectId);
  const narrativeFile = path.resolve(projectDir, "narrative.json");

  if (!fs.existsSync(narrativeFile)) {
    throw new Error(`[plan] narrative.json not found at ${narrativeFile}. Run segment.mjs first.`);
  }

  const narrative = JSON.parse(fs.readFileSync(narrativeFile, "utf-8"));

  // Read system prompt
  const promptPath = path.resolve(ROOT, "scripts", "prompts", "plan-system.md");
  const systemPrompt = fs.readFileSync(promptPath, "utf-8");

  // Call LLM
  const userPrompt = `Narrative breakdown to plan into scenes:\n${JSON.stringify(narrative, null, 2)}`;
  const response = await callLLM({
    stage: "storyboard",
    projectId,
    prompt: userPrompt,
    systemPrompt,
  });

  const storyboard = response.data;

  // Validate storyboard
  if (!storyboard.plannedScenes || !Array.isArray(storyboard.plannedScenes) || storyboard.plannedScenes.length === 0) {
    throw new Error("[plan] Invalid storyboard: plannedScenes array missing or empty");
  }

  storyboard.projectId = projectId;
  storyboard.channelId = narrative.channelId || "invisible-systems";
  storyboard.pipeline = {
    stage: "plan",
    backend: response.meta?.backend || "unknown",
    model: response.meta?.model || "unknown",
    cached: !!response.meta?.cached,
    generatedAt: new Date().toISOString(),
  };

  const outFile = path.resolve(projectDir, "storyboard.json");
  fs.writeFileSync(outFile, JSON.stringify(storyboard, null, 2), "utf-8");

  // Generate markdown review document
  const reviewFile = path.resolve(projectDir, "storyboard-review.md");
  let reviewMd = `# Storyboard Review: ${projectId}\n\n`;
  reviewMd += `**Total Planned Scenes:** ${storyboard.plannedScenes.length}\n`;
  reviewMd += `**Generated:** ${new Date().toISOString()}\n\n`;
  reviewMd += `| # | Scene ID | Chapter | Seq Type | Est. Sec | Narration Preview |\n`;
  reviewMd += `|---|---|---|---|---|---|\n`;

  storyboard.plannedScenes.forEach((s, idx) => {
    const textPreview = (s.narrationText || "").slice(0, 50).replace(/\|/g, "\\|") + "...";
    reviewMd += `| ${idx + 1} | \`${s.sceneId}\` | ${s.chapterId || "-"} | \`${s.sequenceType || "manual"}\` | ${s.estimatedDurationSeconds}s | ${textPreview} |\n`;
  });

  if (storyboard.missingCapabilities && storyboard.missingCapabilities.length > 0) {
    reviewMd += `\n## Missing Visual Capabilities & Substitutions\n\n`;
    for (const cap of storyboard.missingCapabilities) {
      reviewMd += `- **Needed:** ${cap.neededVisual}\n  - **Substitute Used:** \`${cap.substituteUsed}\`\n  - **Editorial Impact:** ${cap.impact}\n\n`;
    }
  }

  fs.writeFileSync(reviewFile, reviewMd, "utf-8");

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[plan] ✓ Done in ${elapsed}s -> ${outFile}`);
  console.log(`[plan] ✓ Storyboard review report -> ${reviewFile}`);
  return { outFile, reviewFile, storyboard };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { projectId } = parseArgs();
  runPlan({ projectId }).catch((err) => {
    console.error(`[plan] ✗ Error:`, err);
    process.exit(1);
  });
}
