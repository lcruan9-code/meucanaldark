/**
 * Motores de voz.
 *
 * O motor antigo (`edge`) usa o endpoint nao oficial do Edge por linha de
 * comando. Funciona e e gratis, mas nao aceita controle nenhum de prosodia:
 * sem pausa, sem enfase, sem estilo. E a razao principal de a locucao soar
 * de maquina — mais do que a qualidade do modelo em si. Uma frase de sete
 * segundos dita num folego so e o que o ouvido reconhece como sintetico.
 *
 *   edge        gratis, sem configuracao, sem prosodia.
 *   azure       nivel F0: 500 mil caracteres/mes. Mesmas vozes, com SSML.
 *   chatterbox  local (MIT, Resemble AI). Sem cota, offline, clona voz.
 *
 * COMO O TEMPO DAS LEGENDAS SOBREVIVE A TROCA DE MOTOR
 *
 * O `edge-tts` devolve um VTT pronto, com limite de palavra. Azure (REST) e
 * Chatterbox devolvem so audio. Em vez de trazer um SDK ou alinhamento
 * forcado, os dois motores novos sintetizam FRASE A FRASE: medimos cada
 * arquivo e montamos o VTT a partir das duracoes reais mais os silencios
 * que nos mesmos inserimos. O tempo sai exato, sem dependencia nova, e de
 * quebra o tamanho de cada pausa vira decisao nossa — que e justamente o
 * controle que faltava.
 *
 * ENFASE: `*palavra*` no texto da narracao vira `<emphasis>` no Azure e sai
 * do texto no Chatterbox (que nao tem marcacao). E a mesma marca que o
 * componente `kinetic-text` usa para a palavra-heroi: uma convencao so.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(HERE, "../..");

/** Formato canonico das partes. Fixo para o `concat -c copy` funcionar. */
const PART_RATE = 24000;
const PART_BITRATE = "48k";
const AZURE_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

export const VOICE_ENGINES = ["edge", "azure", "chatterbox"];

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

