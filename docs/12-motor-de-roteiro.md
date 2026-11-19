# 12 — De ferramentas a motor de roteiro

Diagnóstico do estado real em 19/11/2026, feito lendo o código e os projetos gerados — não a documentação. Corrige a tabela de capacidades em três pontos.

---

## O achado que reorganiza tudo

O pipeline `segment → plan → compose → make` **existe e roda ponta a ponta**. Mas o adaptador de LLM tem três back-ends — `fixture`, `ollama` e nada mais — e o padrão é:

```js
const backend = forceBackend || process.env.LLM_BACKEND || "fixture";
```

**`fixture` significa resposta enlatada.** Os dois "roteiros testados" do commit são `scripts/fixtures/ai-gold-rush/` e `scripts/fixtures/hidden-internet/`. O Ollama não está no ar, e não existe adaptador para Claude nem para nenhum modelo de fronteira.

Conclusão: **a tubulação foi validada; a inteligência nunca rodou.** O motor sabe transportar uma decisão de direção do roteiro até o `project.json`. Ele nunca tomou uma.

Isso não é um defeito do trabalho feito — é exatamente o que se faz primeiro, e está certo. Mas muda o que falta.

---

## A tabela, corrigida pela evidência

| Capacidade | Tabela | Evidência no código |
|---|---|---|
| Motor de composição Remotion | Existe | ✅ confirmado |
| Biblioteca visual 2D | Existe | ✅ 15 componentes registrados |
| Incorporação de vídeos | Existe | ✅ `video-clip`, família `video` |
| Narração e sincronização | No piloto | ✅ 3 motores, fatiamento de locução única |
| Legendas | Implementadas | ✅ VTT, com os tempos do arquivo |
| Biblioteca 3D genérica | Incompleta | ✅ confirmado: só `cable-3d` e `data-center-3d` |
| **Geração de cenas a partir do roteiro** | "falta desenvolver" | ⚠️ **existe, mas nunca rodou com modelo real** |
| **Direção audiovisual automatizada** | "falta desenvolver" | ⚠️ **existe e está cega às regras do próprio motor** |
| Interpretação técnica por segmento | "falta desenvolver" | ⚠️ parcial: escolhe componente, não compõe plano |
| Validação factual | "falta desenvolver" | ❌ confirmado ausente |
| Continuidade visual | "falta desenvolver" | ❌ confirmado ausente |

---

## O diretor automático está cego

`scripts/prompts/plan-system.md` é a instrução do diretor. Contagem de menções:

| Conceito | Menções |
|---|---|
| `camera` | 1 |
| `layer` / `camada` / `track` / `overlay` | **0** |
| `composição` / `regra` | **0** |
| `fato` / `fonte` | **0** |
| `continuidade` | **0** |

E o resultado aparece medido no `ai-gold-rush`, 28 cenas e 59 camadas:

- **1 camada de 59 tem movimento de câmera.** A regra "nenhum plano é parado" é violada em 58.
- **25 das 28 cenas têm exatamente 2 camadas**: fundo mais um componente centralizado. É a estrutura de slide descrita em [`10`](10-direcao-de-arte.md) — a mesma que a camada de sequências foi criada para eliminar.
- As `src/sequences/` **não são usadas**: o prompt foi escrito antes delas.

Crédito onde é devido: o diretor escolhe **14 componentes diferentes** em 28 cenas. Ele não está preso a um molde. Ele só não sabe compor um plano.

---

## O que o roteiro de teste exige

O pacote `the_invisible_systems_roteiro` traz um manifesto com oito cenas, e cada uma declara:

```
scene_id · chapter · start_time · end_time
narration_en
visual_objective_pt      <- o que o espectador precisa ENTENDER
visual_style[]           <- cinematic_live_action, orbital_3d, underwater_3d
camera_direction_pt      <- o movimento, descrito em prosa
required_assets[]
sfx_and_music_pt
generation_prompt_en
```

Repare no que isso é: **intenção**, não implementação. "Mergulho atravessando a superfície do oceano até o leito abissal" não é um componente com props.

A lacuna real do projeto é a tradução entre essas duas linguagens:

```
intenção          ->  implementação
visual_objective      layers[] com componente e props
visual_style          escolha de família (2D / 3D / mídia)
camera_direction      camera{} com escala, origem e easing
```

**Isso é a direção audiovisual automatizada.** E é o trabalho que resta — não construir o transporte, que já existe, mas construir o tradutor.

---

## A decisão que precede o resto

Melhorar o prompt do diretor tem teto: o teto é a capacidade do modelo que o executa.

| Caminho | Custo | O que esperar |
|---|---|---|
| Ollama local (llama3) | grátis, offline | direção genérica; é o que produziu fundo + componente em 25 de 28 cenas |
| Claude por `claude -p` | já pago na assinatura | direção de verdade; o padrão foi provado no Projeto Canais, com ferramentas restritas |

Não existe adaptador para Claude hoje. Acrescentá-lo é o menor passo com maior efeito do projeto inteiro — e o Projeto Canais já mostrou como fazer com segurança: `--tools` explícito, `--disallowedTools` cobrindo segredos, prompt por stdin e nunca `acceptEdits` ([`01`](01-auditoria-seguranca.md)).

---

## A ordem que eu proporia

1. **Adaptador Claude no `llm.mjs`.** Sem modelo capaz, todo o resto rende pouco.
2. **Reescrever `plan-system.md`** ensinando o que o motor já sabe fazer: camadas e trilhas, `camera` obrigatória, as cinco sequências, a escada de valor, corte seco como padrão.
3. **Continuidade** como estado explícito entre cenas: paleta, objeto técnico recorrente, direção de câmera anterior. É o que impede o cabo de mudar de cor entre o plano 3 e o 7.
4. **Validação factual** como etapa própria, com a fonte entrando no `stat-block` e no `end-card` — campos que já existem e hoje ficam vazios.
5. **Biblioteca 3D**, guiada pelos `visual_style` que os roteiros realmente pedirem, não por adivinhação.

A ordem não é arbitrária: cada item depende do anterior. Um validador factual sobre um diretor cego valida cenas que não deveriam existir.
