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
import { TitleCard, titleCardSchema } from "./2d/TitleCard";
import { LowerThird, lowerThirdSchema } from "./2d/LowerThird";
import { WorldMap, worldMapSchema } from "./2d/WorldMap";
import { CableScene3D, cableScene3DSchema } from "./3d/CableScene3D";

export interface LibraryEntry {
  component: ComponentType<never>;
  schema: ZodType;
  /** Usa WebGL: o render precisa de --gl=angle e paga custo de GPU. */
  webgl: boolean;
  description: string;
}

export const LIBRARY: Readonly<Record<string, LibraryEntry>> = {
  backdrop: {
    component: Backdrop as ComponentType<never>,
    schema: backdropSchema,
    webgl: false,
    description: "Fundo de cena: gradiente, grade tecnica e vinheta.",
  },
  "title-card": {
    component: TitleCard as ComponentType<never>,
    schema: titleCardSchema,
    webgl: false,
    description: "Abertura cinematografica com titulo e subtitulo animados.",
  },
  "lower-third": {
    component: LowerThird as ComponentType<never>,
    schema: lowerThirdSchema,
    webgl: false,
    description: "Tarja inferior com nome, cargo ou fonte.",
  },
  "world-map": {
    component: WorldMap as ComponentType<never>,
    schema: worldMapSchema,
    webgl: false,
    description: "Mapa-mundi com rotas que se iluminam progressivamente.",
  },
  "cable-3d": {
    component: CableScene3D as ComponentType<never>,
    schema: cableScene3DSchema,
    webgl: true,
    description: "Cabo submarino em 3D com camera viajando ao longo dele.",
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
