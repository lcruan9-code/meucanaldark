/**
 * Motor de composicao: pega a linha do tempo resolvida e a toca.
 *
 * Nao sabe desenhar nada. Toda imagem vem da biblioteca, pelo registro.
 * Essa separacao e o que permite trocar um componente visual sem tocar em
 * roteiro nenhum, e e a razao de este arquivo ser curto.
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
import { createElement } from "react";

import type { Layer, ResolvedScene, ResolvedTimeline } from "../contract";
import { getEntry } from "../library/registry";

const dbToGain = (db: number): number => 10 ** (db / 20);

type LayerHostProps = {
  layer: Layer;
  sceneDurationInFrames: number;
  fps: number;
};

function LayerHost({ layer, sceneDurationInFrames, fps }: LayerHostProps) {
  const entry = getEntry(layer.component);
  // Validar aqui, e nao no render de cada quadro, seria melhor; o schema
  // roda uma vez por montagem porque o Remotion remonta a arvore por quadro
  // apenas quando a Sequence entra. O custo e desprezivel e o erro aparece
  // com o nome do componente, nao como "undefined is not an object".
  const props = entry.schema.parse(layer.props);

  const from = Math.round(layer.from * fps);
  const duration = layer.duration
    ? Math.round(layer.duration * fps)
    : sceneDurationInFrames - from;

  if (duration <= 0) return null;

  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <FadeWrapper
        fadeInFrames={Math.round(layer.fadeIn * fps)}
        fadeOutFrames={Math.round(layer.fadeOut * fps)}
        durationInFrames={duration}
      >
        {createElement(entry.component, props as never)}
      </FadeWrapper>
    </Sequence>
  );
}

type FadeWrapperProps = {
  fadeInFrames: number;
  fadeOutFrames: number;
  durationInFrames: number;
  children: React.ReactNode;
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

  return <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>{children}</AbsoluteFill>;
}

const TRACK_ORDER = { background: 0, main: 1, overlay: 2 } as const;

function SceneView({ scene }: { scene: ResolvedScene }) {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const ordered = [...scene.layers].sort(
    (a, b) => TRACK_ORDER[a.track] - TRACK_ORDER[b.track],
  );

  // Transicao de entrada: a cena anterior continua montada por baixo, entao
  // basta a nova aparecer. Dip-to-black e tratado no nivel do filme.
  const transitionFrames =
    scene.transitionIn && scene.transitionIn.type !== "none"
      ? Math.round(scene.transitionIn.duration * fps)
      : 0;

  const opacity =
    transitionFrames > 0
      ? interpolate(frame, [0, transitionFrames], [0, 1], {
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <AbsoluteFill style={{ opacity }}>
      {ordered.map((layer, index) => (
        <LayerHost
          key={`${scene.id}-${layer.component}-${index}`}
          layer={layer}
          sceneDurationInFrames={scene.durationInFrames}
          fps={fps}
        />
      ))}

      {scene.narration && (
        <Audio
          src={staticFile(scene.narration.src)}
          volume={dbToGain(scene.narration.gainDb)}
        />
      )}

      {scene.sfx.map((sfx, index) => (
        <Sequence
          key={`sfx-${index}`}
          from={Math.round(sfx.at * fps)}
          layout="none"
        >
          <Audio src={staticFile(sfx.src)} volume={dbToGain(sfx.gainDb)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** Grao de filme. Determinista por quadro; sem isso o grao "anda". */
function Grain({ amount }: { amount: number }) {
  const frame = useCurrentFrame();
  if (amount <= 0) return null;

  return (
    <AbsoluteFill style={{ opacity: amount, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${frame % 12}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            seed={frame % 12}
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${frame % 12})`} />
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
          volume={dbToGain(project.audio.musicGainDb)}
          loop
        />
      )}

      <Grain amount={project.theme.grain} />
    </AbsoluteFill>
  );
}
