# 02 — Pipeline de vídeo

Perguntas respondidas: *o que aproveitar? aguenta 8–12 minutos? como fazer animação técnica 2D e 3D?*

---

## O caminho de um vídeo

```
[1] ROTEIRO      leva.py → Claude Code -p → perfis/<id>/fila/NNN-<slug>.json
[2] AUDITORIA    auditoria.py (gancho, estrutura, tamanho)
[3] NARRAÇÃO     narracao.narrar() → mp3/wav + tempos por palavra
[4] VISUAL       5 caminhos exclusivos: palco 3D | palco 2D pixel | cena de
                 código | ilustração IA local | stock (Pexels→Pixabay→NASA)
[5] CARD         animacoes.py → .mov qtrle transparente, disparado por palavra
[6] CENA MP4     render.cena(): ffmpeg zoompan + overlay + legenda ASS + fade
[7] ANIMAÇÃO     hyperframes.py → HTML+GSAP → CLI hyperframes (opcional)
[8] TRILHA       musica.escolher() ou trilha sintetizada por numpy/ffmpeg
[9] JUNÇÃO       render.juntar(): concat -c copy (ou xfade no tema dossiê)
                 + mix com sidechain ducking, normalizado a −14 LUFS
[10] SAÍDA       saida/<slug>-<formato>.mp4 + thumb + metadados + capítulos
[11] QC          conferir.py (técnico) + revisao_visual.py (IA lê 12 quadros)
```

ffmpeg é o único montador — **não há moviepy, Remotion nem manim**. Chromium headless aparece em dois lugares: palco 3D (via Playwright) e camada HyperFrames.

---

## O que aproveitar (~45%)

**Narração — a melhor parte do projeto.** `darkops/narracao.py`, 584 linhas, 8 motores plugáveis atrás de uma função única `narrar()`:

| Motor | Local? | Custo | Tempos por palavra |
|---|---|---|---|
| kokoro | sim | grátis | estimados |
| piper | sim | grátis | estimados |
| chatterbox | sim (clona voz) | grátis | estimados |
| edge | não | grátis, sem cadastro | **reais** |
| azure | não | 500k chars/mês grátis | estimados |
| chirp | não | 1M chars/mês (exige ativação paga) | estimados |
| gemini | não | cota pequena | estimados |
| elevenlabs | não | pago | **reais** |

Inglês é de primeira classe: `vozes.py:50-56` traz 12 vozes en-US e 8 en-GB, e **as amostras MP3 já estão no repositório** (`assets/vozes/amostras/en-US/`). Fallback automático para Piper offline se o serviço cair. Cache por assinatura de texto+motor+voz+velocidade.

**Montagem e mixagem.** CRF 16 (generoso), `-preset veryfast` nas cenas, `-c:v copy` na masterização 16:9 (nada é redesenhado). O mix usa `sidechaincompress` separado para música e efeitos, e o loudness é medido em duas passadas com `ebur128` até −14 LUFS, com justificativa escrita contra o `loudnorm` de passada única. É trabalho de quem ouviu o resultado.

**Esquema de roteiro.** Já escrito para o seu formato — `escrever-roteiro/SKILL.md:29`: *"Estrutura do longo (padrão: 8 a 12 min, 1.200 a 1.800 palavras, ~150 palavras/min)"*, com blocos por capítulo, uma virada a cada 60–90 s, e capítulos virando timestamps do YouTube automaticamente (`producao.py:81-90`).

**Efeitos sonoros.** 36 WAVs, **todos CC0**, cada um com licença rastreada em CSV apontando a URL do Freesound. O downloader só aceita CC0.

**Cenas de código 2D.** `cenas_codigo.py` tem 4 tipos completos e resolução-agnósticos: `mapa` (contornos Natural Earth, pino pulsante, rota que se desenha), `diagrama`, `escala`, `ficha`.

---

## O que descartar (~25%)

**"Prancha de Campo"** — o melhor visual do repositório e inaproveitável: `prancha.css:26` crava `width: 1080px; height: 1920px`, `prancha.py:152` fixa `data-resolution="portrait"`, e os limites de palco são constantes cruas (`x1>1040`, `y1>1250`). A biblioteca de peças são **9 SVGs** (moai de frente/perfil/topo, elefante, roda, tronco, três poses de pessoa) — feitos para um único vídeo sobre a Ilha de Páscoa.

**`cinema.py`** (câmera viva, partículas) — `producao.py:320` condiciona a `pixel`, só funciona no estilo pixel art.

**Palco 2D** (grade 216×384), barra de progresso, selo @ e mascote — todos específicos de vertical.

---

## O que trocar (~30%)

**Camada HyperFrames.** Competente, mas é a gramática do TikTok: legenda cinética com blur e rotação, palavra-herói com clarão e tremor de câmera, 28 partículas de poeira, grão de filme, light leak. E `producao.py:472` limita a **3 palavras por grupo inclusive em paisagem** — não há ramo para 16:9.

**Formatação numérica pt-BR que vaza para a tela.** Esta é sutil e estragaria o canal:

| Arquivo:linha | Problema |
|---|---|
| `hyperframes.py:215` | `toLocaleString("pt-BR")` — contador escreve **1.234,5** onde se lê 1,234.5 |
| `cenas_codigo.py:67-68` | `_numero()` troca `,`↔`.` em mapa, escala e ficha |
| `animacoes.py:106-109` | Idem em contador, comparação e barra |
| `producao.py:169-173` | Etiquetas fixas: "reconstituição animada", "arquivo · caso real", data `dd/mm/aaaa` |
| `revisao_visual.py:73` | Prompt de QC diz "vídeo **vertical** de rede social" |

