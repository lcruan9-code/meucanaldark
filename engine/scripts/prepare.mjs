/**
 * Mede a duracao de cada narracao e grava `projects/<id>/durations.json`.
 *
 * Existe para que a duracao das cenas saia do audio, e nao de numeros
 * escritos a mao no roteiro. Trocar a narracao passa a ser: substituir os
 * arquivos, rodar este script, renderizar. Nenhuma cena e editada.
 *
 * Medimos aqui, uma vez, e nao durante o render: a duracao de um arquivo nao
 * muda entre quadros, e o render consulta esse valor 18.000 vezes num
 * documentario de 10 minutos.
 *
 * Uso: node scripts/prepare.mjs <project-id>
 */

import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** ffprobe que ja vem com o Remotion. Nenhuma dependencia nova. */
function probeSeconds(file) {
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
        file,
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
        reject(new Error(`ffprobe falhou em ${file}: ${err.slice(-400)}`));
        return;
      }
      resolve(seconds);
    });
  });
}

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    process.stderr.write("uso: node scripts/prepare.mjs <project-id>\n");
    process.exit(1);
  }

  const projectDir = path.join(ROOT, "projects", projectId);
  const projectPath = path.join(projectDir, "project.json");
  const project = JSON.parse(await readFile(projectPath, "utf8"));

  // A narracao vive em `public/`, porque e de la que o `staticFile()` do
  // Remotion serve os arquivos para o navegador do render.
  const publicDir = path.join(ROOT, "public");
  const durations = {};
  const missing = [];

  for (const scene of project.scenes) {
    const src = scene.narration?.src;
    if (!src || durations[src] !== undefined) continue;

    const file = path.join(publicDir, src);
    if (!existsSync(file)) {
      missing.push({ scene: scene.id, src });
      continue;
    }

    const seconds = await probeSeconds(file);
    durations[src] = Number(seconds.toFixed(3));
    process.stdout.write(`  ${scene.id}: ${src} = ${seconds.toFixed(2)}s\n`);
  }

  const outPath = path.join(projectDir, "durations.json");
  await writeFile(outPath, `${JSON.stringify(durations, null, 2)}\n`, "utf8");

  const measured = Object.keys(durations).length;
  process.stdout.write(`\n${measured} narracoes medidas -> ${outPath}\n`);

  if (missing.length > 0) {
    process.stdout.write(
      `\n${missing.length} arquivo(s) faltando em public/:\n` +
        missing.map((m) => `  ${m.scene}: ${m.src}`).join("\n") +
        "\nEssas cenas precisam de \"duration\" explicito ate o audio existir.\n",
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
