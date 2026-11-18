/**
 * Registro da biblioteca visual.
 *
 * E o unico lugar que liga um nome do roteiro ("world-map") a um componente
 * React. Essa indirecao e o que permite a regra que o projeto exige: trocar
 * ou melhorar um componente sem reescrever nenhum roteiro.
 *
 * Regras para entrar aqui:
 *  - o componente nao conhece o documentario que o usa;
 *  - toda configuracao chega por props, validadas pelo schema declarado;
 *  - nada de estado, timer ou aleatoriedade sem semente. O render e por
 *    quadro: `Math.random()` produz cintilacao entre quadros vizinhos.
 */

import type { ComponentType } from "react";
import type { ZodType } from "zod";

import { Backdrop, backdropSchema } from "./2d/Backdrop";
import { BarChart, barChartSchema } from "./2d/BarChart";
import { Callout, calloutSchema } from "./2d/Callout";
import { CircuitTrace, circuitTraceSchema } from "./2d/CircuitTrace";
import { Diagram, diagramSchema } from "./2d/Diagram";
import { EndCard, endCardSchema } from "./2d/EndCard";
import { KineticText, kineticTextSchema } from "./2d/KineticText";
import { LineChart, lineChartSchema } from "./2d/LineChart";
import { LowerThird, lowerThirdSchema } from "./2d/LowerThird";
import { NodeGraph, nodeGraphSchema } from "./2d/NodeGraph";
import { StatBlock, statBlockSchema } from "./2d/StatBlock";
import { TechPanel, techPanelSchema } from "./2d/TechPanel";
import { TitleCard, titleCardSchema } from "./2d/TitleCard";
import { WorldMap, worldMapSchema } from "./2d/WorldMap";
import { VideoClip, videoClipSchema } from "./video/VideoClip";
import { CableScene3D, cableScene3DSchema } from "./3d/CableScene3D";
import { DataCenter3D, dataCenter3DSchema } from "./3d/DataCenter3D";

/** Familia serve a navegacao e ao Estudio; nao muda comportamento. */
export type LibraryFamily =
  | "video"
  | "fundo"
  | "texto"
  | "dados"
  | "diagrama"
  | "geografia"
  | "cena-3d";

export interface LibraryEntry {
  component: ComponentType<never>;
  schema: ZodType;
  family: LibraryFamily;
  /** Usa WebGL: o render precisa de --gl=angle e paga custo de GPU. */
  webgl: boolean;
  /**
   * Usa filtro caro de CSS/SVG por padrao (blur, drop-shadow, turbulencia).
   * A medicao da Etapa 1 mostrou que e dai que vem o custo do 2D, nao do
   * desenho em si. Marcado aqui para que a bancada separe os dois grupos.
   */
  costlyFilter: boolean;
  description: string;
}

