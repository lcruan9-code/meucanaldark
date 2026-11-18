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
import { expandSequences } from "./sequences";
import { needsWebgl } from "./library/registry";
import { PROJECTS } from "./projects";
import { BENCH_PROJECTS } from "./bench/benchProjects";

export function RemotionRoot() {
  const all = [...PROJECTS, ...BENCH_PROJECTS];

  return (
    <>
      {all.map(({ raw, durations }) => {
        // Sequencias expandem ANTES do zod: dai em diante o motor so ve
        // cenas comuns, e o contrato nao precisou mudar.
        const project = zProject.parse(expandSequences(raw));
        const resolved = resolveTimeline(project, durations);
        const timeline = {
          ...resolved,
          usesWebgl: needsWebgl(
            resolved.scenes.flatMap((scene) =>
              scene.layers.map((item) => item.component),
            ),
          ),
        };

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
