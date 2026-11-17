/**
 * Mapa-mundi com rotas que se iluminam progressivamente.
 *
 * O componente nao sabe o que a rota representa: cabo submarino, voo, cadeia
 * de suprimento. Isso e proposital — e o mesmo componente reaproveitado entre
 * documentarios, que e a regra da biblioteca.
 *
 * As rotas sao arcos, nao retas. Uma reta entre Nova York e Lisboa num mapa
 * equirretangular le como erro; o arco le como trajeto.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import { LANDMARKS, WORLD_COARSE, type Ring } from "./data/world-coarse";

const zPoint = z.union([
  z.string(), // chave de LANDMARKS
  z.tuple([z.number(), z.number()]), // [lon, lat]
]);

const zRoute = z.object({
  from: zPoint,
  to: zPoint,
  label: z.string().default(""),
  /** Quando a rota comeca a se desenhar, em fracao da cena (0..1). */
  startAt: z.number().min(0).max(1).default(0),
  /** Quanto dura o desenho, em fracao da cena. */
  growth: z.number().min(0.01).max(1).default(0.35),
  /** Curvatura do arco. Negativo inverte o lado. */
  bend: z.number().default(0.22),
  color: z.string().default("#39d0d8"),
});

export const worldMapSchema = z.object({
  routes: z.array(zRoute).default([]),
  land: z.string().default("#16222f"),
  landStroke: z.string().default("#243545"),
  graticule: z.string().default("#101b26"),
  dotColor: z.string().default("#f5a524"),
  labelColor: z.string().default("#cfd8e3"),
  /** Zoom lento sobre o mapa inteiro. 1 = sem zoom. */
  zoomFrom: z.number().positive().default(1),
  zoomTo: z.number().positive().default(1.08),
  /** Centro do zoom em fracao da tela. */
  focusX: z.number().min(0).max(1).default(0.5),
  focusY: z.number().min(0).max(1).default(0.5),
});

export type WorldMapProps = z.infer<typeof worldMapSchema>;

type XY = { x: number; y: number };

/** Equirretangular simples: a projecao que o olho espera num mapa de rotas. */
function project(lon: number, lat: number, w: number, h: number): XY {
  return { x: ((lon + 180) / 360) * w, y: ((90 - lat) / 180) * h };
}

function resolvePoint(
  point: string | readonly [number, number],
): readonly [number, number] {
  if (typeof point !== "string") return point;
  const found = LANDMARKS[point];
  if (!found) {
    const known = Object.keys(LANDMARKS).sort().join(", ");
    throw new Error(`ponto "${point}" nao existe. Disponiveis: ${known}`);
  }
  return found;
}

function ringToPath(ring: Ring, w: number, h: number): string {
  return (
    ring
      .map(([lon, lat], index) => {
        const { x, y } = project(lon, lat, w, h);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

export function WorldMap({
  routes,
  land,
  landStroke,
  graticule,
  dotColor,
  labelColor,
  zoomFrom,
  zoomTo,
  focusX,
  focusY,
}: WorldMapProps) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 1;
  const zoom = interpolate(progress, [0, 1], [zoomFrom, zoomTo]);

  const meridians = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
  const parallels = [-60, -30, 0, 30, 60];

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: `${focusX * 100}% ${focusY * 100}%`,
        }}
      >
        <g opacity={0.6}>
          {meridians.map((lon) => {
            const { x } = project(lon, 0, width, height);
            return (
              <line
                key={`m${lon}`}
                x1={x}
                y1={0}
                x2={x}
                y2={height}
                stroke={graticule}
                strokeWidth={1}
              />
            );
          })}
          {parallels.map((lat) => {
            const { y } = project(0, lat, width, height);
            return (
              <line
                key={`p${lat}`}
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke={graticule}
                strokeWidth={lat === 0 ? 1.6 : 1}
              />
            );
          })}
        </g>

        {WORLD_COARSE.map((ring, index) => (
          <path
            key={`land${index}`}
            d={ringToPath(ring, width, height)}
            fill={land}
            stroke={landStroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        ))}

        {routes.map((route, index) => {
          const [fromLon, fromLat] = resolvePoint(route.from);
          const [toLon, toLat] = resolvePoint(route.to);
          const a = project(fromLon, fromLat, width, height);
          const b = project(toLon, toLat, width, height);

          // Controle perpendicular ao segmento: gera o arco.
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const control = {
            x: midX - dy * route.bend,
            y: midY + dx * route.bend,
          };
          const d = `M${a.x},${a.y} Q${control.x},${control.y} ${b.x},${b.y}`;

          // Comprimento aproximado da quadratica: suficiente para o traco.
          const chord = Math.hypot(dx, dy);
          const legs =
            Math.hypot(control.x - a.x, control.y - a.y) +
            Math.hypot(b.x - control.x, b.y - control.y);
          const length = (chord + legs) / 2;

          const grow = interpolate(
            progress,
            [route.startAt, Math.min(1, route.startAt + route.growth)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const arrived = grow >= 1;

          return (
            <g key={`route${index}`}>
              <path
                d={d}
                fill="none"
                stroke={route.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray={length}
                strokeDashoffset={length * (1 - grow)}
                opacity={grow > 0 ? 0.95 : 0}
                style={{ filter: `drop-shadow(0 0 6px ${route.color})` }}
              />
              <circle cx={a.x} cy={a.y} r={grow > 0 ? 5 : 0} fill={dotColor} />
              <circle cx={b.x} cy={b.y} r={arrived ? 5 : 0} fill={dotColor} />
              {route.label !== "" && arrived && (
                <text
                  x={control.x}
                  y={control.y - 12}
                  fill={labelColor}
                  fontSize={20}
                  fontWeight={600}
                  textAnchor="middle"
                >
                  {route.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}
