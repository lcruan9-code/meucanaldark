/**
 * Diagrama tecnico anotado: chamadas com linha-guia apontando partes.
 *
 * O fundo e transparente de proposito. O uso que importa num documentario
 * nao e desenhar um diagrama isolado — e anotar o que ja esta na tela,
 * inclusive uma cena 3D. Por isso este componente entra na trilha `overlay`
 * por cima do cabo, do chip ou da foto, e aponta.
 *
 * As chamadas entram uma a uma. Todas juntas, o espectador nao sabe para
 * onde olhar e o narrador perde a sincronia com a imagem.
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import { COLOR, FONT, TYPE } from "../shared/tokens";
import { progressOf, window } from "../shared/motion";

const zPart = z.object({
  /** Ponto apontado, em fracao da tela. */
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  label: z.string().min(1),
  /** Segunda linha: medida, material, funcao. */
  sub: z.string().default(""),
  /** Para que lado a linha-guia sai. */
  side: z.enum(["left", "right", "up", "down"]).default("right"),
  /** Comprimento da guia, em fracao da largura. */
  lead: z.number().min(0.02).max(0.4).default(0.12),
  /** Em que fracao da cena esta chamada aparece. */
  at: z.number().min(0).max(1).default(0),
  color: z.string().optional(),
});

export const diagramSchema = z.object({
  parts: z.array(zPart).min(1).max(10),
  /** Figura de fundo opcional. Vazio = so as chamadas, sobre a cena. */
  figure: z.enum(["none", "frame", "crosshair"]).default("none"),
  ink: z.string().default(COLOR.ink),
  muted: z.string().default(COLOR.muted),
  accent: z.string().default(COLOR.accent),
  panel: z.string().default("rgba(5, 10, 18, 0.72)"),
  fontFamily: z.string().default(FONT.display),
  /** Quanto tempo cada chamada leva para entrar, em fracao da cena. */
  revealWindow: z.number().min(0.02).max(0.5).default(0.1),
});

export type DiagramProps = z.infer<typeof diagramSchema>;

export function Diagram({
  parts,
  figure,
  ink,
  muted,
  accent,
  panel,
  fontFamily,
  revealWindow,
}: DiagramProps) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const progress = progressOf(frame, durationInFrames);

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {figure === "frame" && (
          <rect
            x={width * 0.12}
            y={height * 0.14}
            width={width * 0.76}
            height={height * 0.72}
            fill="none"
            stroke={muted}
            strokeWidth={1}
            strokeDasharray="14 10"
            opacity={0.4}
          />
        )}

        {parts.map((part, index) => {
          const show = window(progress, part.at, Math.min(1, part.at + revealWindow), "out");
          if (show < 0.02) return null;

          const color = part.color ?? accent;
          const px = part.x * width;
          const py = part.y * height;
          const lead = part.lead * width;

          const dx = part.side === "left" ? -lead : part.side === "right" ? lead : 0;
          const dy = part.side === "up" ? -lead : part.side === "down" ? lead : 0;
          const ex = px + dx * show;
          const ey = py + dy * show;

          // Cotovelo: a guia sai reta e dobra. Linha diagonal unica le como
          // seta de apresentacao; a dobra le como desenho tecnico.
          const elbow = part.side === "left" || part.side === "right";
          const bendX = elbow ? ex : px;
          const bendY = elbow ? py : ey;
          const tailLen = 46 * show;
          const tx = elbow ? ex + (dx > 0 ? tailLen : -tailLen) : ex;
          const ty = elbow ? ey : ey + (dy > 0 ? tailLen : -tailLen);

          return (
            <g key={`part${index}`} opacity={show}>
              <circle cx={px} cy={py} r={5} fill={color} />
              <circle cx={px} cy={py} r={13 * show} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
              <path
                d={`M${px},${py} L${bendX},${bendY} L${tx},${ty}`}
                fill="none"
                stroke={color}
                strokeWidth={1.6}
              />
            </g>
          );
        })}
      </svg>

      {parts.map((part, index) => {
        const show = window(progress, part.at, Math.min(1, part.at + revealWindow), "out");
        if (show < 0.05) return null;

        const px = part.x * width;
        const py = part.y * height;
        const lead = part.lead * width;
        const color = part.color ?? accent;

        const anchorRight = part.side === "right";
        const anchorLeft = part.side === "left";
        const left =
          anchorRight ? px + lead + 54 : anchorLeft ? undefined : px;
        const right = anchorLeft ? width - (px - lead - 54) : undefined;
        const top =
          part.side === "up" ? py - lead - 70 : part.side === "down" ? py + lead + 24 : py - 30;

        return (
          <div
            key={`label${index}`}
            style={{
              position: "absolute",
              left,
              right,
              top,
              maxWidth: 360,
              padding: "12px 18px",
              backgroundColor: panel,
              borderLeft: `3px solid ${color}`,
              borderRadius: 3,
              opacity: show,
              transform: `translateX(${(1 - show) * (anchorLeft ? 14 : -14)}px)`,
            }}
          >
            <div style={{ color: ink, fontSize: TYPE.label, fontWeight: 700, lineHeight: 1.25 }}>
              {part.label}
            </div>
            {part.sub !== "" && (
              <div style={{ color: muted, fontSize: 17, marginTop: 4, lineHeight: 1.35 }}>
                {part.sub}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
