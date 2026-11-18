/**
 * Contrato de dados do motor audiovisual.
 *
 * Este arquivo e a fronteira entre QUEM ESCREVE o documentario (pesquisa,
 * roteiro, storyboard) e QUEM O PRODUZ (biblioteca visual + Remotion).
 * Nada aqui conhece React, Three.js ou ffmpeg: e so a descricao do filme.
 *
 * Duas decisoes de desenho que vale explicar:
 *
 * 1. CENA E FEITA DE CAMADAS, nao de um "tipo".
 *    Um `type: "map_2d"` obriga uma cena a ser so um mapa. Com camadas, um
 *    plano 3D de cabo submarino pode receber por cima um lower-third 2D e um
 *    selo de fonte, que e o que faz um documentario parecer documentario.
 *
 * 2. A DURACAO VEM DA NARRACAO, nao do JSON.
 *    Se a duracao fosse fixa, trocar a narracao exigiria reajustar todas as
 *    cenas a mao. Aqui `duration` e opcional e serve como override; o padrao
 *    e medir o arquivo de audio. Trocar a voz re-sincroniza o filme inteiro.
 */

import { z } from "zod";

/** Chave de um componente no registro da biblioteca visual. */
export const zComponentKey = z.string().min(1);

/** Em que plano a camada entra. Define a ordem de empilhamento. */
export const zTrack = z.enum(["background", "main", "overlay"]);

/**
 * Movimento de camera simulado, aplicado a QUALQUER camada.
 *
 * Fica aqui, e nao dentro de cada componente, por alavancagem: um unico
 * lugar da zoom, travelling e reenquadramento a biblioteca inteira, 2D e 3D.
 * Deslocamento em fracao da tela (0.1 = 10% da largura), escala em fator.
 */
export const zCameraMove = z.object({
  fromScale: z.number().positive().default(1),
  toScale: z.number().positive().default(1),
  fromX: z.number().default(0),
  toX: z.number().default(0),
  fromY: z.number().default(0),
  toY: z.number().default(0),
  /** Ponto fixo do zoom, em fracao da tela. */
  originX: z.number().min(0).max(1).default(0.5),
  originY: z.number().min(0).max(1).default(0.5),
  easing: z.enum(["linear", "out", "inOut"]).default("inOut"),
});
export type CameraMove = z.infer<typeof zCameraMove>;

export const zLayer = z.object({
  /** Nome registrado em src/library/registry.ts */
  component: zComponentKey,
  /** Props do componente. Validadas contra o schema que ele declara. */
  props: z.record(z.string(), z.unknown()).prefault({}),
  /** Entrada da camada, em segundos relativos ao inicio da cena. */
  from: z.number().min(0).default(0),
  /** Duracao da camada em segundos. Ausente = ate o fim da cena. */
  duration: z.number().positive().optional(),
  track: zTrack.default("main"),
  /** Fade de entrada e saida da propria camada, em segundos. */
  fadeIn: z.number().min(0).default(0),
  fadeOut: z.number().min(0).default(0),
  /** Movimento de camera sobre esta camada. Ausente = quadro parado. */
  camera: zCameraMove.optional(),
});
export type Layer = z.infer<typeof zLayer>;

export const zNarration = z.object({
  /** Caminho do audio, relativo a pasta do projeto. */
  src: z.string().min(1),
  /** Texto falado. Alimenta legenda e conferencia; nao e sintetizado aqui. */
  text: z.string().default(""),
  gainDb: z.number().default(0),
  /**
   * Trecho de um arquivo de narracao COMPARTILHADO, em segundos.
   *
   * O modelo normal e um audio por cena. Mas um documentario pode chegar com
   * uma locucao unica para o filme inteiro — foi o caso do turbofan, com um
   * `voice.mp3` de 37 s para cinco cenas. Apontar as cinco para o mesmo
   * arquivo sem recorte o tocaria cinco vezes, sobrepostas.
   *
   * Com `trimBefore`/`trimAfter`, cada cena toca a sua fatia. Fatias
   * contiguas (o fim de uma e o inicio da seguinte) reproduzem a locucao
   * inteira, uma unica vez, sem repeticao e sem silencio no corte.
   */
  trimBefore: z.number().min(0).optional(),
  trimAfter: z.number().min(0).optional(),
});

/**
 * Legenda com tempo proprio, em segundos relativos ao inicio da CENA.
 *
 * Vem do VTT da locucao e nao deve ser reescrita a mao: `scripts/captions.mjs`
 * regenera a partir do arquivo original, que continua sendo a fonte da
 * verdade dos tempos.
 */
