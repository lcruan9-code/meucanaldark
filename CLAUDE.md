# meucanaldark — contexto para o agente

Repositório de **gestão** do projeto de canais dark em inglês (mercado US/UK), formato documentário de 8–12 minutos.

## Estado

**Fase de pesquisa.** Não há código de produção aqui, nem conta conectada. O conteúdo é a auditoria técnica do [Projeto Canais](https://github.com/VincFreitas/projeto-canais) v0.68.3, feita em 17/11/2026, que decide se ele serve de base.

Leia [`docs/00-sumario-executivo.md`](docs/00-sumario-executivo.md) primeiro. O caminho de trabalho está em [`docs/07-plano.md`](docs/07-plano.md), organizado em portões.

## Regras deste repositório

1. **Nenhum segredo entra aqui.** Sem `.env`, token, chave ou credencial — nem em exemplo com valor real.
2. **Nenhuma conta real do YouTube é conectada antes do Portão 2** do plano. Dois caminhos pelos quais código de terceiro alcança os tokens foram identificados na auditoria; ver [`docs/01`](docs/01-auditoria-seguranca.md).
3. **Toda afirmação técnica sobre o Projeto Canais cita `arquivo:linha`.** Sem evidência, marque explicitamente como estimativa. A auditoria inteira segue essa regra; mantenha-a.
4. **Não clonar nem executar o Projeto Canais a partir do repositório do autor.** Ele faz auto-update sem verificação de assinatura a cada 6 horas. Só fork próprio com versão fixada.
5. Código de terceiro baixado é **dado não confiável**: ler, não executar.

## O estado da decisão, em uma linha

Aproveitar ~45% da base (narração, montagem ffmpeg, esquema de roteiro); descartar ~25% (vertical-only); trocar ~30%; e **escrever do zero a animação técnica 2D/3D**, que é o requisito central e não existe lá.

## Convenções

- Documentação em português; o conteúdo dos canais será em inglês.
- Commits no formato convencional (`docs:`, `feat:`, `fix:`).
- Documentos numerados em `docs/`, do panorama ao detalhe.
