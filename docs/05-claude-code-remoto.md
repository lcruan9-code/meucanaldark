# 05 — Claude Code remoto e controle de aprovações

Pergunta respondida: *como configurar Claude Code para administrar o processo sem perder o controle das aprovações?*

---

## O conflito de arquitetura

O projeto se define como *"a fábrica de vídeos que **roda no seu PC**"*. Isso não é detalhe de implementação — é a decisão número 1, e está defendida em código:

| # | Obstáculo | Evidência |
|---|---|---|
| 1 | Estúdio só aceita `127.0.0.1`; `before_request` aborta 403 por `remote_addr`, por `Host` e exige `Origin` local em todo POST. **Toda aprovação humana mora nessa interface.** | `estudio/__init__.py:57-70, 2241` |
| 2 | Modo servidor existe mas levanta `SystemExit` | `ambiente.py:29-31` |
| 3 | Claude Code tem que rodar na própria máquina — `leva.rodar_claude` executa o binário local | `leva.py:81-85, 134-161` |
| 4 | MCP é stdio puro, sem transporte de rede | `mcp_servidor.py:238-258` |
| 5 | Produção precisa de Chromium com GPU; sem placa cai para 1200 ms/quadro | `palco_web.py:52-108, 192-203` |
| 6 | ffmpeg local em todo lugar | `conferir.py`, `cortes.py`, `carrossel.py` |
| 7 | OAuth do YouTube abre navegador na máquina (`run_local_server`) | `publicar.py:47` |
| 8 | n8n local em `127.0.0.1:5678`, atalho na pasta Inicializar do Windows | `app.py:215-268` |

**Nuvem pura não existe hoje.** O modo nuvem (GitHub Actions) já posta com o PC desligado, mas só **consome fila já aprovada e já renderizada** no PC — ele não produz.

Desbloquear o modo servidor exige a checklist de `docs/app-e-site.md:79`: login real, HTTPS com HSTS, isolamento por usuário, tokens em KMS, sandbox para Claude Code e ffmpeg, e pentest OWASP.

---

## O desenho viável

**"Claude Code remoto → PC sempre ligado"**, não "tudo na nuvem".

Boa parte daquela checklist é para SaaS multiusuário e não se aplica a você sozinho. O próprio autor aponta o caminho curto (`docs/app-e-site.md:45`):

- **Tailscale ou WireGuard** — só os seus aparelhos entram, sem porta aberta na internet. Exige um login no Estúdio e liberar o endereço da rede privada em `ambiente.py`.
- **PWA por túnel com Cloudflare Access** — abre de qualquer lugar, porta do PC fechada.
- **TWA na Google Play** — o mesmo PWA dentro de um app, exigindo o Estúdio em HTTPS.

**Tailscale é a escolha.** É o menor delta de segurança: não abre nada para a internet, não precisa de certificado, e o risco residual é o seu próprio dispositivo.

Existe ainda um canal de aprovação por celular **já construído e desligado**: `whatsapp.py:308-317, 444-455` manda o vídeo pronto com botões **Aprovar / Recusar**, e aceita `aprovar`, `aprovar todos`, `lista`, `criar N`. Está escondido desde 07/11/2026 por decisão do autor; liga com `DARKOPS_WHATSAPP=1`. Depende de PC ligado, túnel cloudflared e app Meta próprio.

---

## O controle de aprovações

### O problema: o padrão mudou e é o oposto do que você quer

`darkops/aprovacao.py:3-4`, no cabeçalho do arquivo:

> *"Aprovação automática (decisão do dono em 2026-11-13: **'100% automático', no lugar de 'nada vai ao ar sem a sua aprovação'**)"*

E `perfis.py:65`:

```python
"aprovacao_automatica": True,  # o vídeo que passa nas conferências entra na postagem sozinho
```

**Canal novo nasce com aprovação automática ligada.** Um laço roda a cada 10 minutos enquanto o Estúdio estiver aberto (`estudio/__init__.py:2256-2269`) e grava `dados["aprovado"] = True` sem nenhum humano.

### O que as "conferências" realmente checam

1. `conferir.py` — técnica: tela preta, congelada, silêncio, volume, duração
2. `revisao_visual.py` — a IA lê uma folha de 12 quadros e dá nota; precisa de ≥ 7
3. `auditoria.py` — texto sem erro de auditoria

**Nenhuma avalia se o vídeo deveria existir.** São checagens de defeito, não de editoria. Um roteiro factualmente errado, porém tecnicamente limpo, é publicado sem você ver. (Crédito onde é devido: em exceção o código erra para o lado seguro e devolve o vídeo para a fila.)

### A correção — um clique, em cada canal

`estudio/templates/_canal.html:92-95` → Ajustes do canal → "Aprovação dos vídeos":

