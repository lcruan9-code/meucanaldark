#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";

import { runSegment } from "./segment.mjs";
import { runPlan } from "./plan.mjs";
import { runCompose } from "./compose.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let scriptPath = null;
  let channelId = "invisible-systems";
  let projectId = null;
  let resume = false;
  let smoke = false;
  let full = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--channel" && args[i + 1]) {
      channelId = args[++i];
    } else if (args[i] === "--project" && args[i + 1]) {
      projectId = args[++i];
    } else if (args[i] === "--resume") {
      resume = true;
    } else if (args[i] === "--smoke") {
      smoke = true;
    } else if (args[i] === "--full") {
      full = true;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (!args[i].startsWith("--") && !scriptPath) {
      scriptPath = args[i];
    }
  }

  if (!scriptPath && !projectId) {
    console.error("Usage: node scripts/make.mjs <screenplay.txt|md> [--channel <id>] [--project <id>] [--resume] [--smoke] [--full] [--dry-run]");
    process.exit(1);
  }

  let resolvedScript = null;
  if (scriptPath) {
    resolvedScript = path.resolve(process.cwd(), scriptPath);
    if (!fs.existsSync(resolvedScript)) {
      console.error(`Error: Screenplay file not found: ${resolvedScript}`);
      process.exit(1);
    }
    if (!projectId) {
      const base = path.basename(resolvedScript, path.extname(resolvedScript));
      projectId = base.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    }
  }

  return { resolvedScript, channelId, projectId, resume, smoke, full, dryRun };
}

async function main() {
  const totalStart = Date.now();
  const { resolvedScript, channelId, projectId, resume, smoke, full, dryRun } = parseArgs();

  console.log(`=======================================================`);
  console.log(`🎬 THE INVISIBLE SYSTEMS - AUTOMATED PIPELINE`);
  console.log(`=======================================================`);
  console.log(`Project:   ${projectId}`);
  console.log(`Channel:   ${channelId}`);
  if (resolvedScript) console.log(`Script:    ${resolvedScript}`);
  console.log(`Resume:    ${resume ? "Yes" : "No"}`);
  console.log(`Mode:      ${dryRun ? "Dry-run" : full ? "Full Render" : "Smoke Render"}`);
  console.log(`-------------------------------------------------------\n`);

  const projectDir = path.resolve(ROOT, "projects", projectId);
  const narrativeFile = path.resolve(projectDir, "narrative.json");
  const storyboardFile = path.resolve(projectDir, "storyboard.json");
  const projectFile = path.resolve(projectDir, "project.json");

  // Step 1: Segmentation
  console.log(`▶ [1/5] Segmenting screenplay...`);
  if (resume && fs.existsSync(narrativeFile)) {
    console.log(`  [cache] narrative.json exists, skipping segmentation.`);
  } else {
    if (!resolvedScript) {
      throw new Error(`Screenplay file is required for initial segmentation.`);
    }
    await runSegment({ scriptPath: resolvedScript, channelId, projectId });
  }

  // Step 2: Audiovisual Planning
  console.log(`\n▶ [2/5] Planning audiovisual storyboard...`);
  if (resume && fs.existsSync(storyboardFile)) {
    console.log(`  [cache] storyboard.json exists, skipping planning.`);
  } else {
    await runPlan({ projectId });
  }

  // Step 3: Composition
  console.log(`\n▶ [3/5] Composing and registering project...`);
  await runCompose({ projectId });

  if (dryRun) {
    console.log(`\n[dry-run] Pipeline completed successfully up to composition. Skipping render.`);
    console.log(`\nTotal pipeline time: ${((Date.now() - totalStart) / 1000).toFixed(2)}s`);
    return;
  }

  // Step 4: Render
  console.log(`\n▶ [4/5] Executing Remotion render...`);
  const renderArgs = ["scripts/render.mjs", projectId];

  const renderProc = spawnSync("node", renderArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (renderProc.status !== 0) {
    throw new Error(`Remotion render failed with exit code ${renderProc.status}`);
  }

  // Step 5: Validation
  console.log(`\n▶ [5/5] Validating output MP4...`);
  const validateScript = path.resolve(ROOT, "scripts", "validate.mjs");
  const validateProc = spawnSync("node", ["scripts/validate.mjs", projectId], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (validateProc.status !== 0) {
    console.warn(`[validate] Validation script reported warnings or non-zero exit.`);
  }

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(2);
  console.log(`\n=======================================================`);
  console.log(`🎉 Pipeline completed successfully in ${totalElapsed}s`);
  console.log(`=======================================================`);
}

main().catch((err) => {
  console.error(`\n❌ Pipeline Error:`, err);
  process.exit(1);
});
