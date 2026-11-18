/**
 * Motores de voz.
 *
 * O motor antigo (`edge`) usa o endpoint nao oficial do Edge por linha de
 * comando. Funciona e e gratis, mas nao aceita controle nenhum de prosodia:
 * sem pausa, sem enfase, sem estilo. E a razao principal de a locucao soar
 * de maquina — mais do que a qualidade do modelo em si. Uma frase de sete
 * segundos dita num folego so e o que o ouvido reconhece como sintetico.
 *
 * O motor `azure` fala com o Azure Speech, que usa a MESMA familia de vozes,
 * mas por SSML: da para pontuar com `<break>`, marcar enfase e pedir estilo
 * de narracao. O nivel F0 cobre 500 mil caracteres por mes, cerca de
 * sessenta episodios de dez minutos.
 *
 * COMO O TEMPO DAS LEGENDAS SOBREVIVE A TROCA
 *
 * O `edge-tts` devolve um VTT pronto, com limite de palavra. O Azure, pelo
 * endpoint REST, devolve so audio. Em vez de trazer o SDK inteiro para
 * recuperar esse evento, este modulo sintetiza FRASE A FRASE, mede cada
 * arquivo e monta o VTT a partir das duracoes reais mais os silencios que
 * ele mesmo insere. O tempo sai exato e sem dependencia nova — e de quebra
 * o tamanho de cada pausa passa a ser decisao nossa, que e justamente o
 * controle que faltava.
 *
 * ENFASE: `*palavra*` no texto da narracao vira `<emphasis>`, a mesma marca
 * que o componente `kinetic-text` ja usa para a palavra-heroi. Uma convencao
 * so para as duas pontas.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

/** Formato pedido ao Azure. Fixo para o silencio casar na concatenacao. */
const AZURE_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const SILENCE_RATE = 24000;
const SILENCE_BITRATE = "48k";

export const VOICE_ENGINES = ["edge", "azure"];

/* ------------------------------------------------------------------ */
/* ffmpeg / ffprobe pelo binario que o Remotion ja traz                 */
/* ------------------------------------------------------------------ */

/**
 * Atencao: este wrapper quebra com argumento que contenha virgula — o
 * `npx remotion ffmpeg` concatena os argumentos. Por isso tudo aqui usa o
 * demuxer `concat` (sem virgula) em vez de `-filter_complex`.
 */
function runFfmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["remotion", "ffmpeg", ...args], {
      cwd,
      shell: true,
      windowsHide: true,
    });
    let err = "";
    child.stderr.on("data", (c) => {
      err += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg saiu com ${code}:\n${err.slice(-1200)}`));
    });
  });
}

export function probeSeconds(file, cwd) {
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
      { cwd, shell: true, windowsHide: true },
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

/* ------------------------------------------------------------------ */
/* Texto -> frases -> SSML                                              */
/* ------------------------------------------------------------------ */

/** Quebra em frases preservando a pontuacao que as encerra. */
export function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“(])/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Pausa depois de uma frase, em ms.
 *
 * Nao e constante de proposito. Pausa sempre igual e tao mecanica quanto
 * pausa nenhuma; o que soa humano e a pausa acompanhar o peso da frase.
 * Funcao pura do texto, entao a locucao sai identica a cada rodada.
 */
export function pauseAfter(sentence, basePauseMs) {
  let ms = basePauseMs;
  if (sentence.length > 90) ms += 120;
  if (/[?!]$/.test(sentence)) ms += 90;
  if (sentence.length < 32) ms -= 60;
  return Math.max(120, ms);
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `*assim*` vira enfase. Mesma marca do `kinetic-text`. */
function markupEmphasis(sentence) {
  return escapeXml(sentence).replace(
    /\*([^*]+)\*/g,
    '<emphasis level="moderate">$1</emphasis>',
  );
}

export function buildSsml({
  sentence,
  voice,
  locale = "en-US",
  rate = "-4%",
  pitch = "0%",
  style = "",
  styleDegree = 1,
}) {
  const body = markupEmphasis(sentence);
  const prosody = `<prosody rate="${rate}" pitch="${pitch}">${body}</prosody>`;
  const inner =
    style !== ""
      ? `<mstts:express-as style="${style}" styledegree="${styleDegree}">${prosody}</mstts:express-as>`
      : prosody;

  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${locale}">` +
    `<voice name="${voice}">${inner}</voice></speak>`
  );
}

/* ------------------------------------------------------------------ */
/* Motor: edge (o que ja existia)                                       */
/* ------------------------------------------------------------------ */

async function synthesizeEdge({ text, voice, mp3File, vttFile, cwd }) {
  const res = spawnSync(
    "python",
    [
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
    ],
    { cwd, stdio: "pipe", encoding: "utf-8" },
  );

  if (res.status !== 0) {
    throw new Error(`edge-tts falhou: ${res.stderr || res.stdout}`);
  }
}

/* ------------------------------------------------------------------ */
/* Motor: azure                                                         */
/* ------------------------------------------------------------------ */

function formatVttTime(total) {
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(total % 60)).padStart(2, "0");
  const ms = String(Math.round((total % 1) * 1000)).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

