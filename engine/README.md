# Motor audiovisual — Etapa 1

Transforma um roteiro estruturado em documentário 1920×1080 a 30 fps, H.264, renderizado localmente. Remotion + React como motor de composição.

**Estado: Etapa 1 (fundação).** O contrato de dados, o motor de composição, o render com cache e a bancada de medição estão de pé. A biblioteca visual tem cinco componentes de prova — não é a biblioteca final.

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