export const zCue = z.object({
  from: z.number().min(0),
  to: z.number().min(0),
  text: z.string().min(1),
});
export type Cue = z.infer<typeof zCue>;

export const zSfx = z.object({
  src: z.string().min(1),
  /** Disparo em segundos relativos ao inicio da cena. */
  at: z.number().min(0).default(0),
  gainDb: z.number().default(-6),
});

export const zTransition = z.object({
  type: z.enum(["none", "fade", "dip-to-black", "whip", "cross-zoom"]),
  /** Duracao em segundos. Sai do tempo da cena seguinte. */
  duration: z.number().min(0).max(3).default(0.5),
});

export const zScene = z.object({
  id: z.string().min(1),
  chapterId: z.string().optional(),
  /** Anotacao do storyboard. Nao afeta o render; serve a revisao humana. */
  note: z.string().default(""),
  narration: zNarration.optional(),
  /**
   * Override da duracao, em segundos. Sem isto, a duracao e a da narracao
   * mais `padding`. Cena sem narracao e sem duration e erro de validacao.
   */
  duration: z.number().positive().optional(),
  /** Respiro somado apos a narracao, em segundos. */
  padding: z.number().min(0).default(0.4),
  layers: z.array(zLayer).min(1),
  sfx: z.array(zSfx).default([]),
  transitionIn: zTransition.optional(),
  /**
   * Legenda queimada. Ligada por padrao.
   *
   * Com `cues`, usa os tempos do VTT. Sem `cues`, cai para uma legenda unica
   * com `narration.text` cobrindo a cena — util para rascunho, mas sem
   * sincronia real.
   */
  captions: z.boolean().default(true),
  /** Legendas com tempo, geradas do VTT por `scripts/captions.mjs`. */
  cues: z.array(zCue).default([]),
});
export type Scene = z.infer<typeof zScene>;

export const zChapter = z.object({
  id: z.string().min(1),
  /** Vira capitulo do YouTube no arquivo de metadados. */
  title: z.string().min(1),
});

/** Identidade visual. Um tema por canal, herdado por todas as cenas. */
export const zTheme = z.object({
  palette: z
    .object({
      bg: z.string().default("#05070d"),
      ink: z.string().default("#f2f5f8"),
      muted: z.string().default("#8b97a8"),
      accent: z.string().default("#39d0d8"),
      accentWarm: z.string().default("#f5a524"),
      grid: z.string().default("#12202e"),
    })
    .prefault({}),
  fonts: z
    .object({
      display: z.string().default("Inter"),
      body: z.string().default("Inter"),
      mono: z.string().default("JetBrains Mono"),
    })
    .prefault({}),
  /** Grao de filme e vinheta aplicados ao filme inteiro. 0 = desliga. */
  grain: z.number().min(0).max(1).default(0.05),
  vignette: z.number().min(0).max(1).default(0.35),
});
export type Theme = z.infer<typeof zTheme>;

export const zAudio = z.object({
  music: z.string().optional(),
  musicGainDb: z.number().default(-22),
  /** Abaixa a trilha enquanto ha narracao, em dB. */
  duckDb: z.number().default(-9),
  masterGainDb: z.number().default(0),
});

export const zProject = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1),
  language: z.string().default("en"),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  fps: z.number().int().positive().default(30),
  theme: zTheme.prefault({}),
  audio: zAudio.prefault({}),
  chapters: z.array(zChapter).default([]),
  scenes: z.array(zScene).min(1),
});
export type DocumentaryProject = z.infer<typeof zProject>;

/**
 * Cena com tempo ja resolvido em quadros. E o que o motor consome.
 * Produzido por resolveTimeline(), nunca escrito a mao.
 */
export type ResolvedScene = Scene & {
  startFrame: number;
  durationInFrames: number;
  /** Duracao medida do audio, em segundos. null quando nao ha narracao. */
  narrationSeconds: number | null;
};

export type ResolvedTimeline = {
  project: DocumentaryProject;
  scenes: ResolvedScene[];
  totalFrames: number;
  totalSeconds: number;
  /**
   * Alguma cena usa WebGL. Decide a flag `--gl` e o modo de render.
   *
   * Calculado a partir do REGISTRO, no Root — antes era uma busca pela
   * string "cable-3d" dentro do JSON, que passou a mentir no instante em que
   * entrou a segunda cena 3D.
   */
  usesWebgl?: boolean;
};
