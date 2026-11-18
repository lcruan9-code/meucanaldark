/**
 * Corredor de data center em 3D.
 *
 * O assunto e "como um data center processa uma requisicao de IA", e a cena
 * precisa servir a planos diferentes do mesmo corredor: um geral, um medio de
 * rack, um close de servidor. Por isso o enquadramento e prop (`shot`), nao
 * uma camera fixa.
 *
 * O que faz a imagem parecer fotografada nao e a malha — rack E uma caixa.
 * Sao, em ordem de retorno por esforco:
 *
 *  1. IBL. `RoomEnvironment` + `PMREMGenerator` geram um mapa de ambiente em
 *     memoria, sem baixar HDR nenhum. Metal sem mapa de ambiente nao tem o que
 *     refletir e fica com cara de plastico de videogame.
 *  2. Materiais variados. Metal escovado no corpo, plastico fosco no painel,
 *     vidro em parte das portas, piso com especularidade. Superficie uniforme
 *     denuncia CGI.
 *  3. Textura procedural. O painel frontal e o piso sao desenhados em canvas
 *     2D com semente — e o que da detalhe no close sem baixar imagem nenhuma.
 *  4. Nevoa e escala. 20 racks por fileira sumindo na nevoa e o que da tamanho
 *     ao corredor; quatro racks nao sao um data center.
 *  5. Emissivos. LEDs e luminarias sao a fonte de contraste da cena.
 *
 * Determinismo: nada aqui depende de relogio, estado ou `Math.random()`. O
 * piscar dos LEDs sai de um mulberry32 com semente, lido em funcao de `frame`.
 * O render e quadro a quadro; sem isso dois quadros vizinhos divergem e o
 * video "chia".
 *
 * Sombras: desligadas por padrao. O custo de shadow map com muitos instanced
 * meshes nao cabe no orcamento desta maquina; o contato com o piso e fingido
 * com uma faixa escura sob cada fileira, que e barata e convence.
 */

import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { z } from "zod";

import { EASE, progressOf, window as rampOf } from "../shared/motion";
import { COLOR } from "../shared/tokens";

export const dataCenter3DSchema = z.object({
  /**
   * Enquadramento. A cena e a mesma; muda a camera. `wide` ve o corredor
   * inteiro, `aisle` caminha nele na altura do olho, `rack` e um plano medio
   * de um rack e `macro` encosta nos servidores.
   */
  shot: z.enum(["wide", "aisle", "rack", "macro"]).default("aisle"),
  /** Movimento ao longo da cena. `dolly` e travelling; `push` e push-in. */
  move: z.enum(["static", "dolly", "push", "drift"]).default("dolly"),
  /** Quanto o movimento percorre, em metros. */
  moveAmount: z.number().min(0).max(40).default(5),
  easing: z.enum(["linear", "out", "inOut"]).default("inOut"),

  /** Racks por fileira. Sao duas fileiras; 20 da corredor de verdade. */
  racksPerSide: z.number().int().min(2).max(40).default(20),
  /** Unidades de servidor por rack. Define a textura e a grade de LEDs. */
  unitsPerRack: z.number().int().min(4).max(24).default(16),
  /** Largura do corredor entre as faces dos racks, em metros. */
  aisleWidth: z.number().min(1.4).max(6).default(2.7),

  /** Semente do PRNG: decide piscar dos LEDs, sujeira e variacao de painel. */
  seed: z.number().int().default(31),
  /** Velocidade do piscar. 0 congela os LEDs no estado inicial. */
  blinkRate: z.number().min(0).max(4).default(1),

  /** Faixa de luz atravessando o corredor: a requisicao cruzando o sistema. */
  pulse: z.boolean().default(true),
  /** Quantas vezes a faixa percorre o corredor ao longo da cena. */
  pulseCount: z.number().min(0).max(12).default(2),
  /** A faixa tambem ilumina os racks por onde passa. Custa 1 luz dinamica. */
  pulseLight: z.boolean().default(true),

  /** Densidade da nevoa. E o que faz o fundo sumir e o corredor ter escala. */
  fogDensity: z.number().min(0).max(0.3).default(0.058),
  exposure: z.number().min(0.1).max(3).default(0.88),
  /** Peso do mapa de ambiente. Alto demais lava o preto e perde o clima. */
  envIntensity: z.number().min(0).max(3).default(0.42),
  /** Sombras reais. Caras: medir antes de ligar numa cena longa. */
  shadows: z.boolean().default(false),

  accent: z.string().default(COLOR.accent),
  status: z.string().default(COLOR.good),
  warm: z.string().default(COLOR.accentWarm),
  room: z.string().default("#060910"),
  /**
   * Cor da nevoa, e do vazio atras dela. Tem de ser MAIS CLARA que a sala:
   * nevoa da cor do preto nao e nevoa, e so escuridao, e o fundo continua
   * nitido. A diferenca entre as duas e o que produz perspectiva aerea.
   */
  haze: z.string().default("#1e2a39"),
  metal: z.string().default("#2d343f"),
  floorColor: z.string().default("#0d1116"),

  /**
   * Sobreposicoes de enquadramento. Vazio = usa o preset do plano. Servem
   * para afinar um plano sem inventar um `shot` novo.
   */
  cameraDistance: z.number().optional(),
  cameraHeight: z.number().optional(),
  cameraSide: z.number().optional(),
  targetHeight: z.number().optional(),
  targetDepth: z.number().optional(),
  fov: z.number().min(10).max(120).optional(),
});

