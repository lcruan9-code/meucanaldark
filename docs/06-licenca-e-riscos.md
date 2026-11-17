# 06 — Licença e riscos de publicação e monetização

---

## A licença

**PolyForm Shield License 1.0.0.** Não é open source. É *source-available*.

O resumo em português do próprio arquivo `LICENSE`:

> *"você pode baixar, usar, estudar e modificar este projeto para qualquer finalidade, inclusive comercial: produzir vídeos e monetizar os seus próprios canais é permitido. Mantenha este aviso e o crédito ao autor em toda cópia. O que não é permitido é usar o projeto para oferecer um produto que concorra com ele (por exemplo, vender ou revender o app, ou oferecê-lo como serviço pago a terceiros)."*

A cláusula Shield proíbe uso em qualquer coisa que concorra com a linha de negócio declarada do licenciante, que é: *"software de pesquisa, roteiro, produção e postagem automática de vídeos para canais sem rosto"*.

### O que isso significa na prática

| Uso pretendido | Permitido? |
|---|---|
| Produzir vídeos para os seus canais | **Sim** |
| Monetizar esses canais | **Sim**, explicitamente |
| Modificar o código para o seu uso | **Sim** |
| Fazer fork privado | **Sim** |
| Distribuir sua versão modificada | Sim, mantendo o aviso e estes termos junto |
| Vender o app, ou oferecê-lo como serviço a terceiros | **Não** |
| Construir um SaaS de automação de canais com ele | **Não** |

Para o `meucanaldark` como sua operação própria, está tudo liberado. **Se um dia virar produto para outras pessoas, é preciso falar com o autor antes** — o contato está no cabeçalho do `LICENSE`.

### Obrigação prática

Todo arquivo do projeto carrega um cabeçalho SPDX:

```
# SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0
# Projeto Canais · Vinicius Freitas · github.com/VincFreitas/projeto-canais
```

Em qualquer arquivo que você derive do projeto, **esse cabeçalho fica**. Em código novo que você escrever do zero, não se aplica.

---

## Riscos de publicação

### 1. "Conteúdo inautêntico" — o risco número um

Desde 15/07/2025 o YouTube classifica como inautêntico o conteúdo produzido em massa, repetitivo ou sem valor próprio. **Canal sem rosto e uso de IA são permitidos**; o que derruba a monetização é o resultado parecer fábrica.

O próprio `docs/monetizacao.md` do projeto documenta isso bem e lista as defesas: estrutura e ganchos diferentes a cada vídeo, visuais ligados ao assunto (não clipe genérico), nada de reaproveitar vídeo entre canais, e marcação de "conteúdo alterado ou sintético" quando o estilo for realista.

**Mas o canal de demonstração do autor viola a própria regra:** os 24 vídeos usam a mesma fórmula de título ("Como funciona o X"). Com 48 inscritos isso ainda não foi testado contra a política.

Para documentário de 8–12 minutos o risco é naturalmente menor — formato longo com pesquisa e ângulo próprio é o oposto da fábrica de Shorts. Mas a defesa tem que ser deliberada: **variar estrutura, não só assunto**.

### 2. Upload privado em app OAuth não verificado

`docs/app-e-site.md:66` registra que **sem a YouTube API Services Audit, vídeos enviados pela API ficam privados**. O documento afirma que a auditoria só é necessária se o app OAuth for compartilhado entre várias pessoas, e que criar o próprio app "para computador" dispensa verificação.

**Isto precisa ser confirmado na prática antes de contar com publicação automática pública.** É o tipo de restrição que muda sem aviso e que só aparece quando o primeiro vídeo fica preso em privado. Teste com uma conta descartável antes de montar a esteira.

Note também que `publicar.py` usa `privacidade="private"` por padrão e declara `containsSyntheticMedia`.

### 3. Escopos OAuth amplos

O token pedido cobre `youtube.upload`, `youtube.readonly`, `youtube.force-ssl` (permite **gerenciar e apagar comentários**) e opcionalmente `yt-analytics-monetary.readonly` (**lê sua receita**). Quem obtiver o token faz tudo isso.

Peça só o que vai usar. `youtube.force-ssl` só é necessário para resposta automática a comentários.

### 4. Instagram pelo modo nuvem passa por repositório público

No modo nuvem o vídeo precisa de URL pública e passa por um **repositório GitHub público de passagem** (`AGENTS.md:33`). No modo local isso não acontece — o upload é resumível e direto. Saiba disso antes de ativar a nuvem para o Instagram.

---

## Riscos de monetização

### Os limiares, e o que muda em 2027

| Programa | Requisito |
|---|---|
| YouTube nível inicial (Clubes, Super Thanks) | 500 inscritos + 3.000 h em 12 meses, **ou** 3 milhões de views de Shorts em 90 dias |
| YouTube completo (anúncios) | 1.000 inscritos + 4.000 h, **ou** 10 milhões de Shorts em 90 dias |
| **A partir de 01/02/2027** | **8.000 h ou 20 milhões de Shorts** |

O limiar **dobra em pouco mais de dois meses**. Isso favorece fortemente a sua estratégia: 4.000 h são ~30 mil visualizações de um vídeo de 8 min assistido pela metade; a mesma meta em Shorts exige milhões.

### O argumento a favor do formato longo

O `docs/monetizacao.md` do projeto é direto, e é a melhor evidência a favor do seu plano:

> *"o criador fica com 45% da receita de anúncios dos Shorts (55% nos vídeos longos). Shorts com público brasileiro rendem centavos por mil visualizações; **vídeo longo rende de 10 a 50 vezes mais por mil**."*

Vídeo com 8 minutos ou mais aceita **anúncio no meio**. Somando o RPM de mercado US/UK ao de formato longo, a diferença contra o caminho do autor (Shorts em português) é de uma ordem de grandeza ou mais.

**Ou seja: o projeto está otimizado exatamente para o cenário de menor receita, e o seu plano aponta para o de maior.** Isso justifica a adaptação — mas também explica por que a base precisa de tanto trabalho: ela nunca foi exercitada onde você quer usá-la.

### Risco de concentração

Toda a monetização depende de uma única conta Google. Se ela for suspensa por violação de política, cai o canal, o acesso à API e o histórico. Mitigações: conta separada só para isto, 2FA em chave física, e nunca rodar experimentos na conta que já está monetizada.

---

## Riscos legais de conteúdo

Documentário em inglês sobre casos reais levanta o que o formato Shorts não levantava:

- **Direito de imagem e difamação** — pessoas vivas citadas em caso criminal. Padrão americano é mais permissivo que o brasileiro, mas o alcance é maior.
- **Licenciamento de imagens de arquivo** — o projeto já tem guarda para música (só licença declarada em CSV) e para efeitos (só CC0), e filtra `isAiGenerated` no Pixabay. Para imagens de arquivo histórico, a guarda é só a fonte (NASA com crédito e disclaimer de não-endosso).
- **Marcação de conteúdo sintético** — obrigatória no YouTube quando há reconstituição realista. O projeto emite o aviso no arquivo de metadados quando o estilo é `realista` ou `foto_antiga`, mas **a marcação em si é manual no Studio**.

Nenhum é impeditivo. Todos pedem política editorial escrita antes do primeiro episódio, não depois.
