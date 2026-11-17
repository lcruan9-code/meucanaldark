/**
 * Composicoes de bancada.
 *
 * Nao entram em filme nenhum. Existem para medir e para conferir.
 *
 * As quatro primeiras sao de MEDICAO. `bench-2d` e `bench-lean` existem como
 * par: as duas desenham quantidade parecida de elemento, mas a primeira usa
 * `drop-shadow`, `blur` e `backdrop-filter` e a segunda nao. A Etapa 1
 * mediu o 2D saindo mais caro que o 3D e a hipotese foi que a culpa e do
 * filtro, nao do desenho. Este par testa a hipotese.
 *
 * `bench-showcase` e de CONFERENCIA: um plano por componente, para olhar.
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

/** 2D com filtros caros: mapa com brilho nas rotas e tarja com desfoque. */
const bench2d = {
  ...BASE,
  id: "bench-2d",
  title: "Bancada 2D (com filtros)",
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

/** Mesma carga visual, sem nenhum filtro caro. O par de controle. */
const benchLean = {
  ...BASE,
  id: "bench-lean",
  title: "Bancada 2D (sem filtros)",
  scenes: [
    {
      id: "blean",
      duration: 10,
      layers: [
        { component: "backdrop", track: "background" as const, props: { glow: "" } },
        {
          component: "node-graph",
          track: "main" as const,
          props: {
            layout: "flow",
            title: "Submarine route, simplified",
            nodes: [
              { id: "a", label: "Landing station", sub: "New York", rank: 0, at: 0 },
              { id: "b", label: "Repeater", sub: "every 80 km", rank: 1, at: 0.12 },
              { id: "c", label: "Branching unit", rank: 1, at: 0.2, y: 0.7 },
              { id: "d", label: "Landing station", sub: "Bude, UK", rank: 2, at: 0.3, highlight: true },
            ],
            edges: [
              { from: "a", to: "b", at: 0.1, pulses: 3 },
              { from: "b", to: "d", at: 0.22, pulses: 3 },
              { from: "b", to: "c", at: 0.26, bend: 0.12 },
            ],
          },
        },
        {
          component: "callout",
          track: "overlay" as const,
          from: 5,
          duration: 4,
          props: { kicker: "Latency", text: "60 ms, New York to London", position: "bottom-right" },
        },
      ],
    },
  ],
};

const bench3d = {
  ...BASE,
  id: "bench-3d",
  title: "Bancada 3D",
  scenes: [
    {
      id: "b3d",
      duration: 10,
      layers: [{ component: "cable-3d", track: "background" as const, props: {} }],
    },
  ],
};

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
          component: "diagram",
          track: "overlay" as const,
          from: 1,
          props: {
            parts: [
              { x: 0.46, y: 0.47, label: "Optical core", sub: "8 fibre pairs", side: "right", at: 0.1 },
              { x: 0.3, y: 0.56, label: "Steel armour", sub: "trawler protection", side: "left", at: 0.45 },
            ],
          },
        },
      ],
    },
  ],
};

