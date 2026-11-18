/**
 * Legenda queimada, sincronizada por quadro.
 *
 * Fica no motor, nao na biblioteca, por um motivo pratico: legenda e funcao
 * da narracao da CENA, e o motor ja sabe qual narracao cada cena tem. Como
 * camada, todo roteiro teria de lembrar de acrescenta-la em cada cena — e
 * esquecer numa so produz um filme com legenda intermitente.
 *
 * Os tempos vem do VTT da locucao e nao sao reescritos aqui. `cues` chega em
 * segundos relativos ao inicio da cena.
 *
 * Duas legendas ao mesmo tempo nunca aparecem: o VTT real tinha 50 ms de
 * sobreposicao entre as frases 1 e 2, e a escolha abaixo (vence a ULTIMA
 * legenda cujo intervalo contem o quadro) resolve isso sem mexer no arquivo.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { Cue } from "../contract";
import { COLOR, FONT, SAFE } from "../library/shared/tokens";

/** Entrada e saida da legenda, em segundos. Curto: legenda nao e animacao. */
const FADE = 0.14;

export type CaptionsProps = {
  cues: readonly Cue[];
  /** Distancia do rodape, em px. */
  bottom?: number;
  maxWidth?: number;
  fontSize?: number;
};

export function Captions({
  cues,
  bottom = SAFE.y + 24,
  maxWidth = 1320,
  fontSize = 34,
}: CaptionsProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;

  if (cues.length === 0) return null;

  // A ULTIMA que contem o instante: onde dois intervalos se sobrepoem, a
  // legenda nova entra e a anterior sai, em vez de as duas dividirem a tela.
  let active: Cue | null = null;
  for (const cue of cues) {
    if (seconds >= cue.from && seconds < cue.to) active = cue;
  }
  if (!active) return null;

  const fadeIn = interpolate(seconds, [active.from, active.from + FADE], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(seconds, [active.to - FADE, active.to], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        padding: `0 ${SAFE.x}px ${bottom}px`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth,
          padding: "14px 26px",
          // Fundo discreto: escuro o bastante para o texto ler sobre imagem
          // clara, transparente o bastante para nao virar uma tarja.
          backgroundColor: "rgba(3, 6, 11, 0.62)",
          borderRadius: 4,
          opacity,
          transform: `translateY(${interpolate(opacity, [0, 1], [8, 0])}px)`,
        }}
      >
        <div
          style={{
            color: COLOR.ink,
            fontFamily: FONT.body,
            fontSize,
            fontWeight: 500,
            lineHeight: 1.36,
            textAlign: "center",
            // Sombra curta: segura a leitura no quadro claro sem o peso de
            // um filtro, que a medicao da Etapa 2 mostrou ser caro.
            textShadow: "0 2px 10px rgba(0,0,0,0.75)",
          }}
        >
          {active.text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/**
 * Legendas da cena, com a reserva para quando nao ha tempos.
 *
 * Sem `cues` mas com texto de narracao, mostra uma legenda unica cobrindo a
 * cena. Nao e sincronia de verdade e nao deve ir ao ar assim — serve para
 * conferir um rascunho antes de o VTT existir.
 */
export function SceneCaptions({
  cues,
  fallbackText,
  sceneSeconds,
}: {
  cues: readonly Cue[];
  fallbackText: string;
  sceneSeconds: number;
}) {
  if (cues.length > 0) return <Captions cues={cues} />;
  if (fallbackText.trim() === "") return null;
  return (
    <Captions cues={[{ from: 0, to: sceneSeconds, text: fallbackText }]} />
  );
}
