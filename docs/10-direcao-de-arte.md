# 10 — Direção de arte V2

Diagnóstico dos componentes da Etapa 2 e a direção de arte que os tira de "demonstração técnica". Escrito olhando os quadros renderizados, não o código.

---

## Diagnóstico: por que a vitrine parece slide

O problema não são os componentes. Cada um faz bem o que promete. O problema é que **não existe camada entre "componente" e "filme"** — e, sem ela, toda cena vira *um componente centralizado num quadro vazio*. Isso é, literalmente, a estrutura de um slide.

Nove defeitos concretos, em ordem de quanto custam:

### 1. Não existe plano, só assunto
Um quadro de documentário tem primeiro plano, assunto e fundo. Os nossos têm só o assunto. Nada é cortado pela borda, nada se sobrepõe, nada está fora de foco. Tudo cabe inteiro, centralizado, com ar de todos os lados.

### 2. A câmera não se move
A capacidade existe desde a Etapa 2 — e **uma única cena das onze usou**. Quadro parado com corte em dissolvência é a definição de apresentação automática.

### 3. A escala tipográfica é tímida
Hero 96 px, corpo 26 px: razão de 3,7 para 1. Cartela de documentário trabalha em 8 ou 10 para 1. Sem contraste de escala não há hierarquia — há "texto grande" e "texto menor".

### 4. Tudo vive na faixa do meio
O conteúdo ocupa entre 30% e 60% da altura. Sobram zonas mortas em cima e embaixo. É pensamento de área segura aplicado à composição, e achata o quadro.

### 5. A escada de valor tem dois degraus
Fundo quase preto, texto quase branco, e quase nada no meio. Sem tons intermediários, não há profundidade — só figura recortada sobre fundo.

### 6. Não há textura nem imperfeição
Gradientes puros e preenchimentos chapados. O grão está em 0,04, praticamente desligado. Quadro limpo demais lê como renderização, não como imagem captada.

### 7. A dissolvência faz o trabalho que o corte deveria fazer
Dissolver entre todas as cenas é o que uma apresentação faz ao avançar o slide. Documentário corta seco na batida e guarda a dissolvência para salto de tempo.

### 8. O 3D não tem ambiente
Materiais padrão com duas luzes e nenhum mapa de ambiente dão plástico, não metal. E o objeto flutua em fundo vazio: sem chão, sem contexto, sem escala.

### 9. Só há uma cor
Um acento ciano em tudo. Sem uma segunda temperatura, todo quadro tem a mesma emoção.

---

## A proposta: sequências, não mais componentes

A correção estrutural é acrescentar **uma camada acima dos componentes** — exatamente o que o briefing pediu no item 4.

Uma **sequência** não é um componente. É uma função que recebe o conteúdo narrativo e **emite várias cenas já compostas**, com enquadramento, movimento de câmera, ritmo e corte decididos. É onde mora o conhecimento de direção.

```
roteiro.json  →  sequências  →  cenas  →  camadas  →  componentes
                 (direção)      (contrato que já existe)
```

Implementação sem tocar no contrato: o JSON pode trazer `{ "sequence": "...", "params": {...} }` no lugar de uma cena, e um expansor roda **antes** da validação zod, devolvendo cenas comuns. O contrato, o registro, as trilhas e o cache continuam exatamente como estão — e a saída de uma sequência é sempre inspecionável como cena normal.

As cinco do briefing:

| Sequência | O que emite |
|---|---|
| `establishing-shot` | Plano geral com push-in lento, título entrando tarde, corte seco |
| `technical-reveal` | Assunto entra, câmera aproxima, chamadas anotam uma a uma |
| `system-visualization` | Grafo se constrói, pulsos atravessam, rótulo fecha |
| `data-storytelling` | Número → gráfico → frase de consequência, em três cortes |
| `consequence-impact` | Tipografia grande sustentada, respiro, corte para preto |

---

## As regras da direção de arte

Concretas, para poderem ser conferidas num quadro.

### Composição
- Grade de 12 colunas, margem lateral de 148 px, goteira de 96 px.
- Texto ancora nas colunas 1–6 **ou** 7–12. Centralizado só em cartela de título.
- O assunto fica sobre um terço, não no centro.
- **Pelo menos um elemento por plano sangra para fora do quadro.**
- Espaço negativo é assimétrico: 60/40, nunca 50/50.

### Escala tipográfica
| Papel | Tamanho |
|---|---|
| Display (número-herói, título de cartela) | 200–260 |
| Título | 96 |
| Subtítulo | 40 |
| Corpo | 26 |
| Rótulo | 18, versalete, entreletra +6 |

Razão display:corpo de no mínimo 7 para 1.

### Escada de valor — a maior alavanca do 2D
Cinco degraus, não dois:

| Nome | Valor |
|---|---|
| `void` | `#03060b` |
| `deep` | `#070d16` |
| `surface` | `#0e1824` |
| `edge` | `#1d2c3c` |
| `fog` | `#3a4a5c` |

Mais `ink` e **um** acento. **Todo quadro precisa conter pelo menos três dos cinco degraus.** Essa regra sozinha mata a sensação de chapado.

### Luz e atmosfera
- Uma luz principal implícita, sempre fora do centro.
- Camada de névoa entre fundo e assunto.
- Vinheta 0,45 (era 0,38). Grão 0,07 (era 0,04).

