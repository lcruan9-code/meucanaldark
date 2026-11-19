"""
Ponte para o Chatterbox (Resemble AI, MIT).

Recebe um lote de frases por stdin e devolve um WAV por frase. O lote existe
por um motivo pratico: carregar o modelo custa dezenas de segundos, e um
processo por frase gastaria esse tempo a cada frase de cada cena.

Determinismo: o Chatterbox e um modelo generativo, entao a mesma frase sai
diferente a cada chamada. Num motor de video isso e inaceitavel — o cache
por hash devolveria audio que nao corresponde ao que foi conferido. Por isso
a semente e fixada por frase, derivada do indice: a mesma cena re-sintetiza
identica.

Entrada (stdin, JSON):
  {
    "sentences": ["...", "..."],
    "outDir": "caminho",
    "audioPrompt": "caminho/ref.wav" | null,
    "exaggeration": 0.5,
    "cfgWeight": 0.5,
    "seed": 1234,
    "device": "cuda" | "cpu"
  }

Saida (stdout, JSON): {"files": [...], "sampleRate": 24000, "device": "cuda"}
"""

import json
import os
import sys
import wave


def save_wav(path: str, tensor, sample_rate: int) -> None:
    """
    Grava WAV PCM 16 bits mono com a biblioteca padrao.

    O `torchaudio.save` da versao 2.14 passou a exigir o TorchCodec, que sao
    mais centenas de MB para uma tarefa de dez linhas. O tensor do Chatterbox
    e float32 em [-1, 1]; converter e escrever cabe aqui.
    """
    import numpy as np

    data = tensor.detach().cpu().numpy()
    if data.ndim > 1:
        data = data[0]
    pcm = (np.clip(data, -1.0, 1.0) * 32767.0).astype("<i2")

    with wave.open(path, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(int(sample_rate))
        handle.writeframes(pcm.tobytes())


def fail(message: str) -> None:
    print(json.dumps({"error": message}), file=sys.stdout, flush=True)
    sys.exit(1)


def main() -> None:
    try:
        job = json.load(sys.stdin)
    except Exception as exc:  # noqa: BLE001
        fail(f"job invalido no stdin: {exc}")
        return

    sentences = job.get("sentences") or []
    out_dir = job.get("outDir")
    if not sentences or not out_dir:
        fail("job precisa de 'sentences' e 'outDir'.")
        return

    # Vazio ou "en" usa o modelo ingles, que e menor e ja esta em cache.
    # Qualquer outro idioma exige a variante multilingue, que e outro modelo.
    language_id = (job.get("languageId") or "").strip().lower()
    multilingual = bool(language_id) and language_id != "en"

    try:
        import torch

        if multilingual:
            from chatterbox.mtl_tts import (  # noqa: PLC0415
                SUPPORTED_LANGUAGES,
                ChatterboxMultilingualTTS as Model,
            )

            if language_id not in SUPPORTED_LANGUAGES:
                fail(
                    f"idioma '{language_id}' nao suportado. "
                    f"Disponiveis: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
                )
                return
        else:
            from chatterbox.tts import ChatterboxTTS as Model  # noqa: PLC0415
    except Exception as exc:  # noqa: BLE001
        fail(
            "dependencias do Chatterbox ausentes no interpretador "
            f"{sys.executable}: {exc}"
        )
        return

    requested = job.get("device") or ("cuda" if torch.cuda.is_available() else "cpu")
    if requested == "cuda" and not torch.cuda.is_available():
        # Avisa e segue na CPU: melhor um render lento que um render que nao sai.
        print("[chatterbox] CUDA indisponivel, caindo para CPU", file=sys.stderr)
        requested = "cpu"

    os.makedirs(out_dir, exist_ok=True)

    try:
        model = Model.from_pretrained(device=requested)
    except Exception as exc:  # noqa: BLE001
        fail(f"falha ao carregar o modelo: {exc}")
        return

    audio_prompt = job.get("audioPrompt") or None
    if audio_prompt and not os.path.isfile(audio_prompt):
        fail(f"voz de referencia nao encontrada: {audio_prompt}")
        return

    base_seed = int(job.get("seed", 1234))
    exaggeration = float(job.get("exaggeration", 0.5))
    cfg_weight = float(job.get("cfgWeight", 0.5))

    files = []
    for index, sentence in enumerate(sentences):
        # Semente por frase: a mesma cena re-sintetiza identica, e frases
        # diferentes nao herdam a mesma entonacao.
        torch.manual_seed(base_seed + index)
        if requested == "cuda":
            torch.cuda.manual_seed_all(base_seed + index)

        kwargs = {"exaggeration": exaggeration, "cfg_weight": cfg_weight}
        if multilingual:
            kwargs["language_id"] = language_id
        if audio_prompt:
            kwargs["audio_prompt_path"] = audio_prompt

        try:
            wav = model.generate(sentence, **kwargs)
        except TypeError:
            # Versoes mais antigas nao aceitam todos os parametros.
            minimal = {"language_id": language_id} if multilingual else {}
            if audio_prompt:
                minimal["audio_prompt_path"] = audio_prompt
            wav = model.generate(sentence, **minimal)
        except Exception as exc:  # noqa: BLE001
            fail(f"falha ao sintetizar a frase {index}: {exc}")
            return

        out_file = os.path.join(out_dir, f"cb{index:03d}.wav")
        save_wav(out_file, wav, model.sr)
        files.append(out_file)
        print(f"[chatterbox] {index + 1}/{len(sentences)}", file=sys.stderr)

    print(
        json.dumps(
            {
                "files": files,
                "sampleRate": int(model.sr),
                "device": requested,
                "language": language_id or "en",
                "multilingual": multilingual,
            }
        ),
        file=sys.stdout,
        flush=True,
    )


if __name__ == "__main__":
    main()
