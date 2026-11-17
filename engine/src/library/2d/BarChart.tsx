/**
 * Barras e indicadores.
 *
 * Decisoes que vieram de assistir documentario, nao de biblioteca de grafico:
 *
 * - As barras crescem escalonadas, nao juntas. Juntas, o olho nao compara;
 *   escalonadas, ele le a ordem como argumento.
 * - O valor aparece na ponta da barra e acompanha o crescimento. Valor fixo
 *   antes de a barra chegar entrega o final antes da hora.
 * - Uma barra pode ser destacada. Num documentario quase sempre ha uma que
 *   importa e as outras sao contexto.
 */

import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import { COLOR, FONT, SAFE, SERIES, TYPE } from "../shared/tokens";
import { countTo, progressOf, stagger, window } from "../shared/motion";

const zBar = z.object({
  label: z.string().min(1),
  value: z.number(),
  /** Sobrepoe a cor da serie. */
  color: z.string().optional(),
  /** Barra em destaque: as demais perdem saturacao. */
  highlight: z.boolean().default(false),
});

export const barChartSchema = z.object({
  bars: z.array(zBar).min(1).max(12),
  title: z.string().default(""),
  orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  locale: z.string().default("en-US"),
  unit: z.string().default(""),
  decimals: z.number().int().min(0).max(3).default(0),
  /** Teto da escala. Ausente = maior valor com 8% de folga. */
  max: z.number().positive().optional(),
  /** Linha de referencia: meta, media, limite. */
  reference: z.number().optional(),
  referenceLabel: z.string().default(""),
  ink: z.string().default(COLOR.ink),
  muted: z.string().default(COLOR.muted),
  surface: z.string().default(COLOR.surface),
  accent: z.string().default(COLOR.accent),
  /**
   * Cor das barras que NAO sao o destaque.
   *
   * Uma cor por barra sugere ao espectador que cada uma e uma categoria
   * diferente de coisa. Numa serie unica — "falhas por causa" — isso e uma
   * afirmacao falsa feita com cor. Quando ha destaque, o resto e contexto e
   * usa um tom so.
   */
  neutral: z.string().default("#3a4a5c"),
  fontFamily: z.string().default(FONT.display),
  monoFamily: z.string().default(FONT.mono),
  /** Atraso entre barras, em quadros. */
  stagger: z.number().min(0).default(4),
  /** Fracao da cena gasta crescendo. */
  growWindow: z.number().min(0.05).max(1).default(0.5),
});

export type BarChartProps = z.infer<typeof barChartSchema>;

export function BarChart({
  bars,
  title,
  orientation,
  locale,
  unit,
  decimals,
  max,
  reference,
  referenceLabel,
  ink,
  muted,
  surface,
  accent,
  neutral,
  fontFamily,
  monoFamily,
  stagger: perBar,
  growWindow,
}: BarChartProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = progressOf(frame, durationInFrames);

  const ceiling = max ?? Math.max(...bars.map((b) => b.value)) * 1.08;
  const anyHighlight = bars.some((b) => b.highlight);
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const isHorizontal = orientation === "horizontal";

  return (
    <AbsoluteFill
      style={{
        padding: `${SAFE.y}px ${SAFE.x}px`,
        fontFamily,
        justifyContent: "center",
      }}
    >
      {title !== "" && (
        <div
          style={{
            color: ink,
            fontSize: TYPE.subheading,
            fontWeight: 700,
            marginBottom: 44,
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: isHorizontal ? "column" : "row",
          alignItems: isHorizontal ? "stretch" : "flex-end",
          gap: isHorizontal ? 22 : 34,
          height: isHorizontal ? undefined : 460,
        }}
      >
        {bars.map((bar, index) => {
          const delay = stagger(index, perBar) / (durationInFrames || 1);
          const grow = window(
            progress,
            Math.min(0.9, delay),
            Math.min(1, delay + growWindow),
            "out",
          );
          const shown = countTo(grow, bar.value);
          const fraction = ceiling > 0 ? Math.max(0, shown / ceiling) : 0;

          const color =
            bar.color ??
            (bar.highlight
              ? accent
              : anyHighlight
                ? neutral
                : SERIES[index % SERIES.length]);
          const dimmed = anyHighlight && !bar.highlight;

          if (isHorizontal) {
            return (
              <div key={bar.label} style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <div
                  style={{
                    color: dimmed ? muted : ink,
                    fontSize: TYPE.label,
                    fontWeight: 600,
                    width: 290,
                    textAlign: "right",
                    flexShrink: 0,
                  }}
                >
                  {bar.label}
                </div>

                <div
                  style={{
                    flex: 1,
                    height: 42,
                    backgroundColor: surface,
                    borderRadius: 3,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${fraction * 100}%`,
                      backgroundColor: color,
                      opacity: dimmed ? 0.4 : 1,
                      borderRadius: 3,
                      willChange: "width",
                    }}
                  />
                </div>

                <div
                  style={{
                    color: dimmed ? muted : ink,
                    fontFamily: monoFamily,
                    fontSize: TYPE.label,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    width: 170,
                    flexShrink: 0,
                    opacity: grow > 0.02 ? 1 : 0,
                  }}
                >
                  {format.format(shown)}
                  {unit}
                </div>
              </div>
            );
          }

          return (
            <div
              key={bar.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                height: "100%",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  color: dimmed ? muted : ink,
                  fontFamily: monoFamily,
                  fontSize: TYPE.label,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  opacity: grow > 0.02 ? 1 : 0,
                }}
              >
                {format.format(shown)}
                {unit}
              </div>
              <div
                style={{
                  width: "100%",
                  height: `${fraction * 100}%`,
                  backgroundColor: color,
                  opacity: dimmed ? 0.4 : 1,
                  borderRadius: "3px 3px 0 0",
                  willChange: "height",
                }}
              />
              <div
                style={{
                  color: dimmed ? muted : ink,
                  fontSize: TYPE.caption,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {bar.label}
              </div>
            </div>
          );
        })}
      </div>

      {reference !== undefined && ceiling > 0 && (
        <div
          style={{
            marginTop: 26,
            color: muted,
            fontSize: TYPE.caption,
            borderTop: `1px dashed ${muted}`,
            paddingTop: 10,
            opacity: progress > 0.15 ? 0.9 : 0,
          }}
        >
          {referenceLabel === "" ? "" : `${referenceLabel}: `}
          {format.format(reference)}
          {unit}
        </div>
      )}
    </AbsoluteFill>
  );
}
