/**
 * Composicoes de bancada.
 *
 * Nao entram em filme nenhum. Existem para responder, com numero, a pergunta
 * que decide a arquitetura do motor: quanto custa um quadro de 2D e quanto
 * custa um quadro de 3D NESTA maquina, dentro do Remotion.
 *
 * Sao curtas de proposito (10 s). O que interessa e a taxa, nao o total, e
 * uma bancada longa so faz esperar.
 */

import type { ProjectEntry } from "../projects";

const BASE = {
  schemaVersion: 1 as const,
  language: "en",
  width: 1920,
  height: 1080,
  fps: 30,
  chapters: [],
};

const BACKDROP = {
  component: "backdrop",
  track: "background" as const,
  props: {},
};

/** So 2D: fundo, titulo e mapa com rotas crescendo. O caso comum. */
const bench2d = {
  ...BASE,
  id: "bench-2d",
  title: "Bancada 2D",
  scenes: [
    {
      id: "b2d",
      duration: 10,
      layers: [
        BACKDROP,
        {
          component: "world-map",
          track: "main" as const,
          props: {
            routes: [
              { from: "new-york", to: "london", label: "TAT-14", growth: 0.4 },
              { from: "fortaleza", to: "lisbon", startAt: 0.2, growth: 0.4 },
              { from: "singapore", to: "mumbai", startAt: 0.35, growth: 0.4 },
            ],
            zoomTo: 1.12,
          },
        },
        {
          component: "lower-third",
          track: "overlay" as const,
          from: 2,
          duration: 5,
          props: { primary: "North Atlantic", secondary: "TeleGeography, 2026" },
        },
      ],
    },
  ],
};

/** So 3D: o caso caro. E a medicao que decide pre-render x render direto. */
const bench3d = {
  ...BASE,
  id: "bench-3d",
  title: "Bancada 3D",
  scenes: [
    {
      id: "b3d",
      duration: 10,
      layers: [
        { component: "cable-3d", track: "background" as const, props: {} },
      ],
    },
  ],
};

/** 3D com 2D por cima: o que um documentario de verdade faz. */
const benchMixed = {
  ...BASE,
  id: "bench-mixed",
  title: "Bancada 2D sobre 3D",
  scenes: [
    {
      id: "bmix",
      duration: 10,
      layers: [
        { component: "cable-3d", track: "background" as const, props: {} },
        {
          component: "lower-third",
          track: "overlay" as const,
          from: 1,
          duration: 6,
          props: {
            primary: "Optical core",
            secondary: "8 fibre pairs, 1.2 mm",
          },
        },
      ],
    },
  ],
};

export const BENCH_PROJECTS: readonly ProjectEntry[] = [
  { raw: bench2d, durations: {} },
  { raw: bench3d, durations: {} },
  { raw: benchMixed, durations: {} },
];