export type DataCenter3DProps = z.infer<typeof dataCenter3DSchema>;

/* ------------------------------------------------------------------ */
/* Geometria do corredor                                               */
/* ------------------------------------------------------------------ */

/** Passo entre racks: a largura do rack mais a folga de montagem. */
const RACK_PITCH = 0.92;
/** Largura do rack ao longo do corredor (eixo Z). */
const RACK_WIDTH = 0.86;
/** Profundidade do rack (eixo X). */
const RACK_DEPTH = 1.05;
const RACK_HEIGHT = 2.15;
const CEILING_Y = 3.3;
/** Altura da bandeja de cabos sobre cada fileira. */
const TRAY_Y = 2.62;
/** Quantas texturas de painel diferentes existem. Evita rack clonado. */
const FACE_VARIANTS = 3;

type Geometry = {
  /** Metade da largura do corredor: a face do rack fica em |x| = faceX. */
  faceX: number;
  /** Centro do rack em X, por fileira. */
  centerX: number;
  /** Comprimento total do corredor em Z. */
  length: number;
  racksPerSide: number;
};

function geometryOf(props: DataCenter3DProps): Geometry {
  const faceX = props.aisleWidth / 2;
  return {
    faceX,
    centerX: faceX + RACK_DEPTH / 2,
    length: props.racksPerSide * RACK_PITCH,
    racksPerSide: props.racksPerSide,
  };
}

/** Centro em Z do rack de indice i. O corredor cresce para -Z. */
function rackZ(index: number): number {
  return -(RACK_PITCH / 2 + index * RACK_PITCH);
}

/* ------------------------------------------------------------------ */
/* Aleatoriedade com semente                                           */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Texturas procedurais                                                */
/* ------------------------------------------------------------------ */

function canvasOf(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d indisponivel para a textura do rack");
  return ctx;
}

/**
 * Painel frontal do rack: unidades de servidor empilhadas, com grade de
 * ventilacao, alcas, baias cegas e sujeira. E o que sustenta o plano macro:
 * sem isto o close revela uma caixa lisa.
 */
