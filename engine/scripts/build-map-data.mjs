/**
 * Gerador dos contornos do mapa-mundi.
 *
 * Baixa o Natural Earth 110m (dominio publico) empacotado como TopoJSON pelo
 * projeto `world-atlas`, converte para aneis de [longitude, latitude] e
 * escreve dois modulos TypeScript PUROS — sem nenhuma dependencia em tempo de
 * execucao. O `topojson-client` so existe aqui, no gerador.
 *
 * Por que gerar em vez de versionar o TopoJSON: o componente desenha SVG a
 * partir de pares [lon, lat]. Decodificar quantizacao e arcos em tempo de
 * render seria pagar, a cada quadro, uma conta que da para pagar uma vez.
 *
 * Uso:
 *   node scripts/build-map-data.mjs
 *   node scripts/build-map-data.mjs --tolerance 0.2 --min-area 0.5
 *
 * A simplificacao e Douglas-Peucker (implementado aqui, sem biblioteca) em
 * graus, seguida de arredondamento para 2 casas. Em 1920 px de largura, 1 px
 * vale 360/1920 = 0,1875 graus de longitude: 0,01 grau e sub-pixel por uma
 * ordem de grandeza, entao o arredondamento nao e visivel.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { feature, mesh } from "topojson-client";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "..", "src", "library", "2d", "data");

const SOURCES = {
  land: "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json",
  countries: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
};

/** Casas decimais do dado final. 2 = sub-pixel em 1920 px. */
const PRECISION = 2;

const DEFAULTS = {
  /**
   * Tolerancia do Douglas-Peucker, em graus. Quanto maior, menos pontos.
   * 0.08 deg ~ 0,4 px em 1920 px de largura: so colineares somem. O 110m ja
   * e grosseiro na origem (5 mil pontos); podar mais nao compraria nada, ja
   * que o arquivo inteiro cabe folgado no orcamento.
   */
  tolerance: 0.08,
  /**
   * Area minima de um anel de terra, em graus quadrados. Abaixo disso a ilha
   * nao chega a um punhado de pixels e so engorda o arquivo.
   * 0.15 deg^2 ~ 1.800 km^2 no equador.
   */
  minArea: 0.15,
  /** Comprimento minimo de uma linha de fronteira, em graus. */
  minLength: 1.0,
};

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = Number(argv[i + 1]);
    if (flag === "--tolerance" && Number.isFinite(value)) {
      out.tolerance = value;
      i += 1;
    } else if (flag === "--min-area" && Number.isFinite(value)) {
      out.minArea = value;
      i += 1;
    } else if (flag === "--min-length" && Number.isFinite(value)) {
      out.minLength = value;
      i += 1;
    }
  }
  return out;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} respondeu ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** Distancia perpendicular de p ate a reta ab, no plano lon/lat. */
function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + clamped * dx), p[1] - (a[1] + clamped * dy));
}

/** Douglas-Peucker iterativo: recursao em lista de ponta a ponta, sem pilha. */
function simplify(points, tolerance) {
  if (points.length < 3) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let worst = 0;
    let worstIndex = -1;
    for (let i = start + 1; i < end; i += 1) {
      const distance = perpendicularDistance(points[i], points[start], points[end]);
      if (distance > worst) {
        worst = distance;
        worstIndex = i;
      }
    }
    if (worstIndex !== -1 && worst > tolerance) {
      keep[worstIndex] = 1;
      stack.push([start, worstIndex], [worstIndex, end]);
    }
  }

  return points.filter((_, index) => keep[index] === 1);
}

function round(value) {
  const factor = 10 ** PRECISION;
  // +0 remove o -0, que viraria "-0" no arquivo gerado.
  return Math.round(value * factor) / factor + 0;
}

/** Arredonda e remove pontos consecutivos que colapsaram no mesmo lugar. */
function quantize(points) {
  const out = [];
  for (const point of points) {
    const next = [round(point[0]), round(point[1])];
    const last = out[out.length - 1];
    if (last && last[0] === next[0] && last[1] === next[1]) continue;
    out.push(next);
  }
  return out;
}

/** Area absoluta pelo laco do sapateiro, em graus quadrados. */
function ringArea(points) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    sum += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return Math.abs(sum) / 2;
}

function lineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

/**
 * Anel fechado do GeoJSON repete o primeiro ponto no fim. O componente fecha
 * o path com "Z", entao o ponto repetido so ocupa espaco.
 */
function dropClosingPoint(points) {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? points.slice(0, -1) : points;
}

/**
 * So os aneis externos de cada poligono.
 *
 * Os internos (lagos, o Caspio) seriam desenhados como <path> proprio e, com
 * a mesma cor de terra, ficariam invisiveis — custo sem efeito. Furo de
 * verdade exigiria um unico path com fill-rule, que nao e a forma do dado.
 */
