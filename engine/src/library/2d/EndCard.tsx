/**
 * Encerramento.
 *
 * Carrega as fontes do episodio, e isso nao e enfeite: a politica de
 * conteudo inautentico do YouTube olha para sinal de trabalho proprio, e
 * creditar a pesquisa e o sinal mais barato que existe. Tambem e o que
 * separa um documentario de um texto narrado por voz sintetica.
 *
 * A chamada final entra por ultimo e sozinha. Pedir inscricao junto com as
 * fontes faz as duas coisas se perderem.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import { COLOR, FONT, SAFE, TYPE } from "../shared/tokens";
import { progressOf, reveal, stagger } from "../shared/motion";

export const endCardSchema = z.object({
  title: z.string().default(""),
  /** Fontes do episodio, uma por linha. */
  sources: z.array(z.string()).default([]),
  sourcesHeading: z.string().default("Sources"),
  /** Chamada final. Entra depois das fontes. */
  cta: z.string().default(""),
  /** Proximo episodio, quando houver serie. */
  next: z.string().default(""),
  ink: z.string().default(COLOR.ink),
  muted: z.string().default(COLOR.muted),
  accent: z.string().default(COLOR.accent),
  fontFamily: z.string().default(FONT.display),
  /** Escurece ate preto no fim: fecha o filme em vez de cortar. */
  fadeToBlack: z.boolean().default(true),
});

export type EndCardProps = z.infer<typeof endCardSchema>;

export function EndCard({
  title,
  sources,
  sourcesHeading,
  cta,
  next,
  ink,
  muted,
  accent,
  fontFamily,
  fadeToBlack,
}: EndCardProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const progress = progressOf(frame, durationInFrames);

  const titleIn = reveal(frame, fps, { spring: "settle" });
  const ruleIn = reveal(frame, fps, { delay: 8, spring: "light" });
  // A chamada so entra depois que as fontes terminaram de subir.
  const ctaDelay = 20 + sources.length * 3;
  const ctaIn = reveal(frame, fps, { delay: ctaDelay, spring: "settle" });

  const blackout = fadeToBlack
    ? interpolate(progress, [0.82, 1], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          padding: `${SAFE.y}px ${SAFE.x}px`,
          fontFamily,
        }}
      >
        {title !== "" && (
          <div
            style={{
              color: ink,
              fontSize: TYPE.title,
              fontWeight: 800,
              letterSpacing: -1.4,
              lineHeight: 1.1,
              maxWidth: 1180,
              opacity: titleIn,
              transform: `translateY(${(1 - titleIn) * 26}px)`,
            }}
          >
            {title}
          </div>
        )}

        <div
          style={{
            height: 3,
            width: interpolate(ruleIn, [0, 1], [0, 180]),
            backgroundColor: accent,
            marginTop: 28,
            marginBottom: 38,
            borderRadius: 2,
          }}
        />

        {sources.length > 0 && (
          <div>
            <div
              style={{
                color: accent,
                fontSize: TYPE.caption,
                fontWeight: 700,
                letterSpacing: 5,
                textTransform: "uppercase",
                marginBottom: 14,
                opacity: ruleIn,
              }}
            >
              {sourcesHeading}
            </div>
            {sources.map((source, index) => {
              const enter = reveal(frame, fps, {
                delay: stagger(index, 3, 14),
                spring: "light",
              });
              return (
                <div
                  key={`src${index}`}
                  style={{
                    color: muted,
                    fontSize: TYPE.caption,
                    lineHeight: 1.75,
                    opacity: enter * 0.9,
                    transform: `translateY(${(1 - enter) * 10}px)`,
                  }}
                >
                  {source}
                </div>
              );
            })}
          </div>
        )}

        {cta !== "" && (
          <div
            style={{
              color: ink,
              fontSize: TYPE.subheading,
              fontWeight: 700,
              marginTop: 52,
              opacity: ctaIn,
              transform: `translateY(${(1 - ctaIn) * 16}px)`,
            }}
          >
            {cta}
          </div>
        )}

        {next !== "" && (
          <div
            style={{
              color: muted,
              fontSize: TYPE.body,
              marginTop: 14,
              opacity: ctaIn * 0.85,
            }}
          >
            {next}
          </div>
        )}
      </AbsoluteFill>

      {blackout > 0 && (
        <AbsoluteFill style={{ backgroundColor: "#000", opacity: blackout }} />
      )}
    </AbsoluteFill>
  );
}
