"""Command line entry point.

  python -m clipfactory scan VIDEO [--captions] [--render-top K] ...
  python -m clipfactory render OUTDIR --ids 1,3 ...
"""
from __future__ import annotations

import argparse
import platform
from pathlib import Path

from . import __version__
from .captions import clip_words, write_all
from .picker import pick
from .render import contact_sheet, render_clip
from .transcribe import transcribe
from .util import Timer, log, mmss, need, probe_duration, read_json, write_json


def _facecam(s: str | None):
    if not s:
        return None
    parts = [int(p) for p in s.replace(" ", "").split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("format --facecam: x,y,w,h")
    return tuple(parts)


def write_markdown(out: Path, video: Path, clips, stats: dict) -> None:
    lines = [f"# Kandidat clip: {video.name}", "",
             f"- Durasi video: {mmss(stats['duration'])}",
             f"- Whisper: model `{stats['whisper_model']}`, {stats['t_transcribe']:.0f} detik",
             f"- Pemilih: {stats['picker']}, {stats['t_pick']:.0f} detik",
             f"- Mesin: {stats['machine']}", f"- Clip Factory v{__version__}", ""]
    if not clips:
        lines.append("_Tidak ada kandidat._")
    for c in clips:
        lines += [f"## #{c['id']} · {c['title'] or '(tanpa judul)'}",
                  f"- Waktu: **{mmss(c['start'])} - {mmss(c['end'])}** ({c['end'] - c['start']:.0f} detik)",
                  f"- Skor: {c['score']:g} ({c['source']})",
                  f"- Hook: {c['hook'] or '-'}",
                  f"- Alasan: {c['reason'] or '-'}"]
        if c.get("render_secs") is not None:
            lines.append(f"- Render: `{c['file']}` dalam {c['render_secs']:.1f} detik")
        lines += ["", f"> {c.get('preview', '')}", ""]
    (out / "candidates.md").write_text("\n".join(lines), encoding="utf-8")


def do_render(out: Path, video: Path, transcript: dict, clips, ids, a) -> None:
    clips_dir = out / "clips"
    clips_dir.mkdir(exist_ok=True)
    for c in clips:
        if ids and c["id"] not in ids:
            continue
        stem = clips_dir / f"clip_{c['id']:02d}"
        ass = None
        if a.captions:
            words = clip_words(transcript["segments"], c["start"], c["end"])
            files = write_all(words, stem, c["end"] - c["start"], hook=c["hook"] if a.hook else "",
                              font=a.font, upper=not a.no_upper)
            ass = files["ass"]
        mp4 = stem.with_suffix(".mp4")
        log(f"render #{c['id']} ({mmss(c['start'])}-{mmss(c['end'])}) ...")
        with Timer() as t:
            render_clip(video, c, mp4, layout=a.layout, facecam=a.facecam, ass=ass, encoder=a.encoder)
        c["render_secs"] = round(t.seconds, 1)
        c["file"] = str(mp4.relative_to(out))
        log(f"  selesai dalam {t.seconds:.1f} detik -> {mp4}")


def cmd_scan(a) -> None:
    need("ffmpeg"), need("ffprobe")
    video = Path(a.video).expanduser()
    if not video.exists():
        raise SystemExit(f"Video tidak ditemukan: {video}")
    out = Path(a.out or f"out/{video.stem}")
    out.mkdir(parents=True, exist_ok=True)
    duration = probe_duration(video)
    log(f"video {video.name}: {mmss(duration)}, output ke {out}/")

    tpath = out / "transcript.json"
    if tpath.exists() and not a.retranscribe:
        log("pakai transcript.json yang sudah ada (pakai --retranscribe untuk ulang)")
        transcript, t_tr = read_json(tpath), 0.0
    else:
        with Timer() as t:
            transcript = transcribe(video, out, a.whisper_model, a.lang or None, a.prompt,
                                    Path(a.kamus) if a.kamus else None)
        t_tr = t.seconds
        write_json(tpath, transcript)
        log(f"transkripsi selesai dalam {t_tr:.0f} detik")

    with Timer() as t:
        clips = pick(transcript["segments"], duration, use_llm=not a.no_llm, host=a.ollama,
                     model=a.llm, min_len=a.min_len, max_len=a.max_len, top=a.top)
    for c in clips:
        c["preview"] = " ".join(s["text"] for s in transcript["segments"]
                                if s["start"] >= c["start"] - 0.1 and s["end"] <= c["end"] + 0.1)[:400]
    picker = "heuristik" if not clips or clips[0]["source"] == "heuristic" else f"Ollama {a.llm}"
    log(f"{len(clips)} kandidat dipilih dalam {t.seconds:.0f} detik")

    contact_sheet(video, clips, out / "candidates.jpg")
    if a.render_top:
        do_render(out, video, transcript, clips, set(c["id"] for c in clips[:a.render_top]), a)

    write_json(out / "candidates.json", {"video": str(video.resolve()), "duration": duration, "clips": clips})
    write_markdown(out, video, clips, {
        "duration": duration, "whisper_model": transcript.get("model", "?"), "t_transcribe": t_tr,
        "picker": picker, "t_pick": t.seconds,
        "machine": f"{platform.system()} {platform.machine()} ({platform.processor() or '-'})"})
    log(f"selesai. Buka {out / 'candidates.md'}")


def cmd_render(a) -> None:
    need("ffmpeg")
    out = Path(a.outdir)
    data = read_json(out / "candidates.json")
    transcript = read_json(out / "transcript.json")
    video = Path(a.video or data["video"])
    ids = {int(x) for x in a.ids.split(",")} if a.ids else set()
    clips = data["clips"]
    do_render(out, video, transcript, clips, ids, a)
    write_json(out / "candidates.json", data)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="clipfactory", description="Pilih dan render clip vertikal dari video panjang.")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="cmd", required=True)

    def render_opts(sp):
        sp.add_argument("--captions", action="store_true", help="bakar caption otomatis ke video")
        sp.add_argument("--hook", action="store_true", help="tampilkan teks hook di 3 detik pertama")
        sp.add_argument("--layout", choices=["blur", "crop", "facecam"], default="blur")
        sp.add_argument("--facecam", type=_facecam, help="x,y,w,h area facecam di video asli (layout facecam)")
        sp.add_argument("--encoder", choices=["auto", "videotoolbox", "x264"], default="auto")
        sp.add_argument("--font", default="Arial")
        sp.add_argument("--no-upper", action="store_true", help="caption tidak huruf besar semua")

    s = sub.add_parser("scan", help="transkripsi, pilih momen, buat candidates.md/.jpg")
    s.add_argument("video")
    s.add_argument("--out", help="folder output (default out/<nama video>)")
    s.add_argument("--lang", default="id", help="bahasa Whisper, kosongkan '' untuk auto")
    s.add_argument("--whisper-model", default="small", help="tiny/base/small/medium/large-v3")
    s.add_argument("--prompt", help="kata-kata/nama yang sering muncul, membantu ejaan Whisper")
    s.add_argument("--kamus", help="file kamus.txt dengan baris 'salah => benar'")
    s.add_argument("--retranscribe", action="store_true")
    s.add_argument("--llm", default="qwen2.5:7b")
    s.add_argument("--ollama", default="http://localhost:11434")
    s.add_argument("--no-llm", action="store_true", help="pakai heuristik saja")
    s.add_argument("--top", type=int, default=8, help="jumlah kandidat")
    s.add_argument("--min-len", type=int, default=20)
    s.add_argument("--max-len", type=int, default=60)
    s.add_argument("--render-top", type=int, default=0, help="langsung render K kandidat teratas")
    render_opts(s)
    s.set_defaults(fn=cmd_scan)

    r = sub.add_parser("render", help="render kandidat dari hasil scan")
    r.add_argument("outdir")
    r.add_argument("--ids", help="contoh: 1,3,4 (default semua)")
    r.add_argument("--video", help="kalau file video sudah dipindah")
    render_opts(r)
    r.set_defaults(fn=cmd_render)

    w = sub.add_parser("web", help="buka tampilan web di http://localhost:8765")
    w.add_argument("--port", type=int, default=8765)
    w.add_argument("--no-browser", action="store_true", help="jangan buka browser otomatis")
    w.set_defaults(fn=lambda a: __import__("clipfactory.web", fromlist=["serve"]).serve(a.port, not a.no_browser))
    return p


def main(argv=None) -> None:
    a = build_parser().parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
