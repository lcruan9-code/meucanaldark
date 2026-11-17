/**
 * Resolucao da linha do tempo: converte o contrato (segundos, narracao) em
 * quadros absolutos que o Remotion consome.
 *
 * Fica fora dos componentes de proposito. Resolver tempo dentro de um
 * componente React significa resolver de novo a cada quadro renderizado, e
 * num documentario de 10 min sao 18.000 execucoes do mesmo calculo.
 */

import type {
  DocumentaryProject,
  ResolvedScene,
  ResolvedTimeline,
  Scene,
} from "../contract";

/** Duracao de cada narracao, em segundos, medida por `npm run narration`. */
export type NarrationDurations = Readonly<Record<string, number>>;

export class TimelineError extends Error {
  constructor(message: string, readonly sceneId: string) {
    super(`cena "${sceneId}": ${message}`);
    this.name = "TimelineError";
  }
}

const secondsToFrames = (seconds: number, fps: number): number =>
  Math.max(1, Math.round(seconds * fps));

/**
 * Duracao de uma cena, em segundos, na ordem de precedencia:
 *   1. `duration` explicito no JSON (override do roteirista)
 *   2. narracao medida + padding
 * Sem nenhum dos dois, e erro: uma cena de duracao indefinida silenciosamente
 * vira 1 quadro no render, e isso so aparece no video pronto.
 */
function sceneSeconds(
  scene: Scene,
  narrationDurations: NarrationDurations,
): { seconds: number; narrationSeconds: number | null } {
  const measured = scene.narration
    ? narrationDurations[scene.narration.src]
    : undefined;

  const narrationSeconds = typeof measured === "number" ? measured : null;

  if (typeof scene.duration === "number") {
    return { seconds: scene.duration, narrationSeconds };
  }

  if (narrationSeconds !== null) {
    return { seconds: narrationSeconds + scene.padding, narrationSeconds };
  }

  if (scene.narration) {
    throw new TimelineError(
      `narracao "${scene.narration.src}" sem duracao medida. ` +
        `Rode "npm run narration" ou defina "duration" na cena.`,
      scene.id,
    );
  }

  throw new TimelineError(
    'sem "narration" e sem "duration": duracao indefinida.',
    scene.id,
  );
}

/**
 * Monta a linha do tempo completa.
 *
 * Transicoes sobrepoem: uma cena com `transitionIn` de 0,5 s comeca 0,5 s
 * antes do fim da anterior. Por isso o total NAO e a soma das duracoes.
 */
export function resolveTimeline(
  project: DocumentaryProject,
  narrationDurations: NarrationDurations = {},
): ResolvedTimeline {
  const { fps } = project;
  const seen = new Set<string>();
  const scenes: ResolvedScene[] = [];
  let cursor = 0;

  for (const scene of project.scenes) {
    if (seen.has(scene.id)) {
      throw new TimelineError("id repetido na linha do tempo.", scene.id);
    }
    seen.add(scene.id);

    const { seconds, narrationSeconds } = sceneSeconds(
      scene,
      narrationDurations,
    );
    const durationInFrames = secondsToFrames(seconds, fps);

    const overlapFrames =
      scene.transitionIn && scene.transitionIn.type !== "none"
        ? Math.min(
            secondsToFrames(scene.transitionIn.duration, fps),
            // Nunca engolir mais que metade da cena: transicao longa demais
            // sobre cena curta faz a anterior sumir antes de ser lida.
            Math.floor(durationInFrames / 2),
          )
        : 0;

    const startFrame = Math.max(0, cursor - overlapFrames);

    scenes.push({
      ...scene,
      startFrame,
      durationInFrames,
      narrationSeconds,
    });

    cursor = startFrame + durationInFrames;
  }

  return {
    project,
    scenes,
    totalFrames: cursor,
    totalSeconds: cursor / fps,
  };
}

/** Capitulos do YouTube, derivados das cenas. Formato "M:SS Titulo". */
export function chapterMarkers(
  timeline: ResolvedTimeline,
): Array<{ seconds: number; title: string; label: string }> {
  const { project, scenes } = timeline;
  const firstSceneOf = new Map<string, number>();

  for (const scene of scenes) {
    if (scene.chapterId && !firstSceneOf.has(scene.chapterId)) {
      firstSceneOf.set(scene.chapterId, scene.startFrame);
    }
  }

  return project.chapters
    .filter((chapter) => firstSceneOf.has(chapter.id))
    .map((chapter) => {
      const frame = firstSceneOf.get(chapter.id) ?? 0;
      const seconds = Math.floor(frame / project.fps);
      const mm = Math.floor(seconds / 60);
      const ss = String(seconds % 60).padStart(2, "0");
      return { seconds, title: chapter.title, label: `${mm}:${ss}` };
    })
    .sort((a, b) => a.seconds - b.seconds);
}