export const LIBRARY: Readonly<Record<string, LibraryEntry>> = {
  backdrop: {
    component: Backdrop as ComponentType<never>,
    schema: backdropSchema,
    family: "fundo",
    webgl: false,
    costlyFilter: false,
    description: "Fundo de cena: gradiente, grade tecnica e vinheta.",
  },
  circuit: {
    component: CircuitTrace as ComponentType<never>,
    schema: circuitTraceSchema,
    family: "fundo",
    webgl: false,
    costlyFilter: false,
    description: "Trilhas de circuito geradas por semente, com sinais correndo.",
  },

  "title-card": {
    component: TitleCard as ComponentType<never>,
    schema: titleCardSchema,
    family: "texto",
    webgl: false,
    costlyFilter: true,
    description: "Abertura cinematografica com titulo e subtitulo animados.",
  },
  "kinetic-text": {
    component: KineticText as ComponentType<never>,
    schema: kineticTextSchema,
    family: "texto",
    webgl: false,
    costlyFilter: true,
    description: "Tipografia cinetica com palavra-heroi marcada por asteriscos.",
  },
  "lower-third": {
    component: LowerThird as ComponentType<never>,
    schema: lowerThirdSchema,
    family: "texto",
    webgl: false,
    costlyFilter: true,
    description: "Tarja inferior com nome, cargo ou fonte.",
  },
  callout: {
    component: Callout as ComponentType<never>,
    schema: calloutSchema,
    family: "texto",
    webgl: false,
    costlyFilter: false,
    description: "Destaque curto que entra sobre qualquer cena e sai sozinho.",
  },
  "end-card": {
    component: EndCard as ComponentType<never>,
    schema: endCardSchema,
    family: "texto",
    webgl: false,
    costlyFilter: false,
    description: "Encerramento com fontes do episodio e chamada final.",
  },

  "stat-block": {
    component: StatBlock as ComponentType<never>,
    schema: statBlockSchema,
    family: "dados",
    webgl: false,
    costlyFilter: false,
    description: "Numeros grandes contando ate o valor, com rotulo e fonte.",
  },
  "bar-chart": {
    component: BarChart as ComponentType<never>,
    schema: barChartSchema,
    family: "dados",
    webgl: false,
    costlyFilter: false,
    description: "Barras escalonadas com valor acompanhando o crescimento.",
  },
  "line-chart": {
    component: LineChart as ComponentType<never>,
    schema: lineChartSchema,
    family: "dados",
    webgl: false,
    costlyFilter: false,
    description: "Serie temporal que se desenha, com marcadores de evento.",
  },
  "tech-panel": {
    component: TechPanel as ComponentType<never>,
    schema: techPanelSchema,
    family: "dados",
    webgl: false,
    costlyFilter: false,
    description: "Painel tecnico ilustrativo com leituras e medidores.",
  },

  "node-graph": {
    component: NodeGraph as ComponentType<never>,
    schema: nodeGraphSchema,
    family: "diagrama",
    webgl: false,
    costlyFilter: false,
    description: "Nos e ligacoes: redes, topologias, fluxogramas e cadeias.",
  },
  diagram: {
    component: Diagram as ComponentType<never>,
    schema: diagramSchema,
    family: "diagrama",
    webgl: false,
    costlyFilter: false,
    description: "Chamadas com linha-guia anotando o que ja esta na tela.",
  },

  "world-map": {
    component: WorldMap as ComponentType<never>,
    schema: worldMapSchema,
    family: "geografia",
    webgl: false,
    costlyFilter: true,
    description: "Mapa-mundi Natural Earth com rotas que se iluminam.",
  },

  "video-clip": {
    component: VideoClip as ComponentType<never>,
    schema: videoClipSchema,
    family: "video",
    // Nao e WebGL: o MP4 e imagem plana, decodificada por ffmpeg fora do
    // navegador. Marcar como webgl obrigaria o render a modo cena sem motivo.
    webgl: false,
    costlyFilter: false,
    description:
      "Clipe de video ja renderizado (Blender, arquivo), com corte e escurecimento.",
  },

  "cable-3d": {
    component: CableScene3D as ComponentType<never>,
    schema: cableScene3DSchema,
    family: "cena-3d",
    webgl: true,
    costlyFilter: false,
    description: "Cabo submarino em 3D com camera viajando ao longo dele.",
  },
  "data-center-3d": {
    component: DataCenter3D as ComponentType<never>,
    schema: dataCenter3DSchema,
    family: "cena-3d",
    webgl: true,
    costlyFilter: false,
    description:
      "Corredor de data center com IBL, nevoa e LEDs; quatro enquadramentos.",
  },
};

export type LibraryKey = keyof typeof LIBRARY;

export function getEntry(key: string): LibraryEntry {
  const entry = LIBRARY[key];
  if (!entry) {
    const known = Object.keys(LIBRARY).sort().join(", ");
    throw new Error(
      `componente "${key}" nao existe na biblioteca. Disponiveis: ${known}`,
    );
  }
  return entry;
}

/** True se qualquer cena usa WebGL. Decide a flag --gl do render. */
export function needsWebgl(componentKeys: readonly string[]): boolean {
  return componentKeys.some((key) => LIBRARY[key]?.webgl === true);
}

/** Lista por familia. Usada pela bancada e pela documentacao. */
export function byFamily(family: LibraryFamily): string[] {
  return Object.entries(LIBRARY)
    .filter(([, entry]) => entry.family === family)
    .map(([key]) => key)
    .sort();
}
