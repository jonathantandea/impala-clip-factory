"""Local web UI: python -m clipfactory web  ->  http://localhost:8765

Standard library only. Binds to 127.0.0.1, so only this computer can open it.
One job (scan or render) runs at a time in a background thread; the page polls
/api/job for progress.
"""
from __future__ import annotations

import json
import mimetypes
import re
import shlex
import subprocess
import sys
import threading
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from .util import LOG_SINKS, log, mmss, probe_duration, probe_size, read_json, run, write_json

OUT = Path("out").resolve()
STATIC = Path(__file__).with_name("web_ui.html")


# ----------------------------------------------------------------------------- jobs
class Job:
    def __init__(self):
        self.lock = threading.Lock()
        self.running = False
        self.kind = ""
        self.project = ""
        self.lines: list[str] = []
        self.error = ""
        self.started = 0.0
        self.finished = 0.0

    def snapshot(self):
        with self.lock:
            return {"running": self.running, "kind": self.kind, "project": self.project,
                    "log": self.lines[-300:], "error": self.error,
                    "elapsed": round((self.finished or time.time()) - self.started) if self.started else 0}

    def add(self, msg: str):
        with self.lock:
            self.lines.append(f"{time.strftime('%H:%M:%S')}  {msg}")

    def start(self, kind: str, project: str, argv: list[str]) -> bool:
        with self.lock:
            if self.running:
                return False
            self.running, self.kind, self.project = True, kind, project
            self.lines, self.error, self.started, self.finished = [], "", time.time(), 0.0
        threading.Thread(target=self._run, args=(argv,), daemon=True).start()
        return True

    def _run(self, argv):
        from .cli import build_parser
        LOG_SINKS.append(self.add)
        try:
            a = build_parser().parse_args(argv)
            a.fn(a)
            self.add("SELESAI")
        except SystemExit as e:
            self.error = str(e) if e.code not in (0, None) else ""
        except Exception as e:  # noqa: BLE001 - show anything to the user
            self.error = f"{e}"
            self.add(traceback.format_exc().splitlines()[-1])
        finally:
            LOG_SINKS.remove(self.add)
            with self.lock:
                self.running = False
                self.finished = time.time()
            if self.error:
                self.add(f"GAGAL: {self.error}")


JOB = Job()


# ----------------------------------------------------------------------------- helpers
def clean_path(p: str) -> str:
    """Accept paths pasted or dragged from Finder/Terminal: quotes, backslash escapes, file://."""
    p = p.strip()
    if p.startswith("file://"):
        p = unquote(urlparse(p).path)
    if len(p) > 1 and p[0] == p[-1] and p[0] in "'\"":
        p = p[1:-1]
    elif "\\ " in p or "\\(" in p:
        try:
            p = shlex.split(p)[0]
        except ValueError:
            pass
    return str(Path(p).expanduser())


def safe_name(name: str) -> str:
    if not re.fullmatch(r"[^/\\]+", name or "") or name in (".", ".."):
        raise ValueError("nama project tidak valid")
    return name


def project_dir(name: str) -> Path:
    d = (OUT / safe_name(name)).resolve()
    if OUT not in d.parents:
        raise ValueError("path di luar folder out/")
    return d


def list_projects():
    if not OUT.exists():
        return []
    items = []
    for d in sorted(OUT.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if not d.is_dir():
            continue
        c = d / "candidates.json"
        info = {"name": d.name, "has_transcript": (d / "transcript.json").exists(), "clips": 0,
                "rendered": len(list((d / "clips").glob("*.mp4"))) if (d / "clips").exists() else 0,
                "updated": time.strftime("%d %b %H:%M", time.localtime(d.stat().st_mtime))}
        if c.exists():
            try:
                info["clips"] = len(read_json(c).get("clips", []))
            except (ValueError, OSError):
                pass
        items.append(info)
    return items


def project_info(name: str):
    d = project_dir(name)
    data = read_json(d / "candidates.json") if (d / "candidates.json").exists() else {"clips": []}
    for c in data.get("clips", []):
        mp4 = d / "clips" / f"clip_{c['id']:02d}.mp4"
        c["rendered"] = mp4.exists()
        c["mp4"] = f"/files/{name}/clips/{mp4.name}" if mp4.exists() else ""
        c["range"] = f"{mmss(c['start'])} - {mmss(c['end'])}"
        c["length"] = round(c["end"] - c["start"])
    md = (d / "candidates.md").read_text(encoding="utf-8") if (d / "candidates.md").exists() else ""
    stats = [ln[2:] for ln in md.splitlines()[:8] if ln.startswith("- ")]
    return {"name": name, "video": data.get("video", ""), "duration": data.get("duration", 0),
            "clips": data.get("clips", []), "stats": stats,
            "has_transcript": (d / "transcript.json").exists()}


def thumb(name: str, cid: int) -> Path:
    d = project_dir(name)
    out = d / "thumbs" / f"{cid}.jpg"
    if out.exists():
        return out
    data = read_json(d / "candidates.json")
    c = next(x for x in data["clips"] if x["id"] == cid)
    out.parent.mkdir(exist_ok=True)
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{(c['start'] + c['end']) / 2:.2f}", "-i", data["video"],
         "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", str(out)])
    return out


