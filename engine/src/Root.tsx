/**
 * Raiz do Remotion.
 *
 * Registra uma composicao por projeto encontrado em `projects/`. Cada uma
 * recebe sua propria linha do tempo, ja resolvida, via defaultProps. Assim o
 * Studio abre qualquer documentario sem recompilar nada, e o render por CLI
 * escolhe pelo id.
 *
 * As composicoes de bancada (`bench-*`) existem so para medir desempenho:
 * sao curtas, isoladas e nao entram em nenhum filme.
 */

import { Composition } from "remotion";

import { Documentary } from "./engine/Documentary";
import { resolveTimeline } from "./engine/timeline";
import { zProject } from "./contract";
import { PROJECTS } from "./projects";
import { BENCH_PROJECTS } from "./bench/benchProjects";

export function RemotionRoot() {
  const all = [...PROJECTS, ...BENCH_PROJECTS];

  return (
    <>
      {all.map(({ raw, durations }) => {
        const project = zProject.parse(raw);
        const timeline = resolveTimeline(project, durations);

        return (
          <Composition
            key={project.id}
            id={project.id}
            component={Documentary}
            durationInFrames={timeline.totalFrames}
            fps={project.fps}
            width={project.width}
            height={project.height}
            defaultProps={{ timeline }}
          />
        );
      })}
    </>
  );
}
