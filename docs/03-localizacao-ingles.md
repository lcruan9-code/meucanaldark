# 03 — Localização para inglês

Pergunta respondida: *o que precisa mudar para o inglês e o mercado internacional?*

**Resposta: 3 a 5 dias de código, ~185 linhas em 18 arquivos. Muito mais barato do que o repositório aparenta — mas há um bloqueador duro que trava tudo até ser corrigido.**

---

## Por que a primeira impressão engana

O projeto tem 80 módulos com nome em português, 1.112 funções em português e 3.521 linhas de template Flask em português, sem nenhuma camada de i18n (busca por `gettext|babel|flask_babel|i18n` retorna zero).

Nada disso importa. São três camadas distintas:

| Camada | Idioma | Vaza para o público? |
|---|---|---|
| Identificadores de código | 100% PT | Não — é custo de leitura, pago uma vez |
| Interface do operador (Estúdio, CLI) | 100% PT | Não — é a sua tela |
| **Saída para o público** | **já parametrizada** | **Sim — é o que importa** |

---

## O que já está pronto

`darkops/mercados.py` é uma camada de mercado completa, com **en-US e en-GB implementados**:

```python
# mercados.py:26-34
"en-US": {"nome": "Inglês · Estados Unidos", "idioma": "en", "youtube": "en-US",
          "fuso": "America/New_York", "cidade": "Nova York",
          "unidades": "unidades americanas (milhas, libras, pés, °F) e dólar (US$)",
          "vozes": ["en-US-AndrewMultilingualNeural", ...]}
```

- `mercados.TEXTOS` (`:66-110`) já tem as frases públicas em pt/en/es/fr/de/it: `"Follow {arroba} for more."`, `"Did you know?"`, `["#didyouknow", "#facts"]`.
- As amostras de voz en-US e en-GB **já estão no repositório**.
- `mercados.coerente()` troca a voz pela padrão do mercado automaticamente.
- O YouTube já recebe `defaultLanguage` do mercado (`publicar.py:170`).
- Fuso resolvido por mercado em todos os call sites de `nuvem.py` — os horários 12h/19h são **no fuso do mercado**, então en-US posta 12h/19h de Nova York. Correto por construção.

E o prompt-chave já manda escrever em inglês (`mercados.py:161-168`):

> *"Escreva TUDO que o público vê ou ouve (título, narração, textos na tela, legenda, descrição, tags e hashtags) em {lingua}, com expressões naturais de lá e nunca tradução literal."*

Os prompts são escritos em português mas instruem o modelo a produzir na língua do mercado. Isso funciona. **~70% da superfície de prompt já está correta.**

---

## O bloqueador duro

**`darkops/auditoria.py` é um portão de qualidade em português que reprova roteiro em inglês.**

```python
# auditoria.py:30-31
CTA = re.compile(r"\b(comenta|comente|escreve|escreva|manda|mande|envia|envie|
                 marca|marque|salva|salve|segue|siga|compartilha)\b", re.I)

# auditoria.py:122-124
elif not CTA.search(fim):
    problemas.append({"parte": "cta", "nivel": "erro", ...})
```

Um roteiro terminando com *"Comment ICE if you didn't know this"* não casa nenhum verbo → erro de nível `erro`. E isso tem duas consequências operacionais:

1. `__main__.py:626` faz `sys.exit(1)`, e `leva.py:323-325` manda o modelo *"corrigir o roteiro até sair sem erro"* → **loop infinito de correção**, queimando tokens.
2. `aprovacao.py:62-64` usa os mesmos erros para negar a aprovação automática → **nenhum vídeo em inglês é postado**.

A ironia: `palavra.py:66` já tem a frase certa em inglês — *"This whole video was made by an app. Comment {palavra} and I'll send you the project."* O projeto gera o CTA correto e depois o próprio auditor o rejeita.

Outras regras do mesmo arquivo que degradam sem travar:

