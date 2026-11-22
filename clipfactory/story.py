"""AI Generation Factory (server side): scene script -> narration -> rendered video.

Projects live in motion/projects/<name>/ : scene.json, vo.mp3, vo.wav, words.json.
The browser renders frames (story/index.html) and streams them here; ffmpeg encodes them, then
the narration and a bundled music bed are mixed in and the result lands in motion/videos/.
"""
from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

from .util import log

MOTION = Path("motion").resolve()
PROJECTS = MOTION / "projects"
VIDEOS = MOTION / "videos"
STORY_DIR = Path(__file__).with_name("story")
KEY_FILE = Path.home() / ".impala" / "elevenlabs.key"
VOICES = {"brian": "nPczCjzI2devNBz1zQrb", "sarah": "EXAVITQu4vr4xnSDxMaL", "jessica": "cgSgspJ2msm6clMCkdW9",
          "liam": "TX3LPaxmHKxFdv7VOQHJ", "george": "JBFqnCBsd6RMkjVDRZzb"}
LEAD, LATE, TAIL = 0.35, 0.09, 2.4


# ----------------------------------------------------------------------------- key
def key_status() -> dict:
    return {"set": bool(os.environ.get("ELEVENLABS_API_KEY") or (KEY_FILE.exists() and KEY_FILE.read_text().strip()))}


def save_key(key: str) -> None:
    key = key.strip()
    if not re.fullmatch(r"[A-Za-z0-9_\-]{20,200}", key):
        raise ValueError("format API key ElevenLabs tidak dikenal")
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    KEY_FILE.write_text(key)
    os.chmod(KEY_FILE, 0o600)


def _key() -> str:
    k = os.environ.get("ELEVENLABS_API_KEY") or (KEY_FILE.read_text().strip() if KEY_FILE.exists() else "")
    if not k:
        raise ValueError("API key ElevenLabs belum diisi (kotak ElevenLabs di Motion Factory)")
    return k


# ----------------------------------------------------------------------------- projects
def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "cerita"


def validate(spec: dict) -> dict:
    if not isinstance(spec, dict):
        raise ValueError("naskah adegan harus berupa objek JSON")
    lines = spec.get("script")
    if not lines or not isinstance(lines, list) or not all(isinstance(x, str) and x.strip() for x in lines):
        raise ValueError('"script" harus daftar kalimat narasi (satu kalimat per adegan)')
    if not isinstance(spec.get("scenes"), list) or not spec["scenes"]:
        raise ValueError('"scenes" kosong')
    if len(lines) > 60:
        raise ValueError("script terlalu panjang (maks 60 kalimat)")
    chars = spec.get("characters") or {}
    for i, s in enumerate(spec["scenes"]):
        for c in s.get("cast", []):
            if c.get("who") not in chars:
                raise ValueError(f'adegan {i + 1}: karakter "{c.get("who")}" tidak ada di "characters"')
    return spec


