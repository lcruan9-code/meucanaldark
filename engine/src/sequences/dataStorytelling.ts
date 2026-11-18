/**
 * Data storytelling: numero, prova, consequencia.
 *
 * Tres planos com corte seco entre eles. A ordem nao e arbitraria:
 *
 *   1. o NUMERO sozinho, grande o bastante para doer. Sem grafico, sem
 *      contexto — o espectador recebe um fato.
 *   2. o GRAFICO, que mostra de onde o numero vem. Agora ele tem contexto.
 *   3. a CONSEQUENCIA em texto, que diz o que aquilo significa.
 *
 * Mostrar grafico primeiro e dar a resposta antes da pergunta. Mostrar os
 * tres juntos num plano e a definicao de infografico de apresentacao.
 */

import { z } from "zod";

import { TYPE } from "../library/shared/tokens";
import { backdrop, drift, layer, push, type RawScene, type SequenceFn } from "./types";

const zStat = z.object({
  value: z.number(),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
  label: z.string().default(""),
  decimals: z.number().int().min(0).max(4).default(0),
});

export const dataStorytellingParams = z.object({
  /** O fato. Um numero so: dois ja dividem a atencao. */
  stat: zStat,
  eyebrow: z.string().default(""),
  source: z.string().default(""),
  locale: z.string().default("en-US"),
  /** O grafico que sustenta o numero. Omitir pula o segundo plano. */
  chart: z
    .object({
      kind: z.enum(["bar", "line"]),
      props: z.record(z.string(), z.unknown()),
    })
    .optional(),
  /** A consequencia. Asteriscos marcam a palavra-heroi. */
  consequence: z.string().default(""),
  statSeconds: z.number().positive().default(4),
  chartSeconds: z.number().positive().default(7),
  consequenceSeconds: z.number().positive().default(4.5),
  note: z.string().default(""),
});

export type DataStorytellingParams = z.infer<typeof dataStorytellingParams>;

export const dataStorytelling: SequenceFn<DataStorytellingParams> = (
  params,
  id,
): RawScene[] => {
  const {
    stat,
    eyebrow,
    source,
    locale,
    chart,
    consequence,
    statSeconds,
    chartSeconds,
    consequenceSeconds,
    note,
  } = params;

  const scenes: RawScene[] = [];

  scenes.push({
    id: `${id}-stat`,
    note: note || "O fato, sozinho e grande. Sem grafico, sem contexto.",
    duration: statSeconds,
    layers: [
      backdrop({ glowOpacity: 0.22, horizon: 0.2 }),
      layer(
        "stat-block",
        {
          eyebrow,
          locale,
          source,
          stats: [stat],
          // Escala de cartela, nao de painel: a razao com o corpo passa de
          // sete para um, que e o que a direcao de arte exige.
          valueSize: TYPE.display,
          align: "left",
        },
        { track: "main", camera: push(1, 1.04, 0.3, 0.5) },
      ),
    ],
  });

  if (chart) {
    scenes.push({
      id: `${id}-chart`,
      note: "De onde o numero vem.",
      duration: chartSeconds,
      layers: [
        backdrop({ glowOpacity: 0.14, gridSize: 96, horizon: 0.18 }),
        layer(
          chart.kind === "bar" ? "bar-chart" : "line-chart",
          { locale, ...chart.props },
          { track: "main", camera: drift(0.015, 0, 1.02) },
        ),
      ],
    });
  }

  if (consequence !== "") {
    scenes.push({
      id: `${id}-consequence`,
      note: "O que aquilo significa. Texto sustentado, camera quase parada.",
      duration: consequenceSeconds,
      layers: [
        backdrop({ glow: "", gridSize: 0, horizon: 0.3, haze: 0.7 }),
        layer(
          "kinetic-text",
          { text: consequence, size: TYPE.heading, align: "left" },
          { track: "main", camera: push(1, 1.03, 0.35, 0.5) },
        ),
      ],
    });
  }

  return scenes;
};