### Movimento
- **Nenhum plano é parado.** O mínimo é escala 1,00 → 1,04 ao longo da cena.
- Paralaxe: o fundo anda 30% do que anda o primeiro plano.
- Entrada sempre com easing `out`; nada em `linear`.
- Texto para quieto depois de assentar. Movimento que nunca termina enjoa.

### Montagem
- **O corte padrão é seco.**
- `dip-to-black` só em troca de capítulo.
- Dissolvência só para salto de tempo.
- Plano de ritmo: 3–6 s. Plano de explicação sustentada: 8–14 s.

### Cor
- Um acento frio para o sistema (ciano), um quente para a consequência humana (âmbar).
- Nunca os dois saturados no mesmo quadro.

### 3D
- Mapa de ambiente sempre (IBL). É o maior salto de qualidade por esforço.
- Névoa obrigatória.
- Escala por repetição: vinte racks, não quatro.
- Emissivos são a fonte de contraste.
- Nunca um objeto nu em fundo vazio — sempre geometria de contexto.

---

## O que foi implementado

### Sequências — `engine/src/sequences/`
As cinco, mais o expansor que as troca por cenas antes da validação zod. Cada uma carrega decisões de direção que antes não existiam em lugar nenhum: *quando* o título entra, *quanto* respiro fica no fim de um plano de anotações, *em que ordem* número, gráfico e consequência aparecem.

### Escada de valor e escala — `shared/tokens.ts`
Cinco degraus nomeados (`void`, `deep`, `surface`, `edge`, `fog`) e uma escala tipográfica que vai até `display: 232`. A razão display:corpo passou de 3,7 para 8,9 para 1.

### Profundidade no fundo — `Backdrop`
Quatro camadas onde havia duas: horizonte que ancora o quadro, grade com máscara que some nas pontas, chave de luz fora do centro e lâmina de névoa entre fundo e assunto. Vinheta de 0,38 para 0,45, grão de 0,04 para 0,07.

### Composição — `TitleCard`, `StatBlock`
Ganharam `position`. A cartela de título agora ancora embaixo por padrão, e a régua **sangra para fora do quadro** pela esquerda — que é a regra "ao menos um elemento sai do quadro" aplicada no lugar mais visível.

### Cena 3D — `DataCenter3D`
Corredor de data center com iluminação baseada em imagem, névoa, racks instanciados, LEDs determinísticos por semente e quatro enquadramentos (`wide`, `aisle`, `rack`, `macro`) com movimento próprio.

### Demonstração — `projects/demo-datacenter/`
"The Machine That Answers You": abertura no corredor, o caminho de uma requisição, close num rack com as partes nomeadas, o custo energético em número-gráfico-consequência, e o fecho de volta ao corredor. **Nenhuma cena escrita à mão** — o JSON tem cinco sequências e nada mais.

---

## Métricas da demonstração

**The Machine That Answers You** — 58,3 s, 11 cenas, 1.749 quadros, 1080p30. Render por cena (escolhido automaticamente, porque quatro planos usam WebGL):

**3m26s · 8,48 fps · 3,54× tempo real · pico 1314 MB**

Projetando para 10 minutos de documentário com esta mistura de 2D e 3D: **~35 minutos**, dentro da janela de duas horas.

Por cena, as pontas:

| Cena | Quadros | Tempo | O que tem |
|---|---|---|---|
| `cost-stat` | 120 | 10,3 s | só 2D |
| `open-wide` | 120 | 16,6 s | corredor 3D |
| `rack-reveal` | 270 | 32,5 s | 3D + chamadas anotando |
| `close-impact` | 180 | 25,9 s | 3D + texto sustentado |

O 3D custa cerca de **40% a mais** por quadro que o 2D equivalente — menos do que se temia, e a conta fecha porque o documentário não é 3D o tempo todo.

**O critério não é o fps.** Como o briefing pediu, o que decide é a composição, a profundidade, o material, a legibilidade e a ausência de cara de slide. O fps só precisa caber na janela — e cabe com folga.

---

## Dois defeitos que a demonstração pegou

### A sequência só falhava no meio do render
A primeira tentativa de renderizar a demo morreu aos **82%**, depois de três minutos, com um `ZodError`: uma sequência emitia um `callout` com texto vazio, e o schema do componente exige texto. O erro só aparecia quando o quadro daquela cena chegava a ser desenhado.

Num documentário de dez minutos isso seria meia hora de render para descobrir um campo errado. O expansor agora **confere as props que cada sequência emite contra o schema do componente**, no instante do empacotamento, e o erro sai nomeando sequência, cena e componente.

É o custo de ter acrescentado uma camada: código que gera código precisa validar o que gerou.

### A detecção de WebGL mentia
`render.mjs` escolhia entre render único e render por cena procurando a string `"cable-3d"` dentro do JSON da linha do tempo. Funcionou enquanto existia **uma** cena 3D. Com a chegada da `data-center-3d`, a demo inteira — que é 3D em quatro dos onze planos — foi renderizada em modo único, que é justamente o modo que a documentação do Remotion desaconselha para WebGL longo por causa do vazamento de memória do Chrome.

Agora a informação vem do registro, calculada no `Root` e exposta na linha do tempo.

---

## O que NÃO muda

Preservado como pedido: contrato zod e `layers[]`, trilhas, registro, câmera como propriedade de camada, duração medida pela narração, render por cena, cache com impressão digital do `src/`, bancadas e validação.

As sequências são açúcar que expande para o contrato existente. Se amanhã elas se mostrarem erradas, apagar a pasta `src/sequences/` não quebra nada.