def create(spec_text) -> str:
    spec = validate(json.loads(spec_text) if isinstance(spec_text, str) else spec_text)
    name = f"{time.strftime('%Y%m%d-%H%M')}-{slug(spec.get('title', 'cerita'))}"
    d = PROJECTS / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "scene.json").write_text(json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")
    return name


def project_dir(name: str) -> Path:
    d = (PROJECTS / name).resolve()
    if PROJECTS.resolve() not in d.parents or not d.is_dir():
        raise ValueError("project tidak ditemukan")
    return d


def list_projects() -> list[dict]:
    if not PROJECTS.exists():
        return []
    out = []
    for d in sorted(PROJECTS.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if not (d / "scene.json").exists():
            continue
        spec = json.loads((d / "scene.json").read_text(encoding="utf-8"))
        words = d / "words.json"
        out.append({"name": d.name, "title": spec.get("title", d.name), "lines": len(spec.get("script", [])),
                    "voice": words.exists(), "duration": json.loads(words.read_text())["duration"] if words.exists() else 0,
                    "video": f"/motion/videos/{d.name}.mp4" if (VIDEOS / f"{d.name}.mp4").exists() else ""})
    return out


# ----------------------------------------------------------------------------- voice
def make_voice(name: str) -> dict:
    d = project_dir(name)
    spec = json.loads((d / "scene.json").read_text(encoding="utf-8"))
    lines = [x.strip() if x.strip()[-1:] in ".!?" else x.strip() + "." for x in spec["script"]]
    text = " ".join(lines)
    voice = spec.get("voice", "brian")
    vid = VOICES.get(str(voice).lower(), voice)
    body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2", "language_code": spec.get("language", "id"),
                       "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.3}}).encode()
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}/with-timestamps?output_format=mp3_44100_128",
                                 data=body, headers={"Content-Type": "application/json", "xi-api-key": _key()})
    log(f"ElevenLabs: {len(text)} karakter, suara {voice} ...")
    try:
        d_ = json.loads(urllib.request.urlopen(req, timeout=180).read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")[:300]
        if e.code == 401:
            raise ValueError("API key ElevenLabs ditolak (cek lagi key-nya)") from e
        if "quota" in msg.lower() or e.code == 402:
            raise ValueError("kuota ElevenLabs habis bulan ini (free tier 10.000 karakter/bulan)") from e
        raise ValueError(f"ElevenLabs error {e.code}: {msg}") from e
    (d / "vo.mp3").write_bytes(base64.b64decode(d_["audio_base64"]))
    a = d_["alignment"]
    chars, cs, ce = a["characters"], a["character_start_times_seconds"], a["character_end_times_seconds"]
    script = "".join(chars)
    # which script line each character belongs to
    bounds, pos = [], 0
    for ln in lines:
        i = script.find(ln, pos)
        if i < 0:
            i = pos
        bounds.append((i, i + len(ln)))
        pos = i + len(ln)
    line_of = lambda ci: next((k for k, (s, e) in enumerate(bounds) if s <= ci < e + 1), len(bounds) - 1)
    words = []
    for m in re.finditer(r"\S+", script):
        j, k = m.start(), m.end() - 1
        kk = k
        while kk > j and not script[kk].isalnum():
            kk -= 1
        words.append({"w": m.group(), "s": round(cs[j] - LATE + LEAD, 3), "e": round(ce[kk] - LATE + LEAD, 3), "phrase": line_of(j)})
    phrases = []
    for k in range(len(lines)):
        ws = [w for w in words if w["phrase"] == k]
        phrases.append({"s": ws[0]["s"] if ws else (phrases[-1]["s"] + 1 if phrases else LEAD), "text": lines[k]})
    duration = round(words[-1]["e"] + TAIL, 2)
    (d / "words.json").write_text(json.dumps({"words": words, "phrases": phrases, "duration": duration}, ensure_ascii=False, indent=1), encoding="utf-8")
    # vo.wav with lead-in, padded to the film length
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(d / "vo.mp3"), "-af", f"adelay={int(LEAD * 1000)},apad",
                    "-t", f"{duration:.2f}", "-ar", "48000", "-ac", "1", str(d / "vo.wav")], check=True)
    log(f"narasi siap: {duration:.1f} detik, {len(words)} kata")
    return {"duration": duration, "words": len(words), "chars": len(text)}


# ----------------------------------------------------------------------------- render
SESSIONS: dict[str, dict] = {}


def render_start(name: str, fps: int, frames: int) -> None:
    d = project_dir(name)
    if not (d / "words.json").exists():
        raise ValueError("buat narasi dulu (tombol Buat suara)")
    render_cancel(name)
    tmp = d / "_video.mp4"
    proc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
                             "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", str(tmp)],
                            stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    SESSIONS[name] = {"proc": proc, "tmp": tmp, "next": 0, "frames": frames, "t0": time.time()}
    log(f"render dimulai: {frames} frame")


def render_frame(name: str, i: int, data: bytes) -> None:
    s = SESSIONS.get(name)
    if not s:
        raise ValueError("render belum dimulai")
    if i != s["next"]:
        raise ValueError(f"frame {i} datang tidak berurutan (menunggu {s['next']})")
    s["proc"].stdin.write(data)
    s["next"] += 1


def render_finish(name: str) -> str:
    d = project_dir(name)
    s = SESSIONS.pop(name, None)
    if not s:
        raise ValueError("render belum dimulai")
    s["proc"].stdin.close()
    if s["proc"].wait() != 0:
        raise RuntimeError("ffmpeg gagal: " + s["proc"].stderr.read().decode(errors="replace")[-300:])
    spec = json.loads((d / "scene.json").read_text(encoding="utf-8"))
    dur = json.loads((d / "words.json").read_text())["duration"]
    music = STORY_DIR / "music" / f"{spec.get('music', 'lofi')}.m4a"
    VIDEOS.mkdir(parents=True, exist_ok=True)
    out = VIDEOS / f"{name}.mp4"
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(s["tmp"]), "-i", str(d / "vo.wav")]
    if music.exists():
        cmd += ["-i", str(music)]
        fx = (f"[2:a]atrim=0:{dur:.2f},afade=t=out:st={max(0, dur - 1.8):.2f}:d=1.8,volume=0.32,aformat=channel_layouts=stereo[m];"
              f"[1:a]aformat=channel_layouts=stereo,asplit=2[v1][v2];"
              f"[m][v1]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=350[md];"
              f"[md][v2]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]")
    else:
        fx = "[1:a]aformat=channel_layouts=stereo,loudnorm=I=-14:TP=-1.5:LRA=11[a]"
    cmd += ["-filter_complex", fx, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
            "-shortest", "-movflags", "+faststart", str(out)]
    subprocess.run(cmd, check=True, capture_output=True)
    s["tmp"].unlink(missing_ok=True)
    log(f"video selesai: {out.name} ({time.time() - s['t0']:.0f} detik)")
    return out.name


def render_cancel(name: str) -> None:
    s = SESSIONS.pop(name, None)
    if s:
        try:
            s["proc"].stdin.close()
        except OSError:
            pass
        s["proc"].kill()
        s["tmp"].unlink(missing_ok=True)