function makeFaceTexture(seed: number, units: number): THREE.CanvasTexture {
  const W = 512;
  const H = 1024;
  const ctx = canvasOf(W, H);
  const rnd = mulberry32(seed);

  ctx.fillStyle = "#080b11";
  ctx.fillRect(0, 0, W, H);

  const unitH = H / units;
  for (let i = 0; i < units; i += 1) {
    const y = i * unitH;
    const kind = rnd();
    const base = 17 + Math.floor(rnd() * 15);

    ctx.fillStyle = `rgb(${base},${base + 3},${base + 9})`;
    ctx.fillRect(7, y + 3, W - 14, unitH - 6);

    if (kind < 0.16) {
      // Painel cego: baia vazia. Liso e mais escuro que o resto.
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.fillRect(7, y + 3, W - 14, unitH - 6);
      ctx.fillStyle = "rgba(190,200,215,0.07)";
      ctx.fillRect(W / 2 - 40, y + unitH / 2 - 2, 80, 4);
    } else {
      const rows = Math.max(2, Math.floor((unitH - 18) / 9));
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      for (let c = 0; c < 24; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          ctx.fillRect(84 + c * 14, y + 9 + r * 9, 8, 5);
        }
      }
      // Alcas / baias de disco nas pontas da unidade.
      ctx.fillStyle = `rgb(${base + 15},${base + 18},${base + 25})`;
      ctx.fillRect(17, y + 7, 36, unitH - 14);
      ctx.fillRect(W - 53, y + 7, 36, unitH - 14);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(25, y + unitH / 2 - 1, 20, 3);
    }

    // Costura entre unidades: a linha preta que da a contagem de racks.
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, y + unitH - 3, W, 3);
  }

  // Montantes laterais do rack.
  ctx.fillStyle = "rgba(150,162,178,0.11)";
  ctx.fillRect(0, 0, 7, H);
  ctx.fillRect(W - 7, 0, 7, H);

  // Poeira e micro-arranhao: quebra a uniformidade que denuncia CGI.
  for (let i = 0; i < 2200; i += 1) {
    ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`;
    ctx.fillRect(rnd() * W, rnd() * H, 2, 2);
  }

  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Piso tecnico: placas 60 cm com juntas, variacao de tom e perfuracao. */
function makeFloorTextures(seed: number): {
  map: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
} {
  const S = 512;
  const TILES = 4;
  const tile = S / TILES;
  const color = canvasOf(S, S);
  const rough = canvasOf(S, S);
  const rnd = mulberry32(seed);

  color.fillStyle = "#171b22";
  color.fillRect(0, 0, S, S);
  rough.fillStyle = "#6b6b6b";
  rough.fillRect(0, 0, S, S);

  for (let tx = 0; tx < TILES; tx += 1) {
    for (let ty = 0; ty < TILES; ty += 1) {
      const x = tx * tile;
      const y = ty * tile;
      const shade = 20 + Math.floor(rnd() * 10);
      color.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
      color.fillRect(x + 2, y + 2, tile - 4, tile - 4);

      // Placa perfurada de insuflamento: aparece em parte do piso.
      if (rnd() < 0.22) {
        color.fillStyle = "rgba(0,0,0,0.55)";
        rough.fillStyle = "#a8a8a8";
        for (let c = 0; c < 9; c += 1) {
          for (let r = 0; r < 9; r += 1) {
            color.fillRect(x + 14 + c * 12, y + 14 + r * 12, 7, 7);
            rough.fillRect(x + 14 + c * 12, y + 14 + r * 12, 7, 7);
          }
        }
      } else {
        // Brilho desigual: o piso polido nao reflete por igual.
        const r = 90 + Math.floor(rnd() * 70);
        rough.fillStyle = `rgb(${r},${r},${r})`;
        rough.fillRect(x + 3, y + 3, tile - 6, tile - 6);
      }

      // Junta entre placas.
      color.fillStyle = "rgba(0,0,0,0.65)";
      color.fillRect(x, y, tile, 2);
      color.fillRect(x, y, 2, tile);
    }
  }

  for (let i = 0; i < 4000; i += 1) {
    color.fillStyle = `rgba(255,255,255,${rnd() * 0.04})`;
    color.fillRect(rnd() * S, rnd() * S, 2, 2);
  }

  const map = new THREE.CanvasTexture(color.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughness = new THREE.CanvasTexture(rough.canvas);

  for (const texture of [map, roughness]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(30, 30);
    texture.anisotropy = 8;
  }
  return { map, roughness };
}

/**
 * Mancha radial suave. Serve de halo das luminarias: sem pos-processamento
 * nao ha bloom, e fonte de luz com borda perfeitamente dura e um dos sinais
 * mais rapidos de render de teste.
 */
function makeGlowTexture(): THREE.CanvasTexture {
  const S = 128;
  const ctx = canvasOf(S, S);
  const gradient = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gradient.addColorStop(0, "rgba(190,215,235,0.55)");
  gradient.addColorStop(0.35, "rgba(150,185,215,0.22)");
  gradient.addColorStop(1, "rgba(120,160,200,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(ctx.canvas);
}

/**
 * Degrade usado como oclusao de contato falsa na base dos racks. Com sombra
 * desligada, e isto que impede o rack de parecer flutuando sobre o piso.
 */
function makeContactTexture(): THREE.CanvasTexture {
  const ctx = canvasOf(8, 128);
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, "rgba(0,0,0,0.85)");
  gradient.addColorStop(0.45, "rgba(0,0,0,0.28)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 8, 128);
  return new THREE.CanvasTexture(ctx.canvas);
}

/* ------------------------------------------------------------------ */
/* Enquadramento                                                       */
/* ------------------------------------------------------------------ */

type Framing = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
};

/**
 * Presets de camera por plano. Numeros vem do tamanho real do corredor: a
 * face do rack esta em |x| = faceX e o olho humano fica por volta de 1,6 m.
 */
function presetOf(shot: DataCenter3DProps["shot"], geo: Geometry): Framing {
  switch (shot) {
    case "wide":
      return {
        position: new THREE.Vector3(0, 2.0, 5.4),
        target: new THREE.Vector3(0, 1.1, -geo.length * 0.6),
        fov: 38,
      };
    case "rack":
      return {
        position: new THREE.Vector3(geo.faceX - 0.4, 1.55, -0.9),
        target: new THREE.Vector3(-geo.faceX + 0.05, 1.2, -3.5),
        fov: 42,
      };
    case "macro":
      return {
        position: new THREE.Vector3(-geo.faceX + 0.78, 1.4, -2.05),
        target: new THREE.Vector3(-geo.faceX + 0.02, 1.3, -2.95),
        fov: 32,
      };
    case "aisle":
    default:
      return {
        position: new THREE.Vector3(0.12, 1.6, 2.6),
        target: new THREE.Vector3(-0.04, 1.42, -geo.length * 0.75),
        fov: 48,
      };
  }
}

/** Preset + sobreposicoes do roteiro + movimento da cena, nesta ordem. */
function framingOf(
  props: DataCenter3DProps,
  geo: Geometry,
  progress: number,
): Framing {
  const base = presetOf(props.shot, geo);
  const position = base.position.clone();
  const target = base.target.clone();

  if (props.targetHeight !== undefined) target.y = props.targetHeight;
  if (props.targetDepth !== undefined) target.z = props.targetDepth;
  if (props.cameraHeight !== undefined) position.y = props.cameraHeight;
  if (props.cameraSide !== undefined) position.x = props.cameraSide;
  if (props.cameraDistance !== undefined) {
    position.z = target.z + props.cameraDistance;
  }

  const eased = rampOf(progress, 0, 1, props.easing);
  const travel = props.moveAmount;

  if (props.move === "dolly") {
    position.z -= travel * eased;
    target.z -= travel * eased;
  } else if (props.move === "push") {
    position.z -= travel * eased;
  } else if (props.move === "drift") {
    position.x += travel * (eased - 0.5);
    target.x += travel * 0.3 * (eased - 0.5);
  }

  return { position, target, fov: props.fov ?? base.fov };
}

/**
 * Posiciona a camera padrao do canvas e ajusta a exposicao do renderizador.
 * Um `<perspectiveCamera>` solto na arvore nao vira a camera do render sem
 * `makeDefault`; mexer na do contexto e mais direto e nao depende de drei.
 */
function CameraRig({
  framing,
  exposure,
}: {
  framing: Framing;
  exposure: number;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  camera.position.copy(framing.position);
  camera.lookAt(framing.target);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = framing.fov;
  }
  camera.updateProjectionMatrix();
  gl.toneMappingExposure = exposure;

  return null;
}

/* ------------------------------------------------------------------ */
/* Iluminacao baseada em imagem                                        */
/* ------------------------------------------------------------------ */

/**
 * Gera o mapa de ambiente em memoria e o aplica a cena.
 *
 * `RoomEnvironment` e uma sala de estudio com luminarias; passada pelo
 * `PMREMGenerator` ela vira o mapa pre-filtrado que os materiais PBR usam
 * como luz de ambiente. Custo: zero em disco, uma vez por aba de render.
 */
function ImageBasedLight({ intensity }: { intensity: number }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  const envMap = useMemo(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    room.dispose();
    generator.dispose();
    return target.texture;
  }, [gl]);

  scene.environment = envMap;
  scene.environmentIntensity = intensity;

  useEffect(() => () => envMap.dispose(), [envMap]);

  return null;
}

/* ------------------------------------------------------------------ */
/* Helpers de InstancedMesh                                            */
/* ------------------------------------------------------------------ */

type Placement = {
  position: [number, number, number];
  rotationY?: number;
  scale?: [number, number, number];
};

/**
 * Monta um InstancedMesh ja preenchido.
 *
 * Construir o objeto a mao e devolve-lo por `<primitive>` evita o `args`
 * meio-tipado do `<instancedMesh>` e deixa a matriz de cada instancia num
 * so lugar, calculada por funcao pura das props.
 */
function buildInstances(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: readonly Placement[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach((placement, index) => {
    dummy.position.set(...placement.position);
    dummy.rotation.set(0, placement.rotationY ?? 0, 0);
    dummy.scale.set(...(placement.scale ?? [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Monta e descarta o mesh junto com as deps. `<primitive>` nao faz isso. */
function useInstances(
  factory: () => THREE.InstancedMesh,
  deps: readonly unknown[],
): THREE.InstancedMesh {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mesh = useMemo(factory, deps);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
      mesh.dispose();
    },
    [mesh],
  );
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Racks                                                               */
/* ------------------------------------------------------------------ */

type RackPlan = {
  /** Indice da textura de painel usada por este rack. */
  variant: number;
  /** Tem porta de vidro. Porta cega e porta de vidro convivem no mesmo DC. */
  glass: boolean;
  x: number;
  z: number;
  /** +1 quando a face aponta para -X (fileira da direita). */
  facing: 1 | -1;
};

function planRacks(geo: Geometry, seed: number): RackPlan[] {
  const rnd = mulberry32(seed ^ 0x5f3a);
  const plans: RackPlan[] = [];
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < geo.racksPerSide; i += 1) {
      plans.push({
        variant: Math.floor(rnd() * FACE_VARIANTS) % FACE_VARIANTS,
        glass: rnd() < 0.38,
        x: side * geo.centerX,
        z: rackZ(i),
        facing: side === -1 ? -1 : 1,
      });
    }
  }
  return plans;
}

function RackRows({
  props,
  geo,
  plans,
  faceTextures,
}: {
  props: DataCenter3DProps;
  geo: Geometry;
  plans: readonly RackPlan[];
  faceTextures: readonly THREE.CanvasTexture[];
}) {
  const { metal, shadows } = props;

  // Corpo: metal escovado. Metalness alto so funciona com o mapa de ambiente
  // da IBL; sem ele isto sairia preto chapado.
  const bodies = useInstances(() => {
    const mesh = buildInstances(
      new THREE.BoxGeometry(RACK_DEPTH, RACK_HEIGHT, RACK_WIDTH),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(metal),
        metalness: 0.6,
        roughness: 0.56,
      }),
      plans.map((plan) => ({
        position: [plan.x, RACK_HEIGHT / 2, plan.z] as [number, number, number],
      })),
    );
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    return mesh;
  }, [plans, metal, shadows]);

  // Porta de vidro em parte dos racks. Transmissao de verdade e cara demais;
  // transparente com rugosidade baixa e metalness leve pega o reflexo da IBL
  // e le como vidro.
  const glass = useInstances(() => {
    const members = plans.filter((plan) => plan.glass);
    return buildInstances(
      new THREE.BoxGeometry(0.02, RACK_HEIGHT - 0.11, RACK_WIDTH - 0.1),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#6d7d8c"),
        metalness: 0.06,
        roughness: 0.14,
        transparent: true,
        // Baixo de proposito: a 0,17 o reflexo da IBL vira um painel aceso e
        // o rack some atras do proprio vidro.
        opacity: 0.13,
        depthWrite: false,
      }),
      members.map((plan) => ({
        position: [plan.facing * (geo.faceX - 0.07), RACK_HEIGHT / 2, plan.z] as [
          number,
          number,
          number,
        ],
      })),
    );
  }, [plans, geo.faceX]);

  return (
    <>
      <primitive object={bodies} />
      {faceTextures.map((texture, variant) => (
        <RackFaces
          key={`face${variant}`}
          texture={texture}
          variant={variant}
          geo={geo}
          plans={plans}
          shadows={shadows}
        />
      ))}
      <primitive object={glass} />
    </>
  );
}

/**
 * Painel frontal de uma variante de textura. Uma malha por variante: tres
 * chamadas de desenho em troca de nenhum rack visivelmente clonado.
 */
function RackFaces({
  texture,
  variant,
  geo,
  plans,
  shadows,
}: {
  texture: THREE.CanvasTexture;
  variant: number;
  geo: Geometry;
  plans: readonly RackPlan[];
  shadows: boolean;
}) {
  const mesh = useInstances(() => {
    const members = plans.filter((plan) => plan.variant === variant);
    const instanced = buildInstances(
      new THREE.BoxGeometry(0.04, RACK_HEIGHT - 0.05, RACK_WIDTH - 0.06),
      new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.18 + variant * 0.06,
        roughness: 0.68 - variant * 0.07,
      }),
      members.map((plan) => ({
        position: [plan.facing * (geo.faceX - 0.02), RACK_HEIGHT / 2, plan.z] as [
          number,
          number,
          number,
        ],
      })),
    );
    instanced.receiveShadow = shadows;
    return instanced;
  }, [plans, texture, variant, geo.faceX, shadows]);

  return <primitive object={mesh} />;
}

/* ------------------------------------------------------------------ */
/* LEDs                                                                */
/* ------------------------------------------------------------------ */

type Led = {
  /** Fase inicial, 0..1. */
  phase: number;
  /** Periodo do piscar, em quadros. */
  period: number;
  /** Fracao do periodo em que fica aceso. */
  duty: number;
  /** true = LED de estado, sempre aceso. false = LED de atividade. */
  steady: boolean;
  /** Indice da cor base. */
  tone: number;
};

/**
 * Grade de LEDs dos servidores.
 *
 * Material basico de proposito: LED nao e iluminado, LED emite. Tirar estes
 * 1.280 cubinhos do calculo de luz e o que mantem o custo da cena de pe.
 *
 * O piscar e lido de um PRNG com semente, nunca de `Math.random()`: o render
 * e quadro a quadro, e dois quadros vizinhos precisam concordar.
 */
function LedField({
  props,
  geo,
  plans,
  frame,
}: {
  props: DataCenter3DProps;
  geo: Geometry;
  plans: readonly RackPlan[];
  frame: number;
}) {
  const { unitsPerRack, seed, blinkRate, accent, status, warm } = props;

  const { mesh, leds } = useMemo(() => {
    const rnd = mulberry32(seed ^ 0x2c91);
    const placements: Placement[] = [];
    const specs: Led[] = [];
    const unitH = (RACK_HEIGHT - 0.14) / unitsPerRack;
    const bottom = 0.07;

    for (const plan of plans) {
      for (let u = 0; u < unitsPerRack; u += 1) {
        const y = bottom + (u + 0.5) * unitH;
        for (let slot = 0; slot < 2; slot += 1) {
          placements.push({
            position: [
              plan.facing * (geo.faceX - 0.045),
              y,
              plan.z + RACK_WIDTH * 0.33 - slot * 0.055,
            ],
          });
          const roll = rnd();
          specs.push({
            phase: rnd(),
            period: 5 + rnd() * 52,
            duty: 0.3 + rnd() * 0.55,
            steady: slot === 0 ? roll < 0.72 : roll < 0.18,
            tone: slot === 0 ? (roll < 0.9 ? 0 : 2) : 1,
          });
        }
      }
    }

    const instanced = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.011, 0.012, 0.018),
      new THREE.MeshBasicMaterial({ toneMapped: false }),
      placements.length,
    );
    const dummy = new THREE.Object3D();
    placements.forEach((placement, index) => {
      dummy.position.set(...placement.position);
      dummy.updateMatrix();
      instanced.setMatrixAt(index, dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
    return { mesh: instanced, leds: specs };
  }, [plans, geo.faceX, unitsPerRack, seed]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    },
    [mesh],
  );

  // Cor por quadro. Roda em useLayoutEffect, que o React executa antes do
  // useEffect onde o @remotion/three chama `advance()` — ou seja, o buffer
  // ja esta atualizado quando o quadro e desenhado.
  useLayoutEffect(() => {
    const palette = [
      new THREE.Color(status),
      new THREE.Color(accent),
      new THREE.Color(warm),
    ];
    const dim = new THREE.Color("#0e1620");
    const color = new THREE.Color();

    leds.forEach((led, index) => {
      const base = palette[led.tone] ?? palette[0];
      if (!base) return;
      let lit: number;
      if (led.steady) {
        // LED de estado: aceso, com respiro quase imperceptivel.
        lit = 0.82 + 0.18 * Math.sin((frame * 0.05 + led.phase * 7) % 6.2832);
      } else {
        const t =
          (((frame * blinkRate) / led.period + led.phase) % 1 + 1) % 1;
        lit = t < led.duty ? 1 : 0.1;
      }
      color.copy(dim).lerp(base, lit);
      mesh.setColorAt(index, color);
    });

    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [mesh, leds, frame, blinkRate, status, accent, warm]);

  return <primitive object={mesh} />;
}

/* ------------------------------------------------------------------ */
/* Sala: piso, teto, luminarias, bandejas de cabo                      */
/* ------------------------------------------------------------------ */

function Room({
  props,
  geo,
  floorTextures,
  contactTexture,
  glowTexture,
}: {
  props: DataCenter3DProps;
  geo: Geometry;
  floorTextures: { map: THREE.CanvasTexture; roughness: THREE.CanvasTexture };
  contactTexture: THREE.CanvasTexture;
  glowTexture: THREE.CanvasTexture;
}) {
  const { room, floorColor, accent, shadows } = props;
  const mid = -geo.length / 2;
  const sideX = geo.centerX + RACK_DEPTH / 2 + 1.1;

  // Luminarias de teto, em trechos com intervalo. O intervalo e o que da
  // ritmo e, com ele, a leitura de distancia.
  const strips = useInstances(() => {
    const segments = Math.max(4, Math.round(geo.length / 2.2));
    const placements: Placement[] = [];
    for (let i = 0; i < segments; i += 1) {
      const z = -0.8 - i * (geo.length / segments);
      placements.push({ position: [-0.95, CEILING_Y - 0.07, z] });
      placements.push({ position: [0.95, CEILING_Y - 0.07, z] });
    }
    return buildInstances(
      new THREE.BoxGeometry(0.1, 0.03, geo.length / segments - 0.85),
      new THREE.MeshBasicMaterial({
        // Nao branco puro: luminaria estourada come o contraste dos LEDs,
        // que sao o assunto da cena.
        color: new THREE.Color("#9db8cc"),
        toneMapped: false,
      }),
      placements,
    );
  }, [geo.length]);

  // Calha escura em volta de cada luminaria: sem ela a luz parece colada na
  // laje, e e esse detalhe que separa teto de data center de teto generico.
  const housings = useInstances(() => {
    const segments = Math.max(4, Math.round(geo.length / 2.2));
    const placements: Placement[] = [];
    for (let i = 0; i < segments; i += 1) {
      const z = -0.8 - i * (geo.length / segments);
      placements.push({ position: [-0.95, CEILING_Y - 0.03, z] });
      placements.push({ position: [0.95, CEILING_Y - 0.03, z] });
    }
    return buildInstances(
      new THREE.BoxGeometry(0.26, 0.07, geo.length / segments - 0.7),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1b222c"),
        metalness: 0.55,
        roughness: 0.6,
      }),
      placements,
    );
  }, [geo.length]);

  // Halo de cada luminaria, virado para baixo. Faz o papel do bloom que a
  // cena nao tem: borda macia em volta da fonte, e luz derramando na laje.
  const halos = useInstances(() => {
    const segments = Math.max(4, Math.round(geo.length / 2.2));
    const segLength = geo.length / segments;
    const placements: Placement[] = [];
    for (let i = 0; i < segments; i += 1) {
      const z = -0.8 - i * segLength;
      placements.push({ position: [-0.95, CEILING_Y - 0.1, z] });
      placements.push({ position: [0.95, CEILING_Y - 0.1, z] });
    }
    const geometry = new THREE.PlaneGeometry(1.5, segLength * 1.35);
    geometry.rotateX(Math.PI / 2);
    return buildInstances(
      geometry,
      new THREE.MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      placements,
    );
  }, [geo.length, glowTexture]);

  // Bandeja de cabos sobre cada fileira, com travessas e feixes coloridos.
  const trays = useInstances(() => {
    const placements: Placement[] = [];
    const rungs = Math.round(geo.length / 0.55);
    for (let i = 0; i < rungs; i += 1) {
      const z = -0.3 - i * 0.55;
      placements.push({ position: [-geo.centerX, TRAY_Y, z] });
      placements.push({ position: [geo.centerX, TRAY_Y, z] });
    }
    return buildInstances(
      new THREE.BoxGeometry(0.62, 0.035, 0.05),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#39414d"),
        metalness: 0.75,
        roughness: 0.5,
      }),
      placements,
    );
  }, [geo.length, geo.centerX]);

  const bundles = useInstances(() => {
    const rnd = mulberry32(props.seed ^ 0x77b1);
    const placements: Placement[] = [];
    const colors: THREE.Color[] = [];
    const tones = ["#1b2c3a", "#2a3550", "#3a2a1e", "#23303a"];
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 4; i += 1) {
        placements.push({
          position: [
            side * geo.centerX - 0.22 + i * 0.14,
            TRAY_Y + 0.05,
            -geo.length / 2,
          ],
          scale: [1, 1, geo.length + 1.4],
        });
        colors.push(new THREE.Color(tones[Math.floor(rnd() * tones.length)] ?? tones[0]));
      }
    }
    const mesh = buildInstances(
      new THREE.BoxGeometry(0.1, 0.07, 1),
      new THREE.MeshStandardMaterial({ metalness: 0.05, roughness: 0.85 }),
      placements,
    );
    colors.forEach((color, index) => mesh.setColorAt(index, color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }, [geo.length, geo.centerX, props.seed]);

  return (
    <>
      {/* Piso tecnico. Rugosidade por mapa: placa perfurada reflete menos que
          placa lisa, e e essa desigualdade que parece piso de verdade. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, mid]}
        receiveShadow={shadows}
      >
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          map={floorTextures.map}
          roughnessMap={floorTextures.roughness}
          color={new THREE.Color(floorColor)}
          metalness={0.12}
          roughness={0.72}
        />
      </mesh>

      {/* Oclusao de contato fingida na base de cada fileira. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`contact${side}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[side * (geo.faceX - 0.38), 0.006, mid]}
        >
          <planeGeometry args={[0.78, geo.length + 1]} />
          <meshBasicMaterial
            map={contactTexture}
            color="#000000"
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Teto e paredes laterais: fecham a sala. Sem elas a camera olha para
          o vazio nos planos altos. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CEILING_Y, mid]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          color={new THREE.Color(room).multiplyScalar(0.6)}
          metalness={0.05}
          roughness={1}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={`wall${side}`}
          rotation={[0, side * -Math.PI / 2, 0]}
          position={[side * sideX, CEILING_Y / 2, mid]}
        >
          <planeGeometry args={[80, CEILING_Y]} />
          <meshStandardMaterial
            color={new THREE.Color(room)}
            metalness={0.2}
            roughness={0.75}
          />
        </mesh>
      ))}

      {/* Parede do fundo, com uma porta fraca: o corredor precisa de destino,
          mesmo que a nevoa quase a engula. */}
      <mesh position={[0, CEILING_Y / 2, -geo.length - 3.5]}>
        <planeGeometry args={[14, CEILING_Y]} />
        <meshStandardMaterial
          color={new THREE.Color(room)}
          metalness={0.15}
          roughness={0.85}
        />
      </mesh>
      <mesh position={[0, 1.05, -geo.length - 3.45]}>
        <planeGeometry args={[1.0, 2.1]} />
        <meshBasicMaterial color={accent} toneMapped={false} opacity={0.25} transparent />
      </mesh>

      <primitive object={housings} />
      <primitive object={halos} />
      <primitive object={strips} />
      <primitive object={trays} />
      <primitive object={bundles} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Pulso de dados                                                      */
