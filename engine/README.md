# Motor audiovisual — Etapas 1 e 2

Transforma um roteiro estruturado em documentário 1920×1080 a 30 fps, H.264, renderizado localmente. Remotion + React como motor de composição.

**Estado: Etapa 2 (biblioteca 2D) concluída.** Contrato de dados, motor de composição, render com cache, bancada de medição e **15 componentes** de biblioteca. Falta o 3D de verdade (Etapa 3) e todo o áudio (Etapa 4).

## Como rodar

```bash
npm install
```

```bash
npm run studio
```

```bash
npm run bench
```

```bash
node scripts/render.mjs hidden-cables
```

## Arquitetura

A separação exigida pelo projeto, e onde cada parte mora:

| Camada | Onde | Regra |
|---|---|---|
| **A. Dados do documentário** | `projects/<id>/project.json` | Roteiro, cenas, narração, legendas. Nenhum código. |
| **B. Biblioteca visual** | `src/library/2d/`, `src/library/3d/` | Componentes que não conhecem documentário nenhum. |
| **C. Motor de composição** | `src/engine/` | Monta a linha do tempo. Não desenha nada. |
| **D. Renderização** | `scripts/render.mjs` | Cache, retomada, concorrência, ffmpeg. |
| **E. Validação** | `scripts/bench.mjs`, `out/<id>/status.json` | Métrica e conferência técnica. |

O elo entre A e B é `src/library/registry.ts`: um nome de componente no JSON (`"world-map"`) vira um componente React. **É essa indireção que permite trocar ou melhorar um componente visual sem reescrever roteiro nenhum**, que é o requisito central da arquitetura.

## Sequências documentais

A camada acima dos componentes, e a correção estrutural da direção de arte V2. Uma sequência **não é um componente**: é uma função que recebe o conteúdo narrativo e emite **várias cenas já compostas** — enquadramento, movimento de câmera, ritmo e corte decididos.

```
roteiro.json → sequências → cenas → camadas → componentes
               (direção)    (o contrato que já existia)
```

No JSON, uma sequência ocupa o lugar de uma cena:

```json
{ "sequence": "establishing-shot",
  "id": "open",
  "params": { "visual": "data-center-3d", "title": "..." } }
```

| Sequência | O que emite |
|---|---|
| `establishing-shot` | Plano geral sem texto · corte · enquadramento fechado com título entrando tarde |
| `technical-reveal` | Chegada ao objeto · partes nomeadas uma a uma, com respiro no fim |
| `system-visualization` | O sistema se monta · depois os pulsos o atravessam |
| `data-storytelling` | Número sozinho · o gráfico que o sustenta · a consequência |
| `consequence-impact` | Frase sustentada com pouca coisa no quadro · respiro · escuro |

**O contrato não mudou.** O expansor roda antes da validação zod e devolve cenas comuns, então o registro, as trilhas, o cache e o render por cena continuam idênticos. Dá para misturar cena escrita à mão com sequência no mesmo roteiro, e a saída de uma sequência é sempre inspecionável como cena normal. Apagar `src/sequences/` não quebraria nada.

## A biblioteca visual

Todo componente é função pura de `frame`, recebe cor e fonte por prop, e não conhece documentário nenhum. O roteiro refere-se a eles pelo nome registrado em `src/library/registry.ts`.

| Nome | Família | O que faz |
|---|---|---|
| `backdrop` | fundo | Gradiente, grade técnica com deriva, vinheta |
| `circuit` | fundo | Trilhas de placa geradas por semente, com sinais correndo |
| `title-card` | texto | Abertura: título assentando palavra a palavra |
| `kinetic-text` | texto | Tipografia cinética com palavra-herói |
| `lower-third` | texto | Tarja com nome, cargo ou fonte |
| `callout` | texto | Destaque curto que entra e sai sozinho |
| `end-card` | texto | Encerramento com as fontes do episódio |
| `stat-block` | dados | Números grandes contando até o valor |
| `bar-chart` | dados | Barras escalonadas, com destaque e referência |
| `line-chart` | dados | Série temporal que se desenha, com marcadores |
| `tech-panel` | dados | Painel técnico ilustrativo com medidores |
| `node-graph` | diagrama | Redes, topologias, fluxogramas e cadeias |
| `diagram` | diagrama | Chamadas com linha-guia anotando o que está na tela |
| `world-map` | geografia | Mapa Natural Earth com rotas que se iluminam |
| `cable-3d` | cena 3D | Cabo submarino, câmera viajando |

Três decisões de biblioteca que valem explicar:

**Um componente para redes, topologias e fluxogramas.** São o mesmo grafo com layouts diferentes — `flow`, `radial`, `manual`. Três componentes separados dariam três implementações do mesmo traço e três jeitos de ficarem inconsistentes.

**A palavra-herói sai do roteiro, não de uma prop.** Em `kinetic-text`, asteriscos marcam a palavra que recebe cor e peso: `"cerca de *99 por cento* do tráfego"`. Quem escreve a frase é quem sabe qual palavra carrega o peso.

