/**
 * Projetos disponiveis para o Studio e para o render.
 *
 * Um projeto e um par: o JSON do documentario e o mapa de duracoes de
 * narracao medidas (`npm run narration`). Separar os dois e proposital — o
 * roteiro e escrito por humano e versionado; as duracoes sao derivadas dos
 * arquivos de audio e podem ser regeradas a qualquer momento.
 *
 * Para adicionar um documentario: crie `projects/<id>/project.json` e
 * acrescente duas linhas aqui.
 */

import type { NarrationDurations } from "./engine/timeline";

import hiddenCables from "../projects/hidden-cables/project.json";
import hiddenCablesDurations from "../projects/hidden-cables/durations.json";

export type ProjectEntry = {
  raw: unknown;
  durations: NarrationDurations;
};

export const PROJECTS: readonly ProjectEntry[] = [
  { raw: hiddenCables, durations: hiddenCablesDurations as NarrationDurations },
];
