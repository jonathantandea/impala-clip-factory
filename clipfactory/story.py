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
          "liam": "TX3LPaxmHKxFdv7VOQHJ", "george": "JBFqnCBsd6RMkjVDRZzb", "charlie": "IKne3meq5aSn9XLyUdCD",
          "will": "bIHbv24MWmeRgasZH58o", "eric": "cjVigY5qzO86Huf0OWal", "daniel": "onwK4e9ZLuTAKqWW03F9",
          "callum": "N2lVS1w4EtoT3dr4eOWO", "chris": "iP95p4xoKVk53GoZ742B"}
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
    norm = lambda x: x.get("text", "") if isinstance(x, dict) else x
    if not lines or not isinstance(lines, list) or not all(isinstance(norm(x), str) and norm(x).strip() for x in lines):
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
                    "video": f"/motion/videos/{d.name}.mp4" if (VIDEOS / f"{d.name}.mp4").exists() else "",
                    "video_169": f"/motion/videos/{d.name}_16x9.mp4" if (VIDEOS / f"{d.name}_16x9.mp4").exists() else ""})
    return out


# ----------------------------------------------------------------------------- voice
def _tts(text: str, vid: str, language: str) -> dict:
    body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2", "language_code": language,
                       "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.35}}).encode()
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}/with-timestamps?output_format=mp3_44100_128",
                                 data=body, headers={"Content-Type": "application/json", "xi-api-key": _key()})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=180).read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")[:300]
        if e.code == 401:
            raise ValueError("API key ElevenLabs ditolak (cek lagi key-nya)") from e
        if "quota" in msg.lower() or e.code == 402:
            raise ValueError("kuota ElevenLabs habis bulan ini (free tier 10.000 karakter/bulan)") from e
        raise ValueError(f"ElevenLabs error {e.code}: {msg}") from e


def _decode(mp3: Path):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp3), "-f", "s16le", "-ac", "1", "-ar", "48000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def make_voice(name: str) -> dict:
    """One TTS take per script line (each line may have its own speaker), joined with short gaps.
    Script lines are strings (narrator) or {"text", "speaker", "pause"}; spec.voices maps speaker -> voice."""
    import hashlib
    import numpy as np
    d = project_dir(name)
    spec = json.loads((d / "scene.json").read_text(encoding="utf-8"))
    voices = {"narator": spec.get("voice", "brian"), **(spec.get("voices") or {})}
    lang = spec.get("language", "id")
    cache = d / "tts"; cache.mkdir(exist_ok=True)
    words, phrases, chunks, cursor, used, total = [], [], [], LEAD, 0, 0
    for k, item in enumerate(spec["script"]):
        line = item if isinstance(item, dict) else {"text": item}
        text = line["text"].strip()
        if text[-1:] not in ".!?…":
            text += "."
        speaker = line.get("speaker", "narator")
        voice = voices.get(speaker, voices["narator"])
        vid = VOICES.get(str(voice).lower(), voice)
        key = hashlib.sha1(f"{vid}|{lang}|{text}".encode()).hexdigest()[:16]
        mp3, al = cache / f"{key}.mp3", cache / f"{key}.json"
        total += len(text)
        if not (mp3.exists() and al.exists()):
            log(f"ElevenLabs [{speaker}]: {text[:50]}")
            r = _tts(text, vid, lang)
            mp3.write_bytes(base64.b64decode(r["audio_base64"]))
            al.write_text(json.dumps(r["alignment"]))
            used += len(text)
        a = json.loads(al.read_text())
        audio = _decode(mp3)
        cursor += float(line.get("pause", 0))
        chars, cs, ce = a["characters"], a["character_start_times_seconds"], a["character_end_times_seconds"]
        script = "".join(chars)
        first = None
        for m in re.finditer(r"\S+", script):
            j, kk = m.start(), m.end() - 1
            while kk > j and not script[kk].isalnum():
                kk -= 1
            w = {"w": m.group(), "s": round(cursor + max(0.0, cs[j] - LATE), 3), "e": round(cursor + max(0.0, ce[kk] - LATE), 3),
                 "phrase": k, "speaker": speaker}
            words.append(w)
            first = first if first is not None else w["s"]
        phrases.append({"s": first if first is not None else cursor, "text": text, "speaker": speaker})
        chunks.append((cursor, audio))
        cursor += len(audio) / 48000 + float(line.get("gap", 0.22))
    duration = round(cursor + TAIL, 2)
    out = np.zeros(int(duration * 48000) + 48000, dtype=np.float32)
    for start, audio in chunks:
        i = int(start * 48000)
        out[i:i + len(audio)] += audio
    out = out[: int(duration * 48000)]
    peak = float(np.max(np.abs(out))) or 1.0
    with wave.open(str(d / "vo.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000)
        w.writeframes((out / peak * 0.89 * 32767).astype(np.int16).tobytes())
    (d / "words.json").write_text(json.dumps({"words": words, "phrases": phrases, "duration": duration}, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"narasi siap: {duration:.1f} detik, {len(words)} kata, {used} karakter baru dipakai")
    return {"duration": duration, "words": len(words), "chars": used, "total_chars": total}


# ----------------------------------------------------------------------------- render
SESSIONS: dict[str, dict] = {}


def render_start(name: str, fps: int, frames: int, fmt: str = "9x16") -> None:
    d = project_dir(name)
    if not (d / "words.json").exists():
        raise ValueError("buat narasi dulu (tombol Buat suara)")
    render_cancel(name)
    tmp = d / "_video.mp4"
    proc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
                             "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", str(tmp)],
                            stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    SESSIONS[name] = {"proc": proc, "tmp": tmp, "next": 0, "frames": frames, "t0": time.time(), "fmt": fmt}
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
    out = VIDEOS / (f"{name}.mp4" if s.get("fmt", "9x16") == "9x16" else f"{name}_{s['fmt']}.mp4")
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
