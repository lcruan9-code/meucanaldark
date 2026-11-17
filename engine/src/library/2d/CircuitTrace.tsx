/**
 * Trilhas de circuito com sinais correndo.
 *
 * O traçado e gerado a partir de uma semente, nao desenhado a mao: um canal
 * de tecnologia precisa de dezenas destes planos e nenhum espectador compara
 * dois. O que nao pode e mudar entre quadros — por isso o gerador e um PRNG
 * com semente fixa, e nunca `Math.random()`.
 *
 * As trilhas seguem angulos de 45 e 90 graus, como placa de verdade. Curva
 * livre le como enfeite; o cotovelo le como engenharia.
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import { z } from "zod";

import { COLOR, FONT, TYPE } from "../shared/tokens";
import { progressOf, window } from "../shared/motion";

export const circuitTraceSchema = z.object({
  /** Mesma semente = mesmo tracado, sempre. */
  seed: z.number().int().default(7),
  traces: z.number().int().min(2).max(40).default(14),
  /** Pontos de solda nas pontas. */
  pads: z.boolean().default(true),
  direction: z.enum(["horizontal", "vertical", "radial"]).default("horizontal"),
  line: z.string().default(COLOR.surfaceLine),
  accent: z.string().default(COLOR.accent),
  pad: z.string().default(COLOR.accentWarm),
  ink: z.string().default(COLOR.ink),
  fontFamily: z.string().default(FONT.mono),
  label: z.string().default(""),
  /** Sinais correndo por trilha. */
  pulses: z.number().int().min(0).max(4).default(1),
  pulseSpeed: z.number().positive().default(0.35),
  strokeWidth: z.number().positive().default(2),
  /** Fracao da cena gasta desenhando as trilhas. */
  drawWindow: z.number().min(0.05).max(1).default(0.45),
});

export type CircuitTraceProps = z.infer<typeof circuitTraceSchema>;

/** PRNG determinista. Mesma semente, mesma sequencia, em qualquer quadro. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Trace = { d: string; length: number; start: [number, number]; end: [number, number] };

function buildTraces(
  seed: number,
  count: number,
  width: number,
  height: number,
  direction: CircuitTraceProps["direction"],
): Trace[] {
  const random = mulberry32(seed);
  const out: Trace[] = [];

  for (let i = 0; i < count; i += 1) {
    const lane = (i + 0.5) / count;
    const points: Array<[number, number]> = [];

    if (direction === "radial") {
      const angle = lane * Math.PI * 2;
      const cx = width / 2;
      const cy = height / 2;
      const r0 = Math.min(width, height) * 0.12;
      const r1 = Math.min(width, height) * (0.36 + random() * 0.14);
      const mid = r0 + (r1 - r0) * (0.4 + random() * 0.3);
      points.push([cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0]);
      points.push([cx + Math.cos(angle) * mid, cy + Math.sin(angle) * mid]);
      // Dobra de 45 graus para fora
      const turn = angle + (random() > 0.5 ? 0.3 : -0.3);
      points.push([cx + Math.cos(turn) * r1, cy + Math.sin(turn) * r1]);
    } else {
      const horizontal = direction === "horizontal";
      const across = horizontal ? height * lane : width * lane;
      const span = horizontal ? width : height;
      const steps = 2 + Math.floor(random() * 2);
      let at = -span * 0.05;
      let off = across;
      points.push(horizontal ? [at, off] : [off, at]);

      for (let s = 0; s < steps; s += 1) {
        const run = (span * (0.9 + random() * 0.2)) / steps;
        at += run * 0.6;
        points.push(horizontal ? [at, off] : [off, at]);
        // Cotovelo de 45 graus
        const jog = (random() - 0.5) * (horizontal ? height : width) * 0.16;
        at += Math.abs(jog);
        off += jog;
        points.push(horizontal ? [at, off] : [off, at]);
      }
      at = span * 1.05;
      points.push(horizontal ? [at, off] : [off, at]);
    }

    let length = 0;
    for (let p = 1; p < points.length; p += 1) {
      const a = points[p - 1];
      const b = points[p];
      if (!a || !b) continue;
      length += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }

    out.push({
      d: points.map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "),
      length,
      start: points[0] ?? [0, 0],
      end: points[points.length - 1] ?? [0, 0],
    });
  }

  return out;
}

export function CircuitTrace({
  seed,
  traces,
  pads,
  direction,
  line,
  accent,
  pad,
  ink,
  fontFamily,
  label,
  pulses,
  pulseSpeed,
  strokeWidth,
  drawWindow,
}: CircuitTraceProps) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const progress = progressOf(frame, durationInFrames);

  const built = useMemo(
    () => buildTraces(seed, traces, width, height, direction),
    [seed, traces, width, height, direction],
  );

  return (
    <AbsoluteFill>
      <svg width={width} height={height}>
        {built.map((trace, index) => {
          const start = (index / built.length) * 0.3;
          const draw = window(progress, start, Math.min(1, start + drawWindow), "out");
          if (draw < 0.01) return null;

          return (
            <g key={`t${index}`}>
              <path
                d={trace.d}
                fill="none"
                stroke={line}
                strokeWidth={strokeWidth}
                strokeLinecap="square"
                strokeLinejoin="round"
                strokeDasharray={trace.length}
                strokeDashoffset={trace.length * (1 - draw)}
              />

              {pads && draw > 0.9 && (
                <>
                  <circle cx={trace.start[0]} cy={trace.start[1]} r={5} fill={pad} opacity={0.85} />
                  <circle cx={trace.end[0]} cy={trace.end[1]} r={5} fill={pad} opacity={0.85} />
                </>
              )}

              {draw > 0.98 &&
                Array.from({ length: pulses }, (_, p) => {
                  const phase =
                    ((((frame / fps) * pulseSpeed + (index * 0.37 + p / Math.max(1, pulses))) % 1) + 1) % 1;
                  // Trecho curto aceso correndo pela trilha: mais barato e
                  // mais legivel que mover um circulo pelo caminho exato.
                  const dashLen = trace.length * 0.07;
                  return (
                    <path
                      key={`p${p}`}
                      d={trace.d}
                      fill="none"
                      stroke={accent}
                      strokeWidth={strokeWidth + 1}
                      strokeLinecap="round"
                      strokeDasharray={`${dashLen} ${trace.length}`}
                      strokeDashoffset={-phase * (trace.length + dashLen)}
                      opacity={0.9}
                    />
                  );
                })}
            </g>
          );
        })}
      </svg>

      {label !== "" && (
        <div
          style={{
            position: "absolute",
            left: 148,
            bottom: 92,
            color: ink,
            fontFamily,
            fontSize: TYPE.caption,
            letterSpacing: 3,
            textTransform: "uppercase",
            opacity: progress > 0.2 ? 0.8 : 0,
          }}
        >
          {label}
        </div>
      )}
    </AbsoluteFill>
  );
}
