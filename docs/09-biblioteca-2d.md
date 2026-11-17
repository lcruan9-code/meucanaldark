# 09 — Biblioteca 2D (Etapa 2)

Registro da Etapa 2. Código em [`engine/src/library/`](../engine/src/library/), catálogo no [README do motor](../engine/README.md).

Data: 17/11/2026.

---

## Cobertura do briefing

A Etapa 2 pedia dezessete itens. Onde cada um foi parar:

| Pedido | Onde |
|---|---|
| Aberturas cinematográficas | `title-card` |
| Títulos e subtítulos animados | `title-card` |
| Tipografia cinética | `kinetic-text` |
| Mapas animados | `world-map` |
| Rotas e conexões geográficas | `world-map` |
| Diagramas técnicos | `diagram` |
| Infográficos | `stat-block` + `diagram` |
| Gráficos de dados | `line-chart` |
| Barras e indicadores | `bar-chart`, `tech-panel` |
| Fluxogramas | `node-graph` (layout `flow`) |
| Interfaces tecnológicas fictícias | `tech-panel` |
| Animações de circuitos | `circuit` |
| Animações de redes e conexões | `node-graph` (layout `radial`) |
| Transições cinematográficas | **motor**, não componente |
| Zooms e movimentos de câmera | **motor**, não componente |
| Destaques e chamadas visuais | `callout` |
| Encerramentos | `end-card` |

São 13 componentes 2D novos ou revistos, mais duas capacidades que ficaram no motor.

---

## Três decisões que moldaram a biblioteca

### 1. Câmera e transição moram no motor, não nos componentes

`camera` é campo de **qualquer** camada. Um lugar só dá zoom, travelling e reenquadramento à biblioteca inteira — inclusive às cenas 3D, que ganharam movimento de câmera 2D sem uma linha de código no componente 3D.

```json
{ "component": "world-map",
  "camera": { "fromScale": 1, "toScale": 1.18, "originX": 0.36 },
  "props": { "showBorders": true } }
```

Se isso fosse prop de componente, cada um dos quinze teria a sua implementação, e dezessete documentários depois haveria dezessete jeitos de dar zoom.

As transições (`fade`, `dip-to-black`, `whip`, `cross-zoom`) são propriedade da cena que **chega**, porque a linha do tempo recua o início dela e mantém a anterior montada por baixo.

### 2. Um componente para redes, topologias e fluxogramas

O briefing pedia "fluxogramas" e "animações de redes e conexões" como itens separados. São o mesmo grafo com layouts diferentes — `flow`, `radial`, `manual`. Separar daria três implementações do mesmo traço e três jeitos de ficarem inconsistentes entre si.

Os pulsos correndo pelas arestas são o que separa mostrar a topologia de mostrar a rede funcionando.

### 3. A palavra-herói sai do roteiro, não de uma prop

Em `kinetic-text`, asteriscos marcam a palavra que recebe cor e peso:

> `"Almost *99 per cent* of the traffic travels under the sea."`

Quem escreve a frase é quem sabe qual palavra carrega o peso. Uma prop separada obrigaria o roteirista a contar índices de palavra.

---

## Duas regras editoriais embutidas no código

Não são estética — são defesa contra o risco número um do projeto, a política de conteúdo inautêntico do YouTube ([`06`](06-licenca-e-riscos.md)).

**`stat-block` tem campo `source`, e `end-card` tem lista de fontes.** Afirmação com número e sem fonte é o que separa documentário de conteúdo de fábrica. O campo existir faz o roteirista lembrar.

**`tech-panel` tem `disclaimer` ligado por padrão**, com o texto "Illustrative interface". Um painel inventado que o espectador toma por captura de tela real é desinformação, não estilo.

E uma terceira, herdada da auditoria: **todo número formata pelo `locale` do canal**, nunca por padrão cravado. A auditoria do projeto de referência encontrou `toLocaleString("pt-BR")` fixo no código, que escreveria `1.234,5` onde um americano lê `1,234.5` ([`02`](02-pipeline-video.md)).

---

## O mapa agora é Natural Earth

`world-coarse.ts` — a Eurásia como um bloco de 38 pontos — saiu. No lugar:

| Arquivo | Tamanho | Conteúdo |
|---|---|---|
| `data/world-110m.ts` | 61,0 KB | 123 anéis, 4.139 pontos (massas de terra) |
| `data/world-borders-110m.ts` | 33,7 KB | 148 linhas, 2.364 pontos (fronteiras) |
| `data/landmarks.ts` | — | 12 cidades de referência |

Fonte: Natural Earth 110m, domínio público, via `world-atlas@2`. O gerador fica em `scripts/build-map-data.mjs` e é reprodutível, com tolerância de simplificação de 0,08° (~0,4 px em 1920) e descarte de ilhas abaixo de 0,15 deg².

