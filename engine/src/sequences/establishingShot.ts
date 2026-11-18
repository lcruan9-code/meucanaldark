/**
 * Establishing shot: mostra o lugar antes de nomea-lo.
 *
 * A gramatica e antiga e funciona: plano geral sem texto, o espectador tem
 * tempo de entender ONDE esta, corte seco para um enquadramento mais fechado,
 * e so entao o titulo entra. Titulo junto com a primeira imagem rouba a
 * leitura do lugar.
 *
 * Dois planos, nao um, porque o corte entre eles e o que cria ritmo. Uma
 * cena so com texto aparecendo no meio e um slide com animacao.
 */

import { z } from "zod";

import { backdrop, layer, push, type RawScene, type SequenceFn } from "./types";

export const establishingShotParams = z.object({
  /** Componente do plano: cena 3D, mapa, circuito. */
  visual: z.string().min(1),
  /** Props do plano aberto. */
  wideProps: z.record(z.string(), z.unknown()).prefault({}),
  /** Props do plano fechado. Ausente = as mesmas do aberto. */
  closeProps: z.record(z.string(), z.unknown()).optional(),
  title: z.string().min(1),
  eyebrow: z.string().default(""),
  subtitle: z.string().default(""),
  wideSeconds: z.number().positive().default(3.5),
  closeSeconds: z.number().positive().default(6.5),
  /** Usa fundo 2D atras do plano. Desligue para cena 3D, que traz o seu. */
  useBackdrop: z.boolean().default(false),
  note: z.string().default(""),
});

export type EstablishingShotParams = z.infer<typeof establishingShotParams>;

export const establishingShot: SequenceFn<EstablishingShotParams> = (
  params,
  id,
): RawScene[] => {
  const {
    visual,
    wideProps,
    closeProps,
    title,
    eyebrow,
    subtitle,
    wideSeconds,
    closeSeconds,
    useBackdrop,
    note,
  } = params;

  const wide: RawScene = {
    id: `${id}-wide`,
    note: note || "Plano geral: o lugar, sem texto. O olho precisa chegar.",
    duration: wideSeconds,
    layers: [
      ...(useBackdrop ? [backdrop()] : []),
      layer(visual, wideProps, {
        track: "background",
        // Push lento e longo: a camera nunca para, mas tambem nao corre.
        camera: push(1, 1.06, 0.5, 0.52),
      }),
    ],
  };

  const close: RawScene = {
    id: `${id}-title`,
    note: "Enquadramento fechado, titulo entra tarde e ancorado embaixo.",
    duration: closeSeconds,
    // Corte seco entre os dois: e o corte que faz o ritmo.
    layers: [
      ...(useBackdrop ? [backdrop({ glowOpacity: 0.18 })] : []),
      layer(visual, closeProps ?? wideProps, {
        track: "background",
        camera: push(1.08, 1.0, 0.42, 0.58),
      }),
      layer(
        "title-card",
        {
          eyebrow,
          title,
          subtitle,
          titleSize: 96,
          align: "left",
        },
        {
          track: "overlay",
          // Entra depois de um terco do plano: o lugar primeiro, o nome
          // depois. E o atraso que faz o titulo pesar.
          from: closeSeconds * 0.34,
          fadeIn: 0.25,
        },
      ),
    ],
  };

  return [wide, close];
};
