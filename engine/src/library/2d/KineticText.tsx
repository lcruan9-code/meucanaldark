/**
 * Tipografia cinetica: texto que entra no ritmo da fala.
 *
 * O que separa isto de "texto com fade" e a palavra-heroi: uma palavra do
 * trecho recebe cor, peso e um tempo proprio. E o recurso que faz o
 * espectador reter um numero ou um nome sem o narrador precisar repetir.
 *
 * Marque a palavra-heroi no texto com asteriscos: "cerca de *99 por cento*
 * do trafego". Sai do roteiro, nao de uma prop separada, porque quem escreve
 * a frase e quem sabe qual palavra carrega o peso.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import { COLOR, FONT, SAFE, TYPE } from "../shared/tokens";
import { presence, reveal, stagger } from "../shared/motion";

export const kineticTextSchema = z.object({
  /** Asteriscos marcam a palavra-heroi: "o *unico* cabo". */
  text: z.string().min(1),
  mode: z.enum(["words", "lines", "single"]).default("words"),
  size: z.number().positive().default(TYPE.heading),
  align: z.enum(["left", "center"]).default("left"),
  position: z.enum(["top", "middle", "bottom"]).default("middle"),
  ink: z.string().default(COLOR.ink),
  accent: z.string().default(COLOR.accent),
  fontFamily: z.string().default(FONT.display),
  weight: z.number().int().min(100).max(900).default(700),
  /** Atraso entre palavras ou linhas, em quadros. */
  stagger: z.number().min(0).default(2.5),
  /** Quadros antes do fim em que o texto comeca a sair. 0 = fica. */
  exitFrames: z.number().min(0).default(0),
  maxWidth: z.number().positive().default(1240),
  /**
   * Desfoque na entrada. O olho le como foco assentando, nao como elemento
   * aparecendo. Custa rasterizacao: 0 desliga.
   */
  blurIn: z.number().min(0).default(8),
});

export type KineticTextProps = z.infer<typeof kineticTextSchema>;

type Token = { text: string; hero: boolean };

/** Quebra o texto preservando as marcas de heroi. */
function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const chunk of text.split(/(\*[^*]+\*)/g)) {
    if (chunk === "") continue;
    const hero = chunk.startsWith("*") && chunk.endsWith("*") && chunk.length > 2;
    const body = hero ? chunk.slice(1, -1) : chunk;
    for (const word of body.split(/\s+/).filter(Boolean)) {
      out.push({ text: word, hero });
    }
  }
  return out;
}

const JUSTIFY = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
} as const;

export function KineticText({
  text,
  mode,
  size,
  align,
  position,
  ink,
  accent,
  fontFamily,
  weight,
  stagger: perItem,
  exitFrames,
  maxWidth,
  blurIn,
}: KineticTextProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const groupPresence = presence(frame, fps, durationInFrames, { exitFrames });

  // `single` e `lines` animam blocos; `words` anima cada palavra.
  const units: Token[][] =
    mode === "single"
      ? [tokenize(text)]
      : mode === "lines"
        ? text.split("\n").map((line) => tokenize(line))
        : tokenize(text).map((token) => [token]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: JUSTIFY[position],
        alignItems: align === "center" ? "center" : "flex-start",
        padding: `${SAFE.y}px ${SAFE.x}px`,
        fontFamily,
        opacity: groupPresence,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: `${size * 0.22}px ${size * 0.26}px`,
          justifyContent: align === "center" ? "center" : "flex-start",
          maxWidth,
          textAlign: align,
        }}
      >
        {units.map((unit, index) => {
          const enter = reveal(frame, fps, { delay: stagger(index, perItem) });
          const translate = interpolate(enter, [0, 1], [26, 0]);
          const blur = blurIn > 0 ? interpolate(enter, [0, 1], [blurIn, 0]) : 0;

          return (
            <span
              key={`unit-${index}`}
              style={{
                display: "inline-flex",
                gap: `${size * 0.26}px`,
                opacity: enter,
                transform: `translateY(${translate}px)`,
                filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
                willChange: "transform, opacity",
              }}
            >
              {unit.map((token, tokenIndex) => (
                <span
                  key={`t-${tokenIndex}`}
                  style={{
                    color: token.hero ? accent : ink,
                    fontSize: size,
                    fontWeight: token.hero ? Math.min(900, weight + 100) : weight,
                    lineHeight: 1.12,
                    letterSpacing: size > 60 ? -1.4 : -0.4,
                  }}
                >
                  {token.text}
                </span>
              ))}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