/** Vitrine: um plano por componente, para conferir com o olho. */
const benchShowcase = {
  ...BASE,
  id: "bench-showcase",
  title: "Vitrine da biblioteca",
  chapters: [],
  scenes: [
    {
      id: "s-title",
      duration: 4,
      layers: [
        BACKDROP,
        {
          component: "title-card",
          track: "main" as const,
          props: {
            eyebrow: "Library",
            title: "Visual components",
            subtitle: "Every shot below is data, not a hand-made frame.",
            titleSize: 80,
          },
        },
      ],
    },
    {
      id: "s-kinetic",
      duration: 4,
      transitionIn: { type: "fade", duration: 0.5 },
      layers: [
        BACKDROP,
        {
          component: "kinetic-text",
          track: "main" as const,
          props: {
            text: "Almost *99 per cent* of intercontinental traffic travels by sea.",
            size: 64,
          },
        },
      ],
    },
    {
      id: "s-stat",
      duration: 4,
      transitionIn: { type: "cross-zoom", duration: 0.5 },
      layers: [
        BACKDROP,
        {
          component: "stat-block",
          track: "main" as const,
          props: {
            eyebrow: "In service, 2026",
            stats: [
              { value: 552, label: "active cables" },
              { value: 1.5, suffix: "M", label: "kilometres of cable", decimals: 1 },
              { value: 200, prefix: "~", label: "faults per year" },
            ],
            source: "TeleGeography Submarine Cable Map",
          },
        },
      ],
    },
    {
      id: "s-bar",
      duration: 4,
      transitionIn: { type: "fade", duration: 0.4 },
      layers: [
        BACKDROP,
        {
          component: "bar-chart",
          track: "main" as const,
          props: {
            title: "Cable faults by cause",
            unit: "%",
            bars: [
              { label: "Fishing gear", value: 41, highlight: true },
              { label: "Anchors", value: 16 },
              { label: "Natural hazards", value: 14 },
              { label: "Equipment failure", value: 9 },
              { label: "Unknown", value: 20 },
            ],
          },
        },
      ],
    },
    {
      id: "s-line",
      duration: 4,
      transitionIn: { type: "fade", duration: 0.4 },
      layers: [
        BACKDROP,
        {
          component: "line-chart",
          track: "main" as const,
          props: {
            title: "Transatlantic capacity",
            yLabel: "Tbps",
            xLabel: "year",
            series: [
              {
                label: "Lit capacity",
                area: true,
                points: [
                  [2014, 12], [2016, 24], [2018, 58], [2020, 118],
                  [2022, 210], [2024, 360], [2026, 520],
                ],
              },
            ],
            markers: [{ x: 2021, label: "Dunant online", at: 0.68 }],
          },
        },
      ],
    },
    {
      id: "s-map",
      duration: 5,
      transitionIn: { type: "dip-to-black", duration: 0.6 },
      layers: [
        { component: "backdrop", track: "background" as const, props: { glow: "" } },
        {
          component: "world-map",
          track: "main" as const,
          camera: { fromScale: 1, toScale: 1.18, originX: 0.36, originY: 0.4 },
          props: {
            showBorders: true,
            routes: [
              { from: "new-york", to: "london", label: "North Atlantic", startAt: 0.05, growth: 0.35 },
              { from: "fortaleza", to: "lisbon", label: "EllaLink", startAt: 0.3, growth: 0.35 },
            ],
          },
        },
      ],
    },
    {
      id: "s-graph",
      duration: 4,
      transitionIn: { type: "whip", duration: 0.45 },
      layers: [
        { component: "backdrop", track: "background" as const, props: { glow: "" } },
        {
          component: "node-graph",
          track: "main" as const,
          props: {
            layout: "radial",
            title: "Landing station, simplified",
            nodes: [
              { id: "hub", label: "Landing station", shape: "circle", highlight: true, at: 0 },
              { id: "n1", label: "Power feed", at: 0.15 },
              { id: "n2", label: "Terminal equipment", at: 0.22 },
              { id: "n3", label: "Backhaul", at: 0.3 },
              { id: "n4", label: "Monitoring", at: 0.38 },
            ],
            edges: [
              { from: "hub", to: "n1", at: 0.2, pulses: 2 },
              { from: "hub", to: "n2", at: 0.26, pulses: 2 },
              { from: "hub", to: "n3", at: 0.33, pulses: 2 },
              { from: "hub", to: "n4", at: 0.4 },
            ],
          },
        },
      ],
    },
    {
      id: "s-circuit",
      duration: 4,
      transitionIn: { type: "fade", duration: 0.4 },
      layers: [
        { component: "backdrop", track: "background" as const, props: { glow: "", gridSize: 0 } },
        {
          component: "circuit",
          track: "background" as const,
          props: { seed: 11, traces: 16, pulses: 2, label: "repeater board" },
        },
        {
          component: "callout",
          track: "overlay" as const,
          from: 1,
          duration: 3,
          props: {
            kicker: "Every 80 km",
            text: "A repeater amplifies the light before it fades.",
            position: "top-left",
          },
        },
      ],
    },
    {
      id: "s-panel",
      duration: 4,
      transitionIn: { type: "fade", duration: 0.4 },
      layers: [
        { component: "backdrop", track: "background" as const, props: { glow: "" } },
        {
          component: "tech-panel",
          track: "main" as const,
          props: {
            title: "Cable monitoring",
            readouts: [
              { label: "Segment", value: "NYC-BUDE-03", state: "normal" },
              { label: "Optical loss", value: "0.18 dB/km", gauge: 0.34, state: "good" },
              { label: "Fault distance", value: "1,418 km", gauge: 0.72, state: "warning" },
              { label: "Repair vessel", value: "ETA 6 d", gauge: 0.5, state: "normal" },
            ],
          },
        },
      ],
    },
    {
      id: "s-3d",
      duration: 5,
      transitionIn: { type: "dip-to-black", duration: 0.6 },
      layers: [
        { component: "cable-3d", track: "background" as const, props: { cutawayAt: 0.3 } },
        {
          component: "diagram",
          track: "overlay" as const,
          from: 1.5,
          props: {
            parts: [
              { x: 0.48, y: 0.46, label: "Polyethylene sheath", side: "right", at: 0.1 },
              { x: 0.34, y: 0.54, label: "Steel strand armour", side: "left", at: 0.5 },
            ],
          },
        },
      ],
    },
    {
      id: "s-end",
      duration: 5,
      transitionIn: { type: "dip-to-black", duration: 0.7 },
      layers: [
        { component: "backdrop", track: "background" as const, props: { glow: "", gridSize: 0 } },
        {
          component: "end-card",
          track: "main" as const,
          props: {
            title: "The Hidden Cables That Keep the Internet Alive",
            sources: [
              "TeleGeography, Submarine Cable Map (2026)",
              "International Cable Protection Committee, fault statistics",
              "Natural Earth, 110m physical vectors (public domain)",
            ],
            cta: "Next: what happens when one of them breaks.",
          },
        },
      ],
    },
  ],
};

export const BENCH_PROJECTS: readonly ProjectEntry[] = [
  { raw: bench2d, durations: {} },
  { raw: benchLean, durations: {} },
  { raw: bench3d, durations: {} },
  { raw: benchMixed, durations: {} },
  { raw: benchShowcase, durations: {} },
];
