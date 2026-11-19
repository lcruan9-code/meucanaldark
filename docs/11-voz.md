# 11 — Voz: por que soa de máquina e o que fazer

Registro da decisão de motor de voz. Data: 18/11/2026.

---

## O diagnóstico

A locução do turbofan soa sintética, e isso importa mais do que estética: a política de conteúdo inautêntico do YouTube ([`06`](06-licenca-e-riscos.md)) olha justamente para texto lido por voz sintética sem valor próprio.

São **duas causas, e a segunda pesa mais**.

**A primeira é o modelo.** O motor era `edge-tts` — o endpoint não oficial do Edge.

**A segunda é que o `edge-tts` não aceita controle de prosódia nenhum.** Sem pausa, sem ênfase, sem estilo. É exatamente a lacuna que a auditoria do Projeto Canais encontrou (*"o único controle é velocidade global; não há pitch, ênfase, `<break>`, SSML por trecho"*) e que o nosso motor herdou.

A primeira frase do turbofan tem **7,3 segundos ditos num fôlego só**. Nenhum narrador humano faz isso. É esse achatamento — não o timbre — que o ouvido reconhece como máquina.

---

## O que foi descartado, e por quê

### ElevenLabs no plano gratuito — não serve

| | |
|---|---|
| Cota | ~10.000 créditos/mês ≈ 10 minutos de fala |
| Na prática | **um** episódio de 10 minutos por mês |
| Uso comercial | **Não permitido** no plano gratuito |

A maioria das fontes consultadas afirma que o plano gratuito não dá direito de uso comercial; uma diverge. Para um canal monetizado, isso é impeditivo — e a cota sozinha já inviabilizaria. O nível mais barato com direitos comerciais é o **Starter, ~US$ 5–6/mês, 30 mil créditos** (3 a 4 episódios).

**Confira os termos atuais na própria ElevenLabs antes de contratar:** as fontes acima são blogs de preço, não a página oficial.

### `allmybusinessorg/Freeelevenlabs` — não instalar

O repositório **não contém TTS nenhum**. O `package.json` é `luxe-audio-web`: Next.js, Tailwind, framer-motion, lucide. É uma **landing page**.

O software real é um `.exe` de Windows distribuído por GitHub Releases — não auditável a partir do código. Somando: **sem arquivo de licença**, 14 estrelas, 3 forks, criado e abandonado no mesmo dia (03/08/2026).

Executar um binário sem assinatura desse perfil numa máquina que guarda token OAuth do YouTube é risco desproporcional ao ganho.

**O que o repositório tem de útil é a atribuição:** ele embrulha o **VoxCPM/VoxCPM2 da OpenBMB**, que é real e Apache 2.0. Se o interesse é esse motor, o caminho é o repositório da OpenBMB, não o intermediário.

---

## O caminho escolhido

### Agora: Azure Speech (nível F0) com SSML

| | |
|---|---|
| Cota gratuita | **500.000 caracteres/mês** |
| Em episódios | ~60 episódios de 10 minutos |
| Vozes | A **mesma família** do `edge-tts` |
| O que muda | **SSML**: `<break>`, `<emphasis>`, `<prosody>`, estilos de narração |

O ganho não é trocar de timbre — é passar a ter **direção de locução**. Pausa entre frases, ênfase na palavra que carrega o peso, ritmo mais lento para documentário.

**Ressalva verificada:** as vozes **HD (DragonHD)** provavelmente **não** entram na cota gratuita, e não emitem evento de limite de palavra. Por isso o motor fica nas vozes Neural padrão, que são gratuitas e preservam o tempo das legendas.

### Também implementado: Chatterbox local

Licença **MIT** (Resemble AI, confirmada nos metadados do pacote), roda offline, sem cota e sem custo recorrente. É o "ElevenLabs grátis" que o repositório descartado fingia ser — mas de verdade.

Ambiente nesta máquina: venv isolado em `engine/.venv-tts/` com **torch 2.14.1+cu126**, CUDA ativa na **RTX 3050 6 GB**. Fica fora do git (`.gitignore`).

```bash
node scripts/synthesize.mjs <projeto> --engine chatterbox
```

