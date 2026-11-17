/**
 * Nos e ligacoes: redes, topologias, fluxogramas e cadeias de causa.
 *
 * Um componente so para tres itens do briefing, porque sao a mesma coisa
 * desenhada de modo diferente: um fluxograma e um grafo com layout em
 * fileira; uma rede e o mesmo grafo em anel. Separar em tres componentes
 * daria tres implementacoes do mesmo traco e tres jeitos de ficarem
 * inconsistentes.
 *
 * Os pulsos que correm pelas arestas sao o que transforma um diagrama parado
 * em "trafego": e a diferenca entre mostrar a topologia e mostrar a rede
 * funcionando.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useMemo } from "react";
import { z } from "zod";

import { COLOR, FONT, SAFE, TYPE } from "../shared/tokens";
import { progressOf, window } from "../shared/motion";

const zNode = z.object({
  id: z.string().min(1),
  label: z.string().default(""),
  /** Segunda linha: funcao, numero, local. */
  sub: z.string().default(""),
  shape: z.enum(["box", "circle", "diamond"]).default("box"),
  /** Posicao em fracao da tela. So no layout "manual". */
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  /** Coluna no layout "flow". Nos da mesma coluna empilham. */
  rank: z.number().int().min(0).default(0),
  color: z.string().optional(),
  highlight: z.boolean().default(false),
  /** Em que fracao da cena o no aparece. */
  at: z.number().min(0).max(1).default(0),
});

const zEdge = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().default(""),
  at: z.number().min(0).max(1).default(0.1),
  /** Pulsos correndo pela aresta: trafego, fluxo, sinal. */
  pulses: z.number().int().min(0).max(6).default(0),
  dashed: z.boolean().default(false),
  bend: z.number().default(0),
});

export const nodeGraphSchema = z.object({
  nodes: z.array(zNode).min(1).max(24),
  edges: z.array(zEdge).default([]),
  layout: z.enum(["flow", "radial", "manual"]).default("flow"),
  title: z.string().default(""),
  ink: z.string().default(COLOR.ink),
  muted: z.string().default(COLOR.muted),
  surface: z.string().default(COLOR.surface),
  line: z.string().default(COLOR.surfaceLine),
  accent: z.string().default(COLOR.accent),
  fontFamily: z.string().default(FONT.display),
  nodeWidth: z.number().positive().default(220),
  nodeHeight: z.number().positive().default(84),
  /** Velocidade dos pulsos, em voltas por segundo. */
  pulseSpeed: z.number().positive().default(0.55),
});

export type NodeGraphProps = z.infer<typeof nodeGraphSchema>;

type Placed = { id: string; cx: number; cy: number };

