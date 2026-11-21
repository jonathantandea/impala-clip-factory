"""Render a candidate to a 1080x1920 MP4 with ffmpeg, plus a contact sheet of all candidates."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from .util import log, mmss, run

W, H = 1080, 1920
MAC_FONT_DIRS = ["/System/Library/Fonts/Supplemental", "/Library/Fonts", "/System/Library/Fonts"]


def video_filter(layout: str, facecam: tuple[int, int, int, int] | None) -> str:
    if layout == "crop":
        return f"[0:v]scale=-2:{H},crop={W}:{H}[v]"
    if layout == "facecam":
        if not facecam:
            raise SystemExit("--layout facecam butuh --facecam x,y,w,h (area facecam di video asli, dalam piksel)")
        x, y, w, h = facecam
        top_h, bot_h = 700, H - 700
        return (f"[0:v]split=2[a][b];"
                f"[a]crop={w}:{h}:{x}:{y},scale={W}:{top_h}:force_original_aspect_ratio=increase,"
                f"crop={W}:{top_h}[top];"
                f"[b]scale=-2:{bot_h},crop={W}:{bot_h}[bot];"
                f"[top][bot]vstack=inputs=2[v]")
    # blur (default): full frame centred over a blurred, zoomed copy of itself.
    return (f"[0:v]split=2[bg][fg];"
            f"[bg]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=24:2[bgb];"
            f"[fg]scale={W}:-2[fgs];"
            f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2[v]")


def encoder_args(encoder: str) -> list[str]:
    if encoder == "auto":
        encoder = "videotoolbox" if sys.platform == "darwin" else "x264"
    if encoder == "videotoolbox":
        return ["-c:v", "h264_videotoolbox", "-b:v", "10M", "-maxrate", "14M", "-bufsize", "20M"]
    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"]


def render_clip(video: Path, clip: dict, out_mp4: Path, *, layout: str = "blur",
                facecam=None, ass: Path | None = None, encoder: str = "auto") -> None:
    vf = video_filter(layout, facecam)
    if ass:
        # Run ffmpeg inside the folder so the subtitles path needs no escaping.
        sub = f"subtitles={ass.name}"
        fonts = next((d for d in MAC_FONT_DIRS if Path(d).is_dir()), None) if sys.platform == "darwin" else None
        if fonts:  # static ffmpeg builds may not find system fonts through fontconfig
            sub += f":fontsdir={fonts}"
        vf = vf[:-3] + f"[pre];[pre]{sub}[v]"
    dur = clip["end"] - clip["start"]

    def cmd(enc):
        return ["ffmpeg", "-y", "-v", "error", "-ss", f"{clip['start']:.3f}", "-t", f"{dur:.3f}",
                "-i", str(video.resolve()), "-filter_complex", vf, "-map", "[v]", "-map", "0:a:0?",
                *encoder_args(enc), "-pix_fmt", "yuv420p", "-r", "30",
                "-c:a", "aac", "-b:a", "160k", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
                "-movflags", "+faststart", out_mp4.name]

    try:
        run(cmd(encoder), cwd=out_mp4.parent)
    except RuntimeError:
        if encoder == "x264":
            raise
        log("  encoder hardware gagal, ulang dengan libx264 ...")
        run(cmd("x264"), cwd=out_mp4.parent)


def contact_sheet(video: Path, clips: list[dict], out_jpg: Path, cols: int = 4) -> None:
    """One frame per candidate (at its middle), labelled with id and time, tiled into a grid."""
    if not clips:
        return
    tmp = out_jpg.parent / "_frames"
    tmp.mkdir(exist_ok=True)
    for i, c in enumerate(clips, 1):
        t = (c["start"] + c["end"]) / 2
        label = f"#{c['id']}  {mmss(c['start'])}-{mmss(c['end'])}  skor {c['score']:g}".replace(":", r"\:")
        base = ["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1"]
        scale = "scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2"
        text = (f",drawtext=text='{label}':x=10:y=h-th-10:fontsize=20:fontcolor=white"
                f":box=1:boxcolor=black@0.6:boxborderw=6")
        dst = str(tmp / f"f_{i:03d}.jpg")
        try:
            run(base + ["-vf", scale + text, dst])
        except RuntimeError:
            run(base + ["-vf", scale, dst])  # ffmpeg without drawtext/fonts: no label
    n = len(clips)
    cols = min(cols, n)
    rows = (n + cols - 1) // cols
    run(["ffmpeg", "-y", "-v", "error", "-framerate", "1", "-i", str(tmp / "f_%03d.jpg"),
         "-vf", f"tile={cols}x{rows}:padding=6:margin=6", "-frames:v", "1", "-q:v", "3", str(out_jpg)])
    shutil.rmtree(tmp, ignore_errors=True)
    log(f"contact sheet: {out_jpg}")
