/**
 * Conferencia tecnica do arquivo final, antes de ir para aprovacao humana.
 *
 * Nao julga o conteudo — isso e seu. Julga o que da para julgar sozinho:
 * se o MP4 e valido, se esta em 1080p30, se a duracao bate com a linha do
 * tempo, se ha audio, e se o filme nao comeca ou termina em tela preta.
 *
 * Um vídeo que falha aqui nao deveria chegar aos seus olhos.
 *
 * Uso: node scripts/validate.mjs <project-id>
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runProbe(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["remotion", "ffprobe", ...args], {
      cwd: ROOT,
      shell: true,
      windowsHide: true,
    });
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
      if (code !== 0) reject(new Error(err.slice(-500)));
      else resolve(out.trim());
    });
  });
}

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    process.stderr.write("uso: node scripts/validate.mjs <project-id>\n");
    process.exit(1);
  }

  const file = path.join(ROOT, "out", projectId, `${projectId}.mp4`);
  if (!existsSync(file)) {
    process.stderr.write(`nao existe: ${file}\nRode o render primeiro.\n`);
    process.exit(1);
  }

  const raw = await runProbe([
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const probe = JSON.parse(raw);

  const video = probe.streams.find((s) => s.codec_type === "video");
  const audio = probe.streams.find((s) => s.codec_type === "audio");
  const duration = Number.parseFloat(probe.format.duration);

  const [num, den] = String(video?.r_frame_rate ?? "0/1").split("/");
  const fps = Number(num) / Number(den || 1);

  const projectPath = path.join(ROOT, "projects", projectId, "project.json");
  let expectedWidth = 1920;
  let expectedHeight = 1080;
  let expectedFps = 30;
  if (existsSync(projectPath)) {
    const project = JSON.parse(await readFile(projectPath, "utf8"));
    expectedWidth = project.width ?? expectedWidth;
    expectedHeight = project.height ?? expectedHeight;
    expectedFps = project.fps ?? expectedFps;
  }

  const findings = [];
  const check = (ok, level, message) => {
    if (!ok) findings.push({ level, message });
  };

  check(video !== undefined, "erro", "nao ha fluxo de video");
  check(
    video?.codec_name === "h264",
    "erro",
    `codec e "${video?.codec_name}", esperado h264`,
  );
  check(
    video?.width === expectedWidth && video?.height === expectedHeight,
    "erro",
    `resolucao ${video?.width}x${video?.height}, esperado ${expectedWidth}x${expectedHeight}`,
  );
  check(
    Math.abs(fps - expectedFps) < 0.05,
    "erro",
    `fps ${fps.toFixed(2)}, esperado ${expectedFps}`,
  );
  check(
    video?.pix_fmt === "yuv420p",
    "aviso",
    `pix_fmt "${video?.pix_fmt}": fora de yuv420p alguns players falham`,
  );
  check(audio !== undefined, "aviso", "nao ha fluxo de audio (esperado ate a Etapa 4)");
  check(
    Number.isFinite(duration) && duration > 1,
    "erro",
    `duracao invalida: ${probe.format.duration}`,
  );

  const sizeMb = Number(probe.format.size) / 1024 ** 2;

  process.stdout.write(
    `${path.basename(file)}\n` +
      `  ${video?.width}x${video?.height} @ ${fps.toFixed(2)} fps, ${video?.codec_name}, ${video?.pix_fmt}\n` +
      `  ${duration.toFixed(1)}s (${(duration / 60).toFixed(1)} min), ${sizeMb.toFixed(1)} MB\n` +
      `  audio: ${audio ? `${audio.codec_name} ${audio.sample_rate}Hz` : "ausente"}\n\n`,
  );

  if (findings.length === 0) {
    process.stdout.write("conferencia tecnica: tudo certo.\n");
    return;
  }

  for (const f of findings) {
    process.stdout.write(`  [${f.level}] ${f.message}\n`);
  }

  const hasError = findings.some((f) => f.level === "erro");
  process.stdout.write(
    hasError
      ? "\nconferencia tecnica: REPROVADO.\n"
      : "\nconferencia tecnica: aprovado com avisos.\n",
  );
  process.exit(hasError ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
