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
import {
  VOICE_ENGINES,
  defaultVoiceFor,
  riskyVoiceWarning,
  synthesizeScene,
} from "./lib/voice.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  let projectId = null;
  let channelId = "invisible-systems";
  let engine = null;
  let voice = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--channel" && args[i + 1]) {
      channelId = args[++i];
    } else if (args[i] === "--project" && args[i + 1]) {
      projectId = args[++i];
    } else if (args[i] === "--engine" && args[i + 1]) {
      engine = args[++i];
    } else if (args[i] === "--voice" && args[i + 1]) {
      voice = args[++i];
    } else if (!args[i].startsWith("--") && !projectId) {
      projectId = args[i];
    }
  }

  if (!projectId) {
    console.error(
      "Usage: node scripts/synthesize.mjs <project-id> [--channel <id>] " +
        `[--engine ${VOICE_ENGINES.join("|")}] [--voice <nome>]`,
    );
    process.exit(1);
  }

  return { projectId, channelId, engine, voice };
}

/** `edge-tts` (como esta no channel.json) e `edge` sao o mesmo motor. */
function normalizeEngine(name) {
  if (!name) return null;
  const lower = String(name).toLowerCase();
  if (lower === "edge-tts" || lower === "edge") return "edge";
  if (lower === "azure" || lower === "azure-speech") return "azure";
  return lower;
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

export async function runSynthesize({
  projectId,
  channelId = "invisible-systems",
  engine: engineOverride = null,
  voice: voiceOverride = null,
}) {
  const start = Date.now();
  console.log(`[synthesize] Synthesizing TTS narration for project: ${projectId}`);

  const channel = loadChannel(channelId);
  const tts = channel.tts ?? {};

  // Precedencia: linha de comando > channel.json > padrao.
  const engine =
    normalizeEngine(engineOverride) ??
    normalizeEngine(tts.engine) ??
    normalizeEngine(tts.backend) ??
    "edge";

  const locale = tts.locale ?? channel.language ?? "en-US";

  // Sem voz declarada, a do idioma — escolhida por teste de escuta.
  const voice = voiceOverride || tts.voice || defaultVoiceFor(locale);

  const risky = riskyVoiceWarning(locale, voice);
  if (risky) console.warn(`[synthesize] AVISO: ${risky}`);

  // Cada motor usa o que entende e ignora o resto: o edge nao tem prosodia,
  // o chatterbox nao tem SSML, o azure nao clona voz.
  const prosody = {
    locale,
    rate: tts.rate ?? "-4%",
    pitch: tts.pitch ?? "0%",
    style: tts.style ?? "",
    styleDegree: tts.styleDegree ?? 1,
    basePauseMs: tts.basePauseMs ?? 360,
    // Chatterbox: `audioPrompt` e o clipe de referencia (~5 s) que define a
    // voz. Sem ele, o modelo usa a voz padrao dele.
    audioPrompt: tts.audioPrompt ?? "",
    exaggeration: tts.exaggeration ?? 0.5,
    cfgWeight: tts.cfgWeight ?? 0.5,
    // Semente fixa: o modelo e generativo, e sem isto a mesma cena
    // re-sintetizaria diferente e o cache devolveria audio que ninguem
    // conferiu.
    seed: tts.seed ?? 1234,
    device: tts.device ?? "cuda",
  };

  console.log(
    `[synthesize] Channel: ${channelId} | Engine: ${engine} | Voice: ${voice}` +
      (engine === "azure"
        ? ` | rate ${prosody.rate}, pausa base ${prosody.basePauseMs}ms` +
          (prosody.style ? `, estilo ${prosody.style}` : "")
        : engine === "chatterbox"
          ? ` | ${prosody.device}, pausa base ${prosody.basePauseMs}ms` +
            (prosody.audioPrompt ? `, voz de ${prosody.audioPrompt}` : ", voz padrao")
          : " | sem controle de prosodia"),
  );

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

      try {
        await synthesizeScene({
          engine,
          text,
          voice,
          mp3File,
          vttFile,
          cwd: ROOT,
          ...prosody,
        });
      } catch (error) {
        throw new Error(
          `[synthesize] motor "${engine}" falhou na cena ${scene.sceneId}: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
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
  const { projectId, channelId, engine, voice } = parseArgs();
  runSynthesize({ projectId, channelId, engine, voice }).catch((err) => {
    console.error(`[synthesize] ✗ Error:`, err);
    process.exit(1);
  });
}
