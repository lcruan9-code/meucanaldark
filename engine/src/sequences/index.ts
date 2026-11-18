/**
 * Registro e expansor de sequencias.
 *
 * O expansor roda ANTES da validacao zod do projeto. Ele troca cada entrada
 * `{ "sequence": "...", "params": {...} }` da lista de cenas pelas cenas que
 * a sequencia emite. Dai em diante nada no motor sabe que sequencias
 * existem: o contrato, o registro, as trilhas e o cache continuam iguais.
 *
 * Consequencia pratica boa: a saida de uma sequencia e sempre inspecionavel
 * como cena comum, e da para misturar cena escrita a mao com sequencia no
 * mesmo roteiro.
 */

import type { ZodType } from "zod";

import {
  consequenceImpact,
  consequenceImpactParams,
} from "./consequenceImpact";
import { dataStorytelling, dataStorytellingParams } from "./dataStorytelling";
import { establishingShot, establishingShotParams } from "./establishingShot";
import {
  systemVisualization,
  systemVisualizationParams,
} from "./systemVisualization";
import { technicalReveal, technicalRevealParams } from "./technicalReveal";
import { getEntry } from "../library/registry";
import type { RawScene, SequenceFn } from "./types";

interface SequenceEntry {
  // A funcao e o schema sao sempre do mesmo par; o `never` existe so para
  // nao espalhar generico por todo o registro.
  fn: SequenceFn<never>;
  schema: ZodType;
  description: string;
}

export const SEQUENCES: Readonly<Record<string, SequenceEntry>> = {
  "establishing-shot": {
    fn: establishingShot as SequenceFn<never>,
    schema: establishingShotParams,
    description:
      "Plano geral sem texto, corte, enquadramento fechado e titulo entrando tarde.",
  },
  "technical-reveal": {
    fn: technicalReveal as SequenceFn<never>,
    schema: technicalRevealParams,
    description:
      "Chegada ao objeto, depois as partes nomeadas uma a uma, com respiro no fim.",
  },
  "system-visualization": {
    fn: systemVisualization as SequenceFn<never>,
    schema: systemVisualizationParams,
    description:
      "O sistema se monta num plano; no seguinte, os pulsos o atravessam.",
  },
  "data-storytelling": {
    fn: dataStorytelling as SequenceFn<never>,
    schema: dataStorytellingParams,
    description: "Numero sozinho, depois o grafico que o sustenta, depois a consequencia.",
  },
  "consequence-impact": {
    fn: consequenceImpact as SequenceFn<never>,
    schema: consequenceImpactParams,
    description: "Frase sustentada com pouca coisa no quadro, respiro e escuro.",
  },
};

export type SequenceKey = keyof typeof SEQUENCES;

function isSequenceRef(value: unknown): value is { sequence: string; params?: unknown; id?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { sequence?: unknown }).sequence === "string"
  );
}

/**
 * Troca referencias de sequencia pelas cenas que elas emitem.
 *
 * Recebe e devolve o projeto cru, antes do zod. Projeto sem sequencia
 * nenhuma passa por aqui sem alteracao.
 */
/**
 * Confere as props que a sequencia emitiu contra o schema de cada componente.
 *
 * Sem isto, um erro de sequencia so aparece quando o quadro daquela cena e
 * renderizado — e num documentario de dez minutos isso pode ser tres minutos
 * de render depois. Aconteceu de verdade: uma sequencia emitia `callout` com
 * texto vazio e o render morria em 82%.
 *
 * Aqui o erro sai no instante do empacotamento, com o nome da sequencia, da
 * cena e do componente.
 */
function assertLayersValid(scene: RawScene, sequenceName: string): void {
  const layers = scene.layers;
  if (!Array.isArray(layers)) return;

  for (const item of layers) {
    if (typeof item !== "object" || item === null) continue;
    const { component, props } = item as { component?: unknown; props?: unknown };
    if (typeof component !== "string") continue;

    const result = getEntry(component).schema.safeParse(props ?? {});
    if (result.success) continue;

    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `sequencia "${sequenceName}" emitiu camada invalida na cena ` +
        `"${String(scene.id)}" — componente "${component}": ${detail}`,
    );
  }
}

export function expandSequences(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;

  const project = raw as { scenes?: unknown };
  if (!Array.isArray(project.scenes)) return raw;

  const expanded: unknown[] = [];

  project.scenes.forEach((entry, index) => {
    if (!isSequenceRef(entry)) {
      expanded.push(entry);
      return;
    }

    const found = SEQUENCES[entry.sequence];
    if (!found) {
      const known = Object.keys(SEQUENCES).sort().join(", ");
      throw new Error(
        `sequencia "${entry.sequence}" nao existe. Disponiveis: ${known}`,
      );
    }

    // Id estavel: e o que mantem o cache de render por cena valido entre
    // execucoes. Derivar do indice da lista seria fragil — inserir uma cena
    // no meio renomearia todas as seguintes e invalidaria o cache inteiro.
    const id = entry.id ?? `${entry.sequence}-${index}`;
    const params = found.schema.parse(entry.params ?? {});
    const scenes = found.fn(params as never, id) as RawScene[];

    for (const scene of scenes) {
      assertLayersValid(scene, entry.sequence);
      expanded.push(scene);
    }
  });

  return { ...raw, scenes: expanded };
}
