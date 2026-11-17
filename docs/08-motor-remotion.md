# 08 — Motor audiovisual em Remotion (Etapa 1)

Registro da Etapa 1: fundação do motor que transforma roteiro estruturado em documentário 1080p30. Código em [`engine/`](../engine/), decisões de arquitetura no [README do motor](../engine/README.md).

Data: 17/11/2026. Remotion 4.0.544, React 19.2, Three.js 0.187.

---

## Métricas reais

Medidas nesta máquina, não estimadas. 300 quadros a 1920×1080, 30 fps, H.264 CRF 18, `--gl=angle`.

**Máquina:** Intel i7-13650HX (14 núcleos, 20 threads), 40 GB RAM, NVIDIA RTX 3050 6 GB, Windows 11.

| Cena | Concorrência | fps | × tempo real | 10 min renderizam em | Pico de RAM |
|---|---|---|---|---|---|
| 2D | 1 | 5,7 | 5,3× | 53 min | 1312 MB |
| 2D | 10 | **11,6** | **2,6×** | **26 min** | 343 MB |
| 3D | 1 | 5,7 | 5,3× | 53 min | 1023 MB |
| 3D | 10 | **15,8** | **1,9×** | **19 min** | 1237 MB |
| 2D sobre 3D | 1 | 5,7 | 5,3× | 53 min | 552 MB |
| 2D sobre 3D | 10 | **15,4** | **1,9×** | **20 min** | 303 MB |

Empacotamento: 3,5 a 10 s.

### Três leituras que mudam o plano

**1. A janela de 2 horas é folgada.** Um documentário de 10 minutos renderiza em 19 a 26 minutos. Mesmo no pior caso medido — concorrência 1 — são 53 minutos. Render não é o gargalo deste projeto.

**2. O 3D é mais barato que o 2D, e isso inverte a premissa da auditoria.** A 15,8 fps contra 11,6 do 2D. A razão: o mapa 2D usa `filter: drop-shadow` nas rotas, `backdrop-filter: blur` na tarja e `feTurbulence` no grão — tudo rasterizado em CPU. O 3D vai para a GPU pela ANGLE.

Isso contraria o que a auditoria do Projeto Canais mediu (palco 3D a 6× o tempo real). A diferença não é a GPU: é a arquitetura. Lá, cada quadro atravessava a ponte Chromium↔Python como PNG em base64. No Remotion a captura é direta. **A conclusão prática: o custo não está em "ser 3D", está em efeito de CSS caro e em ponte mal desenhada.**

**3. A concorrência 1 que você pediu é desperdício aqui.** A 1, tudo roda a 5,7 fps independentemente do conteúdo — 2D, 3D e misto dão exatamente o mesmo número. Isso significa que o gargalo a concorrência 1 é a sobrecarga por quadro do Remotion, não o desenho. A instrução de concorrência 1 fazia sentido para o Ryzen com 16 GB; nesta máquina ela custa o dobro do tempo sem ganho.

Memória nunca chegou perto de ser problema: pico de 1,3 GB em 40 GB disponíveis.

### O que estas medições NÃO provam

São clipes de **10 segundos**. A documentação do Remotion registra vazamento de memória do Chrome com `--gl=angle` em renders longos, e é justamente por isso que o render por cena existe. **Estabilidade em 10 minutos contínuos é a Etapa 6 e não pode ser extrapolada daqui.**

---

## O que foi construído

| Camada | Arquivo | Estado |
|---|---|---|
| Contrato de dados | `src/contract.ts` | Completo, validado em zod |
| Resolução da linha do tempo | `src/engine/timeline.ts` | Completo, com capítulos do YouTube |
| Motor de composição | `src/engine/Documentary.tsx` | Completo |
| Registro da biblioteca | `src/library/registry.ts` | Completo |
| Componentes 2D | `Backdrop`, `TitleCard`, `LowerThird`, `WorldMap` | Prova, não biblioteca |
| Componente 3D | `CableScene3D` | Prova, não biblioteca |
| Render com cache e retomada | `scripts/render.mjs` | Completo, dois modos |
| Bancada de medição | `scripts/bench.mjs` | Completo |
| Medição de narração | `scripts/prepare.mjs` | Completo, sem áudio para exercitar |
| Conferência técnica | `scripts/validate.mjs` | Completo |

