"""Context judge: Claude reads each candidate's transcript and keeps only clips that work alone.

Runs when an Anthropic API key is available (ANTHROPIC_API_KEY, or a profile from `ant auth login`).
Without one, export_for_claude() writes a file the user can send to Claude in chat; the answer is
pasted back through the web page's import box.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from .util import log, mmss

MODEL = "claude-opus-5-5"

SYSTEM = """You are a senior short-form video editor for Indonesian gaming/streaming and podcast creators.
You pick clips that real people would watch to the end and send to a friend.
A good clip: understandable with zero context, a hook in the first 2 seconds, a clear payoff
(punchline, reaction, reveal, strong opinion, chaos), no dead air at the start, ends right after the payoff.
Reject clips that are only noise, mid-sentence fragments, inside jokes that need earlier context,
or dull talk that happens to be loud. Audience signals (chat bursts, most-replayed) are strong
evidence that something happened, but you must find WHAT happened in the transcript and frame it."""

SCHEMA = {
    "type": "object",
    "properties": {
        "clips": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "keep": {"type": "boolean"},
                    "score": {"type": "number"},
                    "start": {"type": "number"},
                    "end": {"type": "number"},
                    "title": {"type": "string"},
                    "hook": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["id", "keep", "score", "start", "end", "title", "hook", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["clips"],
    "additionalProperties": False,
}


def _context(segments, a: float, b: float) -> str:
    return "\n".join(f"[{s['start']:.1f}] {s['text']}" for s in segments if s["end"] >= a and s["start"] <= b)


def build_prompt(candidates, segments, min_len: int, max_len: int) -> str:
    blocks = []
    for c in candidates:
        a, b = max(0.0, c["start"] - 30), c["end"] + 15
        blocks.append(f"### Candidate {c['id']}  (current {c['start']:.1f}-{c['end']:.1f}s, peak {c.get('peak', '?')}s)\n"
                      f"Signals: {c.get('reason', '-')}\nTranscript ({mmss(a)}-{mmss(b)}):\n{_context(segments, a, b)}")
    return (f"Here are clip candidates from a long stream/video. For EACH candidate decide keep or reject.\n"
            f"If you keep it, set start/end (seconds, taken from the transcript timestamps) so the clip opens on the\n"
            f"hook and ends right after the payoff; length {min_len}-{max_len} s. Score 1-10 = how likely it is to go viral.\n"
            f"title: short Indonesian title (max 8 words). hook: on-screen text for the first 2 s (max 8 words, Indonesian,\n"
            f"same language/slang as the video). reason: one sentence on why it works (or why rejected).\n\n"
            + "\n\n".join(blocks))


def api_available() -> bool:
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        return True
    return (Path.home() / ".config" / "anthropic").exists()


def judge(candidates, segments, *, min_len=20, max_len=60, top=8) -> list[dict] | None:
    """Return judged clips, or None if the API can't be used (caller keeps the signal ranking)."""
    if not candidates or not api_available():
        return None
    try:
        import anthropic
    except ImportError:
        log("paket 'anthropic' belum terpasang: jalankan setup lagi. Pakai ranking sinyal saja.")
        return None
    log(f"Claude menilai {len(candidates)} kandidat (konteks, hook, payoff) ...")
    try:
        client = anthropic.Anthropic()
        resp = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
            system=SYSTEM,
            messages=[{"role": "user", "content": build_prompt(candidates, segments, min_len, max_len)}],
        )
    except anthropic.AuthenticationError:
        log("API key Anthropic ditolak. Pakai ranking sinyal saja.")
        return None
    except anthropic.RateLimitError:
        log("Claude API sedang dibatasi (rate limit). Pakai ranking sinyal saja.")
        return None
    except anthropic.APIStatusError as e:
        log(f"Claude API error {e.status_code}. Pakai ranking sinyal saja.")
        return None
    except anthropic.APIConnectionError:
        log("Tidak bisa menghubungi Claude API. Pakai ranking sinyal saja.")
        return None
    if resp.stop_reason == "refusal":
        log("Claude menolak menilai transkrip ini. Pakai ranking sinyal saja.")
        return None
    text = next((b.text for b in resp.content if b.type == "text"), "")
    try:
        data = json.loads(text)
    except ValueError:
        log("Jawaban Claude tidak terbaca. Pakai ranking sinyal saja.")
        return None
    by_id = {c["id"]: c for c in candidates}
    out = []
    for j in data.get("clips", []):
        c = by_id.get(j["id"])
        if not c or not j["keep"]:
            continue
        s, e = float(j["start"]), float(j["end"])
        if not (0 <= s < e) or e - s > max_len + 15 or e - s < 8:
            s, e = c["start"], c["end"]
        out.append(dict(c, start=round(s, 2), end=round(e, 2), title=j["title"].strip(), hook=j["hook"].strip(),
                        reason=f"{j['reason'].strip()} ({c.get('reason', '')})", score=round(float(j["score"]), 1),
                        source="claude"))
    out.sort(key=lambda c: c["score"], reverse=True)
    log(f"Claude menyimpan {len(out)} dari {len(candidates)} kandidat")
    return out[:top]


def export_for_claude(path: Path, candidates, segments, min_len=20, max_len=60) -> Path:
    """Write a file to send to Claude in chat; its JSON answer goes into the web page's import box."""
    body = (SYSTEM + "\n\n" + build_prompt(candidates, segments, min_len, max_len) +
            "\n\nAnswer with ONLY this JSON (keep=false clips may be omitted):\n"
            '{"clips":[{"id":1,"start":123.4,"end":160.2,"title":"...","hook":"...","reason":"...","score":8}]}\n')
    path.write_text(body, encoding="utf-8")
    return path