/* ------------------------------------------------------------------ */

/**
 * A requisicao atravessando o sistema: uma faixa de luz que corre pelo piso e
 * pelas bandejas de cabo, do inicio do corredor ao fundo.
 */
function DataPulse({
  props,
  geo,
  progress,
  glowTexture,
}: {
  props: DataCenter3DProps;
  geo: Geometry;
  progress: number;
  glowTexture: THREE.CanvasTexture;
}) {
  const span = geo.length + 7;
  const cycle = ((progress * props.pulseCount) % 1 + 1) % 1;
  const z = 2.8 - cycle * span;
  // Apaga nas pontas: faixa que nasce e morre em corte denuncia o truque.
  const fade = interpolate(Math.sin(Math.PI * cycle), [0, 1], [0, 1], {
    easing: EASE.out,
  });

  if (props.pulseCount <= 0) return null;

  return (
    <>
      <mesh position={[0, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[props.aisleWidth * 1.15, 3.4]} />
        <meshBasicMaterial
          map={glowTexture}
          color={props.accent}
          toneMapped={false}
          transparent
          opacity={0.75 * fade}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`pulse${side}`} position={[side * geo.centerX, TRAY_Y + 0.07, z]}>
          <boxGeometry args={[0.6, 0.05, 1.3]} />
          <meshBasicMaterial
            color={props.accent}
            toneMapped={false}
            transparent
            opacity={0.5 * fade}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
      {props.pulseLight && (
        <pointLight
          position={[0, 1.4, z]}
          color={props.accent}
          intensity={8 * fade}
          distance={5.5}
          decay={2}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Cena                                                                */
/* ------------------------------------------------------------------ */

function DataCenterScene({
  props,
  progress,
  frame,
}: {
  props: DataCenter3DProps;
  progress: number;
  frame: number;
}) {
  const geo = useMemo(() => geometryOf(props), [props]);
  const plans = useMemo(() => planRacks(geo, props.seed), [geo, props.seed]);

  const faceTextures = useMemo(
    () =>
      Array.from({ length: FACE_VARIANTS }, (_, i) =>
        makeFaceTexture(props.seed + i * 977, props.unitsPerRack),
      ),
    [props.seed, props.unitsPerRack],
  );
  const floorTextures = useMemo(() => makeFloorTextures(props.seed), [props.seed]);
  const contactTexture = useMemo(() => makeContactTexture(), []);
  const glowTexture = useMemo(() => makeGlowTexture(), []);

  useEffect(
    () => () => {
      faceTextures.forEach((texture) => texture.dispose());
      floorTextures.map.dispose();
      floorTextures.roughness.dispose();
      contactTexture.dispose();
      glowTexture.dispose();
    },
    [faceTextures, floorTextures, contactTexture, glowTexture],
  );

  const framing = framingOf(props, geo, progress);

  // Luminarias motivadas: tres pontos ao longo do corredor. Com a IBL
  // resolvendo o ambiente, mais luzes dinamicas so custariam quadro.
  const lamps = useMemo(() => {
    const count = 3;
    return Array.from({ length: count }, (_, i) => ({
      key: `lamp${i}`,
      z: -((i + 0.6) * (geo.length / count)),
    }));
  }, [geo.length]);

  return (
    <>
      <CameraRig framing={framing} exposure={props.exposure} />
      <ImageBasedLight intensity={props.envIntensity} />

      <fogExp2 attach="fog" args={[props.haze, props.fogDensity]} />
      <color attach="background" args={[props.haze]} />

      <ambientLight intensity={0.13} color="#9fb6cc" />
      <hemisphereLight args={["#9cb6cf", "#0a0f16", 0.22]} />
      {lamps.map((lamp) => (
        <pointLight
          key={lamp.key}
          // Abaixo da luminaria, nao colado nela: a 30 cm do teto a luz
          // estoura um circulo branco na laje e entrega a fonte pontual.
          position={[0, CEILING_Y - 0.72, lamp.z]}
          color="#dbeaf6"
          // Queda mais suave que o fisico (2): com decay realista o topo do
          // rack estoura e a base some, e a face perde a leitura de servidor.
          intensity={11}
          distance={20}
          decay={1.6}
          castShadow={props.shadows}
          shadow-mapSize-width={props.shadows ? 1024 : 0}
          shadow-mapSize-height={props.shadows ? 1024 : 0}
        />
      ))}

      <Room
        props={props}
        geo={geo}
        floorTextures={floorTextures}
        contactTexture={contactTexture}
        glowTexture={glowTexture}
      />
      <RackRows props={props} geo={geo} plans={plans} faceTextures={faceTextures} />
      <LedField props={props} geo={geo} plans={plans} frame={frame} />
      {props.pulse && <DataPulse
          props={props}
          geo={geo}
          progress={progress}
          glowTexture={glowTexture}
        />}
    </>
  );
}

export function DataCenter3D(props: DataCenter3DProps) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const progress = progressOf(frame, durationInFrames);

  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{ backgroundColor: props.room }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      shadows={props.shadows}
      camera={{ fov: props.fov ?? 45, near: 0.05, far: 140 }}
    >
      <DataCenterScene props={props} progress={progress} frame={frame} />
    </ThreeCanvas>
  );
}
