/**
 * Motor de composicao: pega a linha do tempo resolvida e a toca.
 *
 * Nao sabe desenhar nada. Toda imagem vem da biblioteca, pelo registro.
 * Essa separacao e o que permite trocar um componente visual sem tocar em
 * roteiro nenhum, e e a razao de este arquivo ser curto.
 *
 * Duas coisas moram aqui, e nao nos componentes, por alavancagem:
 * o movimento de camera (serve a biblioteca inteira, 2D e 3D) e as
 * transicoes entre cenas (precisam enxergar duas cenas ao mesmo tempo).
 */

import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createElement, type ReactNode } from "react";

import type {
  CameraMove,
  Layer,
  ResolvedScene,
  ResolvedTimeline,
} from "../contract";
import { getEntry } from "../library/registry";
import { EASE, progressOf } from "../library/shared/motion";
import { SceneCaptions } from "./Captions";

const dbToGain = (db: number): number => 10 ** (db / 20);

type CameraRigProps = {
  camera: CameraMove;
  durationInFrames: number;
  children: ReactNode;
};

/**
 * Zoom e travelling sobre a camada inteira.
 *
 * `transform` e composto pela GPU do Chromium; mexer em largura, altura ou
 * posicao forcaria recalculo de layout a cada quadro, que e justamente o que
 * a medicao da Etapa 1 mostrou ser caro.
 */
