"""Small shared helpers: ffmpeg calls, time formatting, logging."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path


LOG_SINKS: list = []  # extra listeners (the web UI collects log lines here)


def log(msg: str) -> None:
    print(f"[clipfactory] {msg}", file=sys.stderr, flush=True)
    for sink in LOG_SINKS:
        sink(msg)


def need(binary: str) -> None:
    if shutil.which(binary) is None:
        sys.exit(f"'{binary}' tidak ditemukan. Pasang dulu (Mac: brew install {binary}).")


def run(cmd: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-15:])
        raise RuntimeError(f"Perintah gagal: {' '.join(cmd[:6])} ...\n{tail}")
    return proc


def probe_duration(video: Path) -> float:
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", str(video)]).stdout.strip()
    return float(out)


def probe_size(video: Path) -> tuple[int, int]:
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0",
               "-show_entries", "stream=width,height", "-of", "json", str(video)]).stdout
    s = json.loads(out)["streams"][0]
    return int(s["width"]), int(s["height"])


def mmss(sec: float) -> str:
    sec = max(0, int(round(sec)))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


class Timer:
    def __enter__(self):
        self.t0 = time.perf_counter()
        return self

    def __exit__(self, *exc):
        self.seconds = time.perf_counter() - self.t0
