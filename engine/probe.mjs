/**
 * TEMPORARIO — conferencia da cena DataCenter3D. Apagar depois.
 *
 * Empacota uma vez so e tira os quatro quadros de prova + mede fps numa
 * tomada de 150 quadros. Quatro chamadas de `remotion still` pagariam quatro
 * empacotamentos.
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out", "bench");
const ID = "bench-dc";

const SHOTS = [
  { name: "dc-wide", frame: 90 },
  { name: "dc-aisle", frame: 240 },
  { name: "dc-rack", frame: 390 },
  { name: "dc-macro", frame: 540 },
];

const onlyStills = process.argv.includes("--stills");

await mkdir(OUT, { recursive: true });

console.log("empacotando...");
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, "src", "index.ts"),
  onProgress: () => undefined,
});

const composition = await selectComposition({ serveUrl, id: ID });
console.log(`composicao ${ID}: ${composition.durationInFrames} quadros`);

for (const shot of SHOTS) {
  const started = Date.now();
  await renderStill({
    composition,
    serveUrl,
    output: path.join(OUT, `${shot.name}.png`),
    frame: shot.frame,
    chromiumOptions: { gl: "angle" },
    overwrite: true,
  });
  console.log(`${shot.name} (quadro ${shot.frame}) em ${Date.now() - started} ms`);
}

if (!onlyStills) {
  const FRAMES = 150;
  const started = Date.now();
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: path.join(OUT, "dc-run.mp4"),
    frameRange: [150, 150 + FRAMES - 1],
    concurrency: 10,
    chromiumOptions: { gl: "angle" },
    overwrite: true,
  });
  const seconds = (Date.now() - started) / 1000;
  console.log(
    `FPS: ${(FRAMES / seconds).toFixed(2)} (${FRAMES} quadros em ${seconds.toFixed(1)} s, concorrencia 10, angle)`,
  );
}
