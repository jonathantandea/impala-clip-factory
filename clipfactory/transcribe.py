"""Speech-to-text with openai-whisper, word timestamps included.

Output (transcript.json):
  {"language": "id", "model": "small", "segments": [
     {"start": 1.2, "end": 4.8, "text": "...", "words": [{"w": "halo", "s": 1.2, "e": 1.5}, ...]}
  ]}
"""
from __future__ import annotations

import re
from pathlib import Path

from .util import log, run


def extract_audio(video: Path, wav: Path) -> None:
    run(["ffmpeg", "-y", "-v", "error", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000",
         "-c:a", "pcm_s16le", str(wav)])


def load_kamus(path: Path | None) -> list[tuple[re.Pattern, str]]:
    """kamus.txt: one fix per line, `salah => benar`. Lines starting with # are ignored."""
    if not path or not path.exists():
        return []
    rules = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=>" not in line:
            continue
        wrong, right = (p.strip() for p in line.split("=>", 1))
        if wrong:
            rules.append((re.compile(rf"(?<!\w){re.escape(wrong)}(?!\w)", re.IGNORECASE), right))
    return rules


def apply_kamus(text: str, rules) -> str:
    for pat, right in rules:
        text = pat.sub(right, text)
    return text


def transcribe(video: Path, workdir: Path, model_name: str = "small", language: str | None = "id",
               prompt: str | None = None, kamus: Path | None = None) -> dict:
    try:
        import whisper  # openai-whisper
    except ImportError as e:
        raise SystemExit("Whisper belum terpasang. Jalankan: pip install -r requirements.txt") from e

    wav = workdir / "audio.wav"
    log("ekstrak audio ...")
    extract_audio(video, wav)

    log(f"muat model whisper '{model_name}' (pertama kali akan download) ...")
    model = whisper.load_model(model_name)
    log("transkripsi berjalan, ini bagian paling lama ...")
    result = model.transcribe(str(wav), language=language, word_timestamps=True,
                              initial_prompt=prompt, fp16=False, verbose=False)

    rules = load_kamus(kamus)
    segments = []
    for seg in result.get("segments", []):
        words = [{"w": apply_kamus(w["word"].strip(), rules), "s": round(float(w["start"]), 3),
                  "e": round(float(w["end"]), 3)}
                 for w in seg.get("words", []) if w.get("word", "").strip()]
        segments.append({"start": round(float(seg["start"]), 3), "end": round(float(seg["end"]), 3),
                         "text": apply_kamus(seg["text"].strip(), rules), "words": words})
    wav.unlink(missing_ok=True)
    return {"language": result.get("language", language), "model": model_name, "segments": segments}
