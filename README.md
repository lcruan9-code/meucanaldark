# meucanaldark

Repositório de gestão do projeto de canais dark em inglês (mercado US/UK), formato documentário de 8 a 12 minutos.

**Estado: pesquisa. Nenhum código de produção, nenhuma conta conectada.**

Este repositório existe hoje para guardar a decisão: *vale usar o [Projeto Canais](https://github.com/VincFreitas/projeto-canais) como base, ou construir do zero?* A auditoria técnica está em [`docs/`](docs/), feita em 17/11/2026 sobre a versão v0.68.3 do projeto.

## Comece por aqui

| Documento | O que responde |
|---|---|
| [00 — Sumário executivo](docs/00-sumario-executivo.md) | A recomendação, em uma página |
| [01 — Auditoria de segurança](docs/01-auditoria-seguranca.md) | Dá para confiar contas reais a este software? |
| [02 — Pipeline de vídeo](docs/02-pipeline-video.md) | Aguenta documentário de 8–12 min? E animação técnica? |
| [03 — Localização para inglês](docs/03-localizacao-ingles.md) | Quanto custa virar o projeto para o mercado US |
| [04 — Custo por episódio](docs/04-custos.md) | Quanto sai um episódio, pago e grátis |
| [05 — Claude Code remoto](docs/05-claude-code-remoto.md) | Operar do celular sem perder as aprovações |
| [06 — Licença e riscos](docs/06-licenca-e-riscos.md) | O que a PolyForm Shield permite; riscos de monetização |
| [07 — Plano](docs/07-plano.md) | O que fazer, em ordem, com portões de decisão |
| [08 — Motor em Remotion](docs/08-motor-remotion.md) | Etapa 1 do motor audiovisual, com métricas reais de render |
| [09 — Biblioteca 2D](docs/09-biblioteca-2d.md) | Etapa 2: 15 componentes, mapa Natural Earth e o custo dos filtros |
| [10 — Direção de arte V2](docs/10-direcao-de-arte.md) | Por que parecia slide, e as sequências documentais que corrigem |
| [11 — Voz](docs/11-voz.md) | Por que a locução soa de máquina; Azure com SSML, e o que foi descartado |
| [12 — Motor de roteiro](docs/12-motor-de-roteiro.md) | O que já existe, o que nunca rodou, e a ordem do que falta |

## A recomendação, em três linhas

Aproveitar a base — mas um terço dela, não ela inteira, e nunca o repositório do autor diretamente. A narração, a montagem em ffmpeg e o esquema de roteiro são bons e difíceis de superar. A animação técnica 2D/3D, que é o seu requisito central, precisa ser escrita do zero.

Antes de qualquer linha de código, rodar o **Portão 0** do [plano](docs/07-plano.md): um episódio piloto de 10 minutos, à mão, para descobrir se o formato funciona antes de automatizá-lo.

## Regras deste repositório

- Nenhum segredo, token ou `.env` entra aqui. Nunca.
- Nenhuma conta real do YouTube é conectada antes do Portão 2 do plano.
- Toda afirmação técnica sobre o Projeto Canais cita `arquivo:linha`. Se não tem evidência, é marcada como estimativa.

## Sobre o projeto auditado

[Projeto Canais](https://github.com/VincFreitas/projeto-canais) · Copyright (c) 2026 Vinicius Freitas · licença [PolyForm Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0). Uso próprio e monetização de canais próprios são permitidos; oferecer produto concorrente não é. Ver [`docs/06`](docs/06-licenca-e-riscos.md).