### Critérios de conclusão: onde estamos

| Critério | Estado |
|---|---|
| Recebe roteiro estruturado | ✅ |
| Organiza cenas na linha do tempo | ✅ |
| Renderiza cenas 2D | ✅ |
| Renderiza cenas 3D | ✅ |
| Combina 2D e 3D no mesmo documentário | ✅ medido (`bench-mixed`) |
| Gera MP4 válido 1080p30 | ✅ |
| Mantém memória controlada | ✅ em 10 s; **não verificado em 10 min** |
| Permite corrigir e re-renderizar cenas | ✅ implementado; **não exercitado** |
| Sincroniza narração, trilha e efeitos | ❌ Etapa 4 |
| Legendas sincronizadas | ❌ Etapa 4 |
| Renderiza documentário longo | ❌ Etapa 6 |

---

## Problemas conhecidos, nomeados

**1. Os contornos do mapa são grosseiros.** `src/library/2d/data/world-coarse.ts` tem a Eurásia como um bloco de 38 pontos. Serve para provar projeção, enquadramento e animação de rota — não serve para documentário. A Etapa 2 troca por Natural Earth 110m (domínio público); nenhum roteiro muda, porque a troca é interna ao componente.

**2. A cena 3D tem encanamento, não fotografia.** WebGL, geometria, materiais, névoa, câmera animada e determinismo funcionam. Mas o plano é um tubo nu em fundo vazio: falta chão oceânico, referência de escala, partículas e luz volumétrica. E o corte que deveria revelar as camadas internas não lê, porque transparência em Three.js não ordena profundidade como eu supus — vai precisar de `clippingPlanes` ou de geometria cortada de verdade.

**3. Dois ajustes de ambiente que custaram tempo e ficam registrados:** o Remotion 4.0.544 exige **zod 4.6.7** (zod 3 passa no typecheck e quebra no render), e o webpack do Remotion **não resolve `.js` para `.tsx`** — imports relativos vão sem extensão.

**4. `npm run prepare` não pode existir.** `prepare` é nome de ciclo de vida do npm e rodaria sozinho a cada `npm install`. O script chama-se `narration`.

---

## Decisões que fogem do briefing, e por quê

**Construído fora do Projeto Canais, não dentro.** O briefing pede integração e proibe migração destrutiva. Mas o fork do Projeto Canais nunca foi criado — a auditoria concluiu que usar o repositório do autor direto é inseguro ([`01`](01-auditoria-seguranca.md)), e você optou por "só o dossiê". Construir o motor isolado satisfaz as três regras de uma vez: nada do Projeto Canais foi tocado, o HyperFrames continua intacto, e não houve migração. É também o que a sua própria Etapa 7 pede, ao pôr a integração por último.

**Cena é feita de camadas, não de `type`.** O JSON de referência propunha `"type": "map_2d"`, o que prende a cena a um elemento só. O contrato usa `layers[]` com `track`, e é o que permite o item 7 do briefing: combinar 2D, 3D e mídia real na mesma cena. O `bench-mixed` existe para medir exatamente isso.

**Concorrência padrão é metade das threads, não 1.** Pela medição acima. O valor continua configurável por `--concurrency`.

---

## Próximo passo

A Etapa 2 (biblioteca 2D) é o maior volume de trabalho, mas a Etapa 3 (3D) é a que tem risco técnico real — o corte revelando camadas internas é um problema de geometria, não de ajuste.

Uma observação de ordem, porém: o [plano geral](07-plano.md) mantém o **Portão 0** — um episódio piloto de 10 minutos feito à mão, para medir retenção antes de automatizar. As métricas acima mostram que o motor é viável; elas não dizem nada sobre o formato funcionar em inglês. Construir as Etapas 2 a 7 antes do Portão 0 é construir uma fábrica para um produto não validado.