function outerRings(geojson) {
  const rings = [];
  const visit = (geometry) => {
    if (!geometry) return;
    if (geometry.type === "Polygon") {
      if (geometry.coordinates[0]) rings.push(geometry.coordinates[0]);
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        if (polygon[0]) rings.push(polygon[0]);
      }
    } else if (geometry.type === "GeometryCollection") {
      geometry.geometries.forEach(visit);
    }
  };
  if (geojson.type === "FeatureCollection") {
    for (const item of geojson.features) visit(item.geometry);
  } else {
    visit(geojson.geometry ?? geojson);
  }
  return rings;
}

function meshLines(geometry) {
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}

function buildRings(raw, { tolerance, minArea }) {
  const kept = [];
  let droppedSmall = 0;
  let droppedShort = 0;
  let rawPoints = 0;

  for (const ring of raw) {
    rawPoints += ring.length;
    if (ringArea(ring) < minArea) {
      droppedSmall += 1;
      continue;
    }
    const simplified = dropClosingPoint(quantize(simplify(ring, tolerance)));
    if (simplified.length < 4) {
      droppedShort += 1;
      continue;
    }
    kept.push(simplified);
  }

  return { rings: kept, droppedSmall, droppedShort, rawPoints };
}

function buildLines(raw, { tolerance, minLength }) {
  const kept = [];
  let droppedShort = 0;
  let rawPoints = 0;

  for (const line of raw) {
    rawPoints += line.length;
    if (lineLength(line) < minLength) {
      droppedShort += 1;
      continue;
    }
    const simplified = quantize(simplify(line, tolerance));
    if (simplified.length < 2) {
      droppedShort += 1;
      continue;
    }
    kept.push(simplified);
  }

  return { lines: kept, droppedShort, rawPoints };
}

/** Uma linha de texto por anel: diff legivel e arquivo compacto. */
function serializeRings(rings) {
  return rings
    .map((ring) => `  [${ring.map(([lon, lat]) => `[${lon},${lat}]`).join(",")}],`)
    .join("\n");
}

function countPoints(rings) {
  return rings.reduce((total, ring) => total + ring.length, 0);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString().slice(0, 10);

  const header = (what) => `/**
 * ${what}
 *
 * ARQUIVO GERADO — nao edite a mao.
 *
 * Fonte: Natural Earth 1:110m (dominio publico, sem restricao de uso),
 * empacotada como TopoJSON pelo projeto world-atlas@2.
 *   ${SOURCES.land}
 *   ${SOURCES.countries}
 *
 * Gerado em ${generatedAt} por:
 *   node scripts/build-map-data.mjs --tolerance ${options.tolerance} --min-area ${options.minArea} --min-length ${options.minLength}
 *
 * Coordenadas em [longitude, latitude], graus, 2 casas decimais.
 */
`;

  const [landTopo, countriesTopo] = await Promise.all([
    fetchJson(SOURCES.land),
    fetchJson(SOURCES.countries),
  ]);

  const landGeo = feature(landTopo, landTopo.objects.land);
  const land = buildRings(outerRings(landGeo), options);

  const borderMesh = mesh(
    countriesTopo,
    countriesTopo.objects.countries,
    (a, b) => a !== b,
  );
  const borders = buildLines(meshLines(borderMesh), options);

  const landFile = `${header("Massas de terra do mundo, em aneis fechados.")}
export type Ring = ReadonlyArray<readonly [number, number]>;

/** Contornos continentais e das ilhas maiores. Cada anel fecha sozinho. */
export const WORLD_LAND: ReadonlyArray<Ring> = [
${serializeRings(land.rings)}
];
`;

  const borderFile = `${header("Fronteiras entre paises, em linhas abertas.")}
import type { Ring } from "./world-110m";

/**
 * Fronteiras internas (a malha entre vizinhos, sem as costas). Sao LINHAS,
 * nao aneis: o primeiro ponto nao liga no ultimo.
 */
export const WORLD_BORDERS: ReadonlyArray<Ring> = [
${serializeRings(borders.lines)}
];
`;

  const landPath = path.join(OUT_DIR, "world-110m.ts");
  const borderPath = path.join(OUT_DIR, "world-borders-110m.ts");

  await writeFile(landPath, landFile, "utf8");
  await writeFile(borderPath, borderFile, "utf8");

  const kb = (text) => (Buffer.byteLength(text, "utf8") / 1024).toFixed(1);

  process.stdout.write(
    [
      `tolerancia ${options.tolerance} deg | area minima ${options.minArea} deg^2 | linha minima ${options.minLength} deg`,
      "",
      `world-110m.ts          ${kb(landFile)} KB  ${land.rings.length} aneis  ${countPoints(land.rings)} pontos`,
      `  descartados: ${land.droppedSmall} ilhas abaixo do limiar, ${land.droppedShort} aneis com menos de 4 pontos`,
      `  pontos na origem: ${land.rawPoints}`,
      "",
      `world-borders-110m.ts  ${kb(borderFile)} KB  ${borders.lines.length} linhas  ${countPoints(borders.lines)} pontos`,
      `  descartadas: ${borders.droppedShort} linhas abaixo do limiar`,
      `  pontos na origem: ${borders.rawPoints}`,
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
