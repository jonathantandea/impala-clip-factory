"""Choose clip-worthy moments from a transcript.

Default: a local LLM through Ollama (qwen2.5:7b). The transcript is sent in
overlapping windows so a 7B model with an 8k context can handle long VODs.
Fallback (--no-llm or Ollama not reachable): a simple speech-energy heuristic.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from .util import log, mmss

SYSTEM = """Kamu editor video pendek (TikTok/Reels/Shorts) yang tajam.
Dari transkrip bertanda waktu, pilih momen yang paling layak jadi clip vertikal:
lucu, reaksi kuat, cerita lengkap, opini tegas, info berguna, atau momen tegang.
Setiap clip harus bisa dimengerti tanpa konteks lain, punya awal yang langsung menarik,
dan berdurasi {min_len}-{max_len} detik.
Jawab HANYA JSON dengan bentuk:
{{"clips": [{{"start": <detik>, "end": <detik>, "title": "<judul pendek>",
"hook": "<teks hook di layar, maks 8 kata>", "reason": "<kenapa menarik, 1 kalimat>",
"score": <1-10>}}]}}
Gunakan angka detik dari tanda waktu transkrip. Kalau tidak ada yang bagus, kembalikan {{"clips": []}}."""


def _lines(segments, t0: float, t1: float) -> str:
    return "\n".join(f"[{s['start']:.1f}-{s['end']:.1f}] {s['text']}"
                     for s in segments if s["end"] > t0 and s["start"] < t1)


def _ollama(host: str, model: str, system: str, user: str, timeout: int = 600) -> dict:
    body = json.dumps({
        "model": model, "stream": False, "format": "json",
        "options": {"temperature": 0.3, "num_ctx": 8192},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request(f"{host.rstrip('/')}/api/chat", data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        content = json.loads(resp.read())["message"]["content"]
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        log("  jawaban LLM bukan JSON valid, window ini dilewati")
        return {"clips": []}


def ollama_ok(host: str) -> bool:
    try:
        urllib.request.urlopen(f"{host.rstrip('/')}/api/tags", timeout=3)
        return True
    except (urllib.error.URLError, OSError):
        return False


def pick_llm(segments, duration: float, host: str, model: str, min_len: int, max_len: int,
             window: int = 480, overlap: int = 60) -> list[dict]:
    system = SYSTEM.format(min_len=min_len, max_len=max_len)
    found, t0 = [], 0.0
    n_win = max(1, int((duration - overlap) // (window - overlap)) + 1)
    i = 0
    while t0 < duration:
        i += 1
        t1 = min(duration, t0 + window)
        text = _lines(segments, t0, t1)
        if text.strip():
            log(f"  LLM window {i}/{n_win} ({mmss(t0)}-{mmss(t1)}) ...")
            data = _ollama(host, model, system, f"Transkrip ({mmss(t0)} sampai {mmss(t1)}):\n{text}")
            for c in data.get("clips", []) or []:
                try:
                    found.append({"start": float(c["start"]), "end": float(c["end"]),
                                  "title": str(c.get("title", "")).strip(),
                                  "hook": str(c.get("hook", "")).strip(),
                                  "reason": str(c.get("reason", "")).strip(),
                                  "score": float(c.get("score", 5)), "source": "llm"})
                except (KeyError, TypeError, ValueError):
                    continue
        if t1 >= duration:
            break
        t0 = t1 - overlap
    return found


def pick_heuristic(segments, duration: float, min_len: int, max_len: int) -> list[dict]:
    """Score sliding windows by speech density plus excitement markers."""
    target = (min_len + max_len) / 2
    out, t = [], 0.0
    while t + min_len <= duration:
        segs = [s for s in segments if s["start"] >= t and s["end"] <= t + target]
        if segs:
            words = sum(len(s["words"]) or len(s["text"].split()) for s in segs)
            text = " ".join(s["text"] for s in segs)
            bang = text.count("!") + text.count("?")
            score = words / target * 3 + bang * 0.5
            out.append({"start": segs[0]["start"], "end": segs[-1]["end"],
                        "title": segs[0]["text"][:60], "hook": "", "reason": "padat bicara (heuristik)",
                        "score": round(min(10, score), 1), "source": "heuristic"})
        t += 10
    return out


def snap(clips, segments, duration: float, min_len: int, max_len: int) -> list[dict]:
    """Snap to sentence boundaries and enforce length limits."""
    out = []
    for c in clips:
        s, e = max(0.0, c["start"]), min(duration, c["end"])
        if e <= s:
            continue
        starts = [g["start"] for g in segments if g["start"] <= s + 0.5]
        ends = [g["end"] for g in segments if g["end"] >= e - 0.5]
        s = max(starts) if starts else s
        e = min(ends) if ends else e
        if e - s > max_len:
            e = s + max_len
            inside = [g["end"] for g in segments if s < g["end"] <= e]
            e = max(inside) if inside and max(inside) - s >= min_len else e
        if e - s < min_len:
            e = min(duration, s + min_len)
        c = dict(c, start=round(s, 2), end=round(e + 0.25, 2) if e + 0.25 <= duration else round(e, 2))
        out.append(c)
    return out


def dedupe(clips, top: int) -> list[dict]:
    clips = sorted(clips, key=lambda c: c["score"], reverse=True)
    kept: list[dict] = []
    for c in clips:
        overlap = any(min(c["end"], k["end"]) - max(c["start"], k["start"])
                      > 0.5 * min(c["end"] - c["start"], k["end"] - k["start"]) for k in kept)
        if not overlap:
            kept.append(c)
        if len(kept) >= top:
            break
    for i, c in enumerate(kept, 1):
        c["id"] = i
    return kept


def pick(segments, duration: float, *, use_llm: bool, host: str, model: str,
         min_len: int, max_len: int, top: int) -> list[dict]:
    raw: list[dict] = []
    if use_llm:
        if ollama_ok(host):
            log(f"pilih momen dengan Ollama ({model}) ...")
            raw = pick_llm(segments, duration, host, model, min_len, max_len)
        else:
            log(f"Ollama tidak bisa dihubungi di {host}. Pakai heuristik. (Jalankan: ollama serve)")
    if not raw:
        raw = pick_heuristic(segments, duration, min_len, max_len)
    return dedupe(snap(raw, segments, duration, min_len, max_len), top)