export function probeSeconds(file, cwd = ENGINE_ROOT) {
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
/* Texto -> frases -> prosodia                                          */
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

/** Tira as marcas de enfase: para motor sem marcacao, e para a legenda. */
export function stripMarkup(sentence) {
  return sentence.replace(/\*/g, "");
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
/* Pipeline comum: frases -> partes -> silencio -> mp3 + vtt            */
/* ------------------------------------------------------------------ */

function formatVttTime(total) {
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(total % 60)).padStart(2, "0");
  const ms = String(Math.round((total % 1) * 1000)).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

async function makeSilence({ seconds, outFile, cwd }) {
  await runFfmpeg(
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=${PART_RATE}:cl=mono`,
      "-t",
      seconds.toFixed(3),
      "-c:a",
      "libmp3lame",
      "-b:a",
      PART_BITRATE,
      `"${outFile}"`,
    ],
    cwd,
  );
}

/**
 * Normaliza uma parte para o formato canonico.
 *
 * O Azure ja devolve mp3 no formato certo e passa direto. O Chatterbox
 * devolve WAV a 24 kHz, que precisa virar mp3 para o `concat -c copy`
 * funcionar sem recodificar o conjunto.
 */
async function normalizePart({ file, workDir, index, cwd }) {
  if (file.toLowerCase().endsWith(".mp3")) return file;

  const out = path.join(workDir, `n${String(index).padStart(3, "0")}.mp3`);
  await runFfmpeg(
    [
      "-y",
      "-i",
      `"${file}"`,
      "-ar",
      String(PART_RATE),
      "-ac",
      "1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      PART_BITRATE,
      `"${out}"`,
    ],
    cwd,
  );
  return out;
}

/**
 * `speakAll(sentences, workDir)` devolve um arquivo de audio por frase, na
 * mesma ordem. O resto — medir, inserir silencio, juntar e escrever o VTT —
 * e igual para todos os motores.
 */
async function synthesizeBySentence({
  text,
  speakAll,
  mp3File,
  vttFile,
  cwd,
  basePauseMs,
}) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) throw new Error("texto vazio para sintetizar.");

  // Absoluto desde a entrada. Caminho relativo aqui depende de qual diretorio
  // o ffmpeg herda, e a lista do `concat` passou a nao ser encontrada quando
  // a chamada veio de fora da raiz do motor.
  const outMp3 = path.resolve(cwd, mp3File);
  const outVtt = path.resolve(cwd, vttFile);

  const workDir = path.join(
    path.dirname(outMp3),
    `.tmp-${path.basename(outMp3, ".mp3")}`,
  );
  fs.mkdirSync(workDir, { recursive: true });

  try {
    const spoken = await speakAll(sentences, workDir);
    if (spoken.length !== sentences.length) {
      throw new Error(
        `motor devolveu ${spoken.length} audios para ${sentences.length} frases.`,
      );
    }

    const parts = [];
    const cues = [];
    let cursor = 0;

    for (const [index, sentence] of sentences.entries()) {
      const part = await normalizePart({
        file: spoken[index],
        workDir,
        index,
        cwd,
      });
      const seconds = await probeSeconds(part, cwd);

      cues.push({
        from: cursor,
        to: cursor + seconds,
        text: stripMarkup(sentence),
      });
      parts.push(part);
      cursor += seconds;

      if (index < sentences.length - 1) {
        const pause = pauseAfter(sentence, basePauseMs) / 1000;
        const silenceFile = path.join(
          workDir,
          `p${String(index).padStart(3, "0")}.mp3`,
        );
        await makeSilence({ seconds: pause, outFile: silenceFile, cwd });
        parts.push(silenceFile);
        cursor += pause;
      }
    }

    const listFile = path.join(workDir, "parts.txt");
    fs.writeFileSync(
      listFile,
      parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"),
      "utf-8",
    );
    await runFfmpeg(
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        `"${listFile}"`,
        "-c",
        "copy",
        `"${outMp3}"`,
      ],
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
    fs.writeFileSync(outVtt, vtt, "utf-8");

    return { sentences: sentences.length, seconds: cursor };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ */
/* Motor: edge                                                          */
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
  return {};
}

/* ------------------------------------------------------------------ */
/* Motor: azure                                                         */
/* ------------------------------------------------------------------ */

export function azureCredentials() {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    throw new Error(
      "motor `azure` precisa de AZURE_SPEECH_KEY e AZURE_SPEECH_REGION no ambiente.\n" +
        "O nivel F0 e gratuito e cobre 500 mil caracteres por mes.\n" +
        "Veja docs/11-voz.md para o passo a passo.",
    );
  }
  return { key, region };
}

function azureSpeakAll({ key, region, voice, locale, rate, pitch, style, styleDegree }) {
  return async (sentences, workDir) => {
    const files = [];
    for (const [index, sentence] of sentences.entries()) {
      const ssml = buildSsml({
        sentence,
        voice,
        locale,
        rate,
        pitch,
        style,
        styleDegree,
      });

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
            ? " — chave ou regiao invalida"
            : response.status === 400
              ? " — SSML ou voz recusados; confira se a voz existe na regiao"
              : "";
        throw new Error(
          `Azure Speech respondeu ${response.status}${hint}\n${detail.slice(0, 400)}`,
        );
      }

      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.length === 0) throw new Error("Azure devolveu audio vazio.");

      const file = path.join(workDir, `a${String(index).padStart(3, "0")}.mp3`);
      fs.writeFileSync(file, audio);
      files.push(file);
    }
    return files;
  };
}

/* ------------------------------------------------------------------ */
/* Motor: chatterbox (local)                                            */
/* ------------------------------------------------------------------ */

/** Interpretador do venv de TTS, se existir; senao o do ambiente. */
export function chatterboxPython() {
  const fromEnv = process.env.CHATTERBOX_PYTHON;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const venv = path.join(ENGINE_ROOT, ".venv-tts", "Scripts", "python.exe");
  if (fs.existsSync(venv)) return venv;

  const posix = path.join(ENGINE_ROOT, ".venv-tts", "bin", "python");
  if (fs.existsSync(posix)) return posix;

  return "python";
}

function chatterboxSpeakAll({
  audioPrompt,
  exaggeration,
  cfgWeight,
  seed,
  device,
  languageId,
}) {
  return (sentences, workDir) =>
    new Promise((resolve, reject) => {
      const script = path.join(HERE, "chatterbox_speak.py");
      const python = chatterboxPython();

      // Um processo para TODAS as frases: carregar o modelo custa dezenas de
      // segundos, e um processo por frase pagaria isso a cada frase.
      const child = spawn(python, [script], {
        cwd: ENGINE_ROOT,
        windowsHide: true,
      });

      let out = "";
      let err = "";
      child.stdout.on("data", (c) => {
        out += c.toString();
      });
      child.stderr.on("data", (c) => {
        const chunk = c.toString();
        err += chunk;
        // O progresso do modelo vai para stderr; repassa para o terminal.
        for (const line of chunk.split("\n")) {
          if (line.includes("[chatterbox]")) process.stdout.write(`    ${line.trim()}\n`);
        }
      });
      child.on("error", (error) =>
        reject(
          new Error(
            `nao consegui executar "${python}": ${error.message}\n` +
              "Veja docs/11-voz.md para preparar o ambiente local.",
          ),
        ),
      );
      child.on("close", () => {
        let payload;
        try {
          payload = JSON.parse(out.trim().split("\n").pop() || "{}");
        } catch {
          reject(
            new Error(
              `Chatterbox nao devolveu JSON.\nstdout: ${out.slice(-300)}\n` +
                `stderr: ${err.slice(-600)}`,
            ),
          );
          return;
        }
        if (payload.error) {
          reject(new Error(`Chatterbox: ${payload.error}`));
          return;
        }
        if (!Array.isArray(payload.files)) {
          reject(new Error(`Chatterbox: resposta sem 'files'. ${err.slice(-400)}`));
          return;
        }
        resolve(payload.files);
      });

      child.stdin.write(
        JSON.stringify({
          // O Chatterbox nao tem marcacao de enfase: as marcas saem do texto.
          sentences: sentences.map(stripMarkup),
          outDir: workDir,
          audioPrompt: audioPrompt || null,
          exaggeration,
          cfgWeight,
          seed,
          device,
          languageId,
        }),
      );
      child.stdin.end();
    });
}

/* ------------------------------------------------------------------ */
/* Despacho                                                             */
/* ------------------------------------------------------------------ */

/**
 * Sintetiza uma cena. Escreve `mp3File` e `vttFile`.
 *
 * Os tres motores produzem a mesma dupla de arquivos, entao quem chama nao
 * precisa saber qual esta em uso — e trocar de motor nao mexe no resto do
 * pipeline.
 */
export async function synthesizeScene({
  engine = "edge",
  text,
  voice,
  mp3File,
  vttFile,
  cwd = ENGINE_ROOT,
  locale = "en-US",
  rate = "-4%",
  pitch = "0%",
  style = "",
  styleDegree = 1,
  basePauseMs = 360,
  // Chatterbox
  audioPrompt = "",
  exaggeration = 0.5,
  cfgWeight = 0.5,
  seed = 1234,
  device = "cuda",
}) {
  if (engine === "edge") {
    await synthesizeEdge({ text, voice, mp3File, vttFile, cwd });
    return { engine };
  }

  if (engine === "azure") {
    const { key, region } = azureCredentials();
    const info = await synthesizeBySentence({
      text,
      mp3File,
      vttFile,
      cwd,
      basePauseMs,
      speakAll: azureSpeakAll({
        key,
        region,
        voice,
        locale,
        rate,
        pitch,
        style,
        styleDegree,
      }),
    });
    return { engine, ...info };
  }

  if (engine === "chatterbox") {
    const info = await synthesizeBySentence({
      text,
      mp3File,
      vttFile,
      cwd,
      basePauseMs,
      speakAll: chatterboxSpeakAll({
        audioPrompt: audioPrompt
          ? path.resolve(ENGINE_ROOT, audioPrompt)
          : "",
        exaggeration,
        cfgWeight,
        seed,
        device,
        // "en" (ou vazio) usa o modelo ingles, menor. Outro idioma troca
        // para a variante multilingue, que e outro modelo e outro download.
        languageId: (locale || "en").split("-")[0].toLowerCase(),
      }),
    });
    return { engine, ...info };
  }

  throw new Error(
    `motor de voz "${engine}" nao existe. Disponiveis: ${VOICE_ENGINES.join(", ")}.`,
  );
}