**O modelo é generativo, então a semente é fixada por frase.** Sem isso, a mesma cena re-sintetizaria diferente a cada rodada e o cache por hash devolveria áudio que ninguém conferiu. A semente deriva do índice da frase: a cena sai idêntica, e frases diferentes não herdam a mesma entonação.

**Uma frase, um processo — não.** Carregar o modelo custa dezenas de segundos. O módulo manda **todas** as frases da cena num único processo Python e recebe um WAV por frase.

#### Medido nesta máquina

Três frases (12,2 s de áudio) em **53 s**, incluindo o carregamento do modelo (~30 s, pago uma vez por cena). O regime depois da carga fica perto de 2× o tempo real: um documentário de 10 minutos levaria cerca de 20 minutos de síntese.

É muito mais lento que o `edge` (4,9 s para o mesmo texto) e que o Azure. Em troca: offline, sem cota, sem custo e sem depender de serviço de terceiro.

As pausas calculadas aparecem no VTT gerado, como esperado:

| Depois de | Pausa |
|---|---|
| frase longa (129 caracteres) | 480 ms |
| "Every measurement matters." (26) | 300 ms |

#### Português: outro modelo, outro download

O Chatterbox padrão é **só inglês**. Para qualquer outro idioma existe a variante `ChatterboxMultilingualTTS`, com 23 idiomas, `pt` entre eles.

O motor troca de modelo sozinho pelo `locale`: `en-*` usa o modelo inglês (menor, já em cache); qualquer outro usa o multilíngue. **São modelos diferentes** — a primeira síntese em português levou **20,5 minutos**, quase tudo download. Depois disso fica em cache.

Resultado medido em pt-BR, três frases:

| | Total | Observação |
|---|---|---|
| `edge` (pt-BR-AntonioNeural) | 14,88 s | 3,8 s para gerar |
| `chatterbox` (`pt`) | 15,07 s | ritmo 1,3% diferente do edge |

#### Veredito do teste de escuta: Chatterbox está FORA para pt-BR

A amostra foi ouvida e reprovou, por um motivo que não se conserta com ajuste:

> "condições" saiu **"condisames"**. "medição" saiu **"mediaosão"**. Mais R puxado demais e timbre ainda robotizado.

**Isso não é sotaque — é o modelo não sabendo pronunciar o `ção` nasal.** E a distinção importa para a decisão: um clipe de referência (`audioPrompt`) corrige timbre e sotaque, mas **não corrige pronúncia**. A palavra errada nasce na conversão de texto em fonemas, antes de a voz entrar.

Palavra comum pronunciada errada é defeito que vai ao ar em todo episódio. Não há tuning que resolva.

**A lição generaliza:** um modelo que divide capacidade entre 23 idiomas perde para vozes treinadas só em português brasileiro. Para pt-BR, voz nativa ganha de modelo multilíngue — mesmo que o multilíngue seja mais moderno.

O Chatterbox segue válido **para inglês**, que é o idioma do canal e onde ele foi testado primeiro.

#### Vozes nativas pt-BR

O `edge-tts` expõe só três:

| Voz | Observação |
|---|---|
| `pt-BR-AntonioNeural` | masculina, geração antiga |
| `pt-BR-FranciscaNeural` | feminina |
| `pt-BR-ThalitaMultilingualNeural` | feminina, geração mais nova |

**O Azure próprio expõe bem mais** (Macerio, Brenda, Donato, Elza, Fabio, Giovanna, Humberto, Julio, Leila, Leticia, Manuela, Nicolau, Valerio, Yara, entre outras) — o `edge-tts` enxerga só um subconjunto. Esse é mais um argumento para o Azure quando o assunto é pt-BR: mais escolha de timbre, além do SSML.

#### Duas armadilhas pagas na integração

**`torchaudio.save` não serve mais.** A versão 2.14 passou a exigir o TorchCodec — centenas de MB para uma tarefa de dez linhas. O WAV é gravado com o módulo `wave` da biblioteca padrão.

**Caminho relativo quebra o `concat`.** O ffmpeg não encontrava a lista de partes quando a chamada vinha de fora da raiz do motor. Os caminhos são resolvidos para absolutos logo na entrada do módulo.

