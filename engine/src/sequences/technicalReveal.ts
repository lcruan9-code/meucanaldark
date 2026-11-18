/**
 * Technical reveal: aproxima de um objeto e nomeia suas partes.
 *
 * O erro comum e anotar tudo de uma vez. Quando as chamadas aparecem juntas,
 * o espectador nao sabe para onde olhar e a narracao perde a sincronia com a
 * imagem. Aqui elas entram uma a uma, espacadas ao longo do plano.
 *
 * Tres tempos: o objeto chega (sem texto), as partes sao nomeadas, e sobra
 * um respiro no fim para o narrador fechar a ideia.
 */

import { z } from "zod";

import { backdrop, layer, push, type RawScene, type SequenceFn } from "./types";

const zPart = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  label: z.string().min(1),
  sub: z.string().default(""),
  side: z.enum(["left", "right", "up", "down"]).default("right"),
});

export const technicalRevealParams = z.object({
  visual: z.string().min(1),
  visualProps: z.record(z.string(), z.unknown()).prefault({}),
  parts: z.array(zPart).min(1).max(6),
  /** Plano de chegada, antes de qualquer anotacao. */
  approachSeconds: z.number().positive().default(3),
  /** Plano das anotacoes. */
  revealSeconds: z.number().positive().default(9),
  useBackdrop: z.boolean().default(false),
  /** Onde a camera fecha, em fracao da tela. */
  focusX: z.number().min(0).max(1).default(0.45),
  focusY: z.number().min(0).max(1).default(0.5),
  note: z.string().default(""),
});

export type TechnicalRevealParams = z.infer<typeof technicalRevealParams>;

export const technicalReveal: SequenceFn<TechnicalRevealParams> = (
  params,
  id,
): RawScene[] => {
  const {
    visual,
    visualProps,
    parts,
    approachSeconds,
    revealSeconds,
    useBackdrop,
    focusX,
    focusY,
    note,
  } = params;

  const approach: RawScene = {
    id: `${id}-approach`,
    note: note || "Chegada ao objeto. Sem texto: o olho reconhece a forma.",
    duration: approachSeconds,
    layers: [
      ...(useBackdrop ? [backdrop()] : []),
      layer(visual, visualProps, {
        track: "background",
        camera: push(1, 1.1, focusX, focusY),
      }),
    ],
  };

  // As chamadas se distribuem entre 8% e 72% do plano, deixando um quarto
  // final de respiro. Sem esse respiro, o ultimo rotulo some junto com o
  // corte e nao da tempo de ler.
  const spread = parts.map((part, index) => ({
    ...part,
    at: 0.08 + (index / Math.max(1, parts.length)) * 0.64,
  }));

  const reveal: RawScene = {
    id: `${id}-reveal`,
    note: "As partes entram uma a uma, com respiro no fim.",
    duration: revealSeconds,
    layers: [
      ...(useBackdrop ? [backdrop({ glowOpacity: 0.16 })] : []),
      layer(visual, visualProps, {
        track: "background",
        // Deriva lenta em vez de push: a camera ja chegou, agora so respira.
        camera: push(1.1, 1.14, focusX, focusY),
      }),
      layer("diagram", { parts: spread }, { track: "overlay" }),
    ],
  };

  return [approach, reveal];
};
