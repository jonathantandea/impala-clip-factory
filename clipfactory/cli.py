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
from .judge import export_for_claude, judge
from .picker import pick
from .signals import audio_curve, fetch_chat, find_moments
from .facedetect import consensus, describe, log_plan, near, plan_layout
from .render import contact_sheet, render_clip
from .remote import download_audio, download_section, fetch_info, fetch_transcript, is_url, project_name
from .transcribe import transcribe, whisper_available
from .util import Timer, log, mmss, need, probe_duration, read_json, write_json


def _facecam(s: str | None):
    if not s:
        return None
    parts = [int(p) for p in s.replace(" ", "").split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("format --facecam: x,y,w,h")
    return tuple(parts)


def write_markdown(out: Path, label: str, clips, stats: dict) -> None:
    lines = [f"# Kandidat clip: {label}", "",
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


def _clip_words_for(c, transcript, src_info, a, out):
    """Caption words for one clip, relative to the clip start."""
    if src_info is None:
        return clip_words(transcript["segments"], c["start"], c["end"])
    src, offset = src_info
    if getattr(a, "clip_whisper", True) and whisper_available():
        cache = src.with_suffix(".json")
        if cache.exists():
            t = read_json(cache)
        else:
            log("  whisper untuk potongan ini (caption akurat) ...")
            t = transcribe(src, src.parent, a.whisper_model, a.lang or None, a.prompt,
                           Path(a.kamus) if a.kamus else None)
            write_json(cache, t)
        return clip_words(t["segments"], c["start"] - offset, c["end"] - offset)
    return clip_words(transcript["segments"], c["start"], c["end"])


def _prepare(out: Path, video, c, url, a):
    """Local source for one clip (downloads the section in link mode)."""
    if not url:
        return Path(video), c, None
    src = out / "src" / f"clip_{c['id']:02d}_{int(c['start'])}-{int(c['end'])}.mp4"   # range in the name: re-scans never reuse a stale piece
    src.parent.mkdir(exist_ok=True)
    if not src.exists():
        log(f"download potongan #{c['id']} ({mmss(c['start'])}-{mmss(c['end'])}) saja (1-3 menit di Mac lama) ...")
    with Timer() as t:
        offset = download_section(url, c["start"], c["end"], src, getattr(a, "cookies", None))
    if t.seconds > 1:
        log(f"  terunduh dalam {t.seconds:.0f} detik")
    return src, dict(c, start=c["start"] - offset, end=c["end"] - offset), (src, offset)


def _plans(out: Path, jobs) -> dict:
    """Auto layout for every clip, then a project-wide facecam consensus: a stream's facecam rarely
    moves, so clips where detection missed (or caught a face in the game) reuse the agreed position."""
    plans = {}
    for c, src, local, _ in jobs:
        plans[c["id"]] = plan_layout(src, local["start"], local["end"])
    saved = read_json(out / "face.json") if (out / "face.json").exists() else None
    cams = [p for p in plans.values() if p["layout"] == "facecam"]
    cons = consensus(cams + ([saved] if saved else []))
    if cons:
        write_json(out / "face.json", cons)
        for cid, p in plans.items():
            if p["layout"] == "crop":          # full-screen camera: its own framing is right
                continue
            if p["layout"] == "blur" or (p["layout"] == "facecam" and not near(p, cons)):
                plans[cid] = dict(cons, why=f"posisi facecam tersimpan ({cons['votes']} clip setuju)")
    for cid, p in plans.items():
        log_plan(cid, p)
    return plans


def do_render(out: Path, video, transcript: dict, clips, ids, a) -> None:
    url = video if isinstance(video, str) and is_url(video) else None
    clips_dir = out / "clips"
    clips_dir.mkdir(exist_ok=True)
    jobs = []
    for c in clips:
        if ids and c["id"] not in ids:
            continue
        src, local, src_info = _prepare(out, video, c, url, a)
        jobs.append((c, src, local, src_info))
    plans = _plans(out, jobs) if a.layout == "auto" else {}
    for c, src, local, src_info in jobs:
        stem = clips_dir / f"clip_{c['id']:02d}"
        ass = None
        if a.captions or a.srt or a.hook:
            words = _clip_words_for(c, transcript, src_info, a, out) if (a.captions or a.srt) else []
            files = write_all(words, stem, c["end"] - c["start"], hook=c["hook"] if a.hook else "",
                              font=a.font, upper=not a.no_upper)
            if a.captions or a.hook:
                ass = files["ass"]
            else:  # .srt only: nothing is burned in
                files["ass"].unlink(missing_ok=True)
            if not (a.captions or a.srt):  # hook only: no caption files to keep
                files["srt"].unlink(missing_ok=True)
                files["txt"].unlink(missing_ok=True)
            if a.hook and not a.captions:  # hook burned, captions not
                files["ass"].write_text("\n".join(ln for ln in files["ass"].read_text(encoding="utf-8").splitlines()
                                                  if not ln.startswith("Dialogue: 0,")) + "\n", encoding="utf-8")
        layout, facecam, center_x = a.layout, a.facecam, 0.5
        if a.layout == "auto":
            plan = plans[c["id"]]
            layout, facecam, center_x = plan["layout"], plan.get("facecam"), plan.get("center_x", 0.5)
            c["layout_used"] = describe(plan)
        mp4 = stem.with_suffix(".mp4")
        log(f"render #{c['id']} ({mmss(c['start'])}-{mmss(c['end'])}) ...")
        with Timer() as t:
            render_clip(src, local, mp4, layout=layout, facecam=tuple(facecam) if facecam else None, ass=ass,
                        encoder=a.encoder, center_x=center_x)
        c["render_secs"] = round(t.seconds, 1)
        c["file"] = str(mp4.relative_to(out))
        log(f"  selesai dalam {t.seconds:.1f} detik -> {mp4}")


def _transcript_for(a, out: Path, video, info):
    tpath = out / "transcript.json"
    if tpath.exists() and not a.retranscribe:
        log("pakai transcript.json yang sudah ada (pakai --retranscribe untuk ulang)")
        return read_json(tpath), 0.0
    with Timer() as t:
        transcript = None
        if info is not None:  # link mode: platform subtitles first
            transcript = fetch_transcript(video, info, out, a.lang or None, a.cookies)
            if transcript is None:
                audio = download_audio(video, out, a.cookies)
                transcript = transcribe(audio, out, a.whisper_model, a.lang or None, a.prompt,
                                        Path(a.kamus) if a.kamus else None)
                curve = audio_curve(audio, transcript["segments"][-1]["end"] if transcript["segments"] else 0)
                if curve:
                    write_json(out / "audio_curve.json", curve)
                audio.unlink(missing_ok=True)
        else:
            transcript = transcribe(video, out, a.whisper_model, a.lang or None, a.prompt,
                                    Path(a.kamus) if a.kamus else None)
    write_json(tpath, transcript)
    log(f"transkrip siap dalam {t.seconds:.0f} detik ({transcript.get('model')})")
    return transcript, t.seconds


def cmd_scan(a) -> None:
    need("ffmpeg"), need("ffprobe")
    info = None
    if is_url(a.video):
        video = a.video.strip()
        out = Path(a.out or f"out/{project_name(video)}")
        out.mkdir(parents=True, exist_ok=True)
        ipath = out / "info.json"
        info = read_json(ipath) if ipath.exists() and not a.retranscribe else fetch_info(video, a.cookies)
        write_json(ipath, info)
        duration = float(info.get("duration") or 0)
        label = info.get("title") or video
        log(f"link: {label} ({mmss(duration)}), heatmap: {'ada' if info.get('heatmap') else 'tidak ada'}")
    else:
        video = Path(a.video).expanduser()
        if not video.exists():
            raise SystemExit(f"Video tidak ditemukan: {video}")
        out = Path(a.out or f"out/{video.stem}")
        out.mkdir(parents=True, exist_ok=True)
        duration = probe_duration(video)
        label = video.name
        log(f"video {video.name}: {mmss(duration)}, output ke {out}/")

    transcript, t_tr = _transcript_for(a, out, video, info)
    if not duration and transcript["segments"]:
        duration = transcript["segments"][-1]["end"]

    with Timer() as t:
        segs = transcript["segments"]
        if a.picker == "ollama":
            clips = pick(segs, duration, use_llm=True, host=a.ollama, model=a.llm, min_len=a.min_len,
                         max_len=a.max_len, top=a.top, heatmap=(info or {}).get("heatmap"))
            picker = f"Ollama {a.llm}"
        else:
            chat = fetch_chat(video, info, out, a.cookies, a.chat_timeout) if info is not None and not a.no_chat else []
            curve_path = out / "audio_curve.json"
            if curve_path.exists():
                audio = read_json(curve_path)
            elif info is None:
                log("analisis volume suara (tawa, teriakan) ...")
                audio = audio_curve(video, duration)
                if audio:
                    write_json(curve_path, audio)
            else:
                audio = []
            cands = find_moments(segs, duration, chat=chat, heatmap=(info or {}).get("heatmap"), audio=audio,
                                 top=a.top * 2, min_len=a.min_len, max_len=a.max_len)
            for i, c in enumerate(cands, 1):
                c["id"] = i
            export_for_claude(out / "untuk_claude.txt", cands, segs, a.min_len, a.max_len)
            judged = judge(cands, segs, min_len=a.min_len, max_len=a.max_len, top=a.top) if a.ai and not a.no_ai else None
            clips = judged if judged else cands[:a.top]
            picker = "sinyal (" + ", ".join(x for x, ok in [("chat", bool(chat)), ("most replayed", bool((info or {}).get("heatmap"))),
                                                           ("suara", bool(audio)), ("kata reaksi", True)] if ok) + ")"
            if judged:
                picker += " + penilaian Claude"
            for i, c in enumerate(clips, 1):
                c["id"] = i
    for c in clips:
        c["preview"] = " ".join(s["text"] for s in transcript["segments"]
                                if s["start"] >= c["start"] - 0.1 and s["end"] <= c["end"] + 0.1)[:400]
    log(f"{len(clips)} kandidat dipilih dalam {t.seconds:.0f} detik")

    video_ref = video if info is not None else str(video.resolve())
    data = {"video": video_ref, "title": label, "duration": duration, "clips": clips}
    if info is None:
        contact_sheet(video, clips, out / "candidates.jpg")
    write_json(out / "candidates.json", data)  # saved early so the web page can show candidates
    if a.render_top:
        do_render(out, video_ref, transcript, clips, set(c["id"] for c in clips[:a.render_top]), a)
        write_json(out / "candidates.json", data)
    write_markdown(out, label, clips, {
        "duration": duration, "whisper_model": transcript.get("model", "?"), "t_transcribe": t_tr,
        "picker": picker, "t_pick": t.seconds,
        "machine": f"{platform.system()} {platform.machine()} ({platform.processor() or '-'})"})
    log(f"selesai. Buka {out / 'candidates.md'}")


def cmd_render(a) -> None:
    need("ffmpeg")
    out = Path(a.outdir)
    data = read_json(out / "candidates.json")
    transcript = read_json(out / "transcript.json")
    video = a.video or data["video"]
    if not is_url(video):
        video = Path(video)
    ids = {int(x) for x in a.ids.split(",")} if a.ids else set()
    do_render(out, video, transcript, data["clips"], ids, a)
    write_json(out / "candidates.json", data)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="clipfactory", description="Pilih dan render clip vertikal dari video panjang.")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="cmd", required=True)

    def render_opts(sp):
        sp.add_argument("--captions", action="store_true", help="bakar caption otomatis ke video")
        sp.add_argument("--srt", action="store_true", help="buat file .srt/.txt caption saja (untuk edit manual), tidak dibakar")
        sp.add_argument("--hook", action="store_true", help="tampilkan teks hook di 3 detik pertama")
        sp.add_argument("--layout", choices=["auto", "blur", "crop", "facecam"], default="auto",
                        help="auto = deteksi muka per clip (default)")
        sp.add_argument("--facecam", type=_facecam, help="x,y,w,h area facecam di video asli (layout facecam)")
        sp.add_argument("--encoder", choices=["auto", "videotoolbox", "x264"], default="auto")
        sp.add_argument("--font", default="Arial")
        sp.add_argument("--no-upper", action="store_true", help="caption tidak huruf besar semua")
        sp.add_argument("--lang", default="id", help="bahasa Whisper/subtitle, kosongkan '' untuk auto")
        sp.add_argument("--whisper-model", default="small", help="tiny/base/small/medium/large-v3")
        sp.add_argument("--prompt", help="kata-kata/nama yang sering muncul, membantu ejaan Whisper")
        sp.add_argument("--kamus", help="file kamus.txt dengan baris 'salah => benar'")
        sp.add_argument("--cookies", help="mode link: ambil login dari browser (chrome/safari/firefox)")
        sp.add_argument("--no-clip-whisper", dest="clip_whisper", action="store_false",
                        help="mode link: caption dari subtitle platform, tanpa Whisper per potongan")

    s = sub.add_parser("scan", help="transkripsi, pilih momen, buat candidates.md/.jpg")
    s.add_argument("video", help="file video atau link YouTube/Twitch")
    s.add_argument("--out", help="folder output (default out/<nama video>)")
    s.add_argument("--retranscribe", action="store_true")
    s.add_argument("--llm", default="qwen2.5:7b")
    s.add_argument("--ollama", default="http://localhost:11434")
    s.add_argument("--no-llm", action="store_true", help="(lama, diabaikan) pemilih default sekarang sinyal")
    s.add_argument("--picker", choices=["signals", "ollama"], default="signals",
                   help="signals = chat, most replayed, suara, kata reaksi (default); ollama = LLM lokal")
    s.add_argument("--no-chat", action="store_true", help="jangan unduh chat replay")
    s.add_argument("--chat-timeout", type=float, default=12, help="menit maksimal download chat (default 12)")
    s.add_argument("--ai", action="store_true", help="pakai Claude API untuk menilai konteks (BERBAYAR, butuh API key)")
    s.add_argument("--no-ai", action="store_true", help=argparse.SUPPRESS)
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
