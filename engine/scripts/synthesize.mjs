#!/usr/bin/env node
/**
 * Synthesizes voice narration using Edge TTS and measures audio durations with ffprobe.
 * Generates individual scene audio in public/narration/<projectId>/<sceneId>.mp3
 * and consolidated subtitles in out/<projectId>/<projectId>.srt and .vtt.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { loadChannel } from "./lib/channel.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let projectId = null;
  let channelId = "invisible-systems";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--channel" && args[i + 1]) {
      channelId = args[++i];
    } else if (args[i] === "--project" && args[i + 1]) {
      projectId = args[++i];
    } else if (!args[i].startsWith("--") && !projectId) {
      projectId = args[i];
    }
  }

  if (!projectId) {
    console.error("Usage: node scripts/synthesize.mjs <project-id> [--channel <id>]");
    process.exit(1);
  }

  return { projectId, channelId };
}

/**
 * Probes audio duration with remotion ffprobe
 */
export function probeSeconds(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "remotion",
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        `"${file}"`,
      ],
      { cwd: ROOT, shell: true, windowsHide: true },
    );

    let out = "";
    let err = "";
    child.stdout.on("data", (c) => {
      out += c.toString();
    });
    child.stderr.on("data", (c) => {
      err += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const seconds = Number.parseFloat(out.trim());
      if (code !== 0 || !Number.isFinite(seconds)) {
        reject(new Error(`ffprobe failed on ${file}: ${err.slice(-400)}`));
        return;
      }
      resolve(seconds);
    });
  });
}

function parseVttTime(timeStr) {
  // Format: 00:00:00,100 or 00:00:00.100
  const normalized = timeStr.replace(",", ".");
  const parts = normalized.split(":");
  let hours = 0, mins = 0, secs = 0;
  if (parts.length === 3) {
    hours = parseFloat(parts[0]);
    mins = parseFloat(parts[1]);
    secs = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    mins = parseFloat(parts[0]);
    secs = parseFloat(parts[1]);
  }
  return hours * 3600 + mins * 60 + secs;
}

