/**
 * Vocabulario de movimento da biblioteca.
 *
 * Existe para que todos os componentes se movam com a mesma gramatica. Num
 * documentario, o que faz a imagem parecer de um filme so nao e a paleta: e
 * o ritmo. Dois componentes com curvas de entrada diferentes brigam entre si
 * mesmo usando as mesmas cores.
 *
 * Regra que vale para tudo aqui: funcao pura de `frame`. Render e quadro a
 * quadro; qualquer estado, relogio ou `Math.random()` faz quadros vizinhos
 * divergirem e o video "chia".
 */

import { Easing, interpolate, spring } from "remotion";

/** Curvas nomeadas. Usar nome, nao numero magico espalhado pelo codigo. */
export const EASE = {
  /** Padrao de entrada: rapido no inicio, assenta devagar. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Movimento de camera e zoom: nao chama atencao em nenhum extremo. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Saida: acelera para fora da tela. */
  in: Easing.bezier(0.7, 0, 0.84, 0),
  linear: Easing.linear,
} as const;

export type EaseName = keyof typeof EASE;

/** Molas nomeadas, pelo papel que cumprem. */
export const SPRING = {
  /** Entrada firme, sem repique. O padrao para texto. */
  settle: { damping: 200, mass: 0.9 },
  /** Mais leve: elementos pequenos, pontos, selos. */
  light: { damping: 200, mass: 0.6 },
  /** Com um repique discreto. Use com parcimonia, chama atencao. */
  pop: { damping: 14, mass: 0.8, stiffness: 120 },
} as const;

export type SpringName = keyof typeof SPRING;

/** Progresso 0..1 da cena ou da camada. Protege contra duracao 1. */
export function progressOf(frame: number, durationInFrames: number): number {
  if (durationInFrames <= 1) return 1;
  return Math.min(1, Math.max(0, frame / (durationInFrames - 1)));
}

export type RevealOptions = {
  /** Atraso em quadros antes de comecar. */
  delay?: number;
  spring?: SpringName;
  durationInFrames?: number;
};

/** Entrada 0..1 por mola. E o tijolo de quase toda animacao daqui. */
export function reveal(
  frame: number,
  fps: number,
  options: RevealOptions = {},
): number {
  const { delay = 0, spring: name = "settle", durationInFrames } = options;
  return spring({
    frame: frame - delay,
    fps,
    config: SPRING[name],
    ...(durationInFrames ? { durationInFrames } : {}),
  });
}

/**
 * Presenca 0..1 com entrada e saida.
 *
 * Elemento que entra e nunca sai e a marca de template automatico: a tela
 * vai acumulando coisa. Todo componente com vida propria usa isto.
 */
export function presence(
  frame: number,
  fps: number,
  durationInFrames: number,
  options: { delay?: number; exitFrames?: number; spring?: SpringName } = {},
): number {
  const { delay = 0, exitFrames = 0, spring: name = "settle" } = options;
  const enter = reveal(frame, fps, { delay, spring: name });
  if (exitFrames <= 0) return enter;
  const exit = reveal(frame, fps, {
    delay: durationInFrames - exitFrames,
    spring: name,
  });
  return Math.max(0, enter - exit);
}

/** Atraso escalonado. Entrada simultanea e assinatura de template barato. */
export function stagger(index: number, perItem: number, base = 0): number {
  return base + index * perItem;
}

/**
 * Interpola um trecho do progresso para 0..1, com corte nas pontas.
 * Serve para "este elemento acontece entre 30% e 60% da cena".
 */
export function window(
  progress: number,
  start: number,
  end: number,
  ease: EaseName = "out",
): number {
  if (end <= start) return progress >= end ? 1 : 0;
  return interpolate(progress, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE[ease],
  });
}

/**
 * Formata numero para leitura em tela, no padrao do idioma do canal.
 *
 * Isto NAO e detalhe: a auditoria do projeto de referencia encontrou
 * `toLocaleString("pt-BR")` cravado no codigo, que escreveria 1.234,5 onde
 * um americano le 1,234.5. Aqui o idioma vem de fora, sempre.
 */
export function formatNumber(
  value: number,
  locale: string,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/** Contagem crescente com desaceleracao. O numero grande de documentario. */
export function countTo(
  progress: number,
  target: number,
  from = 0,
  ease: EaseName = "out",
): number {
  return interpolate(progress, [0, 1], [from, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE[ease],
  });
}
