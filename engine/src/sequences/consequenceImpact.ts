/**
 * Consequence and impact: o fecho.
 *
 * E a sequencia mais simples e a mais facil de errar. A tentacao e encher o
 * quadro; o que funciona e tirar. Um plano sustentado com pouca coisa, a
 * camera quase parada, e entao o escuro.
 *
 * O silencio visual aqui e intencional: e onde o espectador processa o que
 * acabou de ver. Cortar rapido no fim desfaz os doze minutos anteriores.
 */

import { z } from "zod";

import { TYPE } from "../library/shared/tokens";
import { backdrop, layer, push, type RawScene, type SequenceFn } from "./types";

export const consequenceImpactParams = z.object({
  /** A frase que fica. Asteriscos marcam a palavra-heroi. */
  text: z.string().min(1),
  kicker: z.string().default(""),
  /** Linha final, menor, depois do respiro. */
  coda: z.string().default(""),
  /** Imagem de fundo opcional: componente que sustenta a frase. */
  visual: z.string().optional(),
  visualProps: z.record(z.string(), z.unknown()).prefault({}),
  textSeconds: z.number().positive().default(6),
  codaSeconds: z.number().positive().default(4),
  /** Fecha em preto no fim. Praticamente sempre sim. */
  toBlack: z.boolean().default(true),
  note: z.string().default(""),
});

export type ConsequenceImpactParams = z.infer<typeof consequenceImpactParams>;

export const consequenceImpact: SequenceFn<ConsequenceImpactParams> = (
  params,
  id,
): RawScene[] => {
  const {
    text,
    kicker,
    coda,
    visual,
    visualProps,
    textSeconds,
    codaSeconds,
    toBlack,
    note,
  } = params;

  const base = visual
    ? layer(visual, visualProps, {
        track: "background",
        // Quase parada. Movimento forte aqui compete com a frase.
        camera: push(1.06, 1.1, 0.5, 0.5),
      })
    : backdrop({ glow: "", gridSize: 0, horizon: 0.4, haze: 0.8, vignette: 0.55 });

  const scenes: RawScene[] = [
    {
      id: `${id}-impact`,
      note: note || "A frase que fica. Pouca coisa no quadro, de proposito.",
      duration: textSeconds,
      transitionIn: { type: "dip-to-black", duration: 0.9 },
      layers: [
        base,
        ...(visual
          ? [
              // Escurece o fundo sob o texto: legibilidade sem caixa.
              layer(
                "backdrop",
                { bg: "transparent", glow: "", gridSize: 0, horizon: 0, haze: 0.9, vignette: 0.6 },
                { track: "main" },
              ),
            ]
          : []),
        layer(
          "kinetic-text",
          {
            text,
            size: TYPE.title,
            align: "left",
            position: "middle",
            stagger: 3.5,
          },
          { track: "overlay", from: 0.6, camera: push(1, 1.02, 0.35, 0.5) },
        ),
        ...(kicker !== ""
          ? [
              // O kicker vai no campo `text`, nao em `kicker`: o schema do
              // callout exige texto nao vazio, e um rotulo de capitulo e
              // exatamente um texto curto sem destaque.
              layer(
                "callout",
                {
                  text: kicker,
                  position: "top-left",
                  rule: false,
                  tone: "neutral",
                  size: TYPE.label,
                },
                { track: "overlay", duration: textSeconds * 0.6 },
              ),
            ]
          : []),
      ],
    },
  ];

  if (coda !== "") {
    scenes.push({
      id: `${id}-coda`,
      note: "Respiro e ultima linha, menor. Entao o escuro.",
      duration: codaSeconds,
      transitionIn: { type: "dip-to-black", duration: 0.8 },
      layers: [
        backdrop({ glow: "", gridSize: 0, horizon: 0.25, haze: 0.4, vignette: 0.6 }),
        layer(
          "end-card",
          { title: coda, fadeToBlack: toBlack },
          { track: "main" },
        ),
      ],
    });
  }

  return scenes;
};
