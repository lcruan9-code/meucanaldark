/**
 * Abertura cinematografica: titulo que assenta palavra a palavra, regua que
 * se desenha, subtitulo que sobe.
 *
 * O ritmo e o que importa. Palavras entram escalonadas (stagger) com spring
 * amortecido, nunca todas juntas: entrada simultanea e a assinatura visual
 * de template barato.
 */

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

export const titleCardSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().default(""),
  /** Linha fina acima do titulo: capitulo, data, lugar. */
  eyebrow: z.string().default(""),
  align: z.enum(["left", "center"]).default("left"),
  ink: z.string().default("#f2f5f8"),
  muted: z.string().default("#8b97a8"),
  accent: z.string().default("#39d0d8"),
  fontFamily: z.string().default("Inter, system-ui, sans-serif"),
  titleSize: z.number().positive().default(96),
  /** Atraso entre palavras, em quadros. */
  stagger: z.number().min(0).default(3),
});

export type TitleCardProps = z.infer<typeof titleCardSchema>;

export function TitleCard({
  title,
  subtitle,
  eyebrow,
  align,
  ink,
  muted,
  accent,
  fontFamily,
  titleSize,
  stagger,
}: TitleCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = title.split(" ").filter(Boolean);
  const lastWordStart = stagger * Math.max(0, words.length - 1);

  const rule = spring({
    frame: frame - (lastWordStart + 6),
    fps,
    config: { damping: 200, mass: 0.6 },
    durationInFrames: 24,
  });

  const subtitleIn = spring({
    frame: frame - (lastWordStart + 14),
    fps,
    config: { damping: 200, mass: 0.8 },
  });

  const eyebrowIn = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: align === "center" ? "center" : "flex-start",
        padding: "0 148px",
        fontFamily,
        textAlign: align,
      }}
    >
      {eyebrow !== "" && (
        <div
          style={{
            color: accent,
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 22,
            opacity: eyebrowIn,
            transform: `translateY(${interpolate(eyebrowIn, [0, 1], [14, 0])}px)`,
          }}
        >
          {eyebrow}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: `0 ${titleSize * 0.26}px`,
          justifyContent: align === "center" ? "center" : "flex-start",
        }}
      >
        {words.map((word, index) => {
          const enter = spring({
            frame: frame - index * stagger,
            fps,
            config: { damping: 200, mass: 0.9 },
          });
          return (
            <span
              key={`${word}-${index}`}
              style={{
                color: ink,
                fontSize: titleSize,
                fontWeight: 800,
                lineHeight: 1.06,
                letterSpacing: -1.5,
                opacity: enter,
                transform: `translateY(${interpolate(enter, [0, 1], [38, 0])}px)`,
                // blur na entrada: o olho le como foco assentando, nao como
                // elemento aparecendo. Custa pouco e muda muito.
                filter: `blur(${interpolate(enter, [0, 1], [10, 0])}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      <div
        style={{
          height: 3,
          width: interpolate(rule, [0, 1], [0, 220]),
          backgroundColor: accent,
          marginTop: 30,
          borderRadius: 2,
        }}
      />

      {subtitle !== "" && (
        <div
          style={{
            color: muted,
            fontSize: 28,
            fontWeight: 400,
            marginTop: 26,
            maxWidth: 980,
            lineHeight: 1.45,
            opacity: subtitleIn,
            transform: `translateY(${interpolate(subtitleIn, [0, 1], [18, 0])}px)`,
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
}
