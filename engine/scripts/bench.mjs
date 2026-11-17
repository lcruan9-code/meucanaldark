/**
 * Bancada de render.
 *
 * Responde, com numero, as perguntas que decidem a arquitetura do motor:
 *   1. Quantos quadros por segundo o 2D rende nesta maquina?
 *   2. E o 3D, com GPU (angle) e sem (swangle)?
 *   3. Qual concorrencia e a melhor, dado que cada aba e um Chrome inteiro?
 *   4. Quanta memoria o render come, e ela cresce ao longo do tempo?
 *
 * Uso:
 *   node scripts/bench.mjs                      # tudo
 *   node scripts/bench.mjs --only bench-3d      # uma composicao
 *   node scripts/bench.mjs --concurrency 4,8    # varre concorrencias
 *
 * Saida: tabela no terminal e out/bench/bench-<timestamp>.json
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatDuration, sampleMemoryMb, startMemorySampler } from "./lib/measure.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "out", "bench");

function parseArgs(argv) {
  const args = { only: null, concurrency: null, gl: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--only" && value) args.only = value.split(",");
    if (flag === "--concurrency" && value)
      args.concurrency = value.split(",").map((n) => Number.parseInt(n, 10));
    if (flag === "--gl" && value) args.gl = value.split(",");
  }
  return args;
}

/**
 * Matriz padrao. O 2D nao varia com `gl` (nao usa WebGL), entao so o 3D paga
 * a varredura — e a comparacao angle x swangle e justamente a que diz se a
 * RTX esta sendo usada de verdade.
 */
function buildMatrix(args, cores) {
  const half = Math.max(1, Math.floor(cores / 2));
  const concurrencies = args.concurrency ?? [1, half];
  const cases = [];

  const want = (id) => !args.only || args.only.includes(id);

  for (const concurrency of concurrencies) {
    // bench-2d e bench-lean sao um par de controle: carga visual parecida,
    // a primeira com filtros caros de CSS/SVG e a segunda sem nenhum.
    if (want("bench-2d")) {
      cases.push({ id: "bench-2d", gl: "angle", concurrency });
    }
    if (want("bench-lean")) {
      cases.push({ id: "bench-lean", gl: "angle", concurrency });
    }
    if (want("bench-3d")) {
      for (const gl of args.gl ?? ["angle", "swangle"]) {
        cases.push({ id: "bench-3d", gl, concurrency });
      }
    }
    if (want("bench-mixed")) {
      cases.push({ id: "bench-mixed", gl: "angle", concurrency });
    }
  }
  return cases;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cores = os.cpus().length;

  await mkdir(OUT_DIR, { recursive: true });

  const baselineMb = await sampleMemoryMb();
  process.stdout.write(
    `maquina: ${os.cpus()[0]?.model?.trim()} | ${cores} threads | ` +
      `${Math.round(os.totalmem() / 1024 ** 3)} GB RAM\n` +
      `memoria em uso antes de comecar: ${baselineMb} MB\n\n` +
      "empacotando...\n",
  );

  const bundleStart = Date.now();
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    // Sem minificacao: o bundle e descartavel e minificar cobra ~20 s.
    webpackOverride: (config) => ({ ...config, optimization: { minimize: false } }),
  });
  const bundleMs = Date.now() - bundleStart;
  process.stdout.write(`empacotado em ${formatDuration(bundleMs)}\n\n`);

  const cases = buildMatrix(args, cores);
  const results = [];

  for (const testCase of cases) {
    const label = `${testCase.id} gl=${testCase.gl} c=${testCase.concurrency}`;
    process.stdout.write(`${label} ... `);

    const composition = await selectComposition({
      serveUrl,
      id: testCase.id,
    });

    const outputLocation = path.join(
      OUT_DIR,
      `${testCase.id}-${testCase.gl}-c${testCase.concurrency}.mp4`,
    );

    const sampler = startMemorySampler(1500);
    const start = Date.now();
    let failure = null;

    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        crf: 18,
        imageFormat: "jpeg",
        jpegQuality: 90,
        outputLocation,
        concurrency: testCase.concurrency,
        chromiumOptions: { gl: testCase.gl },
      });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }

    const wallMs = Date.now() - start;
    const memory = sampler.stop();

    const frames = composition.durationInFrames;
    const videoSeconds = frames / composition.fps;
    const fps = failure ? 0 : frames / (wallMs / 1000);

    results.push({
      ...testCase,
      frames,
      videoSeconds,
      wallMs,
      framesPerSecond: Number(fps.toFixed(2)),
      realtimeRatio: failure ? null : Number((wallMs / 1000 / videoSeconds).toFixed(2)),
      peakMemoryMb: memory.peakMb,
      avgMemoryMb: memory.avgMb,
      failure,
    });

    process.stdout.write(
      failure
        ? `FALHOU: ${failure.split("\n")[0]}\n`
        : `${formatDuration(wallMs)} | ${fps.toFixed(1)} fps | ` +
            `${(wallMs / 1000 / videoSeconds).toFixed(1)}x tempo real | ` +
            `pico ${memory.peakMb} MB\n`,
    );
  }

  const report = {
    at: new Date().toISOString(),
    machine: {
      cpu: os.cpus()[0]?.model?.trim(),
      threads: cores,
      totalMemoryGb: Math.round(os.totalmem() / 1024 ** 3),
      platform: `${os.platform()} ${os.release()}`,
    },
    baselineMemoryMb: baselineMb,
    bundleMs,
    results,
  };

  const reportPath = path.join(OUT_DIR, `bench-${Date.now()}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  process.stdout.write(`\nrelatorio: ${reportPath}\n`);

  // Projecao para o alvo real: documentario de 10 min.
  process.stdout.write("\nprojecao para 10 minutos de video:\n");
  for (const r of results) {
    if (r.failure || !r.realtimeRatio) continue;
    const minutes = (600 * r.realtimeRatio) / 60;
    const verdict = minutes <= 120 ? "cabe na janela de 2h" : "ESTOURA a janela de 2h";
    process.stdout.write(
      `  ${r.id} gl=${r.gl} c=${r.concurrency}: ${minutes.toFixed(0)} min — ${verdict}\n`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
