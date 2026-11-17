/**
 * Tarja inferior: nome, cargo, fonte, local.
 *
 * Num documentario a tarja e o que separa afirmacao de fato: e onde a fonte
 * aparece. Entra e sai sozinha, com tempo proprio, para poder ser colocada
 * sobre qualquer cena sem o roteirista calcular quadros.
 */

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

export const lowerThirdSchema = z.object({
  primary: z.string().min(1),
  secondary: z.string().default(""),
  side: z.enum(["left", "right"]).default("left"),
  accent: z.string().default("#39d0d8"),
  ink: z.string().default("#f2f5f8"),
  muted: z.string().default("#8b97a8"),
  panel: z.string().default("rgba(5, 10, 18, 0.82)"),
  fontFamily: z.string().default("Inter, system-ui, sans-serif"),
  /** Distancia do rodape em px. */
  bottom: z.number().default(120),
  /** Quadros antes do fim em que a tarja comeca a sair. */
  exitFrames: z.number().min(0).default(18),
});

export type LowerThirdProps = z.infer<typeof lowerThirdSchema>;

export function LowerThird({
  primary,
  secondary,
  side,
  accent,
  ink,
  muted,
  panel,
  fontFamily,
  bottom,
  exitFrames,
}: LowerThirdProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });
  const exit = spring({
    frame: frame - (durationInFrames - exitFrames),
    fps,
    config: { damping: 200, mass: 0.7 },
  });

  const presence = enter - exit;
  const slide = interpolate(presence, [0, 1], [side === "left" ? -70 : 70, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: side === "left" ? "flex-start" : "flex-end",
        padding: `0 148px ${bottom}px`,
        fontFamily,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 18,
          padding: "18px 30px 18px 22px",
          backgroundColor: panel,
          backdropFilter: "blur(10px)",
          borderRadius: 4,
          opacity: Math.max(0, presence),
          transform: `translateX(${slide}px)`,
        }}
      >
        <div style={{ width: 4, backgroundColor: accent, borderRadius: 2 }} />
        <div>
          <div style={{ color: ink, fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>
            {primary}
          </div>
          {secondary !== "" && (
            <div
              style={{
                color: muted,
                fontSize: 21,
                fontWeight: 500,
                marginTop: 5,
                letterSpacing: 0.3,
              }}
            >
              {secondary}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}
