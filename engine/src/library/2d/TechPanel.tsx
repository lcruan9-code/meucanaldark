/**
 * Interface tecnica ficticia: leituras, medidores e uma varredura.
 *
 * Usado para representar sistema em operacao — monitoramento de cabo, painel
 * de data center, console de controle. E ficcao ilustrativa, e o roteiro
 * deve dizer isso quando o assunto for um sistema real: um painel inventado
 * que o espectador toma por captura de tela e desinformacao, nao estilo.
 * Por isso existe a prop `disclaimer`, e por isso ela aparece por padrao.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

import { COLOR, FONT, SAFE, TYPE } from "../shared/tokens";
import { progressOf, reveal, stagger, window } from "../shared/motion";

const zReadout = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  /** 0..1 preenche o medidor. Ausente = so o texto. */
  gauge: z.number().min(0).max(1).optional(),
  state: z.enum(["normal", "good", "warning", "danger"]).default("normal"),
});

export const techPanelSchema = z.object({
  title: z.string().default(""),
  readouts: z.array(zReadout).min(1).max(8),
  columns: z.number().int().min(1).max(3).default(2),
  /** Linha de varredura cruzando o painel. */
  scan: z.boolean().default(true),
  /** Aviso de que o painel e ilustrativo. Vazio remove — use com criterio. */
  disclaimer: z.string().default("Illustrative interface"),
  ink: z.string().default(COLOR.ink),
  muted: z.string().default(COLOR.muted),
  surface: z.string().default(COLOR.surface),
  line: z.string().default(COLOR.surfaceLine),
  accent: z.string().default(COLOR.accent),
  good: z.string().default(COLOR.good),
  warning: z.string().default(COLOR.accentWarm),
  danger: z.string().default(COLOR.danger),
  fontFamily: z.string().default(FONT.mono),
  displayFamily: z.string().default(FONT.display),
});

export type TechPanelProps = z.infer<typeof techPanelSchema>;

export function TechPanel({
  title,
  readouts,
  columns,
  scan,
  disclaimer,
  ink,
  muted,
  surface,
  line,
  accent,
  good,
  warning,
  danger,
  fontFamily,
  displayFamily,
}: TechPanelProps) {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const progress = progressOf(frame, durationInFrames);

  const tone = { normal: accent, good, warning, danger } as const;
  const panelIn = reveal(frame, fps, { spring: "settle" });

  return (
    <AbsoluteFill
      style={{
        padding: `${SAFE.y}px ${SAFE.x}px`,
        fontFamily: displayFamily,
        justifyContent: "center",
      }}
    >
      <div
        style={{
          backgroundColor: surface,
          border: `1px solid ${line}`,
          borderRadius: 6,
          padding: 42,
          opacity: panelIn,
          transform: `translateY(${(1 - panelIn) * 20}px)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {title !== "" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 32,
              paddingBottom: 18,
              borderBottom: `1px solid ${line}`,
            }}
          >
            <div style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: accent }} />
            <div
              style={{
                color: ink,
                fontSize: TYPE.label,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              {title}
            </div>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: "30px 56px",
          }}
        >
          {readouts.map((readout, index) => {
            const delay = stagger(index, 3);
            const enter = reveal(frame, fps, { delay, spring: "light" });
            const fill =
              readout.gauge !== undefined
                ? window(progress, 0.06 + index * 0.03, 0.45 + index * 0.03, "out") * readout.gauge
                : 0;
            const color = tone[readout.state];

            return (
              <div key={`r${index}`} style={{ opacity: enter }}>
                <div
                  style={{
                    color: muted,
                    fontSize: TYPE.caption,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  {readout.label}
                </div>
                <div
                  style={{
                    color: readout.state === "normal" ? ink : color,
                    fontFamily,
                    fontSize: 38,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1,
                  }}
                >
                  {readout.value}
                </div>
                {readout.gauge !== undefined && (
                  <div
                    style={{
                      height: 6,
                      backgroundColor: line,
                      borderRadius: 3,
                      marginTop: 12,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${fill * 100}%`,
                        backgroundColor: color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {scan && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 2,
              top: `${(((frame / fps) * 0.22) % 1) * 100}%`,
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              opacity: 0.35,
            }}
          />
        )}
      </div>

      {disclaimer !== "" && (
        <div
          style={{
            color: muted,
            fontSize: TYPE.caption,
            marginTop: 16,
            letterSpacing: 1,
            opacity: interpolate(panelIn, [0, 1], [0, 0.7]),
          }}
        >
          {disclaimer}
        </div>
      )}
    </AbsoluteFill>
  );
}
