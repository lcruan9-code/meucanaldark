/**
 * Clipe de video como camada da biblioteca.
 *
 * Existe para que material ja renderizado — Blender, arquivo, captura — entre
 * na linha do tempo do mesmo jeito que qualquer outro componente: como uma
 * camada numa cena, com `camera`, `fadeIn`/`fadeOut` e trilha funcionando por
 * cima sem tratamento especial.
 *
 * Usa `OffthreadVideo` em vez de `Video`: o render extrai o quadro exato por
 * ffmpeg, fora da thread do navegador, em vez de depender de o elemento
 * `<video>` ter buscado a posicao certa. E o que garante que o quadro 300 do
 * render seja mesmo o quadro 300 do arquivo.
 *
 * NAO e uma cena 3D. O MP4 e imagem plana; quem precisa de geometria usa um
 * componente da familia `cena-3d`.
 */

import { AbsoluteFill, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { z } from "zod";

export const videoClipSchema = z.object({
  /** Caminho dentro de `public/`, como `video/turbofan-preview.mp4`. */
  src: z.string().min(1),
  /**
   * `cover` preenche o quadro e corta o excesso; `contain` cabe inteiro e
   * deixa barras. Para documentario, `cover` quase sempre — barra preta no
   * meio do filme le como erro, nao como escolha.
   */
  fit: z.enum(["cover", "contain", "fill"]).default("cover"),
  /**
   * Padrao mudo. O audio do filme e a locucao e a trilha; faixa de um clipe
   * entrando por engano briga com a narracao e nao aparece em nenhum
   * controle de mixagem.
   */
  muted: z.boolean().default(true),
  /**
   * Trecho do arquivo, em SEGUNDOS. Permite cortar sem reexportar.
   *
   * O roteiro pensa em segundos; o Remotion conta em quadros. A conversao
   * acontece aqui dentro, com o fps da composicao — passar segundos direto
   * para o `OffthreadVideo` faria `trimAfter: 7.37` virar sete quadros de
   * video, e o resto do plano congelaria.
   */
  trimBefore: z.number().min(0).optional(),
  trimAfter: z.number().min(0).optional(),
  /** Velocidade. 1 = tempo real. */
  playbackRate: z.number().positive().default(1),
  /** Escurecimento por cima, para texto ler. 0 desliga. */
  scrim: z.number().min(0).max(1).default(0),
  /** Cor do escurecimento. */
  scrimColor: z.string().default("#03060b"),
  /** Dessaturacao, 0 a 1. Material cru costuma destoar da paleta do filme. */
  desaturate: z.number().min(0).max(1).default(0),
  /** Cor de fundo atras do video. Aparece com `contain`. */
  background: z.string().default("#03060b"),
});

export type VideoClipProps = z.infer<typeof videoClipSchema>;

export function VideoClip({
  src,
  fit,
  muted,
  trimBefore,
  trimAfter,
  playbackRate,
  scrim,
  scrimColor,
  desaturate,
  background,
}: VideoClipProps) {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: background, overflow: "hidden" }}>
      <OffthreadVideo
        src={staticFile(src)}
        muted={muted}
        playbackRate={playbackRate}
        {...(trimBefore !== undefined
          ? { trimBefore: Math.round(trimBefore * fps) }
          : {})}
        {...(trimAfter !== undefined
          ? { trimAfter: Math.round(trimAfter * fps) }
          : {})}
        style={{
          width: "100%",
          height: "100%",
          objectFit: fit,
          filter: desaturate > 0 ? `saturate(${1 - desaturate})` : undefined,
        }}
      />

      {scrim > 0 && (
        <AbsoluteFill
          style={{ backgroundColor: scrimColor, opacity: scrim, pointerEvents: "none" }}
        />
      )}
    </AbsoluteFill>
  );
}