function formatSrtTime(totalSec) {
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  const ms = Math.floor((totalSec - Math.floor(totalSec)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatVttTime(totalSec) {
  return formatSrtTime(totalSec).replace(",", ".");
}

export async function runSynthesize({ projectId, channelId = "invisible-systems" }) {
  const start = Date.now();
  console.log(`[synthesize] Synthesizing TTS narration for project: ${projectId}`);

  const channel = loadChannel(channelId);
  const voice = channel.tts?.voice || "en-US-GuyNeural";
  console.log(`[synthesize] Channel: ${channelId} | TTS Voice: ${voice}`);

  const projectDir = path.resolve(ROOT, "projects", projectId);
  const storyboardFile = path.resolve(projectDir, "storyboard.json");
  const projectFile = path.resolve(projectDir, "project.json");

  if (!fs.existsSync(storyboardFile)) {
    throw new Error(`[synthesize] storyboard.json not found at ${storyboardFile}`);
  }

  const storyboard = JSON.parse(fs.readFileSync(storyboardFile, "utf-8"));
  const publicNarrationDir = path.resolve(ROOT, "public", "narration", projectId);
  if (!fs.existsSync(publicNarrationDir)) {
    fs.mkdirSync(publicNarrationDir, { recursive: true });
  }

  const durations = {};
  const sceneSubtitles = [];

  for (let i = 0; i < storyboard.plannedScenes.length; i++) {
    const scene = storyboard.plannedScenes[i];
    const text = (scene.narrationText || "").trim();
    if (!text) continue;

    const mp3File = path.resolve(publicNarrationDir, `${scene.sceneId}.mp3`);
    const vttFile = path.resolve(publicNarrationDir, `${scene.sceneId}.vtt`);
    const relSrc = `narration/${projectId}/${scene.sceneId}.mp3`;

    // Generate audio if not present or empty
    if (!fs.existsSync(mp3File) || fs.statSync(mp3File).size === 0) {
      console.log(`  [tts ${i + 1}/${storyboard.plannedScenes.length}] Synthesizing "${scene.sceneId}" (${text.slice(0, 40)}...)`);

      const ttsArgs = [
        "-m",
        "edge_tts",
        "--voice",
        voice,
        "--text",
        text,
        "--write-media",
        mp3File,
        "--write-subtitles",
        vttFile,
      ];

      const res = spawnSync("python", ttsArgs, {
        cwd: ROOT,
        stdio: "pipe",
        encoding: "utf-8",
      });

      if (res.status !== 0) {
        throw new Error(`[synthesize] edge-tts failed for scene ${scene.sceneId}: ${res.stderr || res.stdout}`);
      }
    } else {
      console.log(`  [tts ${i + 1}/${storyboard.plannedScenes.length}] Using cached audio: ${scene.sceneId}.mp3`);
    }

    if (!fs.existsSync(mp3File) || fs.statSync(mp3File).size === 0) {
      throw new Error(`[synthesize] Audio file not found or zero size: ${mp3File}`);
    }

    // Measure exact duration with ffprobe
    const durationSec = await probeSeconds(mp3File);
    durations[relSrc] = Number(durationSec.toFixed(3));

    // Collect subtitle cues if vtt exists
    if (fs.existsSync(vttFile)) {
      const vttContent = fs.readFileSync(vttFile, "utf-8");
      sceneSubtitles.push({
        sceneId: scene.sceneId,
        vttContent,
        text,
      });
    }
  }

  // Save durations.json
  const durationsFile = path.resolve(projectDir, "durations.json");
  fs.writeFileSync(durationsFile, JSON.stringify(durations, null, 2), "utf-8");
  console.log(`[synthesize] ✓ Measured ${Object.keys(durations).length} narration tracks -> ${durationsFile}`);

  // Update project.json with narration references if exists
  if (fs.existsSync(projectFile)) {
    const proj = JSON.parse(fs.readFileSync(projectFile, "utf-8"));
    for (const sc of proj.scenes) {
      const relSrc = `narration/${projectId}/${sc.id}.mp3`;
      if (durations[relSrc]) {
        const sbScene = storyboard.plannedScenes.find((s) => s.sceneId === sc.id);
        sc.narration = {
          src: relSrc,
          text: sbScene?.narrationText || "",
          gainDb: 0,
        };
        // Remove fixed duration override so narration duration + padding dictates scene timing
        delete sc.duration;
      }
    }
    fs.writeFileSync(projectFile, JSON.stringify(proj, null, 2), "utf-8");
  }

  // Build consolidated subtitles (.srt and .vtt)
  const outDir = path.resolve(ROOT, "out", projectId);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // We compute timeline starts from durations + padding (0.4s)
  let timelineCursor = 0;
  let srtIndex = 1;
  let srtOutput = "";
  let vttOutput = "WEBVTT\n\n";

  for (const scene of storyboard.plannedScenes) {
    const relSrc = `narration/${projectId}/${scene.sceneId}.mp3`;
    const dur = durations[relSrc];
    if (!dur) continue;

    const sceneStart = timelineCursor;
    const vttEntry = sceneSubtitles.find((s) => s.sceneId === scene.sceneId);

    if (vttEntry) {
      // Parse cues from edge_tts vtt
      const lines = vttEntry.vttContent.split(/\r?\n/);
      let i = 0;
      while (i < lines.length) {
        const line = lines[i].trim();
        if (line.includes("-->")) {
          const [startStr, endStr] = line.split("-->").map((s) => s.trim());
          const cueStart = sceneStart + parseVttTime(startStr);
          const cueEnd = sceneStart + parseVttTime(endStr);
          i++;
          const cueTextLines = [];
          while (i < lines.length && lines[i].trim() !== "") {
            cueTextLines.push(lines[i].trim());
            i++;
          }
          const cueText = cueTextLines.join(" ");

          srtOutput += `${srtIndex}\n${formatSrtTime(cueStart)} --> ${formatSrtTime(cueEnd)}\n${cueText}\n\n`;
          vttOutput += `${formatVttTime(cueStart)} --> ${formatVttTime(cueEnd)}\n${cueText}\n\n`;
          srtIndex++;
        }
        i++;
      }
    } else {
      // Fallback single cue
      const cueStart = sceneStart;
      const cueEnd = sceneStart + dur;
      srtOutput += `${srtIndex}\n${formatSrtTime(cueStart)} --> ${formatSrtTime(cueEnd)}\n${scene.narrationText}\n\n`;
      vttOutput += `${formatVttTime(cueStart)} --> ${formatVttTime(cueEnd)}\n${scene.narrationText}\n\n`;
      srtIndex++;
    }

    timelineCursor += dur + 0.4; // 0.4 padding
  }

  const srtPath = path.resolve(outDir, `${projectId}.srt`);
  const vttPath = path.resolve(outDir, `${projectId}.vtt`);
  fs.writeFileSync(srtPath, srtOutput, "utf-8");
  fs.writeFileSync(vttPath, vttOutput, "utf-8");

  console.log(`[synthesize] ✓ Generated English subtitles -> ${srtPath} and ${vttPath}`);
  console.log(`[synthesize] ✓ Completed in ${((Date.now() - start) / 1000).toFixed(2)}s`);

  return { durations, srtPath, vttPath };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { projectId, channelId } = parseArgs();
  runSynthesize({ projectId, channelId }).catch((err) => {
    console.error(`[synthesize] ✗ Error:`, err);
    process.exit(1);
  });
}
