# 07 — Plano

Nada de código ainda. O plano é feito de **portões**: cada um responde uma pergunta que pode matar o projeto, e custa pouco comparado ao que vem depois.

A ordem não é por dificuldade técnica. É por **risco de descobrir tarde**.

---

## Portão 0 — O formato funciona? (1 a 2 semanas, zero código)

**A pergunta:** um documentário de 8–12 minutos em inglês, no seu nicho, retém audiência?

Este é o risco maior do projeto inteiro, e é o único que nenhuma quantidade de engenharia resolve. O autor do Projeto Canais tem 48 inscritos depois de 24 vídeos. Automatizar um formato que não funciona só produz mais rápido o que ninguém assiste.

**O que fazer:** produzir **um episódio piloto inteiramente à mão**. Roteiro escrito com o Claude normalmente, narração com Kokoro ou Edge (grátis), montagem no editor que você preferir. Sem o Projeto Canais, sem automação.

**O que medir:** retenção aos 30s, aos 2min e no fim; CTR da thumbnail; e a sua própria resposta honesta a "eu assistiria isto até o fim?".

**Critério de passagem:** retenção média acima de 40% aos 2 minutos. Abaixo disso, o problema é o formato ou o nicho, não a ferramenta.

**Decisão de nicho** também sai daqui. Dark channel documental em inglês é um mercado saturado e profissionalizado — concorrência com produção cara. O ângulo precisa ser definido antes, não depois.

---

## Portão 1 — A base aguenta? (3 a 5 dias)

Só depois que o Portão 0 passar.

**A pergunta:** o pipeline do Projeto Canais produz um episódio de 10 minutos de ponta a ponta, em inglês, sem quebrar?

**O que fazer:**

1. **Fork privado** do `VincFreitas/projeto-canais`, fixado no SHA auditado (v0.68.3).
2. Desligar `atualizar_sozinho` e `atualizar_dependencias_sozinho`. Não ativar a nuvem.
3. Gerar `requirements.txt` com versões e hashes.
4. Corrigir o bloqueador: `auditoria.py:30-31`, transformando as listas em dicionário por idioma. Ver [`03`](03-localizacao-ingles.md).
5. Rodar um episódio de 600s pelo caminho **stock + Ken Burns**, o único robusto, com narração local.
6. **Conta Google de teste**, nunca a definitiva.

**O que vai quebrar, e onde olhar primeiro:**

| Sintoma | Causa provável |
|---|---|
| Roteiro em loop de correção | `auditoria.py` reprovando o CTA em inglês |
| ffmpeg falha na junção | Grafo `xfade` do tema dossiê com ~100 entradas (`render.py:402-417`) — use `concat` |
| Produção passa de 30 min | `arquitetura.md:108` — a rodada seguinte para de sincronizar a fila |
| Números estranhos na tela | `toLocaleString("pt-BR")` (`hyperframes.py:215`) |
| Memória estourando | Trilha sintetizada, ~2 GB em 600s (`render.py:152-218`) |

**Critério de passagem:** um `.mp4` de 10 minutos, em inglês, assistível do início ao fim, produzido em menos de 1 hora de máquina.

---

## Portão 2 — Vale automatizar? (decisão, não trabalho)

Com o piloto validado e a base rodando, decidir **o que manter e o que reescrever**:

| Componente | Decisão | Razão |
|---|---|---|
| `narracao.py` | **Manter** | 8 motores, inglês pronto, rota local grátis |
| `render.py` | **Manter** | CRF 16, −14 LUFS, ducking por sidechain |
| Esquema de roteiro + skill | **Manter** | Já escrito para 8–12 min |
| `auditoria.py` | **Refatorar** | Dicionário por idioma |
| `cenas_codigo.py` | **Estender** | 4 primitivas boas; faltam gráficos e esquemas |
| HyperFrames | **Trocar** | Gramática de TikTok, 3 palavras por legenda |
| Palco 3D | **Trocar** | 6× tempo real; usar Blender headless em lote |
| Prancha de Campo | **Descartar** | 1080×1920 cravado, 9 SVGs de um vídeo só |
| `cinema.py`, palco 2D | **Descartar** | Pixel art / vertical |

**O maior item isolado é a animação técnica**, que não existe e precisa ser escrita: Manim para 2D técnico, Blender headless para 3D. A regra que a medição do autor ensina: **nunca renderizar quadro a quadro atravessando a ponte Python↔navegador**.

Só aqui entra a primeira conta real de YouTube, e só depois de confirmar que app OAuth próprio publica como público (ver [`06`](06-licenca-e-riscos.md)).

---

## Portão 3 — Operação remota (depois de tudo funcionar local)

1. Tailscale entre celular e PC
2. Login no Estúdio antes de liberar o endereço da tailnet em `ambiente.py`
3. Claude Code remoto conectado ao PC, falando com o MCP por stdio
4. `aprovacao_automatica: false` em **todos** os perfis, conferido a cada canal novo
5. GitHub Actions como rede de segurança da postagem, com checkout fixado no seu fork por SHA

Detalhes em [`05`](05-claude-code-remoto.md).

---

## O que não fazer

**Não conectar conta real antes do Portão 2.** A auditoria encontrou dois caminhos pelos quais código de terceiro alcança seus tokens do YouTube. Eles se fecham com fork e configuração, mas a sequência importa.

**Não começar pela animação 3D.** É o item mais caro e mais fácil de justificar como "o diferencial". Se o roteiro e a narração não seguram 10 minutos, nenhuma animação salva.

**Não adotar o `AGENTS.md` inteiro.** São 51 KB injetados em toda sessão via `CLAUDE.md`. Herde as regras de segurança e a disciplina de prompt-injection; deixe o diário de bordo de lado.

**Não rodar `darkops mcp-configurar --usuario`.** Ele escreve fora do projeto, em `~/.codex/config.toml`.

---

## Resumo do caminho crítico

```
Portão 0  →  piloto à mão, 10 min, inglês        ← o projeto vive ou morre aqui
   ↓          (retenção > 40% aos 2 min?)
Portão 1  →  fork travado + auditoria.py + 1 episódio automático
   ↓          (10 min em < 1h de máquina?)
Portão 2  →  decidir o que reescrever; animação técnica do zero
   ↓          (primeira conta real)
Portão 3  →  Tailscale + aprovação manual + nuvem como rede
```

O Portão 0 não precisa de nada deste repositório, de nenhum fork e de nenhuma decisão de arquitetura. Precisa de um episódio e de honestidade ao medir o resultado.
