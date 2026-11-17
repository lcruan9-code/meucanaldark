/**
 * Serie temporal que se desenha.
 *
 * O ponto que viaja na ponta da linha e o que prende o olho: sem ele, o
 * espectador le um grafico pronto e segue; com ele, acompanha a construcao,
 * que e o tempo de que o narrador precisa.
 *
 * O desenho usa `stroke-dasharray`, e nao mascara animada: e barato e e
 * exato. Mascara obriga o Chromium a recompor a camada inteira por quadro, e
 * a medicao da Etapa 1 mostrou que e por ai que o 2D fica caro.
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import { z } from "zod";

import { COLOR, FONT, SAFE, SERIES, TYPE } from "../shared/tokens";
import { progressOf, window } from "../shared/motion";

const zSeries = z.object({
  label: z.string().default(""),
  /** Pontos [x, y] em unidades de dado, nao de tela. */
  points: z.array(z.tuple([z.number(), z.number()])).min(2),
  color: z.string().optional(),
  /** Preenche a area sob a linha. Use em uma serie so. */
  area: z.boolean().default(false),
  dashed: z.boolean().default(false),
});

const zMarker = z.object({
  x: z.number(),
  label: z.string().min(1),
  /** Em que fracao da cena o marcador aparece. */
  at: z.number().min(0).max(1).default(0.6),
});

export const lineChartSchema = z.object({
  series: z.array(zSeries).min(1).max(5),
  title: z.string().default(""),
  xLabel: z.string().default(""),
  yLabel: z.string().default(""),
  locale: z.string().default("en-US"),
  /** Limites. Ausentes = calculados dos dados com folga. */
  xMin: z.number().optional(),
  xMax: z.number().optional(),
  yMin: z.number().optional(),
  yMax: z.number().optional(),
  /** Linhas verticais anotadas: um evento no tempo. */
  markers: z.array(zMarker).default([]),
  ink: z.string().default(COLOR.ink),
  muted: z.string().default(COLOR.muted),
  grid: z.string().default(COLOR.surfaceLine),
  fontFamily: z.string().default(FONT.display),
  monoFamily: z.string().default(FONT.mono),
  /** Fracao da cena gasta desenhando. */
  drawWindow: z.number().min(0.05).max(1).default(0.62),
  gridLines: z.number().int().min(0).max(10).default(4),
  /**
   * Marcacoes do eixo X. Serie temporal sem ano no eixo obriga o espectador
   * a confiar na narracao para saber de quando e o dado.
   */
  xTicks: z.number().int().min(0).max(12).default(5),
  /** Casas decimais nas marcacoes do eixo X. Ano quer 0. */
  xDecimals: z.number().int().min(0).max(3).default(0),
});

export type LineChartProps = z.infer<typeof lineChartSchema>;

const PAD = { left: 96, right: 72, top: 36, bottom: 76 };

