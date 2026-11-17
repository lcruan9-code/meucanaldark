/**
 * Pontos de referencia usados por rotas nomeadas nos roteiros.
 *
 * Em [longitude, latitude], a mesma ordem dos contornos. Escrito a mao, de
 * proposito: o roteiro cita "tokyo", nao um par de numeros, e a lista e curta
 * o bastante para caber na cabeca de quem escreve.
 */

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