export function NodeGraph({
  nodes,
  edges,
  layout,
  title,
  ink,
  muted,
  surface,
  line,
  accent,
  fontFamily,
  nodeWidth,
  nodeHeight,
  pulseSpeed,
}: NodeGraphProps) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const progress = progressOf(frame, durationInFrames);

  const area = {
    x: SAFE.x,
    y: SAFE.y + (title ? 70 : 0),
    w: width - SAFE.x * 2,
    h: height - SAFE.y * 2 - (title ? 70 : 0),
  };

  const placed = useMemo<Placed[]>(() => {
    if (layout === "manual") {
      return nodes.map((n) => ({
        id: n.id,
        cx: area.x + (n.x ?? 0.5) * area.w,
        cy: area.y + (n.y ?? 0.5) * area.h,
      }));
    }

    if (layout === "radial") {
      const [center, ...ring] = nodes;
      const radius = Math.min(area.w, area.h) * 0.36;
      const result: Placed[] = center
        ? [{ id: center.id, cx: area.x + area.w / 2, cy: area.y + area.h / 2 }]
        : [];
      ring.forEach((n, i) => {
        const angle = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
        result.push({
          id: n.id,
          cx: area.x + area.w / 2 + Math.cos(angle) * radius,
          cy: area.y + area.h / 2 + Math.sin(angle) * radius,
        });
      });
      return result;
    }

    // flow: colunas por rank, empilhado dentro da coluna
    const ranks = new Map<number, typeof nodes>();
    for (const n of nodes) {
      const list = ranks.get(n.rank) ?? [];
      list.push(n);
      ranks.set(n.rank, list);
    }
    const sorted = [...ranks.keys()].sort((a, b) => a - b);
    const result: Placed[] = [];
    sorted.forEach((rank, columnIndex) => {
      const column = ranks.get(rank) ?? [];
      const cx = area.x + ((columnIndex + 0.5) / sorted.length) * area.w;
      column.forEach((n, rowIndex) => {
        const cy = area.y + ((rowIndex + 0.5) / column.length) * area.h;
        result.push({ id: n.id, cx, cy });
      });
    });
    return result;
  }, [nodes, layout, area.x, area.y, area.w, area.h]);

  const at = (id: string) => placed.find((p) => p.id === id);

  return (
    <AbsoluteFill style={{ fontFamily }}>
      {title !== "" && (
        <div
          style={{
            position: "absolute",
            left: SAFE.x,
            top: SAFE.y,
            color: ink,
            fontSize: TYPE.subheading,
            fontWeight: 700,
          }}
        >
          {title}
        </div>
      )}

      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {edges.map((edge, index) => {
          const a = at(edge.from);
          const b = at(edge.to);
          if (!a || !b) return null;

          const grow = window(progress, edge.at, Math.min(1, edge.at + 0.18), "out");
          if (grow < 0.02) return null;

          const mx = (a.cx + b.cx) / 2;
          const my = (a.cy + b.cy) / 2;
          const dx = b.cx - a.cx;
          const dy = b.cy - a.cy;
          const ctrl = { x: mx - dy * edge.bend, y: my + dx * edge.bend };
          const d = `M${a.cx},${a.cy} Q${ctrl.x},${ctrl.y} ${b.cx},${b.cy}`;
          const length = Math.hypot(dx, dy) * (1 + Math.abs(edge.bend));

          return (
            <g key={`e${index}`}>
              <path
                d={d}
                fill="none"
                stroke={line}
                strokeWidth={2}
                strokeDasharray={edge.dashed ? "8 7" : length}
                strokeDashoffset={edge.dashed ? 0 : length * (1 - grow)}
                opacity={edge.dashed ? grow : 1}
              />

              {grow > 0.98 &&
                Array.from({ length: edge.pulses }, (_, p) => {
                  // Fase determinada pelo quadro: o pulso corre sempre
                  // igual, em qualquer ponto do render.
                  const phase =
                    (((frame / fps) * pulseSpeed + p / edge.pulses) % 1 + 1) % 1;
                  const px = interpolate(phase, [0, 0.5, 1], [a.cx, ctrl.x, b.cx]);
                  const py = interpolate(phase, [0, 0.5, 1], [a.cy, ctrl.y, b.cy]);
                  return (
                    <circle
                      key={`p${p}`}
                      cx={px}
                      cy={py}
                      r={4}
                      fill={accent}
                      opacity={Math.sin(phase * Math.PI)}
                    />
                  );
                })}

              {edge.label !== "" && grow > 0.9 && (
                <text
                  x={ctrl.x}
                  y={ctrl.y - 10}
                  fill={muted}
                  fontSize={TYPE.caption}
                  fontWeight={600}
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {nodes.map((node) => {
        const spot = at(node.id);
        if (!spot) return null;
        const show = window(progress, node.at, Math.min(1, node.at + 0.12), "out");
        if (show < 0.02) return null;

        const color = node.color ?? (node.highlight ? accent : line);
        const isCircle = node.shape === "circle";
        const size = isCircle ? nodeHeight * 1.5 : nodeWidth;

        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: spot.cx - size / 2,
              top: spot.cy - nodeHeight / 2,
              width: size,
              height: isCircle ? size : nodeHeight,
              marginTop: isCircle ? -(size - nodeHeight) / 2 : 0,
              backgroundColor: surface,
              border: `2px solid ${color}`,
              borderRadius: isCircle ? "50%" : 4,
              transform: `${node.shape === "diamond" ? "rotate(45deg)" : ""} scale(${0.9 + show * 0.1})`,
              opacity: show,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: 10,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                color: node.highlight ? accent : ink,
                fontSize: TYPE.caption,
                fontWeight: 700,
                textAlign: "center",
                lineHeight: 1.2,
                transform: node.shape === "diamond" ? "rotate(-45deg)" : undefined,
              }}
            >
              {node.label}
            </div>
            {node.sub !== "" && node.shape !== "diamond" && (
              <div style={{ color: muted, fontSize: 15, textAlign: "center" }}>
                {node.sub}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
