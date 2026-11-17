# Sumário executivo

Auditoria de `VincFreitas/projeto-canais` v0.68.3, feita em 17/11/2026, sobre 25.677 linhas de Python em 94 arquivos. Nada foi executado: só leitura de código, mais verificação independente do canal de demonstração no YouTube.

**Objetivo avaliado:** canais dark em inglês (US/UK), documentários de 8–12 minutos com animação técnica 2D/3D, operados por Claude Code remoto com aprovação humana preservada.

---

## Recomendação

**Aproveitar a base, mas apenas cerca de um terço dela — e jamais o repositório do autor diretamente.**

O projeto resolve bem menos do que os 80% que se esperava. A estimativa honesta é **40% a 45% aproveitável**, concentrado em infraestrutura (narração, montagem, esquema de roteiro), e **0% no requisito central** — animação técnica de qualidade documental, que não existe e precisa ser escrita.

Mesmo assim, aproveitar vale a pena: os 45% são justamente a parte chata e bem-feita, que levaria semanas para reescrever pior.

---

## Os cinco achados que mudam a decisão

### 1. A prova social não sustenta o formato pretendido

O canal de demonstração **Pulga do Saber** tem **48 inscritos e 24 vídeos, e os 24 são Shorts** — verificado diretamente no YouTube, não no README. Não existe um único vídeo longo. As 18 mil visualizações do README são verdadeiras (o autor é honesto nos números), mas converteram em 48 inscritos: **0,27%**. O canal não está monetizado e está longe disso.

Os 24 títulos seguem a mesma fórmula ("Como funciona o X"). É exatamente o padrão repetitivo que o próprio `docs/monetizacao.md` do projeto descreve como **"conteúdo inautêntico"** na política do YouTube vigente desde 15/07/2025.

**Conclusão:** o software é uma fábrica de Shorts que funciona. Como negócio, é um experimento ainda não validado. Não há evidência alguma para documentário longo.

### 2. O formato longo existe no código, mas nunca foi exercitado

`perfis.py:139` define `DURACOES["longo"] = [180, 300, 480, 600, 900, 1200, 1800]` — 480s e 600s são exatamente 8 e 10 minutos, opções de primeira classe na interface. `config.py:52` mapeia 1920×1080. A skill de roteiro já está escrita para o formato: *"Estrutura do longo (padrão: 8 a 12 min, 1.200 a 1.800 palavras)"*.

Porém **o único roteiro longo de exemplo do repositório tem 3 cenas e 35 segundos**, e nenhum dos 83 testes toca o pipeline de vídeo.

**Conclusão:** não é stub, é caminho não percorrido. Risco médio, não alto.

### 3. Segurança: bem construído, com dois furos de cadeia de suprimentos

O que está certo: cofre com XSalsa20-Poly1305 (PyNaCl) protegido por DPAPI no Windows; Estúdio só em 127.0.0.1 com defesa de CSRF, DNS-rebinding e CSP com nonce; redação de tokens em log; **nenhum segredo no histórico do git**; **nenhuma telemetria**. Nada malicioso encontrado.

O que está errado, e é grave:

- **Auto-update ligado por padrão** (`app.py:30`): a cada 6 horas o app faz `git fetch` + `merge --ff-only` do `main` do autor e reinicia com o código novo, **sem verificação de assinatura**. Código novo roda como você e lê `cofre.ler()` — ou seja, seus refresh tokens do YouTube.
- **Workflow de nuvem**: o `postar.yml` gerado **na sua conta** faz checkout do repositório **do autor** sem SHA fixo e entrega `${{ toJSON(secrets) }}` — todos os seus segredos — ao código dele. Funciona mesmo com o auto-update desligado.

**Conclusão:** usar o repositório do autor diretamente está fora de questão. Fork próprio, versão fixada e auto-update desligado não são preferência: são requisito. Detalhes em [`01`](01-auditoria-seguranca.md).

### 4. O requisito central — animação técnica — não existe

Há cinco geradores de imagem no projeto. O único robusto e genérico é **stock + Ken Burns de 12%**: slideshow, sem eufemismo. As quatro cenas de código 2D (`mapa`, `diagrama`, `escala`, `ficha`) são bem-feitas e resolução-agnósticas, mas são **quatro primitivas, não um sistema** — sem gráficos de linha, séries temporais, cortes esquemáticos ou fluxos.