def import_candidates(name: str, raw: str):
    """Save a candidates list (e.g. picked by Claude) into a project."""
    d = project_dir(name)
    incoming = json.loads(raw)
    clips = incoming["clips"] if isinstance(incoming, dict) else incoming
    old = read_json(d / "candidates.json") if (d / "candidates.json").exists() else {}
    video = (incoming.get("video") if isinstance(incoming, dict) else None) or old.get("video")
    if not video or not Path(video).exists():
        raise ValueError("path video tidak diketahui: scan video ini dulu di project yang sama")
    norm = []
    for i, c in enumerate(clips, 1):
        norm.append({"id": int(c.get("id", i)), "start": float(c["start"]), "end": float(c["end"]),
                     "title": str(c.get("title", "")), "hook": str(c.get("hook", "")),
                     "reason": str(c.get("reason", "")), "score": float(c.get("score", 5)),
                     "source": str(c.get("source", "claude"))})
    write_json(d / "candidates.json", {"video": video, "duration": old.get("duration", 0), "clips": norm})
    for f in (d / "thumbs").glob("*.jpg") if (d / "thumbs").exists() else []:
        f.unlink()
    return len(norm)


def choose_file_mac() -> str:
    if sys.platform != "darwin":
        raise ValueError("pemilih file hanya ada di Mac; tempel path video-nya")
    script = ('POSIX path of (choose file with prompt "Pilih video untuk Clip Factory" '
              'of type {"public.movie", "public.mpeg-4", "com.apple.quicktime-movie"})')
    proc = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    if proc.returncode != 0:
        return ""  # cancelled
    return proc.stdout.strip()


def resolve_video(q: dict) -> Path:
    """Video from ?project=NAME (its scanned video) or ?video=PATH (not scanned yet)."""
    if q.get("project"):
        d = project_dir(q["project"][0])
        if (d / "candidates.json").exists():
            return Path(read_json(d / "candidates.json")["video"])
    if q.get("video"):
        return Path(clean_path(q["video"][0]))
    raise ValueError("pilih video dulu")


def video_frame(video: Path, t: float) -> bytes:
    proc = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0.0, t):.2f}", "-i", str(video),
                           "-frames:v", "1", "-vf", "scale=960:-2", "-q:v", "4", "-f", "image2", "-c:v", "mjpeg",
                           "pipe:1"], capture_output=True)
    if proc.returncode != 0 or not proc.stdout:
        raise ValueError("tidak bisa ambil gambar dari video")
    return proc.stdout


def ollama_status() -> bool:
    from .picker import ollama_ok
    return ollama_ok("http://localhost:11434")


# ----------------------------------------------------------------------------- argv builders
def scan_argv(o: dict) -> tuple[str, list[str]]:
    video = clean_path(o.get("video", ""))
    if not Path(video).is_file():
        raise ValueError(f"video tidak ditemukan: {video}")
    name = safe_name(Path(video).stem)
    argv = ["scan", video, "--out", str(OUT / name),
            "--whisper-model", o.get("whisper_model", "base"),
            "--top", str(int(o.get("top", 8))),
            "--min-len", str(int(o.get("min_len", 20))), "--max-len", str(int(o.get("max_len", 60))),
            "--render-top", str(int(o.get("render_top", 0)))]
    if o.get("lang", "id"):
        argv += ["--lang", o["lang"]]
    if o.get("prompt"):
        argv += ["--prompt", o["prompt"]]
    if not o.get("use_llm"):
        argv.append("--no-llm")
    if Path("kamus.txt").exists():
        argv += ["--kamus", "kamus.txt"]
    return name, argv + render_flags(o)


