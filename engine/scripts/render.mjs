/**
 * Render de producao.
 *
 * Dois modos, de proposito:
 *
 *   --mode single  um passe sobre o filme inteiro. Simples, e o que o
 *                  Remotion faz melhor quando nao ha WebGL.
 *   --mode scenes  uma cena por vez, cada uma em seu MP4, concatenadas no
 *                  fim. Mais lento no total (cada cena paga a abertura do
 *                  Chrome), mas e o unico modo que da cache, retomada e
 *                  teto de memoria — e a documentacao do Remotion recomenda
 *                  partir renders longos com `gl=angle` por causa de um
 *                  vazamento conhecido do Chrome.
 *
 * O modo nao e escolhido por gosto: `npm run bench` mede os dois e o numero
 * decide. Enquanto nao houver medida, o padrao e `scenes` para projeto com
 * cena 3D e `single` para o resto.
 *
 * Cache: cada cena vira `scenes/<id>-<hash>.mp4`, onde o hash cobre a cena
 * resolvida inteira. Mudou o roteiro de uma cena, so ela re-renderiza; o
 * resto e reaproveitado. E tambem o que permite retomar um render morto.
 *
 * Acompanhamento remoto: `status.json` e `render.log.jsonl` sao escritos a
 * cada evento. Da para ler de outra maquina sem interromper nada.
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatDuration, startMemorySampler } from "./lib/measure.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {
    project: null,
    mode: null,
    concurrency: null,
    gl: null,
    scenes: null,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag.startsWith("--") && !args.project) args.project = flag;
    if (flag === "--project" && value) args.project = value;
    if (flag === "--mode" && value) args.mode = value;
    if (flag === "--concurrency" && value)
      args.concurrency = Number.parseInt(value, 10);
    if (flag === "--gl" && value) args.gl = value;
    if (flag === "--scenes" && value) args.scenes = value.split(",");
    if (flag === "--force") args.force = true;
  }
  return args;
}

/**
 * Impressao digital do codigo que desenha.
 *
 * O hash da cena sozinho NAO basta: mudar um componente da biblioteca sem
 * tocar no roteiro deixaria o JSON identico, e a cena voltaria do cache
 * desatualizada, em silencio. Isso aconteceu de verdade na conferencia da
 * Etapa 2 e e o tipo de erro que so aparece no video pronto.
 *
 * Lemos o conteudo de `src/` inteiro uma vez por render. Sao dezenas de
 * arquivos pequenos: custa milissegundos e vale a correcao.
 */
async function sourceFingerprint(dir) {
  const hash = createHash("sha256");
  const walk = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (/\.(ts|tsx|json)$/.test(entry.name)) {
        hash.update(entry.name);
        hash.update(await readFile(full));
      }
    }
  };
  await walk(dir);
  return hash.digest("hex").slice(0, 8);
}

function hashScene(scene, fingerprint) {
  return createHash("sha256")
    .update(fingerprint)
    .update(JSON.stringify(scene))
    .digest("hex")
    .slice(0, 12);
}

