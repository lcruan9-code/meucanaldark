/**
 * Cabo submarino em 3D, com a camera viajando ao longo dele e as camadas
 * internas se revelando.
 *
 * Esta cena tambem e a prova de carga da Etapa 3: mede o custo real de WebGL
 * dentro do Remotion neste hardware. O numero que ela produz decide se as
 * cenas 3D entram direto no filme ou se precisam ser pre-renderizadas.
 *
 * Determinismo: nada aqui depende de relogio, random ou estado. A posicao de
 * tudo e funcao pura de `frame`. Sem isso, dois quadros vizinhos divergem e o
 * video "chia".
 */

import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { z } from "zod";

export const cableScene3DSchema = z.object({
  /** Quantas camadas internas o corte revela. */
  layers: z.number().int().min(1).max(6).default(4),
  /** Avanco da camera ao longo do cabo, em fracao (0..1). */
  travelFrom: z.number().min(0).max(1).default(0),
  travelTo: z.number().min(0).max(1).default(0.85),
  /** Em que ponto da cena o corte comeca a abrir (0..1). */
  cutawayAt: z.number().min(0).max(1).default(0.45),
  core: z.string().default("#f5a524"),
  shield: z.string().default("#8b97a8"),
  sheath: z.string().default("#16222f"),
  water: z.string().default("#04121c"),
  accent: z.string().default("#39d0d8"),
  /**
   * Segmentos ao longo do tubo. 160 ja da silhueta limpa em 1080p; dobrar
   * nao muda a imagem e cobra memoria de GPU em cada quadro.
   */
  tubularSegments: z.number().int().min(32).max(512).default(160),
  radialSegments: z.number().int().min(6).max(64).default(20),
  /**
   * Enquadramento. O cabo tem raio 1,5: a camera a menos de ~8 unidades
   * enche o quadro e a imagem vira um gradiente abstrato, nao um cabo.
   * Estes valores sao o ponto de partida; cada plano afina os seus.
   */
  cameraDistance: z.number().positive().default(17),
  cameraHeight: z.number().default(5.5),
  cameraSide: z.number().default(3),
  fov: z.number().min(10).max(120).default(45),
});

export type CableScene3DProps = z.infer<typeof cableScene3DSchema>;

/**
 * TubeGeometry com menos de ~3 segmentos degenera: o calculo de frames de
 * Frenet devolve undefined e o render morre com "reading 'x'". Este piso
 * existe por isso, nao por estetica.
 */
const MIN_TUBE_SEGMENTS = 8;

/** Abaixo disto a camada e invisivel; nao vale gastar geometria nela. */
const REVEAL_EPSILON = 0.02;

function useCableCurve(): THREE.CatmullRomCurve3 {
  return useMemo(() => {
    const points = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return new THREE.Vector3(
        (t - 0.5) * 60,
        Math.sin(t * Math.PI * 1.7) * 2.2 - 1.2,
        Math.cos(t * Math.PI * 1.3) * 3.4,
      );
    });
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  }, []);
}

type CameraRigProps = {
  position: THREE.Vector3;
  target: THREE.Vector3;
};

/**
 * Posiciona a camera padrao do canvas. Um `<perspectiveCamera>` solto na
 * arvore nao vira a camera do render sem `makeDefault`; mexer na do contexto
 * e mais direto e nao depende de drei.
 */
function CameraRig({ position, target }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return null;
}

type CableBodyProps = {
  props: CableScene3DProps;
  progress: number;
};

function CableBody({ props, progress }: CableBodyProps) {
  const curve = useCableCurve();
  const {
    layers,
    core,
    shield,
    sheath,
    accent,
    water,
    tubularSegments,
    radialSegments,
  } = props;

  const travel = interpolate(progress, [0, 1], [props.travelFrom, props.travelTo]);
  const cut = interpolate(progress, [props.cutawayAt, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const at = Math.min(0.995, Math.max(0, travel));
  const ahead = Math.min(0.999, at + 0.04);
  const anchor = curve.getPointAt(at);
  const target = curve.getPointAt(ahead);

  const cameraPosition = useMemo(
    () =>
      new THREE.Vector3(
        anchor.x - props.cameraSide,
        anchor.y + props.cameraHeight,
        anchor.z + props.cameraDistance,
      ),
    [
      anchor.x,
      anchor.y,
      anchor.z,
      props.cameraSide,
      props.cameraHeight,
      props.cameraDistance,
    ],
  );

  const radii = Array.from(
    { length: layers },
    (_, i) => 1.5 * (1 - i / (layers + 0.4)),
  );
  const palette = [sheath, shield, accent, core, shield, core];

  return (
    <>
      <CameraRig position={cameraPosition} target={target} />

      <ambientLight intensity={0.45} color={water} />
      <directionalLight position={[8, 14, 10]} intensity={1.5} />
      <pointLight
        position={[anchor.x, anchor.y + 3, anchor.z + 4]}
        intensity={28}
        color={accent}
        distance={26}
      />

      {radii.map((radius, index) => {
        // A bainha externa esta sempre la; as internas so aparecem conforme
        // o corte avanca.
        const reveal = index === 0 ? 1 : cut;
        if (reveal < REVEAL_EPSILON) return null;

        const segments = Math.max(
          MIN_TUBE_SEGMENTS,
          Math.round(tubularSegments * reveal),
        );

        return (
          <mesh key={`layer${index}`}>
            <tubeGeometry
              args={[curve, segments, radius, radialSegments, false]}
            />
            <meshStandardMaterial
              color={palette[index % palette.length]}
              metalness={index === 0 ? 0.1 : 0.75}
              roughness={index === 0 ? 0.85 : 0.28}
              transparent={index === 0}
              opacity={index === 0 ? 1 - cut * 0.55 : 1}
            />
          </mesh>
        );
      })}

      {/* Nevoa de agua profunda: barato, e e o que vende a escala. O inicio
          acompanha a distancia da camera para o cabo nao nascer ja apagado. */}
      <fog attach="fog" args={[water, props.cameraDistance * 0.7, 110]} />
    </>
  );
}

export function CableScene3D(props: CableScene3DProps) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 1;

  return (
    <ThreeCanvas
      width={width}
      height={height}
      style={{ backgroundColor: props.water }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: props.fov, near: 0.1, far: 160 }}
    >
      <CableBody props={props} progress={progress} />
    </ThreeCanvas>
  );
}
