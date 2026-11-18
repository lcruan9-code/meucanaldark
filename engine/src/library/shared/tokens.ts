/**
 * Valores padrao da identidade visual.
 *
 * Todo componente aceita cor e fonte por prop; estes sao os valores quando a
 * prop nao vem. Existem para que um roteiro curto — sem tema declarado —
 * ainda produza imagem coerente, e para que a biblioteca inteira mude de
 * paleta editando um arquivo.
 */

/**
 * Escada de valor: CINCO degraus, nao dois.
 *
 * O diagnostico da direcao de arte V2 apontou isto como a maior alavanca do
 * 2D. Com fundo quase preto e texto quase branco e nada no meio, nao ha
 * profundidade — ha figura recortada sobre fundo. A regra que vale para toda
 * cena: pelo menos TRES destes cinco degraus visiveis no mesmo quadro.
 */
export const VALUE = {
  /** Mais escuro que o fundo. Vinheta, sombra, corte para preto. */
  void: "#03060b",
  /** O fundo. */
  deep: "#070d16",
  /** Painel, cartao, plano de apoio. */
  surface: "#0e1824",
  /** Borda, grade, separador. */
  edge: "#1d2c3c",
  /** Nevoa, elemento distante, texto de apoio sobre fundo. */
  fog: "#3a4a5c",
} as const;

export const COLOR = {
  bg: VALUE.deep,
  ink: "#f2f5f8",
  muted: "#8b97a8",
  /** Frio: o sistema, a maquina, o dado. */
  accent: "#39d0d8",
  /** Quente: a pessoa, a consequencia, o alarme. Nunca saturado junto. */
  accentWarm: "#f5a524",
  grid: "#12202e",
  surface: VALUE.surface,
  surfaceLine: VALUE.edge,
  fog: VALUE.fog,
  void: VALUE.void,
  danger: "#e5484d",
  good: "#46c26a",
} as const;

export const FONT = {
  display: "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
  body: "Inter, system-ui, -apple-system, Segoe UI, sans-serif",
  mono: "JetBrains Mono, Consolas, ui-monospace, monospace",
} as const;

/**
 * Margem de seguranca. Nada ESSENCIAL encosta na borda.
 *
 * Atencao: isto NAO e margem de composicao. A direcao de arte exige que ao
 * menos um elemento por plano sangre para fora do quadro; o que a area
 * segura protege e texto e numero, nao imagem.
 */
export const SAFE = {
  x: 148,
  y: 92,
} as const;

/**
 * Grade de 12 colunas. Texto ancora em 1-6 ou 7-12, nunca centralizado
 * fora de cartela de titulo.
 */
export const GRID = {
  columns: 12,
  gutter: 96,
  get columnWidth(): number {
    return (1920 - SAFE.x * 2 - this.gutter * 2) / this.columns;
  },
  /** Largura de N colunas, com as goteiras internas. */
  span(n: number): number {
    return this.columnWidth * n + this.gutter * Math.max(0, n - 1) * 0.25;
  },
} as const;

/**
 * Escala tipografica.
 *
 * A V1 tinha hero 96 e corpo 26 — razao de 3,7 para 1, que le como "texto
 * grande" e nao como hierarquia. Cartela de documentario trabalha em 8 ou
 * 10 para 1. `display` existe para isso e deve doer de tao grande.
 */
export const TYPE = {
  display: 232,
  hero: 150,
  title: 96,
  heading: 56,
  subheading: 40,
  body: 26,
  label: 21,
  caption: 18,
} as const;

/** Entreletra por tamanho. Titulo grande fecha; rotulo pequeno abre. */
export function tracking(size: number): number {
  if (size >= 150) return -4;
  if (size >= 90) return -2.4;
  if (size >= 48) return -1.2;
  if (size <= 20) return 1.2;
  return -0.3;
}

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

/**
 * Duracoes de plano, em segundos.
 *
 * Plano de ritmo e curto; plano de explicacao e sustentado. Misturar os dois
 * numa mesma sequencia e o que da sensacao de montagem, em vez de lista.
 */
export const SHOT = {
  beat: 2.5,
  short: 4,
  medium: 6,
  held: 10,
  long: 14,
} as const;
