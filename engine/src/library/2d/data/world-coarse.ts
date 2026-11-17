/**
 * Contornos continentais grosseiros, em [longitude, latitude].
 *
 * ESTE E UM MARCO DE ETAPA 1, NAO O DADO FINAL. Serve para provar a projecao,
 * o enquadramento e a animacao de rotas. A Etapa 2 troca por Natural Earth
 * 110m (dominio publico) convertido para o mesmo formato, e nenhum roteiro
 * precisa mudar: a troca e interna ao componente.
 */

export type Ring = ReadonlyArray<readonly [number, number]>;

export const WORLD_COARSE: ReadonlyArray<Ring> = [
  // America do Norte
  [
    [-168, 66], [-158, 71], [-130, 70], [-95, 74], [-80, 73], [-61, 60],
    [-56, 51], [-66, 45], [-70, 42], [-75, 35], [-81, 25], [-97, 26],
    [-105, 20], [-115, 29], [-124, 40], [-130, 54], [-141, 60], [-168, 66],
  ],
  // America do Sul
  [
    [-81, 8], [-70, 11], [-60, 10], [-51, 0], [-44, -2], [-35, -6],
    [-38, -13], [-48, -25], [-54, -34], [-62, -40], [-66, -50], [-71, -55],
    [-75, -45], [-73, -30], [-71, -18], [-77, -6], [-81, 8],
  ],
  // Africa
  [
    [-17, 15], [-6, 36], [10, 37], [25, 32], [34, 31], [43, 12],
    [51, 12], [41, -2], [40, -15], [35, -24], [20, -35], [18, -30],
    [12, -16], [9, -1], [5, 5], [-8, 5], [-17, 15],
  ],
  // Eurasia
  [
    [-10, 36], [0, 44], [12, 45], [30, 40], [45, 40], [60, 45],
    [80, 45], [100, 40], [120, 38], [127, 35], [122, 30], [110, 20],
    [100, 13], [92, 21], [80, 8], [72, 22], [60, 25], [48, 30],
    [36, 36], [28, 41], [30, 55], [40, 68], [60, 70], [80, 73],
    [105, 77], [140, 72], [170, 68], [160, 60], [135, 55], [130, 43],
    [110, 50], [85, 50], [60, 55], [30, 60], [20, 55], [10, 55],
    [-5, 48], [-10, 36],
  ],
  // Australia
  [
    [113, -22], [122, -17], [131, -12], [142, -11], [146, -19], [153, -25],
    [150, -35], [141, -38], [129, -32], [118, -34], [114, -28], [113, -22],
  ],
];

/** Pontos de referencia usados por rotas nomeadas nos roteiros. */
export const LANDMARKS: Readonly<Record<string, readonly [number, number]>> = {
  "new-york": [-74.0, 40.7],
  london: [-0.13, 51.5],
  lisbon: [-9.14, 38.7],
  fortaleza: [-38.5, -3.7],
  "cape-town": [18.4, -33.9],
  mumbai: [72.9, 19.1],
  singapore: [103.8, 1.35],
  tokyo: [139.7, 35.7],
  sydney: [151.2, -33.9],
  marseille: [5.37, 43.3],
  alexandria: [29.9, 31.2],
  "los-angeles": [-118.2, 34.1],
};
