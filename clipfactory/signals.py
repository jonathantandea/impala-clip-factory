"""Find viral moments from audience and audio signals instead of guessing from speech density.

Signals (each optional; whatever is available is combined):
  chat    live-chat replay (YouTube live_chat / Twitch rechat): message bursts + reaction tokens
  heat    YouTube "Most replayed" heatmap
  audio   loudness spikes (laughs, screams) from the audio track
  words   reaction words in the transcript (wkwk, anjir, gila, ...)

A moment is the peak of the combined curve. Each clip is built around it with a setup before
(so the viewer has context) and a payoff after, snapped to sentence boundaries.
"""
from __future__ import annotations

import json
import re
import subprocess
from bisect import bisect_left, bisect_right
from pathlib import Path

from .util import log, mmss

LAUGH = r"w+k+w+k*|wk(wk)+|k+w+k+w*|(ha){2,}h?|(he){2,}|xi(xi)+|ngakak|kocak|lmao|lol|rofl"
SHOCK = (r"anjir|anjay|anjrit|njir|bjir|jir|anjing|astag\w*|buset|busett|gila|gokil|waduh|wadaw|parah|mampus|"
         r"sumpah|serius|beneran|ngeri|bangsat|cok|cuk|jancok|omg|wtf|no ?way|what+|hah+|loh+|lho+|wow+|wah+")
HYPE_RE = re.compile(rf"\b({LAUGH}|{SHOCK})\b", re.I)
CLIP_RE = re.compile(r"\b(clip|klip|kliping|clipped|momen|moment)\b", re.I)
EMOJI_HYPE = set("😂🤣💀😭🔥😱🤯👀😳🫢😆")


# ----------------------------------------------------------------------------- chat
def parse_chat(path: Path) -> list[tuple[float, str, int]]:
    """-> [(second, text, emoji_hype_count)] from a yt-dlp chat file (YouTube JSONL or Twitch JSON)."""
    out = []
    raw = path.read_text(encoding="utf-8", errors="replace")
    if raw.lstrip().startswith("{") and '"comments"' in raw[:2000]:   # Twitch rechat
        try:
            for c in json.loads(raw).get("comments", []):
                body = (c.get("message") or {}).get("body", "")
                out.append((float(c.get("content_offset_seconds", 0)), body, sum(ch in EMOJI_HYPE for ch in body)))
            return out
        except ValueError:
            pass
    for line in raw.splitlines():                                      # YouTube live_chat JSONL
        try:
            d = json.loads(line)
        except ValueError:
            continue
        rep = d.get("replayChatItemAction") or {}
        try:
            sec = int(rep.get("videoOffsetTimeMsec", 0)) / 1000
        except (TypeError, ValueError):
            continue
        for act in rep.get("actions", []):
            item = (act.get("addChatItemAction") or {}).get("item", {})
            r = item.get("liveChatTextMessageRenderer") or item.get("liveChatPaidMessageRenderer")
            if not r:
                continue
            text, emo = "", 0
            for run in (r.get("message") or {}).get("runs", []):
                if "text" in run:
                    text += run["text"]
                    emo += sum(ch in EMOJI_HYPE for ch in run["text"])
                elif "emoji" in run:
                    emo += 1
                    sc = (run["emoji"].get("shortcuts") or [""])[0]
                    text += f" {sc} "
            out.append((sec, text, emo))
    return out


def chat_curves(msgs, duration: float):
    """Per-second message count and per-second reaction score."""
    n = int(duration) + 2
    count, hype = [0.0] * n, [0.0] * n
    for sec, text, emo in msgs:
        i = int(sec)
        if 0 <= i < n:
            count[i] += 1
            h = len(HYPE_RE.findall(text)) + min(emo, 3) * 0.7 + (2.0 if CLIP_RE.search(text) else 0)
            if re.search(r"[!?]{3,}", text):
                h += 0.5
            if len(text) > 4 and text.isupper():
                h += 0.4
            hype[i] += min(h, 4)
    return count, hype


