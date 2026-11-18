/**
 * Numero grande que conta ate o valor, com rotulo e fonte.
 *
 * E o recurso mais usado de documentario de dados, e o mais facil de errar.
 * Duas regras embutidas aqui:
 *
 * 1. O numero formata pelo idioma do canal, nunca por um padrao cravado.
 *    A auditoria do projeto de referencia encontrou `toLocaleString("pt-BR")`
 *    fixo no codigo, que escreveria 1.234,5 onde um americano le 1,234.5.
 *
 * 2. A fonte aparece junto. Afirmacao com numero e sem fonte e o que separa
 *    documentario de conteudo de fabrica — e e o que a politica de conteudo
 *    inautentico do YouTube olha.
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import { COLOR, FONT, SAFE, TYPE } from "../shared/tokens";
import { countTo, presence, progressOf, reveal, window } from "../shared/motion";

const zStat = z.object({
  value: z.number(),
  /** Vem antes do numero: "US$", "£". */
  prefix: z.string().default(""),
  /** Vem depois: "%", " km", "x". */
  suffix: z.string().default(""),
  label: z.string().default(""),
  decimals: z.number().int().min(0).max(4).default(0),
  /** Comeca a contagem deste valor. Util para variacao. */
  from: z.number().default(0),
});

export const statBlockSchema = z.object({
  stats: z.array(zStat).min(1).max(4),
  /** Idioma da formatacao numerica. Vem do mercado do canal. */
  locale: z.string().default("en-US"),
  /** Linha fina acima: contexto ou recorte temporal. */
  eyebrow: z.string().default(""),
  /** Fonte do dado. Omitir e erro editorial, nao economia. */
  source: z.string().default(""),
  layout: z.enum(["row", "stack"]).default("row"),
  align: z.enum(["left", "center"]).default("left"),
  /**
   * Ancoragem vertical. O diagnostico da direcao de arte apontou que tudo
   * vivia na faixa do meio, deixando zonas mortas em cima e embaixo.
   */
  position: z.enum(["top", "middle", "bottom"]).default("middle"),
  ink: z.string().default(COLOR.ink),
  muted: z.string().default(COLOR.muted),
  accent: z.string().default(COLOR.accent),
  fontFamily: z.string().default(FONT.display),
  monoFamily: z.string().default(FONT.mono),
  valueSize: z.number().positive().default(TYPE.hero),
  /** Fracao da cena gasta contando. O resto o numero fica parado, legivel. */
  countWindow: z.number().min(0.05).max(1).default(0.45),
  exitFrames: z.number().min(0).default(0),
});

export type StatBlockProps = z.infer<typeof statBlockSchema>;

export function StatBlock({
  stats,
  locale,
  eyebrow,
  source,
  layout,
  align,
  position,
  ink,
  muted,
  accent,
  fontFamily,
  monoFamily,
  valueSize,
  countWindow,
  exitFrames,
}: StatBlockProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progress = progressOf(frame, durationInFrames);
  const counting = window(progress, 0, countWindow, "out");
  const alive = presence(frame, fps, durationInFrames, { exitFrames });
  const eyebrowIn = reveal(frame, fps, { spring: "light" });
  const sourceIn = reveal(frame, fps, { delay: 16, spring: "light" });

  return (
    <AbsoluteFill
      style={{
        justifyContent:
          position === "top"
            ? "flex-start"
            : position === "bottom"
              ? "flex-end"
              : "center",
        alignItems: align === "center" ? "center" : "flex-start",
        padding: `${SAFE.y + 32}px ${SAFE.x}px`,
        fontFamily,
        opacity: alive,
      }}
    >
      {eyebrow !== "" && (
        <div
          style={{
            color: accent,
            fontSize: TYPE.label,
            letterSpacing: 6,
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 26,
            opacity: eyebrowIn,
          }}
        >
          {eyebrow}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: layout === "row" ? "row" : "column",
          gap: layout === "row" ? 92 : 38,
          alignItems: layout === "row" ? "flex-end" : align === "center" ? "center" : "flex-start",
        }}
      >
        {stats.map((stat, index) => {
          const enter = reveal(frame, fps, { delay: index * 4 });
          const current = countTo(counting, stat.value, stat.from);
          const shown = new Intl.NumberFormat(locale, {
            minimumFractionDigits: stat.decimals,
            maximumFractionDigits: stat.decimals,
          }).format(current);

          return (
            <div
              key={`stat-${index}`}
              style={{
                opacity: enter,
                transform: `translateY(${(1 - enter) * 20}px)`,
                textAlign: align,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  justifyContent: align === "center" ? "center" : "flex-start",
                  color: ink,
                  fontFamily: monoFamily,
                  fontSize: valueSize,
                  fontWeight: 700,
                  lineHeight: 1,
                  // Tabular: sem isto o numero "pula" de largura enquanto
                  // conta, e o olho le como instabilidade.
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {stat.prefix !== "" && (
                  <span style={{ fontSize: valueSize * 0.46, color: muted }}>
                    {stat.prefix}
                  </span>
                )}
                <span>{shown}</span>
                {stat.suffix !== "" && (
                  <span style={{ fontSize: valueSize * 0.46, color: accent }}>
                    {stat.suffix}
                  </span>
                )}
              </div>

              {stat.label !== "" && (
                <div
                  style={{
                    color: muted,
                    fontSize: TYPE.body,
                    marginTop: 12,
                    maxWidth: 420,
                    lineHeight: 1.4,
                  }}
                >
                  {stat.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {source !== "" && (
        <div
          style={{
            color: muted,
            fontSize: TYPE.caption,
            marginTop: 44,
            opacity: sourceIn * 0.85,
            letterSpacing: 0.4,
          }}
        >
          {source}
        </div>
      )}
    </AbsoluteFill>
  );
}
