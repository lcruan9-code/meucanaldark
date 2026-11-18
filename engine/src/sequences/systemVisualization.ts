/**
 * System visualization: o sistema se monta, depois funciona.
 *
 * A separacao em dois tempos e o ponto. No primeiro, o grafo se constroi e o
 * espectador aprende a topologia. No segundo, os pulsos correm e ele ve o
 * sistema EM OPERACAO. Mostrar as duas coisas juntas faz as duas se
 * perderem: ninguem le a estrutura enquanto algo se move por cima dela.
 */

import { z } from "zod";

import { backdrop, drift, layer, push, type RawScene, type SequenceFn } from "./types";

const zNode = z.object({
  id: z.string().min(1),
  label: z.string().default(""),
  sub: z.string().default(""),
  shape: z.enum(["box", "circle", "diamond"]).default("box"),
  rank: z.number().int().min(0).default(0),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  highlight: z.boolean().default(false),
});

const zEdge = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().default(""),
  bend: z.number().default(0),
});

export const systemVisualizationParams = z.object({
  title: z.string().default(""),
  nodes: z.array(zNode).min(2).max(16),
  edges: z.array(zEdge).default([]),
  layout: z.enum(["flow", "radial", "manual"]).default("flow"),
  /** Frase que fecha a sequencia, sobre o sistema ja funcionando. */
  caption: z.string().default(""),
  captionKicker: z.string().default(""),
  buildSeconds: z.number().positive().default(7),
  runSeconds: z.number().positive().default(5),
  /** Pulsos por aresta no segundo tempo. */
  pulses: z.number().int().min(0).max(5).default(3),
  note: z.string().default(""),
});

export type SystemVisualizationParams = z.infer<typeof systemVisualizationParams>;

export const systemVisualization: SequenceFn<SystemVisualizationParams> = (
  params,
  id,
): RawScene[] => {
  const {
    title,
    nodes,
    edges,
    layout,
    caption,
    captionKicker,
    buildSeconds,
    runSeconds,
    pulses,
    note,
  } = params;

  // Entrada escalonada: no, aresta, no, aresta. O grafo "se desenha" em vez
  // de aparecer pronto.
  const timedNodes = nodes.map((node, index) => ({
    ...node,
    at: (index / Math.max(1, nodes.length)) * 0.62,
  }));

  const timedEdges = edges.map((edge, index) => ({
    ...edge,
    at: 0.1 + (index / Math.max(1, edges.length)) * 0.62,
    pulses: 0,
  }));

  const build: RawScene = {
    id: `${id}-build`,
    note: note || "O sistema se monta. Sem movimento por cima: le-se a estrutura.",
    duration: buildSeconds,
    layers: [
      backdrop({ glowOpacity: 0.16, gridSize: 96 }),
      layer(
        "node-graph",
        { title, nodes: timedNodes, edges: timedEdges, layout },
        { track: "main", camera: push(1.03, 1, 0.5, 0.5) },
      ),
    ],
  };

  const running: RawScene = {
    id: `${id}-run`,
    note: "Agora funcionando: os pulsos atravessam o sistema montado.",
    duration: runSeconds,
    layers: [
      backdrop({ glowOpacity: 0.2, gridSize: 96 }),
      layer(
        "node-graph",
        {
          title,
          layout,
          // Tudo ja visivel desde o quadro zero: este plano nao reconstroi.
          nodes: nodes.map((node) => ({ ...node, at: 0 })),
          edges: edges.map((edge) => ({ ...edge, at: 0, pulses })),
        },
        { track: "main", camera: drift(0.02, 0, 1.02) },
      ),
      ...(caption !== ""
        ? [
            layer(
              "callout",
              { kicker: captionKicker, text: caption, position: "bottom-right" },
              { track: "overlay", from: runSeconds * 0.3 },
            ),
          ]
        : []),
    ],
  };

  return [build, running];
};
