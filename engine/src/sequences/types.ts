/**
 * Sequencias documentais: a camada que faltava entre componente e filme.
 *
 * Uma sequencia NAO e um componente. E uma funcao que recebe o conteudo
 * narrativo e emite VARIAS cenas ja compostas — enquadramento, movimento de
 * camera, ritmo e corte ja decididos. E onde mora o conhecimento de direcao.
 *
 *   roteiro.json -> sequencias -> cenas -> camadas -> componentes
 *                   (direcao)    (o contrato que ja existe)
 *
 * O contrato nao mudou. Uma sequencia expande ANTES da validacao zod e
 * devolve cenas comuns, inspecionaveis. Se amanha as sequencias se mostrarem
 * erradas, apagar esta pasta nao quebra nada.
 */

import { SHOT } from "../library/shared/tokens";

/** Cena crua: o mesmo formato do JSON, antes do zod. */
export type RawScene = Record<string, unknown>;
export type RawLayer = Record<string, unknown>;

export type SequenceFn<P = never> = (params: P, id: string) => RawScene[];

export type Track = "background" | "main" | "overlay";

/** Atalho para montar camada sem repetir a forma do objeto. */
export function layer(
  component: string,
  props: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
): RawLayer {
  return { component, props, ...extra };
}

/**
 * Movimento de camera minimo.
 *
 * A direcao de arte proibe plano parado: o minimo e 1,00 -> 1,04 ao longo da
 * cena. Esta funcao existe para que nenhuma sequencia esqueca.
 */
export function push(
  from = 1,
  to = 1.05,
  originX = 0.5,
  originY = 0.5,
): Record<string, unknown> {
  return { fromScale: from, toScale: to, originX, originY, easing: "inOut" };
}

/** Travelling lateral. Deslocamento em fracao da largura. */
export function drift(
  dx: number,
  dy = 0,
  scale = 1.04,
): Record<string, unknown> {
  return {
    fromScale: scale,
    toScale: scale,
    fromX: -dx / 2,
    toX: dx / 2,
    fromY: -dy / 2,
    toY: dy / 2,
    easing: "inOut",
  };
}

/**
 * Fundo padrao com profundidade.
 *
 * Toda sequencia 2D comeca por aqui, e o `glowX` fora do centro e
 * proposital: luz centralizada le como tela de aplicativo.
 */
export function backdrop(
  props: Record<string, unknown> = {},
  parallax = 0.3,
): RawLayer {
  return layer(
    "backdrop",
    { glowX: 0.26, glowY: 0.3, ...props },
    {
      track: "background",
      // Paralaxe: o fundo anda uma fracao do que anda o primeiro plano.
      camera: push(1, 1 + 0.05 * parallax, 0.5, 0.5),
    },
  );
}

/** Corte seco. E o padrao da montagem; dissolver em tudo le como slide. */
export const CUT = undefined;

/** Dissolvencia curta. Guardada para salto de tempo. */
export const DISSOLVE = { type: "fade", duration: 0.6 } as const;

/** Passagem pelo escuro. So em troca de capitulo. */
export const BLACK = { type: "dip-to-black", duration: 0.9 } as const;

export { SHOT };
