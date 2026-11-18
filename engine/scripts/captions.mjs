/**
 * Gera as legendas das cenas a partir do VTT da locucao.
 *
 * O VTT continua sendo a fonte da verdade dos tempos: este script NAO os
 * reescreve, so os traduz para o referencial de cada cena e os grava em
 * `scenes[].cues` do project.json.
 *
 * Tres decisoes que o arquivo real exigiu:
 *
 * 1. Uma legenda pertence a cena que contem o seu MEIO, nao o seu inicio.
 *    No turbofan, a frase 2 comeca 4 ms antes do corte da cena 1 — pelo
 *    inicio, ela cairia na cena errada.
 * 2. Os extremos sao grampeados aos limites da cena. A frase 1 termina 45 ms
 *    depois do corte; sem grampear, a legenda sobreviveria ao corte.
 * 3. O VTT tinha 50 ms de sobreposicao entre as frases 1 e 2. Depois de (1)
 *    e (2) elas ficam em cenas diferentes e o problema desaparece sem que o
 *    arquivo precise ser corrigido.
 *
 * Uso: node scripts/captions.mjs <project-id> [--vtt <caminho em public/>]
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** "00:00:07,412" ou "00:00:07.412" -> 7.412 */
function toSeconds(stamp) {
  const match = stamp.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) throw new Error(`timestamp invalido no VTT: "${stamp}"`);
  const [, h, m, s, ms] = match;
  return (
    Number(h ?? 0) * 3600 +
    Number(m) * 60 +
    Number(s) +
    Number(ms.padEnd(3, "0")) / 1000
  );
}

/** Aceita WebVTT e SRT: a diferenca que importa aqui e so a virgula. */
export function parseVtt(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;

    const arrowIndex = lines.findIndex((line) => line.includes("-->"));
    if (arrowIndex === -1) continue;

    const [fromRaw, toRaw] = lines[arrowIndex].split("-->");
    const body = lines
      .slice(arrowIndex + 1)
      .join(" ")
      .trim();
    if (body === "") continue;

    cues.push({ from: toSeconds(fromRaw), to: toSeconds(toRaw), text: body });
  }

  return cues.sort((a, b) => a.from - b.from);
}

function parseArgs(argv) {
  const args = { project: null, vtt: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--vtt" && argv[i + 1]) args.vtt = argv[i + 1];
    else if (!argv[i].startsWith("--") && !args.project) args.project = argv[i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.project) {
    process.stderr.write(
      "uso: node scripts/captions.mjs <project-id> [--vtt <caminho em public/>]\n",
    );
    process.exit(1);
  }

  const projectPath = path.join(ROOT, "projects", args.project, "project.json");
  const project = JSON.parse(await readFile(projectPath, "utf8"));
  const fps = project.fps ?? 30;

  // Sem --vtt, procura o .vtt ao lado do mp3 da primeira cena com narracao.
  let vttRelative = args.vtt;
  if (!vttRelative) {
    const withNarration = project.scenes.find((scene) => scene.narration?.src);
    if (!withNarration) {
      throw new Error("o projeto nao tem narracao: nada para legendar.");
    }
    vttRelative = withNarration.narration.src.replace(/\.[^.]+$/, ".vtt");
  }

  const vttPath = path.join(ROOT, "public", vttRelative);
  if (!existsSync(vttPath)) {
    throw new Error(`VTT nao encontrado: ${vttPath}`);
  }

  const cues = parseVtt(await readFile(vttPath, "utf8"));
  process.stdout.write(`${cues.length} legendas lidas de ${vttRelative}\n\n`);

  // Limites das cenas, em segundos absolutos. Transicao de entrada recua o
  // inicio da cena, exatamente como faz resolveTimeline.
  const bounds = [];
  let cursor = 0;
  for (const scene of project.scenes) {
    const seconds =
      typeof scene.duration === "number"
        ? scene.duration
        : scene.narration?.trimAfter !== undefined &&
            scene.narration?.trimBefore !== undefined
          ? scene.narration.trimAfter - scene.narration.trimBefore
          : null;
    if (seconds === null) {
      throw new Error(`cena "${scene.id}" sem duracao conhecida.`);
    }

    const frames = Math.max(1, Math.round(seconds * fps));
    const overlap =
      scene.transitionIn && scene.transitionIn.type !== "none"
        ? Math.min(
            Math.round((scene.transitionIn.duration ?? 0) * fps),
            Math.floor(frames / 2),
          )
        : 0;
    const start = Math.max(0, cursor - overlap);
    bounds.push({ id: scene.id, from: start / fps, to: (start + frames) / fps });
    cursor = start + frames;
  }

  let placed = 0;
  let dropped = 0;

  for (const [index, scene] of project.scenes.entries()) {
    const { from: sceneFrom, to: sceneTo } = bounds[index];
    const mine = [];

    for (const cue of cues) {
      const middle = (cue.from + cue.to) / 2;
      if (middle < sceneFrom || middle >= sceneTo) continue;

      const clampedFrom = Math.max(cue.from, sceneFrom) - sceneFrom;
      const clampedTo = Math.min(cue.to, sceneTo) - sceneFrom;
      // Menos de um quadro na tela nao e legenda, e cintilacao.
      if (clampedTo - clampedFrom < 1 / fps) {
        dropped += 1;
        continue;
      }

      mine.push({
        from: Number(clampedFrom.toFixed(3)),
        to: Number(clampedTo.toFixed(3)),
        text: cue.text,
      });
    }

    scene.cues = mine;
    placed += mine.length;

    const flag = scene.captions === false ? "  (captions desligadas)" : "";
    process.stdout.write(
      `  ${scene.id.padEnd(20)} ${sceneFrom.toFixed(2)}–${sceneTo.toFixed(2)}s  ` +
        `${mine.length} legenda(s)${flag}\n`,
    );
  }

  await writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");

  process.stdout.write(
    `\n${placed} legendas gravadas em ${path.relative(ROOT, projectPath)}\n`,
  );
  if (dropped > 0) {
    process.stdout.write(`${dropped} descartada(s) por sobrar menos de um quadro.\n`);
  }
  if (placed < cues.length - dropped) {
    process.stdout.write(
      `AVISO: ${cues.length - dropped - placed} legenda(s) nao couberam em nenhuma cena.\n`,
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