function CameraRig({ camera, durationInFrames, children }: CameraRigProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const progress = progressOf(frame, durationInFrames);

  const ease = EASE[camera.easing];
  const at = (from: number, to: number) =>
    interpolate(progress, [0, 1], [from, to], { easing: ease });

  const scale = at(camera.fromScale, camera.toScale);
  const x = at(camera.fromX, camera.toX) * width;
  const y = at(camera.fromY, camera.toY) * height;

  return (
    <AbsoluteFill
      style={{
        transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        transformOrigin: `${camera.originX * 100}% ${camera.originY * 100}%`,
        willChange: "transform",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

type FadeWrapperProps = {
  fadeInFrames: number;
  fadeOutFrames: number;
  durationInFrames: number;
  children: ReactNode;
};

function FadeWrapper({
  fadeInFrames,
  fadeOutFrames,
  durationInFrames,
  children,
}: FadeWrapperProps) {
  const frame = useCurrentFrame();

  if (fadeInFrames === 0 && fadeOutFrames === 0) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  const fadeIn =
    fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], {
          extrapolateRight: "clamp",
        })
      : 1;

  const fadeOut =
    fadeOutFrames > 0
      ? interpolate(
          frame,
          [durationInFrames - fadeOutFrames, durationInFrames - 1],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 1;

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>{children}</AbsoluteFill>
  );
}

type LayerHostProps = {
  layer: Layer;
  sceneDurationInFrames: number;
  fps: number;
};

function LayerHost({ layer, sceneDurationInFrames, fps }: LayerHostProps) {
  const entry = getEntry(layer.component);
  const props = entry.schema.parse(layer.props);

  const from = Math.round(layer.from * fps);
  const duration = layer.duration
    ? Math.round(layer.duration * fps)
    : sceneDurationInFrames - from;

  if (duration <= 0) return null;

  const content = createElement(entry.component, props as never);

  const faded = (
    <FadeWrapper
      fadeInFrames={Math.round(layer.fadeIn * fps)}
      fadeOutFrames={Math.round(layer.fadeOut * fps)}
      durationInFrames={duration}
    >
      {content}
    </FadeWrapper>
  );

  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      {layer.camera ? (
        <CameraRig camera={layer.camera} durationInFrames={duration}>
          {faded}
        </CameraRig>
      ) : (
        faded
      )}
    </Sequence>
  );
}

const TRACK_ORDER = { background: 0, main: 1, overlay: 2 } as const;

/**
 * Transicao de entrada da cena.
 *
 * A cena anterior continua montada por baixo durante a sobreposicao (a linha
 * do tempo recua o inicio desta), entao a transicao e sempre uma propriedade
 * da cena que CHEGA. `dip-to-black` e a excecao aparente: ela cobre tudo com
 * preto e vai abrindo, o que o olho le como as duas cenas passando pelo
 * escuro.
 */
function sceneTransitionStyle(
  type: NonNullable<ResolvedScene["transitionIn"]>["type"],
  t: number,
): { style: React.CSSProperties; blackout: number } {
  switch (type) {
    case "fade":
      return { style: { opacity: t }, blackout: 0 };
    case "dip-to-black":
      return { style: {}, blackout: 1 - t };
    case "whip":
      return {
        style: {
          opacity: Math.min(1, t * 2),
          transform: `translateX(${(1 - t) * 14}%)`,
          filter: t < 0.98 ? `blur(${(1 - t) * 18}px)` : undefined,
        },
        blackout: 0,
      };
    case "cross-zoom":
      return {
        style: {
          opacity: t,
          transform: `scale(${interpolate(t, [0, 1], [1.14, 1])})`,
        },
        blackout: 0,
      };
    default:
      return { style: {}, blackout: 0 };
  }
}

function SceneView({ scene }: { scene: ResolvedScene }) {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const ordered = [...scene.layers].sort(
    (a, b) => TRACK_ORDER[a.track] - TRACK_ORDER[b.track],
  );

  const transition = scene.transitionIn;
  const frames =
    transition && transition.type !== "none"
      ? Math.round(transition.duration * fps)
      : 0;

  const t =
    frames > 0
      ? interpolate(frame, [0, frames], [0, 1], {
          extrapolateRight: "clamp",
          easing: EASE.inOut,
        })
      : 1;

  const { style, blackout } = transition
    ? sceneTransitionStyle(transition.type, t)
    : { style: {}, blackout: 0 };

  return (
    <AbsoluteFill style={style}>
      {ordered.map((layer, index) => (
        <LayerHost
          key={`${scene.id}-${layer.component}-${index}`}
          layer={layer}
          sceneDurationInFrames={scene.durationInFrames}
          fps={fps}
        />
      ))}

      {blackout > 0 && (
        <AbsoluteFill
          style={{ backgroundColor: "#000", opacity: blackout, pointerEvents: "none" }}
        />
      )}

      {scene.narration && (
        <Audio
          src={staticFile(scene.narration.src)}
          volume={dbToGain(scene.narration.gainDb)}
          // Fatia de uma locucao compartilhada. Fatias contiguas entre cenas
          // vizinhas reproduzem o arquivo inteiro uma unica vez, sem
          // repeticao e sem silencio no corte.
          {...(scene.narration.trimBefore !== undefined
            ? { trimBefore: Math.round(scene.narration.trimBefore * fps) }
            : {})}
          {...(scene.narration.trimAfter !== undefined
            ? { trimAfter: Math.round(scene.narration.trimAfter * fps) }
            : {})}
        />
      )}

      {scene.captions && (
        <SceneCaptions
          cues={scene.cues}
          fallbackText={scene.narration?.text ?? ""}
          sceneSeconds={scene.durationInFrames / fps}
        />
      )}

      {scene.sfx.map((sfx, index) => (
        <Sequence key={`sfx-${index}`} from={Math.round(sfx.at * fps)} layout="none">
          <Audio src={staticFile(sfx.src)} volume={dbToGain(sfx.gainDb)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/**
 * Grao de filme.
 *
 * `feTurbulence` e rasterizado em CPU e foi um dos motivos de o 2D sair mais
 * caro que o 3D na medicao da Etapa 1. Por isso o padrao do tema e baixo e
 * zero desliga por completo, sem custo residual.
 */
function Grain({ amount }: { amount: number }) {
  const frame = useCurrentFrame();
  if (amount <= 0) return null;

  const seed = frame % 12;
  return (
    <AbsoluteFill
      style={{ opacity: amount, mixBlendMode: "overlay", pointerEvents: "none" }}
    >
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
}

export type DocumentaryProps = {
  timeline: ResolvedTimeline;
};

export function Documentary({ timeline }: DocumentaryProps) {
  const { project, scenes } = timeline;

  return (
    <AbsoluteFill style={{ backgroundColor: project.theme.palette.bg }}>
      {scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationInFrames}
          name={scene.id}
          layout="none"
        >
          <SceneView scene={scene} />
        </Sequence>
      ))}

      {project.audio.music && (
        <Audio
          src={staticFile(project.audio.music)}
          volume={(frame) => {
            const baseGain = dbToGain(project.audio.musicGainDb);
            const duckGain = dbToGain(
              project.audio.musicGainDb + (project.audio.duckDb ?? -10),
            );

            // Suavizacao com rampa de 15 quadros (0.5s a 30fps)
            const RAMP = 15;
            let minDistanceToSpeech = Infinity;
            let isInsideSpeech = false;

            for (const scene of scenes) {
              if (!scene.narration || !scene.narrationSeconds) continue;
              const nFrames = Math.round(scene.narrationSeconds * project.fps);
              const start = scene.startFrame;
              const end = scene.startFrame + nFrames;

              if (frame >= start && frame <= end) {
                isInsideSpeech = true;
                break;
              }

              if (frame < start) {
                minDistanceToSpeech = Math.min(minDistanceToSpeech, start - frame);
              } else if (frame > end) {
                minDistanceToSpeech = Math.min(minDistanceToSpeech, frame - end);
              }
            }

            if (isInsideSpeech) return duckGain;

            if (minDistanceToSpeech < RAMP) {
              const t = minDistanceToSpeech / RAMP;
              return duckGain + (baseGain - duckGain) * t;
            }

            return baseGain;
          }}
          loop
        />
      )}

      <Grain amount={project.theme.grain} />
    </AbsoluteFill>
  );
}