/** ffmpeg que ja vem com o Remotion: nenhuma dependencia nova. */
function remotionFfmpeg(ffmpegArgs, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["remotion", "ffmpeg", ...ffmpegArgs], {
      cwd,
      shell: true,
      windowsHide: true,
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg saiu com ${code}:\n${stderr.slice(-1500)}`));
    });
  });
}

class Journal {
  constructor(dir) {
    this.statusPath = path.join(dir, "status.json");
    this.logPath = path.join(dir, "render.log.jsonl");
    this.state = { phase: "starting", startedAt: new Date().toISOString() };
  }

  async event(type, data = {}) {
    const line = JSON.stringify({ at: new Date().toISOString(), type, ...data });
    await appendFile(this.logPath, `${line}\n`, "utf8");
  }

  async update(patch) {
    this.state = { ...this.state, ...patch, updatedAt: new Date().toISOString() };
    await writeFile(this.statusPath, JSON.stringify(this.state, null, 2), "utf8");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.project) {
    process.stderr.write(
      "uso: node scripts/render.mjs <project-id> [--mode single|scenes]\n" +
        "     [--concurrency N] [--gl angle|swangle] [--scenes id1,id2] [--force]\n",
    );
    process.exit(1);
  }

  const outDir = path.join(ROOT, "out", args.project);
  const sceneDir = path.join(outDir, "scenes");
  await mkdir(sceneDir, { recursive: true });

  const journal = new Journal(outDir);
  await journal.update({ phase: "bundling", project: args.project });
  process.stdout.write("empacotando...\n");

  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    webpackOverride: (config) => ({ ...config, optimization: { minimize: false } }),
  });

  const composition = await selectComposition({ serveUrl, id: args.project });
  const timeline = composition.props?.timeline;

  if (!timeline?.scenes) {
    throw new Error(
      `composicao "${args.project}" nao expoe uma linha do tempo. ` +
        "Ela foi registrada pelo Root.tsx?",
    );
  }

  // Vem do registro, calculado no Root. Antes era uma busca pela string
  // "cable-3d" no JSON, que passou a mentir assim que entrou a segunda cena
  // 3D — e escolher o modo errado custa estabilidade num render longo.
  const usesWebgl = timeline.usesWebgl === true;
  const mode = args.mode ?? (usesWebgl ? "scenes" : "single");
  const gl = args.gl ?? "angle";
  const concurrency =
    args.concurrency ?? Math.max(1, Math.floor(os.cpus().length / 2));

  const finalOut = path.join(outDir, `${args.project}.mp4`);

  await journal.update({
    phase: "rendering",
    mode,
    gl,
    concurrency,
    totalFrames: composition.durationInFrames,
    totalScenes: timeline.scenes.length,
  });
  await journal.event("start", { mode, gl, concurrency });

  process.stdout.write(
    `projeto ${args.project}: ${timeline.scenes.length} cenas, ` +
      `${composition.durationInFrames} quadros ` +
      `(${(composition.durationInFrames / composition.fps / 60).toFixed(1)} min)\n` +
      `modo ${mode} | gl ${gl} | concorrencia ${concurrency}\n\n`,
  );

  const sampler = startMemorySampler(2000);
  const started = Date.now();

  if (mode === "single") {
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: 18,
      imageFormat: "jpeg",
      jpegQuality: 90,
      outputLocation: finalOut,
      concurrency,
      chromiumOptions: { gl },
      onProgress: ({ renderedFrames }) => {
        if (renderedFrames % 60 === 0) {
          void journal.update({
            renderedFrames,
            percent: Math.round(
              (renderedFrames / composition.durationInFrames) * 100,
            ),
          });
        }
      },
    });
  } else {
    const wanted = args.scenes;
    const parts = [];
    const fingerprint = await sourceFingerprint(path.join(ROOT, "src"));
    await journal.event("fingerprint", { fingerprint });

    for (const [index, scene] of timeline.scenes.entries()) {
      const hash = hashScene(scene, fingerprint);
      const file = path.join(sceneDir, `${scene.id}-${hash}.mp4`);
      parts.push(file);

      const skipByFilter = wanted && !wanted.includes(scene.id);
      const cached = existsSync(file) && !args.force;

      if (cached || skipByFilter) {
        if (!existsSync(file)) {
          throw new Error(
            `cena "${scene.id}" foi filtrada mas nao ha render anterior dela. ` +
              "Rode sem --scenes ao menos uma vez.",
          );
        }
        process.stdout.write(
          `  [${index + 1}/${timeline.scenes.length}] ${scene.id} ... reaproveitada\n`,
        );
        await journal.event("scene-cached", { scene: scene.id, hash });
        continue;
      }

      // Limpa renders antigos desta cena: hash diferente = roteiro mudou.
      for (const old of await readdir(sceneDir)) {
        if (old.startsWith(`${scene.id}-`) && old !== path.basename(file)) {
          await rm(path.join(sceneDir, old), { force: true });
        }
      }

      const from = scene.startFrame;
      const to = scene.startFrame + scene.durationInFrames - 1;
      const sceneStart = Date.now();

      process.stdout.write(
        `  [${index + 1}/${timeline.scenes.length}] ${scene.id} (${scene.durationInFrames}q) ... `,
      );

      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        crf: 18,
        imageFormat: "jpeg",
        jpegQuality: 90,
        outputLocation: file,
        concurrency,
        chromiumOptions: { gl },
        frameRange: [from, to],
      });

      const ms = Date.now() - sceneStart;
      process.stdout.write(`${formatDuration(ms)}\n`);
      await journal.event("scene-done", { scene: scene.id, hash, ms });
      await journal.update({
        scenesDone: index + 1,
        percent: Math.round(((index + 1) / timeline.scenes.length) * 100),
      });
    }

    // Concatenacao sem reencode: as partes ja sao H.264 com os mesmos
    // parametros, entao copiar os fluxos preserva qualidade e custa segundos.
    const listPath = path.join(outDir, "parts.txt");
    await writeFile(
      listPath,
      parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"),
      "utf8",
    );

    process.stdout.write("\njuntando as cenas... ");
    await remotionFfmpeg(
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", finalOut],
      ROOT,
    );
    process.stdout.write("ok\n");
  }

  const wallMs = Date.now() - started;
  const memory = sampler.stop();
  const videoSeconds = composition.durationInFrames / composition.fps;

  const summary = {
    phase: "done",
    output: finalOut,
    wallMs,
    wall: formatDuration(wallMs),
    framesPerSecond: Number(
      (composition.durationInFrames / (wallMs / 1000)).toFixed(2),
    ),
    realtimeRatio: Number((wallMs / 1000 / videoSeconds).toFixed(2)),
    peakMemoryMb: memory.peakMb,
    avgMemoryMb: memory.avgMb,
  };

  await journal.update(summary);
  await journal.event("done", summary);

  process.stdout.write(
    `\npronto em ${summary.wall} | ${summary.framesPerSecond} fps | ` +
      `${summary.realtimeRatio}x tempo real | pico ${summary.peakMemoryMb} MB\n` +
      `${finalOut}\n`,
  );
}

main().catch(async (error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
