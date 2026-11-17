/**
 * Valores padrao da identidade visual.
 *
 * Todo componente aceita cor e fonte por prop; estes sao os valores quando a
 * prop nao vem. Existem para que um roteiro curto — sem tema declarado —
 * ainda produza imagem coerente, e para que a biblioteca inteira mude de
 * paleta editando um arquivo.
 */

export const COLOR = {
  bg: "#05070d",
  ink: "#f2f5f8",
  muted: "#8b97a8",
  accent: "#39d0d8",
  accentWarm: "#f5a524",
  grid: "#12202e",
  surface: "#0c141f",
  surfaceLine: "#1d2c3c",
  danger: "#e5484d",
  good: "#46c26a",
} as const;

export const FONT = {
  display: "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
  body: "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
  mono: "JetBrains Mono, Consolas, ui-monospace, monospace",
} as const;

/**
 * Margem de seguranca. Nada essencial encosta na borda: parte do publico
 * assiste em tela com overscan ou com a interface do player por cima.
 */
export const SAFE = {
  x: 148,
  y: 92,
} as const;

/** Escala tipografica. Numeros fora desta lista destoam na montagem. */
export const TYPE = {
  hero: 96,
  title: 72,
  heading: 48,
  subheading: 34,
  body: 26,
  label: 21,
  caption: 18,
} as const;

/**
 * Paleta sequencial para series de dados. Ordenada: a primeira serie e a que
 * o espectador deve olhar. Nao usar mais de 5 series num grafico de video.
 */
export const SERIES = [
  "#39d0d8",
  "#f5a524",
  "#8b7ff5",
  "#46c26a",
  "#e5484d",
] as const;