**O `diagram` tem fundo transparente.** O uso que importa não é desenhar um diagrama isolado — é anotar o que já está na tela, inclusive uma cena 3D. Ele entra na trilha `overlay` e aponta.

### Movimento de câmera e transições moram no motor

`camera` é um campo de **qualquer** camada, não um componente. Um lugar só dá zoom, travelling e reenquadramento à biblioteca inteira, 2D e 3D:

```json
{ "component": "world-map",
  "camera": { "fromScale": 1, "toScale": 1.18, "originX": 0.36 },
  "props": { "routes": [] } }
```

As transições (`fade`, `dip-to-black`, `whip`, `cross-zoom`) são propriedade da cena que chega, porque a linha do tempo recua o início dela e mantém a anterior montada por baixo.

## Decisões técnicas

### 1. Cena é feita de camadas, não de um `type`

O JSON de referência propunha `"type": "map_2d"`. Isso prende a cena a um único elemento. Documentário real empilha: um plano 3D de cabo recebe por cima uma tarja com a fonte e um selo de "reconstituição". O contrato usa `layers[]` com `track` (`background` / `main` / `overlay`), e é o que permite combinar 2D, 3D e mídia real na mesma cena — explicitamente pedido na seção 7 do briefing.

### 2. A duração vem da narração, não do JSON

`duration` existe mas é override. O padrão é medir o arquivo de narração e somar `padding`. Assim, **trocar a voz re-sincroniza o filme inteiro sem editar cena nenhuma** — o requisito da seção 6. As durações medidas ficam em `projects/<id>/durations.json`, geradas por um passo de preparo, nunca medidas durante o render: medir 18.000 vezes o que não muda é desperdício.

### 3. Render por cena é o padrão quando há 3D

A documentação do Remotion registra um vazamento de memória do Chrome quando se usa `--gl=angle`, e recomenda partir renders longos. Como `angle` é o que põe a GPU para trabalhar, o modo `scenes` deixa de ser otimização e vira requisito de estabilidade em documentário de 10 minutos.

O briefing avisou para não presumir que dividir em cenas economiza memória. Correto: dividir **custa** tempo (cada cena reabre o Chrome) e só economiza memória porque o processo morre entre cenas. Por isso `scripts/render.mjs` implementa **os dois modos** e `npm run bench` mede ambos. O número decide, não a intuição.

### 4. Cache por hash da cena

Cada cena vira `out/<id>/scenes/<sceneId>-<hash>.mp4`, com o hash cobrindo a cena resolvida inteira. Isso entrega de uma vez três itens da seção 8: reaproveitar cena não alterada, re-renderizar só o que mudou, e retomar render interrompido. A junção final é `concat -c copy` — sem reencode, sem perda.

### 5. Determinismo é obrigatório, não preferência

Render é quadro a quadro. Qualquer `Math.random()`, `Date.now()` ou estado dentro de um componente faz quadros vizinhos divergirem, e o resultado "chia". Todo componente da biblioteca é função pura de `frame`. O grão de filme usa `seed` derivado do quadro, que é determinístico e ainda assim muda a cada quadro, que é o que grão precisa fazer.

### 6. Sem dependência nova para ffmpeg

A concatenação usa `npx remotion ffmpeg`, que expõe o binário que o Remotion já traz. Nenhum pacote extra, nenhum serviço pago.

## Licença do Remotion

Gratuita para pessoa física, entidade sem fins lucrativos e empresa com até 3 pessoas — **inclusive uso comercial**. A partir de 4 pessoas exige Company License paga. Enquanto `meucanaldark` for operação pessoal, está na faixa gratuita. Se a estrutura crescer, isso vira custo recorrente e precisa ser reavaliado.

## O que falta (Etapas 2 a 7)

| Etapa | Conteúdo |
|---|---|
| 2 | Biblioteca 2D: tipografia cinética, diagramas, infográficos, gráficos, fluxogramas, circuitos, transições. Coastlines reais (Natural Earth 110m) no lugar do contorno grosseiro atual. |
| 3 | Biblioteca 3D: chips, placas, racks, satélites, fibra. Materiais e iluminação reutilizáveis. Pré-render para cenas caras. |
| 4 | Áudio: narração em inglês, trilha, efeitos, mixagem, legendas sincronizadas. |
| 5 | Piloto completo: *The Hidden Cables That Keep the Internet Alive*. |
| 6 | Render longo de 8 a 12 min, com métricas de estabilidade. |
| 7 | Integração ao fluxo de produção. |

## Estrutura

```
engine/
├── projects/<id>/project.json     # A — o documentário
├── projects/<id>/durations.json   # A — durações medidas da narração
├── src/contract.ts                # o contrato, em zod
├── src/engine/timeline.ts         # resolve segundos -> quadros
├── src/engine/Documentary.tsx     # C — motor de composição
├── src/library/registry.ts        # B — nome -> componente
├── src/library/2d/                # B — componentes 2D
├── src/library/3d/                # B — componentes 3D
├── src/bench/                     # E — composições de medição
├── scripts/render.mjs             # D — render, cache, retomada
├── scripts/bench.mjs              # E — métricas
└── out/<id>/status.json           # E — progresso, legível remotamente
```