# ----------------------------------------------------------------------------- audio
def audio_curve(media: Path, duration: float) -> list[float]:
    """Per-second RMS level (dB) using ffmpeg astats; [] if it fails."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(media), "-vn", "-ac", "1",
           "-af", "aresample=8000,asetnsamples=8000,astats=metadata=1:reset=1,"
                  "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-", "-f", "null", "-"]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=3600).stdout
    except (subprocess.TimeoutExpired, OSError):
        return []
    vals = []
    for line in out.splitlines():
        if "RMS_level=" in line:
            v = line.split("=", 1)[1].strip()
            vals.append(-90.0 if v in ("-inf", "inf", "nan") else max(-90.0, float(v)))
    return vals[: int(duration) + 2]


# ----------------------------------------------------------------------------- helpers
def _window_sum(arr, w):
    pre = [0.0]
    for v in arr:
        pre.append(pre[-1] + v)
    return [pre[min(len(arr), i + w)] - pre[i] for i in range(len(arr))]


def _robust_z(arr, floor=1.0):
    """(v - median) / MAD, with a floor on the spread so a near-constant signal gives no peaks."""
    if not arr:
        return []
    s = sorted(arr)
    med = s[len(s) // 2]
    mad = max(sorted(abs(v - med) for v in arr)[len(arr) // 2], floor)
    return [(v - med) / (1.4826 * mad) for v in arr]


def _heat_curve(heatmap, n):
    cur = [0.0] * n
    for h in heatmap or []:
        for i in range(max(0, int(h["start_time"])), min(n, int(h["end_time"]) + 1)):
            cur[i] = max(cur[i], float(h.get("value", 0)))
    return cur


def _words_curve(segments, n):
    cur = [0.0] * n
    for s in segments:
        words = s.get("words") or [{"w": w, "s": s["start"]} for w in s["text"].split()]
        for w in words:
            if HYPE_RE.search(w["w"]):
                i = int(w["s"])
                if 0 <= i < n:
                    cur[i] += 1
    return cur


def _snap_start(segments, starts, t):
    i = bisect_right(starts, t) - 1
    return segments[i]["start"] if i >= 0 else max(0.0, t)


def _snap_end(segments, ends, t):
    i = bisect_left(ends, t)
    return segments[i]["end"] if i < len(segments) else t


# ----------------------------------------------------------------------------- main
def find_moments(segments, duration: float, *, chat=None, heatmap=None, audio=None, top=8,
                 min_len=20, max_len=60, setup=16.0, payoff=7.0, chat_lag=7.0) -> list[dict]:
    n = int(duration) + 2
    parts, used = [], []
    if chat:
        count, hype = chat_curves(chat, duration)
        burst = _robust_z(_window_sum(count, 10), floor=2.0)
        react = _window_sum(hype, 12)
        rmax = max(react) or 1
        # chat reacts AFTER the moment: read it chat_lag seconds ahead
        sh = int(chat_lag)
        parts.append([max(0.0, burst[min(n - 1, i + sh)]) * 0.6 + (react[min(n - 1, i + sh)] / rmax) * 3.0 for i in range(n)])
        used.append("chat")
    if heatmap:
        hc = _heat_curve(heatmap, n)
        parts.append([v * 2.5 for v in hc])
        used.append("most replayed")
    if audio:
        a = (audio + [audio[-1]] * n)[:n] if audio else []
        z = _robust_z(_window_sum(a, 3), floor=6.0)  # 3-s sums of dB: ignore < ~2 dB wobble
        parts.append([min(3.0, max(0.0, v)) * 0.7 for v in z])
        used.append("suara")
    wc = _window_sum(_words_curve(segments, n), 8)
    wmax = max(wc) or 1
    parts.append([v / wmax * 1.2 for v in wc])
    used.append("kata reaksi")

    score = [sum(p[i] for p in parts) for i in range(n)]
    smooth = [sum(score[max(0, i - 2): i + 3]) / 5 for i in range(n)]
    log(f"sinyal dipakai: {', '.join(used)}")

    # greedy peaks at least ~75 s apart
    order = sorted(range(n), key=lambda i: smooth[i], reverse=True)
    peaks = []
    for i in order:
        if smooth[i] <= 0:
            break
        if all(abs(i - p) > 75 for p in peaks):
            peaks.append(i)
        if len(peaks) >= top * 3:
            break

    starts = [s["start"] for s in segments]
    ends = [s["end"] for s in segments]
    best = max(smooth) or 1
    out = []
    for p in peaks:
        s = _snap_start(segments, starts, max(0.0, p - setup))
        e = _snap_end(segments, ends, min(duration, p + payoff))
        if e - s < min_len:
            e = _snap_end(segments, ends, min(duration, s + min_len))
        if e - s > max_len:
            s = _snap_start(segments, starts, max(0.0, e - max_len))
            if e - s > max_len:
                s = e - max_len
        why = []
        if chat:
            c = parts[used.index("chat")][p]
            if c > 1.5:
                why.append(f"chat meledak ({c:.1f})")
        if heatmap:
            hv = _heat_curve(heatmap, n)[p]
            if hv >= 0.4:
                why.append(f"sering diputar ulang ({hv:.0%})")
        if audio and parts[used.index("suara")][p] > 0.8:
            why.append("suara memuncak")
        kws = sorted({m.group(0).lower() for sg in segments if s <= sg["start"] <= e for m in HYPE_RE.finditer(sg["text"])})
        if kws:
            why.append("kata: " + ", ".join(kws[:4]))
        text_at = " ".join(sg["text"] for sg in segments if sg["start"] <= p <= sg["end"] + 2)[:70]
        out.append({"start": round(s, 2), "end": round(e, 2), "peak": p,
                    "title": text_at or f"Momen {mmss(p)}", "hook": "",
                    "reason": "; ".join(why) or "puncak sinyal",
                    "score": round(min(10.0, 10 * smooth[p] / best), 1), "source": "signals"})
    return out


def _chat_progress(path: Path, duration: float) -> str:
    """How far into the stream the partial chat file reaches (reads only the file's tail)."""
    try:
        size = path.stat().st_size
        with path.open("rb") as f:
            f.seek(max(0, size - 65536))
            tail = f.read().decode("utf-8", "replace")
        ms = [int(m) for m in re.findall(r'"videoOffsetTimeMsec"\s*:\s*"?(\d+)', tail)]
        reach = max(ms) / 1000 if ms else 0
        pct = f"{min(100, reach / duration * 100):.0f}%" if duration and reach else "?"
        return f"{size / 1e6:.1f} MB, sampai {mmss(reach)} ({pct})"
    except OSError:
        return "..."


def fetch_chat(url: str, info: dict, workdir: Path, cookies: str | None, timeout_min: float = 12) -> list:
    """Download the live-chat replay with yt-dlp, showing progress; after timeout_min minutes,
    stop and use whatever part has arrived (chat for the first hours is still useful)."""
    import subprocess as sp
    import sys
    import time
    langs = info.get("subs", [])
    lang = "live_chat" if "live_chat" in langs else "rechat" if "rechat" in langs else None
    if not lang:
        log("chat replay tidak tersedia untuk video ini")
        return []
    duration = float(info.get("duration") or 0)
    done = lambda: [p for p in sorted(workdir.glob("chat*.json")) + sorted(workdir.glob("chat*.json3"))]
    cached = done()
    if not cached:
        log(f"download chat replay (stream panjang bisa 5-15 menit; berhenti otomatis setelah {timeout_min:.0f} menit) ...")
        cmd = [sys.executable, "-m", "yt_dlp", "--no-warnings", "--no-playlist", "--skip-download",
               "--write-subs", "--sub-langs", lang, "-o", str(workdir / "chat"), url]
        if cookies:
            cmd[3:3] = ["--cookies-from-browser", cookies]
        proc = sp.Popen(cmd, stdout=sp.DEVNULL, stderr=sp.PIPE, text=True)
        t0, last = time.time(), 0.0
        while proc.poll() is None:
            time.sleep(2)
            parts = sorted(workdir.glob("chat*.part"))
            if parts and time.time() - last >= 10:
                last = time.time()
                log(f"  chat: {_chat_progress(parts[0], duration)}")
            if time.time() - t0 > timeout_min * 60:
                proc.terminate()
                try:
                    proc.wait(10)
                except sp.TimeoutExpired:
                    proc.kill()
                log("  batas waktu chat tercapai: pakai bagian chat yang sudah terunduh")
                break
        if proc.returncode not in (0, None) and not sorted(workdir.glob("chat*.part")) and not done():
            err = (proc.stderr.read() if proc.stderr else "").strip().splitlines()[-1:] or ["?"]
            log(f"chat replay gagal diunduh: {err[0][:160]}")
            return []
        cached = done() or sorted(workdir.glob("chat*.part"))
    if not cached:
        return []
    msgs = parse_chat(cached[0])
    reach = max((m[0] for m in msgs), default=0)
    log(f"chat replay: {len(msgs)} pesan (sampai {mmss(reach)})")
    return msgs
