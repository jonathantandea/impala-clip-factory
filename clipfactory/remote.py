"""Link mode: work from a YouTube/Twitch URL without downloading the whole stream.

1. read metadata (title, duration, "Most replayed" heatmap) - no download
2. transcript from the platform's subtitles (seconds); fallback: audio only + Whisper
3. later, download only the chosen moments (--download-sections)
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

from .util import log

URL_RE = re.compile(r"^https?://", re.I)
YT_ID_RE = re.compile(r"(?:v=|youtu\.be/|/live/|/shorts/|/embed/)([A-Za-z0-9_-]{11})")
PAD = 1.0  # seconds of padding around a downloaded section


def is_url(s: str) -> bool:
    return bool(URL_RE.match((s or "").strip()))


def project_name(url: str) -> str:
    m = YT_ID_RE.search(url)
    if m:
        return f"yt-{m.group(1)}"
    m = re.search(r"twitch\.tv/videos/(\d+)", url)
    if m:
        return f"twitch-{m.group(1)}"
    return "link-" + hashlib.sha1(url.encode()).hexdigest()[:10]


def _ytdlp(args: list[str], cookies: str | None = None) -> subprocess.CompletedProcess:
    cmd = [sys.executable, "-m", "yt_dlp", "--no-warnings", "--no-progress", "--no-playlist"]
    if cookies:
        cmd += ["--cookies-from-browser", cookies]
    proc = subprocess.run(cmd + args, capture_output=True, text=True)
    if proc.returncode != 0:
        err = "\n".join(proc.stderr.strip().splitlines()[-6:])
        hint = ""
        if "Sign in" in err or "members" in err.lower() or "age" in err.lower():
            hint = "\nVideo ini butuh login: pilih browser di opsi Cookies (mis. chrome)."
        elif "JavaScript" in err or "js runtime" in err.lower():
            hint = "\nDeno belum terpasang. Jalankan setup_mac.sh lagi."
        raise RuntimeError(f"yt-dlp gagal:\n{err}{hint}\n(Kalau YouTube baru berubah: jalankan setup_mac.sh lagi untuk update yt-dlp.)")
    return proc


def fetch_info(url: str, cookies: str | None = None) -> dict:
    log("baca info video dari link (tanpa download) ...")
    info = json.loads(_ytdlp(["-J", "--skip-download", url], cookies).stdout)
    if info.get("is_live"):
        raise SystemExit("Live masih berjalan. Tunggu sampai selesai dan jadi VOD, lalu coba lagi.")
    keep = ("id", "title", "duration", "webpage_url", "uploader", "heatmap", "chapters", "thumbnail",
            "language", "width", "height", "extractor_key")
    slim = {k: info.get(k) for k in keep}
    slim["subs"] = sorted((info.get("subtitles") or {}).keys())
    slim["auto_subs"] = sorted((info.get("automatic_captions") or {}).keys())
    return slim


def choose_sub_lang(info: dict, lang: str | None) -> tuple[str, bool] | None:
    """Best subtitle track: manual in lang > auto original-language track > auto in lang."""
    subs, auto = info.get("subs", []), info.get("auto_subs", [])
    lang = lang or (info.get("language") or "")
    if lang and lang in subs:
        return lang, False
    for cand in (f"{lang}-orig", lang):
        if cand and cand in auto:
            return cand, True
    orig = [a for a in auto if a.endswith("-orig")]
    if orig:
        return orig[0], True
    if subs:
        return subs[0], False
    return None


def parse_json3(data: dict) -> list[dict]:
    """YouTube json3 captions -> transcript segments with per-word timings."""
    segments = []
    events = [e for e in data.get("events", []) if e.get("segs")]
    for i, ev in enumerate(events):
        t0 = ev.get("tStartMs", 0) / 1000
        dur = ev.get("dDurationMs", 0) / 1000
        nxt = events[i + 1].get("tStartMs", 0) / 1000 if i + 1 < len(events) else t0 + dur
        end = min(t0 + dur, nxt) if nxt > t0 else t0 + dur
        words = []
        for s in ev["segs"]:
            txt = (s.get("utf8") or "").replace("\n", " ").strip()
            if not txt:
                continue
            for tok in txt.split():
                words.append({"w": tok, "s": round(t0 + s.get("tOffsetMs", 0) / 1000, 3)})
        if not words:
            continue
        for j, w in enumerate(words):  # end of each word = start of next one
            w["e"] = round(words[j + 1]["s"] if j + 1 < len(words) else max(end, w["s"] + 0.3), 3)
            if w["e"] <= w["s"]:
                w["e"] = round(w["s"] + 0.25, 3)
        segments.append({"start": words[0]["s"], "end": words[-1]["e"],
                         "text": " ".join(w["w"] for w in words), "words": words})
    return segments


def parse_vtt(text: str) -> list[dict]:
    """Fallback parser for .vtt captions (no word timings)."""
    def secs(t):
        h, m, s = (["0"] + t.replace(",", ".").split(":"))[-3:]
        return int(h) * 3600 + int(m) * 60 + float(s)
    segs, seen = [], set()
    for block in re.split(r"\n\s*\n", text):
        m = re.search(r"(\d[\d:.,]+)\s*-->\s*(\d[\d:.,]+)", block)
        if not m:
            continue
        rows = block.splitlines()
        idx = next(i for i, ln in enumerate(rows) if "-->" in ln)
        txt = " ".join(t for t in (re.sub(r"<[^>]+>", "", ln).strip() for ln in rows[idx + 1:]) if t)
        if txt and txt not in seen:
            seen.add(txt)
            segs.append({"start": secs(m.group(1)), "end": secs(m.group(2)), "text": txt, "words": []})
    return segs


def fetch_transcript(url: str, info: dict, workdir: Path, lang: str | None, cookies: str | None) -> dict | None:
    pick = choose_sub_lang(info, lang)
    if not pick:
        return None
    code, auto = pick
    log(f"ambil subtitle {'otomatis ' if auto else ''}'{code}' dari platform ...")
    base = workdir / "subs"
    args = ["--skip-download", "--sub-langs", code, "--sub-format", "json3/vtt/best",
            "--write-auto-subs" if auto else "--write-subs", "-o", str(base), url]
    _ytdlp(args, cookies)
    files = sorted(workdir.glob("subs*.json3")) or sorted(workdir.glob("subs*.vtt"))
    if not files:
        return None
    f = files[0]
    segs = parse_json3(json.loads(f.read_text(encoding="utf-8"))) if f.suffix == ".json3" \
        else parse_vtt(f.read_text(encoding="utf-8"))
    for x in files:
        x.unlink(missing_ok=True)
    if not segs:
        return None
    return {"language": code.replace("-orig", ""), "model": f"subtitle {'otomatis' if auto else 'manual'} ({code})",
            "segments": segs}


def download_audio(url: str, workdir: Path, cookies: str | None) -> Path:
    log("subtitle tidak ada: download audio saja (jauh lebih kecil dari video) ...")
    _ytdlp(["-f", "ba[ext=m4a]/ba/b", "-o", str(workdir / "audio.%(ext)s"), url], cookies)
    files = [p for p in workdir.glob("audio.*") if p.suffix not in (".part", ".ytdl")]
    if not files:
        raise RuntimeError("download audio gagal")
    return files[0]


def download_section(url: str, start: float, end: float, out: Path, cookies: str | None = None,
                     max_height: int = 1080) -> float:
    """Download only [start-PAD, end+PAD]. Returns the real start time of the file."""
    s = max(0.0, start - PAD)
    e = end + PAD
    if out.exists() and out.stat().st_size > 0:
        return s
    fmt = (f"bv*[height<={max_height}][ext=mp4]+ba[ext=m4a]/bv*[height<={max_height}]+ba/"
           f"b[height<={max_height}]/b")
    tmp = out.with_name(out.stem + ".dl.%(ext)s")
    _ytdlp(["-f", fmt, "--download-sections", f"*{s:.2f}-{e:.2f}", "--force-keyframes-at-cuts",
            "--merge-output-format", "mp4", "-o", str(tmp), url], cookies)
    got = [p for p in out.parent.glob(out.stem + ".dl.*") if p.suffix not in (".part", ".ytdl")]
    if not got:
        raise RuntimeError("download potongan video gagal")
    got[0].rename(out)
    return s


_INFO_CACHE: dict = {}
_URL_CACHE: dict = {}


def cached_info(url: str, cookies: str | None = None) -> dict:
    if url not in _INFO_CACHE:
        _INFO_CACHE[url] = fetch_info(url, cookies)
    return _INFO_CACHE[url]


def direct_video_url(url: str, cookies: str | None = None) -> str:
    """Streamable URL of a <=720p video-only format, for grabbing single frames."""
    if url not in _URL_CACHE:
        out = _ytdlp(["-g", "-f", "bv*[height<=720][ext=mp4]/bv*[height<=720]/b", url], cookies).stdout
        _URL_CACHE[url] = out.strip().splitlines()[0]
    return _URL_CACHE[url]


def frame_from_link(url: str, t: float, workdir: Path, cookies: str | None = None) -> Path:
    """One low-res second of video around t, downloaded by yt-dlp itself (handles YouTube's
    headers/signatures), for grabbing a still frame. Cached per second."""
    workdir.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(f"{url}|{int(t)}".encode()).hexdigest()[:12]
    done = [p for p in workdir.glob(f"f_{key}.*") if p.suffix not in (".part", ".ytdl")]
    if done:
        return done[0]
    _ytdlp(["-f", "bv*[height<=480][height>=240]/bv*[height<=720]/b[height<=480]/b",
            "--download-sections", f"*{max(0, int(t))}-{int(t) + 2}",
            "-o", str(workdir / f"f_{key}.%(ext)s"), url], cookies)
    done = [p for p in workdir.glob(f"f_{key}.*") if p.suffix not in (".part", ".ytdl")]
    if not done:
        raise RuntimeError("potongan untuk gambar tidak terunduh")
    return done[0]


def heat_at(heatmap, start: float, end: float) -> float:
    """Average 'Most replayed' value (0..1) over a time range."""
    if not heatmap:
        return 0.0
    tot = wsum = 0.0
    for h in heatmap:
        ov = min(end, h["end_time"]) - max(start, h["start_time"])
        if ov > 0:
            tot += ov * float(h.get("value", 0))
            wsum += ov
    return tot / wsum if wsum else 0.0
