# 04 — Custo por episódio

Perguntas respondidas: *quanto custa um episódio de verdade? quais ferramentas gratuitas substituem as pagas?*

---

## Aviso de método

`custos.REFERENCIA` (`custos.py:29-36`) e a tabela do README medem **vídeo curto de 60 segundos**. **O repositório não tem nenhum número medido para vídeo longo.** Tudo abaixo para 10 minutos é extrapolação, marcada como tal.

O jeito certo de descobrir o seu número é rodar 3 episódios reais e ler `dados/custos.jsonl`: `custos.resumo()` passa a usar o seu histórico em vez da referência assim que houver 3 roteiros.

---

## Onde está o dinheiro

**Em um lugar só: o LLM.** Tudo o mais já tem caminho gratuito implementado e funcionando.

| Categoria | Custo | Por quê |
|---|---|---|
| LLM (Claude Code) | **100% do custo** | Único provedor; sem abstração |
| TTS | opcional | 4 motores locais grátis |
| Imagens | zero | Gerador local ou stock grátis |
| Render | zero | ffmpeg local |
| Música / efeitos | zero | CC0 ou sintetizado |
| Publicação / pesquisa | zero | APIs gratuitas |

Busca por `ollama|llama.cpp|lmstudio|openai|gpt-4|mistral|deepseek` em todo o repositório: **zero ocorrências**.

---

## Episódio de 10 minutos em inglês (~1.400 palavras, ~8.000 caracteres)

### Cenário "tudo pago"

| Item | Valor | Origem |
|---|---|---|
| Roteiro (modelo padrão, effort alto, com busca web) | US$ 4,00 – 7,00 | *estimativa* — 2 a 4× o US$ 1,96 medido para 60s; não escala linear, o grosso é pesquisa |
| Descrição (Haiku) | US$ 0,12 – 0,15 | base medida + entrada maior |
| Revisão visual (Sonnet) | US$ 0,16 | **não muda** — `revisao_visual.py:21` fixa 12 quadros |
| Carrossel (só com Instagram) | US$ 0,13 – 0,18 | base medida |
| **Subtotal LLM** | **US$ 4,41 – 7,49** | |
| TTS 8k chars — ElevenLabs | ~US$ 1,60 | *estimativa* |
| TTS 8k chars — Chirp pago | US$ 0,24 | `conectores.py:99` |
| TTS 8k chars — Azure pago | ~US$ 0,13 | *estimativa* |
| Imagens, música, efeitos, render, publicação | **US$ 0,00** | local ou CC0 |

**Total: US$ 6,00 – 9,10** com ElevenLabs · **US$ 4,65 – 7,75** com Chirp.
Com "Prancha de Campo": **+US$ 6 – 13** (inaproveitável para 16:9 de qualquer forma).

### Cenário "máximo gratuito"

| Item | Valor |
|---|---|
| LLM | **US$ 0,00 em dinheiro** com plano Pro/Max — mas consome US$ 4–7,50 de limite |
| TTS | **US$ 0,00** — Kokoro ou Piper local; ou Azure F0 (~60 episódios/mês grátis) |
| Todo o resto | **US$ 0,00** |

**Total em dinheiro: US$ 0,00 por episódio.**

**O custo marginal real é energia.** No estilo desenhado por IA: 100 cenas × 2–5 min de GPU = **3 a 8 horas de placa por episódio**. Com stock: minutos.

**Ressalva:** "grátis via plano" engana num episódio longo. A ~US$ 5 de valor-API por roteiro, um Claude Pro (US$ 20/mês) suporta muito menos episódios do que parece. Para volume, Max é a conta real.

---

## Substituições gratuitas

### O que dá — e já está pronto, troca por configuração

A abstração de TTS é limpa:

```python
# narracao.py:308-309
MOTORES = {"edge": _edge, "piper": _piper, "elevenlabs": _elevenlabs,
           "azure": _azure, "chirp": _chirp, "gemini": _gemini,
           "chatterbox": _chatterbox, "kokoro": _kokoro}
```

Função única `narrar()`, contrato idêntico, dispatch em `:388-391`. Troca via `MOTOR_VOZ` no `.env`, campo `motor_voz` no perfil, ou o seletor do Estúdio. **Zero código.** Bônus: `narracao.py:357-370` cacheia o áudio — reprocessar não recobra TTS.

- TTS pago → **Kokoro** ou **Piper** local
- Imagem → já é local (stable-diffusion.cpp + Z-Image-Turbo) ou stock grátis
- Render → já é ffmpeg local

### O que não dá — o único lock-in

```python
# leva.py:139
raise SystemExit("Claude Code não encontrado")
```

`rodar_claude()` é acoplado ao binário `claude`, e `custos.registrar()` parseia o JSON específico dele. **Não existe camada de provedor.** Trocar por Ollama ou llama.cpp exigiria reescrever `rodar_claude` + `custos.py` + os 13 call sites.

É exatamente onde mora 100% do custo, e é a única peça sem abstração. Se o volume crescer, esta é a refatoração que paga.

---

## Onde a documentação do projeto não bate

A aritmética do README fecha para vídeo curto (1,96 + 0,10 + 0,16 + 0,11 = 2,33). Mas:

1. **US$ 2,33 é só vídeo de 60s.** A FAQ se chama "Quanto custa um vídeo?" sem ressalva de formato, e `perfis.py:139` permite até 1800s.
2. **O README anuncia "Opus 5.5" para roteiro, mas o código não força modelo nenhum.** `leva.py:94-95` não inclui `"roteiro"` em `MODELO` — fica no modelo padrão do Claude Code da máquina. O custo anunciado depende de configuração fora do app.
3. **9 das 13 chamadas de IA não entram na conta.** `custos.POR_VIDEO` só conta 4. Ficam de fora, com custo real: `ferramentas` (Sonnet + busca web, roda **toda semana sozinha**), `analise` e `aprendizado` (effort alto), `comentarios` (até 20/dia), `cortes` ×2, `ajuste`, `nomes`. **O custo mensal é maior que nº_vídeos × 2,33.**
4. **"Chirp grátis até 1M chars" esconde R$ 125–200 adiantados** de ativação do Google Cloud — documentado só em `conectores.py:81-87`, não na tabela de custo.
5. **O README subdeclara o que é grátis:** esquece o `edge`, que é o fallback padrão sem chave nenhuma.
6. **Chatterbox é anunciado, mas `AGENTS.md:83` diz que o ambiente foi apagado** em 03/11/2026.
7. Azure Speech-to-Text (`entrada.py:96-105`) não aparece em nenhuma tabela; tem cota F0 separada.

Nada disso é desonestidade — é documentação que envelheceu junto com um projeto em movimento rápido. Mas significa que **o custo real mensal é maior do que a tabela sugere**, e você só descobre o seu rodando.

---

## Conclusão prática

Para começar, rode no **caminho gratuito**: Kokoro ou Piper local, stock para imagens, ffmpeg. Custo em dinheiro: zero, fora o plano do Claude que você já tem.

Suba para TTS pago só quando a narração local for comprovadamente o fator que limita a retenção — e aí **Azure ou Chirp antes de ElevenLabs**, porque custam 1/10 e a diferença de qualidade em narração documental é menor do que em voz atuada.
