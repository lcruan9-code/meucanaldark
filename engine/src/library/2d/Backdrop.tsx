/**
 * Fundo de cena. Quase todo plano 2D comeca com ele.
 *
 * Existe para resolver o defeito que faz video automatico parecer slide:
 * quadro chapado. A V2 trabalha a escada de valor — o diagnostico da direcao
 * de arte apontou que tinhamos dois degraus (fundo quase preto, texto quase
 * branco) e nada no meio, o que da figura recortada sobre fundo, nao
 * profundidade.
 *
 * As quatro camadas, do fundo para a frente:
 *   1. base            o degrau `deep`
 *   2. horizonte       degrade de chao, ancora o quadro e dá "em pe"
 *   3. grade + luz     o degrau `edge`, com a chave FORA do centro
 *   4. nevoa           lamina translucida que separa fundo de assunto
 * Mais vinheta por cima de tudo, que fecha as bordas.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import { VALUE } from "../shared/tokens";

export const backdropSchema = z.object({
  bg: z.string().default(VALUE.deep),
  grid: z.string().default("#12202e"),
  /** Cor do halo da luz principal. Vazio desliga. */
  glow: z.string().default("#39d0d8"),
  /**
   * Posicao da chave, em fracao da tela. O padrao e deliberadamente fora do
   * centro: luz centralizada le como tela de aplicativo, nao como fotografia.
   */
  glowX: z.number().min(0).max(1).default(0.26),
  glowY: z.number().min(0).max(1).default(0.3),
  glowOpacity: z.number().min(0).max(1).default(0.26),
  gridSize: z.number().min(0).default(64),
  /** Deriva da grade em px por segundo. Base da paralaxe. */
  driftPerSecond: z.number().default(6),
  vignette: z.number().min(0).max(1).default(0.45),
  /**
   * Lamina de nevoa entre fundo e assunto. E o terceiro degrau de valor e o
   * que mais separa "profundidade" de "chapado". 0 desliga.
   */
  haze: z.number().min(0).max(1).default(0.5),
  hazeColor: z.string().default(VALUE.fog),
  /** Degrade de chao. Ancora o quadro: sem ele, o fundo flutua. */
  horizon: z.number().min(0).max(1).default(0.35),
  /** Onde fica a linha do horizonte, em fracao da altura. */
  horizonY: z.number().min(0).max(1).default(0.72),
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
  haze,
  hazeColor,
  horizon,
  horizonY,
}: BackdropProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const drift = (frame / fps) * driftPerSecond;
  // Mantem o deslocamento dentro de uma celula: numeros grandes perdem
  // precisao e viram tremor depois de alguns minutos de filme.
  const offset = gridSize > 0 ? drift % gridSize : 0;

  const breathe = interpolate(
    Math.sin((frame / fps) * 0.45),
    [-1, 1],
    [0.86, 1.08],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: "hidden" }}>
      {horizon > 0 && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(180deg, transparent ${horizonY * 100 - 28}%, ${VALUE.surface} ${horizonY * 100}%, ${VALUE.void} 100%)`,
            opacity: horizon,
          }}
        />
      )}

      {gridSize > 0 && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${offset}px ${offset * 0.6}px`,
            // Grade some para o fundo: perspectiva barata e eficaz.
            maskImage: `linear-gradient(180deg, transparent 0%, #000 22%, #000 62%, transparent 92%)`,
            opacity: 0.55,
          }}
        />
      )}

      {glow !== "" && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse ${width * 0.55}px ${height * 0.6}px at ${glowX * 100}% ${glowY * 100}%, ${glow} 0%, transparent 60%)`,
            opacity: glowOpacity * breathe,
            mixBlendMode: "screen",
          }}
        />
      )}

      {haze > 0 && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(190deg, ${hazeColor} 0%, transparent 48%)`,
            opacity: haze * 0.22,
          }}
        />
      )}

      {vignette > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse ${width * 0.72}px ${height * 0.78}px at 50% 48%, transparent 38%, ${VALUE.void} 100%)`,
            opacity: vignette,
          }}
        />
      )}
    </AbsoluteFill>
  );
}