export function LineChart({
  series,
  title,
  xLabel,
  yLabel,
  locale,
  xMin,
  xMax,
  yMin,
  yMax,
  markers,
  ink,
  muted,
  grid,
  fontFamily,
  monoFamily,
  drawWindow,
  gridLines,
  xTicks,
  xDecimals,
}: LineChartProps) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const progress = progressOf(frame, durationInFrames);
  const draw = window(progress, 0, drawWindow, "inOut");

  const plotW = width - SAFE.x * 2 - PAD.left - PAD.right;
  const plotH = height - SAFE.y * 2 - PAD.top - PAD.bottom - (title ? 70 : 0);

  const bounds = useMemo(() => {
    const xs = series.flatMap((s) => s.points.map((p) => p[0]));
    const ys = series.flatMap((s) => s.points.map((p) => p[1]));
    const rawYMin = yMin ?? Math.min(...ys);
    const rawYMax = yMax ?? Math.max(...ys);
    // Folga no topo: linha encostando na borda le como dado cortado.
    const span = rawYMax - rawYMin || 1;
    return {
      x0: xMin ?? Math.min(...xs),
      x1: xMax ?? Math.max(...xs),
      y0: rawYMin,
      y1: yMax ?? rawYMax + span * 0.1,
    };
  }, [series, xMin, xMax, yMin, yMax]);

  const toX = (x: number) =>
    ((x - bounds.x0) / (bounds.x1 - bounds.x0 || 1)) * plotW;
  const toY = (y: number) =>
    plotH - ((y - bounds.y0) / (bounds.y1 - bounds.y0 || 1)) * plotH;

  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  return (
    <AbsoluteFill style={{ padding: `${SAFE.y}px ${SAFE.x}px`, fontFamily }}>
      {title !== "" && (
        <div
          style={{ color: ink, fontSize: TYPE.subheading, fontWeight: 700, marginBottom: 26 }}
        >
          {title}
        </div>
      )}

      <svg width={plotW + PAD.left + PAD.right} height={plotH + PAD.top + PAD.bottom}>
        <g transform={`translate(${PAD.left}, ${PAD.top})`}>
          {Array.from({ length: gridLines + 1 }, (_, i) => {
            const t = i / Math.max(1, gridLines);
            const y = plotH * t;
            const value = bounds.y1 - (bounds.y1 - bounds.y0) * t;
            return (
              <g key={`g${i}`}>
                <line x1={0} y1={y} x2={plotW} y2={y} stroke={grid} strokeWidth={1} />
                <text
                  x={-16}
                  y={y + 6}
                  fill={muted}
                  fontSize={TYPE.caption}
                  fontFamily={monoFamily}
                  textAnchor="end"
                >
                  {format.format(value)}
                </text>
              </g>
            );
          })}

          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke={muted} strokeWidth={1.5} />

          {xTicks > 0 &&
            Array.from({ length: xTicks }, (_, i) => {
              const t = xTicks === 1 ? 0 : i / (xTicks - 1);
              const value = bounds.x0 + (bounds.x1 - bounds.x0) * t;
              const x = plotW * t;
              return (
                <g key={`xt${i}`}>
                  <line x1={x} y1={plotH} x2={x} y2={plotH + 8} stroke={muted} strokeWidth={1} />
                  <text
                    x={x}
                    y={plotH + 30}
                    fill={muted}
                    fontSize={TYPE.caption}
                    fontFamily={monoFamily}
                    textAnchor={i === 0 ? "start" : i === xTicks - 1 ? "end" : "middle"}
                  >
                    {new Intl.NumberFormat(locale, {
                      minimumFractionDigits: xDecimals,
                      maximumFractionDigits: xDecimals,
                      useGrouping: xDecimals === 0 && Math.abs(value) < 10000 ? false : undefined,
                    }).format(value)}
                  </text>
                </g>
              );
            })}

          {series.map((s, index) => {
            const color = s.color ?? SERIES[index % SERIES.length];
            const path = s.points
              .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p[0]).toFixed(1)},${toY(p[1]).toFixed(1)}`)
              .join(" ");

            // Comprimento aproximado por soma dos segmentos: exato o
            // bastante para o traco e sem medir no DOM.
            let length = 0;
            for (let i = 1; i < s.points.length; i += 1) {
              const a = s.points[i - 1];
              const b = s.points[i];
              if (!a || !b) continue;
              length += Math.hypot(toX(b[0]) - toX(a[0]), toY(b[1]) - toY(a[1]));
            }

            const headIndex = Math.min(
              s.points.length - 1,
              Math.floor(draw * (s.points.length - 1)),
            );
            const head = s.points[headIndex];

            return (
              <g key={`s${index}`}>
                {s.area && (
                  <path
                    d={`${path} L${toX(s.points[s.points.length - 1]?.[0] ?? 0).toFixed(1)},${plotH} L${toX(s.points[0]?.[0] ?? 0).toFixed(1)},${plotH} Z`}
                    fill={color}
                    opacity={0.18 * draw}
                  />
                )}
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={s.dashed ? "10 8" : length}
                  strokeDashoffset={s.dashed ? 0 : length * (1 - draw)}
                  opacity={s.dashed ? draw : 1}
                />
                {head && draw > 0.02 && draw < 0.995 && (
                  <circle cx={toX(head[0])} cy={toY(head[1])} r={6} fill={color} />
                )}
                {s.label !== "" && draw > 0.9 && (
                  // Ancorado no fim e acima da linha: fora, o rotulo corta
                  // na borda do SVG, que foi o que a conferencia da vitrine
                  // pegou na primeira rodada.
                  <text
                    x={toX(s.points[s.points.length - 1]?.[0] ?? 0) - 8}
                    y={toY(s.points[s.points.length - 1]?.[1] ?? 0) - 16}
                    fill={color}
                    fontSize={TYPE.caption}
                    fontWeight={700}
                    textAnchor="end"
                  >
                    {s.label}
                  </text>
                )}
              </g>
            );
          })}

          {markers.map((marker, index) => {
            const show = window(progress, marker.at, Math.min(1, marker.at + 0.08));
            if (show < 0.02) return null;
            const x = toX(marker.x);
            return (
              <g key={`m${index}`} opacity={show}>
                <line x1={x} y1={0} x2={x} y2={plotH} stroke={muted} strokeWidth={1} strokeDasharray="5 6" />
                <text x={x + 10} y={16} fill={muted} fontSize={TYPE.caption} fontWeight={600}>
                  {marker.label}
                </text>
              </g>
            );
          })}

          {yLabel !== "" && (
            <text
              x={-PAD.left + 18}
              y={-12}
              fill={muted}
              fontSize={TYPE.caption}
              fontWeight={600}
            >
              {yLabel}
            </text>
          )}
          {xLabel !== "" && (
            <text
              x={plotW}
              y={plotH + 44}
              fill={muted}
              fontSize={TYPE.caption}
              fontWeight={600}
              textAnchor="end"
            >
              {xLabel}
            </text>
          )}
        </g>
      </svg>
    </AbsoluteFill>
  );
}
