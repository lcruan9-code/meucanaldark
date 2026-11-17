# 01 — Auditoria de segurança

Pergunta respondida: *dá para confiar contas reais de YouTube monetizadas a este software?*

**Resposta: não como está. Sim, com quatro mudanças.** Nada malicioso foi encontrado. O risco é de cadeia de suprimentos, não de má-fé.

---

## O que está bem feito

Vale registrar, porque é acima da média e é a razão de a base valer a pena.

**Cofre de credenciais** (`darkops/cofre.py`) — XSalsa20-Poly1305 via SecretBox do PyNaCl, biblioteca padrão, não criptografia caseira. No Windows a chave é protegida por DPAPI com entropia própria; no Linux e macOS vai para o `keyring`, e sem chaveiro para arquivo com permissão 0600 fora da pasta do projeto. A gravação é atômica e confere lendo de volta antes de apagar o original.

**Redação de segredos** (`darkops/seguranca.py`) — mascara tokens em log e tela: padrões do Google (`ya29`, `1//0`, `GOCSPX`, `AIza`), Meta, GitHub e `sk-`. Mitiga vazamento acidental na interface.

**Superfície de rede** (`darkops/estudio/__init__.py:57-70, 2241`) — o Estúdio escuta só em `127.0.0.1`. Três defesas em `before_request`: bloqueia `remote_addr` não-local, bloqueia `Host` fora do padrão (anti-DNS-rebinding) e exige `Origin`/`Referer` válido em todo POST. A CSP tem `nonce` e **não** tem `unsafe-inline` em `script-src` (só em `style-src`, risco baixo). Também define `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `base-uri 'none'`, COOP e CORP.

**Nenhum segredo no histórico** — varredura de `git log --all -p` por `AIza`, `sk-`, `ghp_`, `github_pat_`, `xox`, `-----BEGIN PRIVATE`, `GOCSPX-`, `ya29.`, `1//0`, `EAA`, `IGAA`. Os únicos acertos são as próprias regexes de redação e um token fictício de teste. O único arquivo sensível já commitado é o `.env.example`, com todos os valores vazios.

**Nenhuma telemetria** — todos os domínios citados no código são serviços declarados. O único domínio do autor é `vincfreitas.github.io`, usado como página de retorno do login do Instagram.

**Disciplina anti-prompt-injection** — `leva.py:54-85` chama o Claude Code com `--tools` explícito, `--disallowedTools` cobrindo `.env`, `credenciais/`, `dados/`, `~/.claude/**` e `~/.ssh/**`, `--setting-sources project,local` e ambiente sem segredos. O prompt vai **por stdin, nunca como argumento**, para que texto vindo da internet não vire comando. `AGENTS.md:111` proíbe `acceptEdits`. Para um sistema que lê páginas e comentários e entrega a um agente, isso é bem pensado.

---

## Os dois achados graves

### CRÍTICO — auto-update sem verificação, ligado por padrão

| Evidência | Conteúdo |
|---|---|
| `app.py:30` | `PADRAO["atualizar_sozinho"] = True` |
| `estudio/__init__.py:2362-2368` | `_vigiar_atualizacao()` roda em thread de fundo, a cada 6h |
| `app.py:335-377` | `git fetch origin <ramo>` + `git merge --ff-only origin/<ramo>` |
| `app.py:370` | Se o `requirements.txt` mudar, roda `pip install -r` sem hash |

O `origin` é `https://github.com/VincFreitas/projeto-canais.git`. Não há assinatura de commit, pin de hash nem tag assinada. **O que entrar no `main` do autor — ou de quem comprometer a conta dele — roda na sua máquina em até 6 horas**, como seu usuário, com acesso a `cofre.ler()`.

O que isso alcança: refresh tokens do YouTube com escopos `youtube.upload`, `youtube.readonly` e `youtube.force-ssl` (este último permite **apagar comentários**), opcionalmente `yt-analytics-monetary.readonly` (lê sua receita); token do GitHub CLI com escopos `repo,workflow`; chaves de API; e a gravação da sua voz usada em clonagem.

