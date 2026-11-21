"""Caption files for one clip: burned-in ASS (word highlight), SRT and CapCut TXT."""
from __future__ import annotations

from pathlib import Path


def clip_words(segments, start: float, end: float) -> list[dict]:
    words = []
    for seg in segments:
        if seg["end"] < start or seg["start"] > end:
            continue
        src = seg["words"] or _fake_words(seg)
        for w in src:
            if w["s"] >= start - 0.05 and w["e"] <= end + 0.05:
                words.append({"w": w["w"], "s": max(0.0, w["s"] - start), "e": max(0.0, w["e"] - start)})
    return words


def _fake_words(seg):
    """Spread words evenly when Whisper gave no word timings."""
    toks = seg["text"].split()
    if not toks:
        return []
    step = (seg["end"] - seg["start"]) / len(toks)
    return [{"w": t, "s": seg["start"] + i * step, "e": seg["start"] + (i + 1) * step}
            for i, t in enumerate(toks)]


def chunk(words, max_words: int = 3, max_dur: float = 1.6, max_gap: float = 0.6) -> list[list[dict]]:
    chunks, cur = [], []
    for w in words:
        if cur and (len(cur) >= max_words or w["s"] - cur[-1]["e"] > max_gap
                    or w["e"] - cur[0]["s"] > max_dur):
            chunks.append(cur)
            cur = []
        cur.append(w)
        if w["w"].endswith((".", "?", "!", ",")):
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def _t_ass(t: float) -> str:
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _t_srt(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _clean(w: str) -> str:
    return w.replace("{", "(").replace("}", ")").replace("\\", "/")


ASS_HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,7,2,2,60,60,{margin_v},1
Style: Hook,{font},86,&H00FFFFFF,&H00FFFFFF,&H00000000,&HC0000000,-1,0,0,0,100,100,0,0,3,18,0,8,70,70,170,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

HIGHLIGHT = r"{\c&H00E5FF&}"  # yellow (ASS colours are BGR)


def write_all(words, out_stem: Path, clip_len: float, hook: str = "", font: str = "Arial",
              size: int = 92, margin_v: int = 520, upper: bool = True, hook_secs: float = 3.0) -> dict:
    chunks = chunk(words)
    fmt = (lambda s: s.upper()) if upper else (lambda s: s)

    # ASS: one event per word so the spoken word lights up.
    lines = []
    if hook:
        lines.append(f"Dialogue: 1,{_t_ass(0)},{_t_ass(min(hook_secs, clip_len))},Hook,,0,0,0,,{_clean(fmt(hook))}")
    for ci, ch in enumerate(chunks):
        chunk_end = chunks[ci + 1][0]["s"] if ci + 1 < len(chunks) else ch[-1]["e"] + 0.3
        chunk_end = min(chunk_end, ch[-1]["e"] + 0.6, clip_len)
        for wi, w in enumerate(ch):
            s = w["s"]
            e = ch[wi + 1]["s"] if wi + 1 < len(ch) else chunk_end
            if e <= s:
                continue
            text = " ".join((HIGHLIGHT + _clean(fmt(x["w"])) + r"{\r}") if j == wi else _clean(fmt(x["w"]))
                            for j, x in enumerate(ch))
            lines.append(f"Dialogue: 0,{_t_ass(s)},{_t_ass(e)},Cap,,0,0,0,,{text}")
    ass = out_stem.with_suffix(".ass")
    ass.write_text(ASS_HEAD.format(font=font, size=size, margin_v=margin_v) + "\n".join(lines) + "\n",
                   encoding="utf-8")

    # SRT + CapCut TXT (plain lines, one per caption chunk).
    srt_lines, txt_lines = [], []
    for i, ch in enumerate(chunks, 1):
        text = " ".join(x["w"] for x in ch)
        srt_lines += [str(i), f"{_t_srt(ch[0]['s'])} --> {_t_srt(ch[-1]['e'])}", text, ""]
        txt_lines.append(text)
    srt = out_stem.with_suffix(".srt")
    txt = out_stem.with_name(out_stem.name + "_capcut.txt")
    srt.write_text("\n".join(srt_lines), encoding="utf-8")
    txt.write_text("\n".join(txt_lines) + "\n", encoding="utf-8")
    return {"ass": ass, "srt": srt, "txt": txt}