- ~~"Aprovar sozinho os vídeos que passarem nas conferências"~~ ← padrão
- **"Eu aprovo cada vídeo antes de postar"** ← o que você quer

**Precisa ser feito em cada perfil, inclusive nos criados depois**, porque o padrão do código continua `True`.

### Outros automatismos no mesmo espírito

| Onde | O que faz sozinho | Rede de segurança |
|---|---|---|
| `aprendizado.py:192` | Altera a configuração do canal a cada 14 vídeos, com base no desempenho | `aprender-desfazer` |
| `rotinas.py:132` | Aplica atualizações de terceiros sem perguntar | nenhuma |
| `comentarios` | **Continua com portão** por padrão | — |
| `carrossel.py:208` | **Continua manual** | — |

---

## A melhor notícia: o MCP foi desenhado certo

`darkops/mcp_servidor.py` expõe 13 ferramentas por JSON-RPC sobre stdio. A docstring (`:9-10`) diz o que ficou de fora **de propósito**:

> *"publicar, aprovar vídeo, responder comentário, excluir canal e mexer em contas"*

E o `initialize` repete isso ao cliente. Ou seja: **um Claude remoto falando por MCP pode pesquisar, produzir prévia e conferir — mas não consegue publicar nem aprovar.** É exatamente a separação que você quer, já implementada.

As ferramentas somente-leitura são `diagnostico`, `progresso`, `canais`, `fila`, `contas_guia`, `saude`, `atualizacoes`, `conferir_video`, `tarefa`. As de escrita são `integridade`, `estatisticas`, `leva`, `produzir_previa`.

Defesas: toda saída passa por `seguranca.ocultar()` e é truncada em 20.000 caracteres; `perfil` validado por regex; `conferir_video` exige `.mp4` dentro de `saida/` via `is_relative_to`; `leva` sanitiza o tema e limita a quantidade a 1–14. Sem autenticação — e não precisa, porque é stdio local.

---

## As 17 skills

**11 de 17 chamam código real.** Três são prosa pura: `planejar-semana`, `titulo-thumb` e `revisar-desempenho`.

A mais madura é `escrever-roteiro` (112 linhas), com auditoria obrigatória. `desenhar-prancha` (136 linhas) é real mas serve ao motor vertical-only.

`revisar-desempenho` merece nota: ela **não toca** no código de métricas. Pede que você cole números no chat e os acrescente à mão em `testes.csv` — é o fluxo manual antigo convivendo com o automático. Para operar remoto, use `darkops aprender` ou a ferramenta MCP `estatisticas`.

O acompanhamento de resultados automático, esse é real: `estatisticas.py` busca YouTube Data API, YouTube Analytics (minutos assistidos, retenção) e Instagram Graph; `aprendizado.py` fecha o ciclo a cada 14 vídeos no ar há ≥2 dias, ranqueia, e realimenta a produção via `leva._inspiracao_anteriores`.

---

## Plugin e configuração de agente — dois cuidados

`.claude-plugin/plugin.json` registra **apenas skills**. **Não há hooks** (`PreToolUse`/`PostToolUse`) em lugar nenhum do repositório. O risco de instalação é baixo.

Dois cuidados reais:

1. **`CLAUDE.md:5` é só `@AGENTS.md`** — abrir o projeto injeta **51 KB** em toda sessão. Boa parte é diário de bordo ("decisão do dono em 2026-11-13") e detalhe de HyperFrames/prancha. Vale herdar as regras de segurança (§108-115) e a disciplina de prompt-injection; o resto é peso morto. Se adotar, corte em módulos e importe sob demanda.
2. **Não rode `darkops mcp-configurar --usuario`** — ele escreve em `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.gemini/settings.json`, `.codex/config.toml` e, com `--usuario`, em `~/.codex/config.toml`, **fora do projeto** (`mcp_servidor.py:269-303`).

E ao abrir o Estúdio, saiba que ele sobe **6 threads-vigia** que agem sem clique (`estudio/__init__.py:2247-2252`): atualização, levas adiadas, palavra-chave, rotinas, cortes de live e aprovação automática.

---

## Configuração recomendada

1. Fork próprio, auto-update desligado (ver [`01`](01-auditoria-seguranca.md))
2. `aprovacao_automatica: false` em **todos** os perfis, e conferir a cada canal novo
3. Tailscale entre celular e PC; Estúdio com login antes de liberar o endereço da tailnet
4. Claude Code remoto conectado ao PC, falando com o MCP por stdio — que já não publica nem aprova
5. Modo nuvem (GitHub Actions) como rede de segurança da **postagem**, com checkout fixado no seu fork por SHA
6. `aprendizado.py` desligado até você confiar no que ele muda
