/**
 * Destaque: uma frase curta que entra por cima de qualquer cena e sai.
 *
 * Serve ao momento em que o narrador diz algo que o espectador precisa ler,
 * nao so ouvir — um numero, um nome proprio, uma data. Por isso tem saida
 * propria e duracao curta: destaque que fica vira legenda, e legenda
 * concorre com a narracao.
 *
 * `rule` desenha uma regua que cresce junto. E o detalhe que separa um
 * destaque de um texto solto na tela.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import { COLOR, FONT, SAFE, TYPE } from "../shared/tokens";
import { presence, reveal } from "../shared/motion";

export const calloutSchema = z.object({
  text: z.string().min(1),
  /** Linha fina acima: "fato", "1986", "segundo a Lloyd's". */
  kicker: z.string().default(""),
  tone: z.enum(["neutral", "accent", "warning"]).default("accent"),
  position: z
    .enum(["top-left", "top-right", "center", "bottom-left", "bottom-right"])
    .default("bottom-left"),
  size: z.number().positive().default(TYPE.subheading),
  ink: z.string().default(COLOR.ink),
  muted: z.string().default(COLOR.muted),
  accent: z.string().default(COLOR.accent),
  warning: z.string().default(COLOR.accentWarm),
  panel: z.string().default("rgba(5, 10, 18, 0.78)"),
  fontFamily: z.string().default(FONT.display),
  rule: z.boolean().default(true),
  /** Quadros antes do fim em que comeca a sair. */
  exitFrames: z.number().min(0).default(14),
  maxWidth: z.number().positive().default(680),
});

export type CalloutProps = z.infer<typeof calloutSchema>;

const PLACE = {
  "top-left": { justifyContent: "flex-start", alignItems: "flex-start" },
  "top-right": { justifyContent: "flex-start", alignItems: "flex-end" },
  center: { justifyContent: "center", alignItems: "center" },
  "bottom-left": { justifyContent: "flex-end", alignItems: "flex-start" },
  "bottom-right": { justifyContent: "flex-end", alignItems: "flex-end" },
} as const;

export function Callout({
  text,
  kicker,
  tone,
  position,
  size,
  ink,
  muted,
  accent,
  warning,
  panel,
  fontFamily,
  rule,
  exitFrames,
  maxWidth,
}: CalloutProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const alive = presence(frame, fps, durationInFrames, { exitFrames });
  const ruleIn = reveal(frame, fps, { delay: 5, spring: "light" });
  const color = tone === "warning" ? warning : tone === "accent" ? accent : muted;

  return (
    <AbsoluteFill
      style={{
        ...PLACE[position],
        padding: `${SAFE.y}px ${SAFE.x}px`,
        fontFamily,
        opacity: alive,
      }}
    >
      <div
        style={{
          maxWidth,
          padding: "22px 30px",
          backgroundColor: panel,
          borderRadius: 4,
          transform: `translateY(${interpolate(alive, [0, 1], [18, 0])}px)`,
        }}
      >
        {kicker !== "" && (
          <div
            style={{
              color,
              fontSize: TYPE.caption,
              fontWeight: 700,
              letterSpacing: 5,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {kicker}
          </div>
        )}

        <div style={{ color: ink, fontSize: size, fontWeight: 700, lineHeight: 1.26 }}>
          {text}
        </div>

        {rule && (
          <div
            style={{
              height: 3,
              width: interpolate(ruleIn, [0, 1], [0, 92]),
              backgroundColor: color,
              marginTop: 16,
              borderRadius: 2,
            }}
          />
        )}
      </div>
    </AbsoluteFill>
  );
}