O 3D tem infraestrutura real (Three.js + GSAP em Chromium headless), mas o conteúdo versionado é um kit de **264 linhas sem uma única cena de exemplo**. E o throughput é sub-realtime pela medição do próprio autor (`palco_web.py:84`): *"vídeo de 90 s: uns 9 min de 3D"* — **6× o tempo real**, já na qualidade reduzida. **Dez minutos de 3D dão cerca de uma hora de máquina por episódio**, contra os 30 minutos que a própria automação assume como teto antes de parar de sincronizar a fila.

O melhor visual do repositório — a "Prancha de Campo" — é inaproveitável: `prancha.css:26` crava `1080×1920` e a biblioteca de peças são 9 SVGs feitos para um único vídeo sobre a Ilha de Páscoa.

**Conclusão:** trocar o palco 3D por **Manim ou Blender headless**, renderizando em lote. Este é o maior item de trabalho do projeto. Detalhes em [`02`](02-pipeline-video.md).

### 5. Inglês é barato; operação remota é cara

**Inglês (3 a 5 dias):** muito mais barato do que aparenta. O autor já desenhou o projeto para multi-mercado — `mercados.py` tem en-US e en-GB prontos, com fuso, unidades e vozes, e **as amostras de áudio em inglês já estão no repositório**. O que ficou para trás foi a camada de julgamento: `auditoria.py:30-31` tem a lista de verbos de CTA em português e **reprova qualquer roteiro em inglês**, travando o modelo em loop de correção. São ~185 linhas em 18 arquivos, das quais 3 são caminho crítico.

**Remoto (semanas, e com decisão de arquitetura):** nuvem pura não existe. O Estúdio é 127.0.0.1 puro, `ambiente.py:31` levanta `SystemExit` se você tentar modo servidor, o MCP é stdio sem rede, e a produção precisa de ffmpeg e Chromium com GPU local. O desenho viável é **"Claude Code remoto → PC sempre ligado"**, via Tailscale. Detalhes em [`03`](03-localizacao-ingles.md) e [`05`](05-claude-code-remoto.md).

---

## O que fazer agora

Não começar a desenvolver. O risco maior não é técnico — é produzir um sistema excelente para um formato que não funciona.

**Portão 0: um episódio piloto de 10 minutos, feito à mão**, antes de automatizar qualquer coisa. Se o formato não retiver audiência em inglês, nada do resto importa. O plano completo, com portões, está em [`07`](07-plano.md).

---

## Respostas diretas às 8 perguntas

| # | Pergunta | Resposta curta |
|---|---|---|
| 1 | O que já funciona e dá para aproveitar? | Narração (8 motores, inglês pronto, rota local grátis), montagem ffmpeg (CRF 16, −14 LUFS, ducking), esquema de roteiro com capítulos, efeitos CC0. ~45%. |
| 2 | O que mudar para inglês? | ~185 linhas em 18 arquivos. Bloqueador único: `auditoria.py` reprova inglês. 3–5 dias. |
| 3 | Como fazer animação técnica 2D/3D? | Não existe no projeto. Escrever do zero com Manim (2D técnico) e Blender headless (3D), em lote. |
| 4 | Como adaptar para 8–12 min? | O formato já existe; o que quebra é tempo de render, o grafo `xfade` do dossiê e memória do áudio sintetizado. |
| 5 | Quais ferramentas grátis substituem pagas? | Todas, menos o LLM. TTS local (Kokoro/Piper), imagem local, ffmpeg. Troca por variável de ambiente, não por código. |
| 6 | Custo real por episódio? | **US$ 6–9** tudo pago; **US$ 0** em dinheiro no caminho grátis (custo real = plano Claude + 3–8h de GPU). |
| 7 | Riscos de publicação e monetização? | "Conteúdo inautêntico", upload privado em app OAuth não auditado, e o limiar subindo para 8.000h em 01/02/2027. |
| 8 | Como manter o controle das aprovações? | Desligar `aprovacao_automatica` em **cada** canal; o MCP já não expõe publicar nem aprovar. |