#### Clonagem de voz: um aviso que não é técnico

O Chatterbox clona uma voz a partir de ~5 s de referência (`tts.audioPrompt` no `channel.json`). Sem referência, usa a voz padrão dele.

**Clonar a voz de uma pessoa real sem consentimento dela não é opção** — nem legal, nem eticamente, nem para um canal que precisa sobreviver a denúncia. Se for usar clonagem, que seja uma voz sua, de alguém que autorizou por escrito, ou de um banco licenciado para isso.

A voz padrão do modelo resolve o caso de uso sem abrir essa porta.

**Licenças importam mais do que parece.** `F5-TTS` é CC-BY-NC (não comercial) e `XTTS-v2` está sob a Coqui Public Model License com a empresa encerrada desde 2024 — ninguém para vender licença comercial. Ambos ficam fora.

---

## Como está implementado

`scripts/lib/voice.mjs` abstrai o motor. Os dois produzem o mesmo par de arquivos (`.mp3` + `.vtt`), então trocar de motor não mexe em mais nada do pipeline.

```bash
node scripts/synthesize.mjs <projeto> --engine azure
```

Precedência: linha de comando → `channel.json` → padrão. O padrão continua `edge`, para nada quebrar sem configuração.

### Como o tempo das legendas sobrevive à troca

O `edge-tts` devolve VTT pronto. O Azure, pelo REST, devolve só áudio. Em vez de trazer o SDK inteiro, o módulo **sintetiza frase a frase**, mede cada arquivo com `ffprobe` e monta o VTT a partir das durações reais mais os silêncios que ele mesmo insere.

Sai exato, sem dependência nova — e de quebra **o tamanho de cada pausa passa a ser decisão nossa**, que era o controle que faltava.

### A pausa não é constante

Pausa sempre igual é tão mecânica quanto pausa nenhuma. `pauseAfter()` varia com o peso da frase, como função pura do texto (a locução sai idêntica a cada rodada):

| Frase | Pausa |
|---|---|
| Longa (>90 caracteres) | base + 120 ms |
| Termina em `?` ou `!` | base + 90 ms |
| Curta (<32 caracteres) | base − 60 ms |

Base padrão: 360 ms.

### Ênfase sai do roteiro

`*assim*` no texto da narração vira `<emphasis>`. É **a mesma marca** que o componente `kinetic-text` já usa para a palavra-herói — uma convenção só para as duas pontas.

---

## Configurar a chave do Azure

O nível F0 não pede cartão.

1. Portal Azure → Criar recurso → **Speech**
2. Escolher o nível de preço **F0 (grátis)**
3. Região: prefira uma próxima do público (`eastus` para EUA)
4. Em *Chaves e Ponto de Extremidade*, copiar a chave e a região
5. No ambiente:

```bash
setx AZURE_SPEECH_KEY "sua-chave"
```

```bash
setx AZURE_SPEECH_REGION "eastus"
```

**A chave nunca entra no repositório.** Sem ela, o motor `azure` falha com mensagem explicando o que falta, em vez de cair em silêncio para o `edge`.

---

## Pendência honesta

**O caminho Azure não foi testado contra a API real** — não há chave nesta máquina. O que foi verificado:

- as funções puras (divisão de frases, cálculo de pausa, geração de SSML) rodam e produzem a saída esperada;
- a falta de credencial falha com mensagem clara;
- a sintaxe dos dois arquivos passa em `node --check`;
- o motor `edge` continua sendo o padrão, então nada do que já funciona mudou.

**Falta exercitar:** a chamada HTTP, a concatenação dos trechos com o silêncio no meio, e o VTT resultante. Isso só com uma chave F0 criada.

---

## O que nenhum motor resolve

Trocar o modelo melhora o timbre. **Não melhora o texto.**

A frase de 7,3 segundos continua sendo de 7,3 segundos. Narração documental de verdade usa frases curtas, contrações e quebras onde o sentido pede. Quando o roteiro passar a ser escrito para ser **falado** — e não para ser lido —, metade da sensação de "robô" vai embora sem trocar uma linha de código de síntese.

Isso é trabalho de roteiro, e vale mais que a diferença entre Azure e ElevenLabs.