Observação de justiça: downloads de terceiros **são** verificados — `sd-cli` por SHA-256, Node por SHA-256 do nodejs.org, cloudflared e o Python do instalador por Authenticode. O autor sabe fazer. O canal principal é que ficou sem.

`atualizar_dependencias_sozinho` também vem `True` (`app.py:31`) e atualiza pip, Node, n8n, Claude Code e `sd-cli` sozinho.

### ALTO — o workflow de nuvem entrega seus segredos ao código do autor

`nuvem.py:535-541` publica, **na sua conta**, um `postar.yml` que:

- faz `actions/checkout` de `repository: VincFreitas/projeto-canais`, **sem `ref` fixo** — ou seja, o HEAD do `main` dele;
- roda `python -m darkops nuvem-preparar` com `SEGREDOS: ${{ toJSON(secrets) }}` — **todos os segredos do seu repositório**, incluindo `client_secret` e refresh token do YouTube, `GH_TOKEN`, `NUVEM_TOKEN` e `WHATSAPP_TOKEN`;
- tem `contents: write` e instala n8n global no mesmo job.

Isto é uma segunda via para os seus tokens, e **vale mesmo com o auto-update desligado**, porque roda na nuvem sem a sua máquina. Só acontece se você ativar a "reserva na nuvem".

---

## Achados menores

| Severidade | Achado |
|---|---|
| MÉDIO | DPAPI protege contra outro usuário ou outro PC, não contra código rodando como você. O cofre não protege do próprio app. |
| MÉDIO | `requirements.txt` só usa `>=`, sem teto nem hash. Com auto-update, um pacote comprometido no PyPI entra sozinho. Os de nicho são `edge-tts`, `curl_cffi`, `piper-tts`. |
| MÉDIO | Com WhatsApp ligado, abre túnel público `trycloudflare.com` até um porteiro local. Bem protegido (HMAC-SHA256 com `compare_digest`, corpo limitado a 1 MB, só o número do dono), mas é exposição deliberada à internet. Desligado por padrão. |
| MÉDIO | `keyring` só é instalado fora do Windows (`sys_platform != "win32"`). No Windows a proteção é DPAPI. |
| BAIXO | `seguranca.link_publico()` valida o hostname contra IPs privados, não o IP resolvido. Domínio apontando para IP interno passa. |
| BAIXO | Actions referenciadas por tag (`@v7`), não por SHA. |
| BAIXO | `app.py:56,181,265` usa `powershell -ExecutionPolicy Bypass`, mas com scripts internos fixos e sem entrada do usuário. |

CI do autor está correto: `permissions: contents: read`, sem `pull_request_target`, auto-merge do Dependabot condicionado ao login do bot e aos testes passando. Rodam `pip-audit` e `npm audit`.

---

## As quatro mudanças obrigatórias

Antes de conectar qualquer conta real:

1. **Fork próprio.** Nunca usar o repositório do autor como `origin`.
2. **Desligar o auto-update.** `atualizar_sozinho: false` e `atualizar_dependencias_sozinho: false` em `dados/app.json`. Revisar o diff antes de cada `git pull` manual.
3. **Não ativar a nuvem** — ou, se ativar, apontar o `checkout` para o seu fork e **fixar por SHA**.
4. **Fixar dependências.** Gerar `requirements.txt` com versões e hashes, instalar com `--require-hashes`.

Adicionalmente: primeiro contato com uma **conta Google de teste**, nunca com a conta que vai ser monetizada. E manter o OAuth no mínimo de escopos — `youtube.force-ssl` só é necessário se você for usar a resposta automática a comentários.

Com isso o risco cai para baixo. Sem isso, confiar contas monetizadas a este software equivale a confiar na conta GitHub de um terceiro.
