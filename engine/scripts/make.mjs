#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { runSegment } from "./segment.mjs";
import { runPlan } from "./plan.mjs";
import { runSynthesize } from "./synthesize.mjs";
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
  let dryRun = false;
  let skipTts = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--channel" && args[i + 1]) {
      channelId = args[++i];
    } else if (args[i] === "--project" && args[i + 1]) {
      projectId = args[++i];
    } else if (args[i] === "--resume") {
      resume = true;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--skip-tts") {
      skipTts = true;
    } else if (!args[i].startsWith("--") && !scriptPath) {
      scriptPath = args[i];
    }
  }

  if (!scriptPath && !projectId) {
    console.error("Usage: node scripts/make.mjs <screenplay.txt|md> [--channel <id>] [--project <id>] [--resume] [--dry-run] [--skip-tts]");
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

  return { resolvedScript, channelId, projectId, resume, dryRun, skipTts };
}

async function main() {
  const totalStart = Date.now();
  const { resolvedScript, channelId, projectId, resume, dryRun, skipTts } = parseArgs();

  console.log(`=======================================================`);
  console.log(`🎬 THE INVISIBLE SYSTEMS - AUTOMATED PIPELINE`);
  console.log(`=======================================================`);
  console.log(`Project:   ${projectId}`);
  console.log(`Channel:   ${channelId}`);
  if (resolvedScript) console.log(`Script:    ${resolvedScript}`);
  console.log(`Resume:    ${resume ? "Yes" : "No"}`);
  console.log(`Mode:      ${dryRun ? "Dry-run" : "Full Render with Narration"}`);
  console.log(`-------------------------------------------------------\n`);

  const projectDir = path.resolve(ROOT, "projects", projectId);
  const narrativeFile = path.resolve(projectDir, "narrative.json");
  const storyboardFile = path.resolve(projectDir, "storyboard.json");
  const projectFile = path.resolve(projectDir, "project.json");

  // Step 1: Segmentation
  console.log(`▶ [1/7] Segmenting screenplay...`);
  if (resume && fs.existsSync(narrativeFile)) {
    console.log(`  [cache] narrative.json exists, skipping segmentation.`);
  } else {
    if (!resolvedScript) {
      throw new Error(`Screenplay file is required for initial segmentation.`);
    }
    await runSegment({ scriptPath: resolvedScript, channelId, projectId });
  }

  // Step 2: Audiovisual Planning
  console.log(`\n▶ [2/7] Planning audiovisual storyboard...`);
  if (resume && fs.existsSync(storyboardFile)) {
    console.log(`  [cache] storyboard.json exists, skipping planning.`);
  } else {
    await runPlan({ projectId });
  }

  // Step 3: TTS Narration & Subtitle Generation
  if (!skipTts) {
    console.log(`\n▶ [3/7] Generating Edge TTS narration & measuring durations...`);
    await runSynthesize({ projectId, channelId });
  } else {
    console.log(`\n▶ [3/7] Skipping TTS synthesis (--skip-tts flag).`);
  }

  // Step 4: Composition & Project Registration
  console.log(`\n▶ [4/7] Composing project.json and registering with Remotion...`);
  await runCompose({ projectId });

  // Step 5: Verification of Narration Durations
  console.log(`\n▶ [5/7] Verifying audio durations with prepare.mjs...`);
  const prepProc = spawnSync("node", ["scripts/prepare.mjs", projectId], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (prepProc.status !== 0) {
    throw new Error(`prepare.mjs failed with exit code ${prepProc.status}`);
  }

  if (dryRun) {
    console.log(`\n[dry-run] Pipeline completed successfully up to preparation. Skipping render.`);
    console.log(`\nTotal pipeline time: ${((Date.now() - totalStart) / 1000).toFixed(2)}s`);
    return;
  }

  // Step 6: Render
  console.log(`\n▶ [6/7] Executing Remotion render...`);
  const renderArgs = ["scripts/render.mjs", projectId];

  const renderProc = spawnSync("node", renderArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (renderProc.status !== 0) {
    throw new Error(`Remotion render failed with exit code ${renderProc.status}`);
  }

  // Step 7: Technical Validation
  console.log(`\n▶ [7/7] Validating output MP4...`);
  const validateProc = spawnSync("node", ["scripts/validate.mjs", projectId], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (validateProc.status !== 0) {
    throw new Error(`Validation failed with exit code ${validateProc.status}`);
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
