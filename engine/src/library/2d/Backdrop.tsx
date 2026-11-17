/**
 * Fundo de cena. Quase toda cena 2D comeca com ele.
 *
 * Existe para resolver o problema que faz video automatico parecer slide:
 * fundo chapado. Aqui ha gradiente radial deslocado do centro, grade tecnica
 * com deriva lenta, vinheta e grao. Nada disso chama atencao sozinho; o
 * conjunto e o que da a impressao de profundidade.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

export const backdropSchema = z.object({
  /** Cor do fundo. Padrao: puxa do tema. */
  bg: z.string().default("#05070d"),
  grid: z.string().default("#12202e"),
  /** Cor do halo. Vazio desliga o halo. */
  glow: z.string().default("#39d0d8"),
  /** Posicao do halo em fracao da tela. */
  glowX: z.number().min(0).max(1).default(0.32),
  glowY: z.number().min(0).max(1).default(0.38),
  glowOpacity: z.number().min(0).max(1).default(0.22),
  /** Lado da celula da grade em px. 0 desliga. */
  gridSize: z.number().min(0).default(64),
  /** Deriva da grade em px por segundo. Movimento lento e proposital. */
  driftPerSecond: z.number().default(6),
  vignette: z.number().min(0).max(1).default(0.35),
});

export type BackdropProps = z.infer<typeof backdropSchema>;

export function Backdrop({
  bg,
  grid,
  glow,
  glowX,
  glowY,
  glowOpacity,
  gridSize,
  driftPerSecond,
  vignette,
}: BackdropProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const drift = (frame / fps) * driftPerSecond;
  // Mantem o deslocamento dentro de uma celula: evita numeros grandes e a
  // perda de precisao que aparece como tremor depois de alguns minutos.
  const offset = gridSize > 0 ? drift % gridSize : 0;

  const breathe = interpolate(
    Math.sin((frame / fps) * 0.45),
    [-1, 1],
    [0.86, 1.08],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: "hidden" }}>
      {gridSize > 0 && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${offset}px ${offset * 0.6}px`,
            opacity: 0.5,
          }}
        />
      )}

      {glow !== "" && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${glowX * 100}% ${glowY * 100}%, ${glow} 0%, transparent 55%)`,
            opacity: glowOpacity * breathe,
            mixBlendMode: "screen",
          }}
        />
      )}

      {vignette > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse ${width * 0.75}px ${height * 0.8}px at 50% 50%, transparent 40%, rgba(0,0,0,${vignette}) 100%)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
}