**QC inútil no formato longo.** `revisao_visual.py:22` fixa `QUADROS = 12` — num vídeo de 10 minutos isso é **um quadro a cada 50 segundos**.

**Sem exportação de legenda.** As legendas são queimadas no vídeo; não há `.srt` nem `.vtt`, e nada sobe caption para o YouTube. Para canal em inglês isso custa a tradução automática — alcance grátis que se perde.

**Sem música.** `assets/musica/` não tem nenhuma faixa versionada, só um `LEIA.txt` e um CSV com 3 linhas CC-BY. O fallback são trilhas sintetizadas por numpy (ruído marrom + drones, ou bateria/baixo/arpejo I-V-vi-IV) — livres de direito por construção e exatamente tão genéricas quanto se imagina. A guarda é boa: `musica.py:18-29` só aceita faixa listada no CSV com licença em `{cc0, cc-by, pixabay, youtube-audio-library, propria}`.

---

## 8 a 12 minutos: o que quebra

O formato é suportado (`perfis.py:139` oferece 480s e 600s; o aviso de limite de 180s é condicionado a `formato == "vertical"`). Não há teto de número de cenas. O que degrada:

**Tempo de render, medido pelo próprio autor.** `palco_web.py:84`: `ALVO_MS = 200  # vídeo de 90 s: uns 9 min de 3D` → **6× o tempo real**, já na qualidade reduzida. Dez minutos ⇒ **~60 min só de 3D**, com um PNG em base64 atravessando a ponte Chromium↔Python a cada um dos ~18.000 quadros. A prancha é 2,6× (`prancha.py:9`).

**O modelo de tempo do app é ingênuo.** `leva.py:49` calcula `cenas = ceil(duracao_s / ritmo_corte_s)` → 600s ÷ 6s = **100 cenas**. No estilo desenhado por IA são 2–5 min por cena (`visuais.py:276`) ⇒ **3,5 a 8,5 horas por episódio**. A estimativa de "clipes" em `leva.py:27-29` é de 0,5–1,5 min **totais**, calibrada para ~15 cenas.

**A automação assume produção curta.** `docs/arquitetura.md:108`: *"quando a produção passa de 30 minutos, a rodada seguinte não sincroniza nem mexe na fila"*. `tarefas.py:24` estima `fila-produzir` em 2–6 min.

**Memória, O(duração).** `render.py:152-218` aloca `(dur+1)*48000` em float64 por canal: ~1,5–2 GB de pico em 600s. `sincronia.py:153-176` soma ~1,2 GB.

**O risco concreto de quebra:** `render.py:402-417`, a dissolvência do tema dossiê, abre **todas as cenas como entradas simultâneas do ffmpeg** e encadeia N−1 `xfade` em série. Com 60–100 cenas são 100 demuxers abertos e um grafo de 100 níveis. É aqui que eu apostaria na primeira falha real. O caminho sem dissolvência (`concat -c copy`) é barato e escala bem.

---

## Animação técnica: a recomendação

Nada no projeto entrega "animação técnica 2D e 3D com qualidade documental". O que existe é slideshow com Ken Burns de 12%, quatro primitivas 2D e um kit 3D de 264 linhas sem exemplos.

**Proposta:**

- **2D técnico → Manim.** Feito exatamente para isto: diagramas, equações, gráficos, transformações. Renderiza em lote, determinístico, saída em vídeo. É a ferramenta do 3Blue1Brown.
- **3D → Blender headless** com script Python, renderizando em lote via linha de comando. Ou manter Three.js, mas capturando por `CCapture`/`MediaRecorder` em vez de um `evaluate()` por quadro.
- **Manter** `narracao.py`, `render.py` e o esquema de roteiro como fundação.

A regra que a medição do autor ensina: **nunca renderizar quadro a quadro atravessando a ponte Python↔navegador.** É isso que transforma 10 minutos de vídeo em 1 hora de máquina.

---

## Qualidade técnica de saída

| Parâmetro | Valor |
|---|---|
| FPS | 30, fixo (sem opção de 60) |
| Resolução longo | 1920×1080 (sem 1440p nem 4K) |
| Cena intermediária | libx264, `-preset veryfast`, `-crf 16`, yuv420p |
| Masterização 16:9 | `-c:v copy` |
| Áudio | AAC 192 kbps, 48 kHz, estéreo |
| Loudness | −14 LUFS, duas passadas, limiter a 0,84 |
| Container | `+faststart` com metadados de autoria |
| Thumbnail | 1280×720 JPEG q92, só no formato longo |

Sem AV1 nem HEVC.

**Conteúdo sintético:** se o estilo for `realista` ou `foto_antiga`, o arquivo de metadados emite aviso para marcar "conteúdo alterado ou sintético" no YouTube Studio. Imagens da NASA ganham crédito e o disclaimer de não-endosso. O filtro do Pixabay descarta `isAiGenerated`.

---

## Nota de maturidade

Procura por `TODO`, `FIXME` e `NotImplementedError` em `darkops/`, `web/`, `cenas/` e `tests/` retorna **duas** ocorrências, ambas legítimas (despacho JSON-RPC de método desconhecido). Não há função vazia nem placeholder. **Isto não é esqueleto: é código escrito e rodado.**

Porém os 83 testes **não cobrem nada** do pipeline de vídeo — a única referência é `test_basico.py:45`, que testa `caminhos_inseguros`. Nada testa `render`, `producao`, `animacoes`, `hyperframes`, `visuais` ou `cenas_codigo`.