def render_flags(o: dict) -> list[str]:
    flags = ["--layout", o.get("layout", "blur")]
    if o.get("captions", True):
        flags.append("--captions")
    if o.get("hook", True):
        flags.append("--hook")
    if o.get("layout") == "facecam":
        fc = str(o.get("facecam", "")).replace(" ", "")
        if not re.fullmatch(r"\d+,\d+,\d+,\d+", fc):
            raise ValueError("layout facecam butuh posisi facecam: x,y,w,h")
        flags += ["--facecam", fc]
    return flags


# ----------------------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "ClipFactory"

    def log_message(self, *args):
        pass

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def _file(self, path: Path, ctype: str | None = None):
        size = path.stat().st_size
        ctype = ctype or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        start, end = 0, size - 1
        rng = self.headers.get("Range")
        if rng and (m := re.match(r"bytes=(\d*)-(\d*)", rng)):
            if m.group(1):
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else size - 1
            else:  # suffix range: last N bytes
                start = max(0, size - int(m.group(2)))
            end = min(end, size - 1)
            if start > end:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with path.open("rb") as f:
            f.seek(start)
            left = end - start + 1
            try:
                while left > 0:
                    chunk = f.read(min(1 << 16, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass  # browser stopped the video download; normal

    def do_GET(self):
        url = urlparse(self.path)
        parts = [unquote(p) for p in url.path.strip("/").split("/") if p]
        try:
            if not parts:
                return self._file(STATIC, "text/html; charset=utf-8")
            q = parse_qs(url.query)
            if parts == ["api", "probe"]:
                v = resolve_video(q)
                if not v.is_file():
                    raise ValueError(f"video tidak ditemukan: {v}")
                w, h = probe_size(v)
                return self._json({"video": str(v), "width": w, "height": h, "duration": probe_duration(v)})
            if parts == ["api", "frame"]:
                body = video_frame(resolve_video(q), float(q.get("t", ["60"])[0]))
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return None
            if parts == ["api", "status"]:
                return self._json({"ollama": ollama_status(), "mac": sys.platform == "darwin",
                                   "out": str(OUT), "kamus": Path("kamus.txt").exists()})
            if parts == ["api", "projects"]:
                return self._json(list_projects())
            if parts[:2] == ["api", "project"] and len(parts) == 3:
                return self._json(project_info(parts[2]))
            if parts == ["api", "job"]:
                return self._json(JOB.snapshot())
            if parts[:2] == ["api", "thumb"] and len(parts) == 4:
                return self._file(thumb(parts[2], int(parts[3].split(".")[0])), "image/jpeg")
            if parts[0] == "files" and len(parts) >= 3:
                d = project_dir(parts[1])
                f = (d / Path(*parts[2:])).resolve()
                if d not in f.parents or not f.is_file():
                    return self._json({"error": "file tidak ada"}, 404)
                return self._file(f)
            return self._json({"error": "tidak ditemukan"}, 404)
        except Exception as e:  # noqa: BLE001
            return self._json({"error": str(e)}, 400)

    def do_POST(self):
        parts = [p for p in urlparse(self.path).path.strip("/").split("/") if p]
        try:
            body = self._body()
            if parts == ["api", "scan"]:
                name, argv = scan_argv(body)
                if not JOB.start("scan", name, argv):
                    return self._json({"error": "masih ada proses yang berjalan"}, 409)
                return self._json({"ok": True, "project": name})
            if parts == ["api", "render"]:
                name = safe_name(body["project"])
                argv = ["render", str(project_dir(name))] + render_flags(body)
                if body.get("ids"):
                    argv += ["--ids", ",".join(str(int(i)) for i in body["ids"])]
                if not JOB.start("render", name, argv):
                    return self._json({"error": "masih ada proses yang berjalan"}, 409)
                return self._json({"ok": True})
            if parts == ["api", "import"]:
                n = import_candidates(body["project"], body["json"])
                return self._json({"ok": True, "count": n})
            if parts == ["api", "choose-file"]:
                return self._json({"path": choose_file_mac()})
            if parts == ["api", "open"]:
                target = project_dir(body["project"]) if body.get("project") else OUT
                target.mkdir(parents=True, exist_ok=True)
                subprocess.Popen(["open" if sys.platform == "darwin" else "xdg-open", str(target)])
                return self._json({"ok": True})
            return self._json({"error": "tidak ditemukan"}, 404)
        except Exception as e:  # noqa: BLE001
            return self._json({"error": str(e)}, 400)


def serve(port: int = 8765, open_browser: bool = True) -> None:
    OUT.mkdir(exist_ok=True)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://localhost:{port}"
    log(f"Clip Factory web jalan di {url}  (Ctrl+C untuk berhenti)")
    if open_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log("berhenti")
