/**
 * Abertura cinematografica: titulo que assenta palavra a palavra, regua que
 * se desenha, subtitulo que sobe.
 *
 * V2, pelo diagnostico da direcao de arte: o titulo deixou de morar no meio
 * do quadro. Cartela centralizada vertical e horizontalmente le como slide
 * de apresentacao; ancorada embaixo, com a regua sangrando para fora pela
 * esquerda, le como filme. Por isso `position` existe e o padrao e `bottom`.
 *
 * O ritmo continua sendo o que importa: palavras entram escalonadas, nunca
 * todas juntas. Entrada simultanea e a assinatura visual de template barato.
 */

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

import { COLOR, FONT, SAFE, TYPE, tracking } from "../shared/tokens";

export const titleCardSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().default(""),
  /** Linha fina acima do titulo: capitulo, data, lugar. */
  eyebrow: z.string().default(""),
  align: z.enum(["left", "center"]).default("left"),
  /** Onde a cartela ancora. `bottom` e o padrao por desenho, nao por acaso. */
  position: z.enum(["top", "middle", "bottom"]).default("bottom"),
  ink: z.string().default(COLOR.ink),
  muted: z.string().default(COLOR.muted),
  accent: z.string().default(COLOR.accent),
  fontFamily: z.string().default(FONT.display),
  titleSize: z.number().positive().default(TYPE.title),
  /** Atraso entre palavras, em quadros. */
  stagger: z.number().min(0).default(3),
  /**
   * A regua sangra para fora do quadro pela esquerda.
   *
   * A direcao de arte pede que ao menos um elemento por plano saia do
   * quadro: e o que separa composicao de diagrama centralizado.
   */
  bleedRule: z.boolean().default(true),
  maxWidth: z.number().positive().default(1240),
  /**
   * Escurecimento sob o texto, para legibilidade sobre imagem movimentada.
   *
   * Nasceu de um defeito real: o titulo da demo sobre o corredor de data
   * center ficou ilegivel, e o subtitulo sumiu nos racks iluminados. A
   * legibilidade pertence ao componente que precisa dela, nao ao roteiro.
   * 0 desliga, para quando o fundo ja e escuro.
   */
  scrim: z.number().min(0).max(1).default(0.72),
});

export type TitleCardProps = z.infer<typeof titleCardSchema>;

const JUSTIFY = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
} as const;

export function TitleCard({
  title,
  subtitle,
  eyebrow,
  align,
  position,
  ink,
  muted,
  accent,
  fontFamily,
  titleSize,
  stagger,
  bleedRule,
  maxWidth,
  scrim,
}: TitleCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = title.split(" ").filter(Boolean);
  const lastWordStart = stagger * Math.max(0, words.length - 1);

  const rule = spring({
    frame: frame - (lastWordStart + 6),
    fps,
    config: { damping: 200, mass: 0.6 },
    durationInFrames: 28,
  });

  const subtitleIn = spring({
    frame: frame - (lastWordStart + 14),
    fps,
    config: { damping: 200, mass: 0.8 },
  });

  const eyebrowIn = spring({ frame, fps, config: { damping: 200 } });

  // Com a regua sangrando, ela comeca fora do quadro e entra: o bloco de
  // texto mantem a margem, so o traco atravessa.
  const ruleWidth = interpolate(rule, [0, 1], [0, bleedRule ? SAFE.x + 260 : 220]);

  // Direcao do escurecimento segue a ancoragem: o texto embaixo pede um
  // degrade que sobe do rodape; em cima, o contrario.
  const scrimDirection =
    position === "top" ? "180deg" : position === "bottom" ? "0deg" : "0deg";

  return (
    <AbsoluteFill
      style={{
        justifyContent: JUSTIFY[position],
        alignItems: align === "center" ? "center" : "flex-start",
        padding:
          position === "bottom"
            ? `0 ${SAFE.x}px ${SAFE.y + 48}px`
            : position === "top"
              ? `${SAFE.y + 48}px ${SAFE.x}px 0`
              : `0 ${SAFE.x}px`,
        fontFamily,
        textAlign: align,
      }}
    >
      {scrim > 0 && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(${scrimDirection}, rgba(3,6,11,${scrim}) 0%, rgba(3,6,11,${scrim * 0.82}) 28%, transparent 68%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {eyebrow !== "" && (
        <div
          style={{
            color: accent,
            fontSize: TYPE.caption,
            letterSpacing: 6,
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 22,
            opacity: eyebrowIn,
            transform: `translateY(${interpolate(eyebrowIn, [0, 1], [14, 0])}px)`,
          }}
        >
          {eyebrow}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: `${titleSize * 0.1}px ${titleSize * 0.26}px`,
          justifyContent: align === "center" ? "center" : "flex-start",
          maxWidth,
        }}
      >
        {words.map((word, index) => {
          const enter = spring({
            frame: frame - index * stagger,
            fps,
            config: { damping: 200, mass: 0.9 },
          });
          return (
            <span
              key={`${word}-${index}`}
              style={{
                color: ink,
                fontSize: titleSize,
                fontWeight: 800,
                lineHeight: 1.04,
                letterSpacing: tracking(titleSize),
                opacity: enter,
                transform: `translateY(${interpolate(enter, [0, 1], [38, 0])}px)`,
                // Desfoque na entrada: o olho le como foco assentando, nao
                // como elemento aparecendo. Custa rasterizacao, entao some
                // assim que a palavra chega.
                filter: enter < 0.96 ? `blur(${interpolate(enter, [0, 1], [10, 0])}px)` : undefined,
                willChange: "transform, opacity",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      <div
        style={{
          height: 3,
          width: ruleWidth,
          backgroundColor: accent,
          marginTop: 30,
          marginLeft: bleedRule ? -SAFE.x : 0,
          borderRadius: bleedRule ? "0 2px 2px 0" : 2,
        }}
      />

      {subtitle !== "" && (
        <div
          style={{
            color: muted,
            fontSize: TYPE.subheading,
            fontWeight: 400,
            marginTop: 24,
            maxWidth: 900,
            lineHeight: 1.4,
            opacity: subtitleIn,
            transform: `translateY(${interpolate(subtitleIn, [0, 1], [18, 0])}px)`,
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
}
