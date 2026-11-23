"""Align a recorded / uploaded voice-over to its script, word by word.

Whisper gives timed words (with spelling guesses); the script gives the exact text. A global
alignment (Needleman-Wunsch over normalised tokens, fuzzy match score) maps every script word to a
time. Script words Whisper missed get times interpolated from their neighbours. The result is the
same words.json the story engine already uses (words with phrase index, phrases, duration), so
captions show the script's spelling and scenes cut on the script's sentences.

    python -m clipfactory.vo_align <project_dir> <audio> [--whisper words.json] [--model small]
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import subprocess
import unicodedata
from pathlib import Path

NUM = {"0": "nol", "1": "satu", "2": "dua", "3": "tiga", "4": "empat", "5": "lima", "6": "enam", "7": "tujuh", "8": "delapan", "9": "sembilan"}


def norm(w: str) -> str:
    w = unicodedata.normalize("NFKD", w).encode("ascii", "ignore").decode().lower()
    w = re.sub(r"[^a-z0-9]", "", w)
    return "".join(NUM.get(ch, ch) for ch in w) if w.isdigit() else w


def sim(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def align(script_tokens: list[str], heard: list[dict]) -> list[tuple[float, float] | None]:
    """Global alignment; returns (start, end) per script token, or None where unmatched."""
    A = [norm(t) for t in script_tokens]
    B = [norm(h["w"]) for h in heard]
    n, m = len(A), len(B)
    GAP = -0.45
    # banded DP would be faster; n*m for ~1.5k x 1.5k words is ~2M cells, fine in pure python lists
    score = [[0.0] * (m + 1) for _ in range(n + 1)]
    back = [[0] * (m + 1) for _ in range(n + 1)]   # 0 diag, 1 up (skip script), 2 left (skip heard)
    for i in range(1, n + 1):
        score[i][0] = i * GAP; back[i][0] = 1
    for j in range(1, m + 1):
        score[0][j] = j * GAP; back[0][j] = 2
    # restrict to a diagonal band to keep it quick on long scripts
    band = max(200, abs(n - m) + 200)
    for i in range(1, n + 1):
        jc = int(i * m / max(1, n))
        lo, hi = max(1, jc - band), min(m, jc + band)
        row, prev = score[i], score[i - 1]
        for j in range(1, m + 1):
            if j < lo or j > hi:
                row[j] = -1e9; continue
            s = sim(A[i - 1], B[j - 1])
            d = prev[j - 1] + (s * 2 - 1 if s > 0.55 else -1.0)
            u = prev[j] + GAP
            l = row[j - 1] + GAP
            if d >= u and d >= l:
                row[j], back[i][j] = d, 0
            elif u >= l:
                row[j], back[i][j] = u, 1
            else:
                row[j], back[i][j] = l, 2
    out: list[tuple[float, float] | None] = [None] * n
    i, j = n, m
    while i > 0 and j > 0:
        b = back[i][j]
        if b == 0:
            if sim(A[i - 1], B[j - 1]) > 0.55:
                out[i - 1] = (heard[j - 1]["s"], heard[j - 1]["e"])
            i, j = i - 1, j - 1
        elif b == 1:
            i -= 1
        else:
            j -= 1
    return out


def fill(times: list[tuple[float, float] | None], total: float) -> list[tuple[float, float]]:
    """Interpolate missing word times between matched neighbours."""
    n = len(times)
    res: list[tuple[float, float]] = [(0.0, 0.0)] * n
    known = [k for k, t in enumerate(times) if t]
    if not known:
        step = total / max(1, n)
        return [(k * step, (k + 1) * step) for k in range(n)]
    for k in range(n):
        if times[k]:
            res[k] = times[k]  # type: ignore[assignment]
            continue
        before = max((x for x in known if x < k), default=None)
        after = min((x for x in known if x > k), default=None)
        t0 = times[before][1] if before is not None else 0.0  # type: ignore[index]
        t1 = times[after][0] if after is not None else total  # type: ignore[index]
        a = before if before is not None else -1
        b = after if after is not None else n
        f0, f1 = (k - a) / (b - a), (k - a + 1) / (b - a)
        res[k] = (t0 + (t1 - t0) * f0, t0 + (t1 - t0) * f1 * 0.98)
    return res


def whisper_words(audio: Path, model: str = "small", prompt: str = "") -> list[dict]:
    import whisper  # openai-whisper
    m = whisper.load_model(model)
    r = m.transcribe(str(audio), language="id", word_timestamps=True, verbose=False, initial_prompt=prompt or None)
    return [{"w": w["word"].strip(), "s": float(w["start"]), "e": float(w["end"])} for seg in r["segments"] for w in seg.get("words", [])]


def build(project: Path, audio: Path, heard: list[dict], lines: list[str], speakers: list[str] | None = None) -> dict:
    """Write vo.wav + words.json in the project from an uploaded VO and its script lines."""
    project.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(audio), "-ac", "1", "-ar", "48000", str(project / "vo.wav")], check=True)
    total = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(audio)],
                                 capture_output=True, text=True, check=True).stdout)
    tokens, owner = [], []
    for k, line in enumerate(lines):
        for t in line.split():
            tokens.append(t); owner.append(k)
    raw = align(tokens, heard)
    matched = sum(1 for t in raw if t)
    times = fill(raw, total)
    words = [{"w": t, "s": round(s, 3), "e": round(e, 3), "phrase": owner[i], "speaker": (speakers or ["narator"] * len(lines))[owner[i]]}
             for i, (t, (s, e)) in enumerate(zip(tokens, times))]
    phrases = []
    for k, line in enumerate(lines):
        ws = [w for w in words if w["phrase"] == k]
        phrases.append({"s": ws[0]["s"] if ws else 0.0, "text": line, "speaker": ws[0]["speaker"] if ws else "narator"})
    data = {"words": words, "phrases": phrases, "duration": round(total + 0.6, 2), "source": "upload"}
    (project / "words.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return {"duration": data["duration"], "words": len(words), "lines": len(lines), "matched": matched}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("project", type=Path, help="project dir with scene.json (script lines are read from it)")
    ap.add_argument("audio", type=Path)
    ap.add_argument("--whisper", type=Path, help="cached whisper words json ({words: [{w, s, e}]})")
    ap.add_argument("--model", default="small")
    a = ap.parse_args()
    spec = json.loads((a.project / "scene.json").read_text(encoding="utf-8"))
    lines = [(x["text"] if isinstance(x, dict) else x) for x in spec["script"]]
    speakers = [(x.get("speaker", "narator") if isinstance(x, dict) else "narator") for x in spec["script"]]
    heard = json.loads(a.whisper.read_text())["words"] if a.whisper else whisper_words(a.audio, a.model, " ".join(lines)[:220])
    print(json.dumps(build(a.project, a.audio, heard, lines, speakers)))


if __name__ == "__main__":
    main()


def insert_pauses(project: Path, audio: Path, before_lines: dict[int, float], out_audio: Path) -> dict:
    """Insert silence before the given script lines (line index -> target pause in seconds).
    Cuts at the quietest 20 ms point near the boundary, shifts word times, rewrites vo.wav + words.json."""
    import numpy as np
    data = json.loads((project / "words.json").read_text(encoding="utf-8"))
    W = data["words"]
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-f", "s16le", "-ac", "1", "-ar", "48000", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    sr, cuts = 48000, []
    for ln, pause in sorted(before_lines.items()):
        i = next((k for k, w in enumerate(W) if w["phrase"] == ln), None)
        if not i:
            continue
        a, b = W[i - 1]["e"], W[i]["s"]
        lo, hi = int((min(a, b) - 0.25) * sr), int((max(a, b) + 0.15) * sr)
        win = int(0.02 * sr)
        energy = [float(np.sqrt(np.mean(x[k:k + win] ** 2))) for k in range(lo, hi - win, win // 2)]
        k = lo + int(np.argmin(energy)) * (win // 2) + win // 2
        cuts.append((k / sr, max(0.0, pause - max(0.0, b - a))))
    pieces, last, shift = [], 0, 0.0
    for t, add in cuts:
        k = int(t * sr); pieces.append(x[last:k]); pieces.append(np.zeros(int(add * sr), dtype=np.float32)); last = k
    pieces.append(x[last:])
    y = np.concatenate(pieces)
    import wave
    with wave.open(str(out_audio), "wb") as wv:
        wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(sr)
        wv.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    for w in W:
        off = sum(add for t, add in cuts if w["s"] >= t)
        w["s"] = round(w["s"] + off, 3); w["e"] = round(w["e"] + off, 3)
    for k, ph in enumerate(data["phrases"]):
        ws = [w for w in W if w["phrase"] == k]
        if ws:
            ph["s"] = ws[0]["s"]
    added = sum(a for _, a in cuts)
    data["duration"] = round(data["duration"] + added, 2)
    (project / "words.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out_audio), "-ac", "1", "-ar", "48000", str(project / "vo.wav")], check=True)
    return {"cuts": [(round(t, 2), round(a, 2)) for t, a in cuts], "added": round(added, 2), "duration": data["duration"]}