A API pública do componente não mudou: só ganhou `showBorders` (padrão `false`). Nenhum roteiro precisou ser tocado — que era exatamente a promessa do registro.

Duas decisões do trabalho de dados que valem registro: os 123 anéis desenham num **único `<path>`**, não em 123 elementos, porque o Chrome paga a composição uma vez por quadro em vez de 123; e furos (lagos, o Cáspio) ficaram de fora, porque furo de verdade exigiria `fill-rule` num path só e o ganho visual não paga. O Cáspio aparece como terra.

---

## Métricas

### O par de controle, e o que ele provou

A Etapa 1 mediu o 2D saindo mais caro que o 3D e levantou a hipótese de que a culpa é dos filtros de CSS/SVG, não do desenho. A Etapa 2 montou o par para testar: duas bancadas com carga visual parecida, uma com `drop-shadow`, `blur` e `backdrop-filter`, outra sem nenhum.

300 quadros, 1080p30, concorrência 10, `--gl=angle`:

| Bancada | fps | × tempo real | 10 min em | Pico RAM |
|---|---|---|---|---|
| 2D **com** filtros caros | 8,2 | 3,7× | 37 min | 1053 MB |
| 2D **sem** filtros caros | **13,7** | **2,2×** | **22 min** | 690 MB |
| 3D | **13,8** | **2,2×** | **22 min** | 692 MB |

**O 2D enxuto empata com o 3D — 13,7 contra 13,8 fps.** A hipótese está confirmada: o custo não está em "ser 2D" nem em "ser 3D", está em `filter` e `backdrop-filter`, que o Chromium rasteriza em CPU.

Consequência prática: `drop-shadow` e `blur` passam a ser decisão consciente, não padrão. O registro da biblioteca marca cada componente com `costlyFilter`, e hoje só quatro dos quinze usam filtro caro por padrão.

### O custo do mapa de verdade

O mesmo `bench-2d` fazia 11,6 fps na Etapa 1 e faz 8,2 agora. A diferença é o mapa: os contornos grosseiros tinham ~90 pontos, o Natural Earth tem 4.139. **Um mapa decente custou 29% do tempo de render** — e vale o preço, porque era o defeito visual mais visível do projeto.

### Vitrine completa, pelo modo cenas

11 cenas, 1.261 quadros, render por cena com cache e concatenação:

**2m15s · 9,36 fps · 3,21× tempo real · pico 1044 MB** → 10 min de documentário em ~32 min.

Por cena, as três pontas:

| Cena | Quadros | Tempo |
|---|---|---|
| `s-circuit` (trilhas geradas) | 120 | 9,0 s |
| `s-map` (Natural Earth + fronteiras + câmera) | 150 | 23,7 s |
| `s-line` (SVG com eixos) | 120 | 13,3 s |

O modo cenas paga ~3 s de abertura do Chrome por cena. Com 11 cenas são ~33 s dos 135 — **24% de sobrecarga**, o preço do cache e da retomada. Num documentário de 10 min com 60 cenas, essa conta precisa ser refeita: é exatamente a medição da Etapa 6.

### Um defeito do cache, encontrado e corrigido

O hash da cena cobria só o JSON do roteiro. Mudar o código de um componente sem tocar no roteiro deixava o hash idêntico, e a cena voltava do cache **desatualizada, em silêncio** — o tipo de erro que só aparece no vídeo pronto.

Corrigido: o hash agora inclui uma impressão digital de todo o `src/`. Mudou qualquer componente, as cenas afetadas re-renderizam sozinhas.

### Defeitos visuais pegos na conferência

Olhar os quadros renderizados pegou três coisas que o typecheck não pega:

1. **Rótulo da série saindo pela borda** do gráfico de linha — corrigido ancorando no fim, acima da linha.
2. **Eixo X sem marcação de ano** numa série temporal — corrigido com `xTicks`.
3. **Uma cor por barra** num gráfico de série única, o que afirma com cor uma categorização que não existe nos dados — corrigido: com destaque, o resto usa um tom neutro só.

---

## O que falta

A Etapa 2 não fecha o requisito de qualidade cinematográfica sozinha. Fica pendente:

- **Fontes reais.** Tudo usa `Inter` e `JetBrains Mono` por nome; se a fonte não estiver instalada, o Chromium cai no fallback e a tipografia perde o desenho. Carregar as fontes como arquivo no `public/` é trabalho pequeno e precisa ser feito antes do piloto.
- **Legendas**, que são da Etapa 4 junto com o áudio.
- **Mídia real** (foto, vídeo de arquivo) ainda não tem componente. O contrato suporta — é só mais uma camada — mas não há `media` registrado.
- **A cena 3D continua sendo encanamento, não fotografia** ([`08`](08-motor-remotion.md)). Etapa 3.