- `GENERICOS` (`:25-27`) lista `"oi"`, `"neste vídeo"`, `"você sabia"`. *"Hey guys, in today's video…"* passa limpo — **proteção perdida**.
- `CARA_DE_IA` (`:34-44`): 12 padrões, **11 em português**. O detector de texto-de-IA fica desarmado justamente em inglês, onde os vícios são conhecidos (*delve, tapestry, in today's fast-paced world, testament to*).
- `PALAVRAS_POR_S = 2.8` (`:46`) foi calibrado em português e alimenta `palavras_alvo()`, injetado no prompt. Inglês tem densidade diferente → alvo de palavras errado.

Mesmo padrão em `conferir.py:110-112` (saudações PT) e `descricao.py:26-28` (28 stopwords PT → tags ruins).

**A correção não é tradução: é transformar as listas em dicionário por idioma — padrão que `mercados.TEXTOS` e `palavra.TEXTOS` já usam no próprio projeto.**

---

## Demais itens

| Item | Situação |
|---|---|
| `cortes.py:384` | Único prompt que fixa PT literalmente: *"Para cada corte escreva em português do Brasil"*. Canal de cortes em en-US sairia em português. |
| `cortes.py:462-465` | Reserva sem IA em PT: `"O momento mais louco da live de {canal}"`, `"OLHA ISSO"` |
| `leva.py:299-300`, `carrossel.py:66-68` | Lista anti-IA em PT. Em inglês não proíbe nada e não cobre os vícios reais. Filtro decorativo. |
| `docs/ganchos.md` | 22 fórmulas de abertura, todas em PT com exemplo PT — e **citadas dentro do prompt** (`leva.py:233`). Isto é conteúdo criativo, não tradução. |
| `config/nichos.json` | **Bug concreto:** os dois nichos em inglês têm a descrição em português (`"Mistérios em inglês (CPM maior)"`), e `identidade.py:52` passa essa string crua para a bio pública. Um canal en-US publicaria literalmente *"Short videos about Mistérios em inglês (CPM maior)"*. |
| `palco.py:290,311,322`, `producao.py:169-172` | Texto PT gravado na tela |
| `contas.py:48` | `REGIAO_AZURE = "brazilsouth"` fixo — convém `eastus`. Uma linha. |
| `publicar.py:20` | `CATEGORIA_EDUCACAO = "27"` fixo. Vale para os EUA, mas não é escolhível. |
| `whatsapp.py` | É canal do **dono**, não do público. Irrelevante para canal US. |
| Pix / R$ | Só em 3 lugares, todos sobre o **seu** custo de ativar o Google Cloud. |

---

## Esforço

**Mudar o parâmetro: ~15 minutos.** `"mercado": "en-US"` no perfil; `mercados.coerente()` ajusta idioma e voz sozinho.

**O trabalho real: ~185 linhas em 18 arquivos.**

| Prioridade | Arquivos | Linhas | Natureza |
|---|---|---|---|
| **P1 — bloqueadores** | `auditoria.py` (~35), `cortes.py` (~6), `docs/ganchos.md` (~50) | ~90 | Refatoração + conteúdo criativo |
| P2 — qualidade | `escrever-roteiro/SKILL.md`, `palavra.py`, `leva.py`, `carrossel.py`, `conferir.py`, `entrada.py`, `descricao.py`, `titulo-thumb/SKILL.md`, `config/nichos.json` | ~65 | Tradução + parametrização |
| P3 — polimento visível | `palco.py`, `producao.py`, `prancha.js`, `revisao_visual.py` | ~20 | Tradução direta |

Das 17 skills, **apenas 5 precisam de trabalho**. As outras 12 e o `AGENTS.md` podem ficar 100% em português: são processo do operador, não vazam para o vídeo.

**Estimativa: 3 a 5 dias de código.** Mas o gargalo não é código — escrever 22 fórmulas de gancho que *funcionem* em inglês é trabalho editorial, e só se valida publicando. Calibrar `PALAVRAS_POR_S` exige medir narração real. Conte **uma semana até rodar, e semanas de ajuste até ficar bom.**

Comece por `auditoria.py`. Sem ele, nada mais pode ser testado de ponta a ponta.