async function azureSpeak({ ssml, key, region, outFile }) {
  const response = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": AZURE_FORMAT,
        // Generico de proposito: nao identifica a maquina nem o projeto.
        "User-Agent": "documentary-engine",
      },
      body: ssml,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const hint =
      response.status === 401
        ? " — chave ou regiao invalida (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION)"
        : response.status === 400
          ? " — SSML ou nome de voz recusado; confira se a voz existe na regiao"
          : "";
    throw new Error(
      `Azure Speech respondeu ${response.status}${hint}\n${detail.slice(0, 400)}`,
    );
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) throw new Error("Azure Speech devolveu audio vazio.");
  fs.writeFileSync(outFile, audio);
}

async function makeSilence({ seconds, outFile, cwd }) {
  await runFfmpeg(
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=${SILENCE_RATE}:cl=mono`,
      "-t",
      seconds.toFixed(3),
      "-c:a",
      "libmp3lame",
      "-b:a",
      SILENCE_BITRATE,
      `"${outFile}"`,
    ],
    cwd,
  );
}

async function synthesizeAzure({
  text,
  voice,
  mp3File,
  vttFile,
  cwd,
  key,
  region,
  locale,
  rate,
  pitch,
  style,
  styleDegree,
  basePauseMs,
}) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) throw new Error("texto vazio para sintetizar.");

  const workDir = path.join(path.dirname(mp3File), `.tmp-${path.basename(mp3File, ".mp3")}`);
  fs.mkdirSync(workDir, { recursive: true });

  const parts = [];
  const cues = [];
  let cursor = 0;

  try {
    for (const [index, sentence] of sentences.entries()) {
      const partFile = path.join(workDir, `s${String(index).padStart(3, "0")}.mp3`);
      await azureSpeak({
        ssml: buildSsml({ sentence, voice, locale, rate, pitch, style, styleDegree }),
        key,
        region,
        outFile: partFile,
      });

      const seconds = await probeSeconds(partFile, cwd);
      // O asterisco e marca de enfase, nao texto: sai da legenda.
      cues.push({
        from: cursor,
        to: cursor + seconds,
        text: sentence.replace(/\*/g, ""),
      });
      parts.push(partFile);
      cursor += seconds;

      const isLast = index === sentences.length - 1;
      if (!isLast) {
        const pause = pauseAfter(sentence, basePauseMs) / 1000;
        const silenceFile = path.join(workDir, `p${String(index).padStart(3, "0")}.mp3`);
        await makeSilence({ seconds: pause, outFile: silenceFile, cwd });
        parts.push(silenceFile);
        cursor += pause;
      }
    }

    // Demuxer concat: todos os trechos saem do mesmo formato, entao copiar
    // os fluxos preserva o audio e nao recodifica.
    const listFile = path.join(workDir, "parts.txt");
    fs.writeFileSync(
      listFile,
      parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"),
      "utf-8",
    );

    await runFfmpeg(
      ["-y", "-f", "concat", "-safe", "0", "-i", `"${listFile}"`, "-c", "copy", `"${mp3File}"`],
      cwd,
    );

    const vtt = [
      "WEBVTT",
      "",
      ...cues.flatMap((cue, index) => [
        String(index + 1),
        `${formatVttTime(cue.from)} --> ${formatVttTime(cue.to)}`,
        cue.text,
        "",
      ]),
    ].join("\n");
    fs.writeFileSync(vttFile, vtt, "utf-8");
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }

  return { sentences: sentences.length };
}

/* ------------------------------------------------------------------ */
/* Despacho                                                             */
/* ------------------------------------------------------------------ */

export function azureCredentials() {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error(
      "motor `azure` precisa de AZURE_SPEECH_KEY e AZURE_SPEECH_REGION no ambiente.\n" +
        "O nivel F0 e gratuito e cobre 500 mil caracteres por mes.\n" +
        "Veja docs/voz.md para o passo a passo.",
    );
  }
  return { key, region };
}

/**
 * Sintetiza uma cena. Escreve `mp3File` e `vttFile`.
 *
 * Os dois motores produzem a mesma dupla de arquivos, entao quem chama nao
 * precisa saber qual esta em uso — e trocar de motor nao mexe no resto do
 * pipeline.
 */
export async function synthesizeScene({
  engine = "edge",
  text,
  voice,
  mp3File,
  vttFile,
  cwd,
  locale = "en-US",
  rate = "-4%",
  pitch = "0%",
  style = "",
  styleDegree = 1,
  basePauseMs = 360,
}) {
  if (engine === "edge") {
    await synthesizeEdge({ text, voice, mp3File, vttFile, cwd });
    return { engine };
  }

  if (engine === "azure") {
    const { key, region } = azureCredentials();
    const info = await synthesizeAzure({
      text,
      voice,
      mp3File,
      vttFile,
      cwd,
      key,
      region,
      locale,
      rate,
      pitch,
      style,
      styleDegree,
      basePauseMs,
    });
    return { engine, ...info };
  }

  throw new Error(
    `motor de voz "${engine}" nao existe. Disponiveis: ${VOICE_ENGINES.join(", ")}.\n` +
      "Chatterbox (local, MIT, com clonagem) esta previsto e entra aqui como terceiro motor.",
  );
}
