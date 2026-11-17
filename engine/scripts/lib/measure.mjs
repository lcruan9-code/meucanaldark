/**
 * Amostragem de memoria durante o render.
 *
 * `process.memoryUsage()` nao serve aqui: o Remotion renderiza em processos
 * Chrome filhos, e e la que a memoria realmente vai. Por isso amostramos o
 * conjunto de trabalho de todos os processos node e chrome da maquina.
 *
 * E uma medida do sistema, nao do processo: se houver outro Chrome aberto,
 * o numero sobe. O relatorio registra a linha de base antes de comecar para
 * que a diferenca continue legivel.
 */

import { spawn } from "node:child_process";

const PS_QUERY =
  "$p = Get-Process -Name chrome,node,chrome_crashpad_handler -ErrorAction SilentlyContinue; " +
  "if ($p) { [math]::Round((($p | Measure-Object WorkingSet64 -Sum).Sum)/1MB) } else { 0 }";

/** Conjunto de trabalho somado, em MB. 0 quando nao ha o que medir. */
export function sampleMemoryMb() {
  return new Promise((resolve) => {
    const child = spawn(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", PS_QUERY],
      { windowsHide: true },
    );
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    child.on("error", () => resolve(0));
    child.on("close", () => {
      const value = Number.parseInt(out.trim(), 10);
      resolve(Number.isFinite(value) ? value : 0);
    });
  });
}

/**
 * Liga um amostrador periodico. Devolve `stop()`, que encerra e entrega
 * o pico e a media observados.
 */
export function startMemorySampler(intervalMs = 2000) {
  const samples = [];
  let active = true;

  const tick = async () => {
    while (active) {
      const mb = await sampleMemoryMb();
      if (mb > 0) samples.push(mb);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };
  void tick();

  return {
    stop() {
      active = false;
      if (samples.length === 0) return { peakMb: 0, avgMb: 0, samples: 0 };
      const peakMb = Math.max(...samples);
      const avgMb = Math.round(
        samples.reduce((a, b) => a + b, 0) / samples.length,
      );
      return { peakMb, avgMb, samples: samples.length };
    },
  };
}

export function formatDuration(ms) {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m${String(seconds).padStart(2, "0")}s`;
}
