"""Auto director: a pasted script (table or plain lines) -> scene.json, without an AI model.

Reads the columns Waktu / Ucapan (VO) / Teks di layar / Visual when present, and maps keywords
in Visual and VO onto the engine's vocabulary (sets, characters, shots, moves, events). Anything
outside the library falls back to the closest thing it has.
"""
from __future__ import annotations

import re

SETS = [
    ("laut", r"laut|samudra|samudera|gurita|ikan|karang|terumbu|dasar laut|hiu|paus|ubur"),
    ("kamar", r"kamar|rebahan|rebah|kasur|sofa|tiduran|berbaring|ruang tamu|di rumah|nonton"),
    ("sawah", r"sawah|desa|kampung|petani|padi|kebun|ladang|pematang|panen"),
]
EMOJI_DOT = re.compile(r"[\U0001F535\U0001F7E6\U0001F499]")          # 🔵 🟦 💙 -> drawn blue dot
EMOJI_ANY = re.compile(r"[\U0001F000-\U0001FAFF☀-➿️]")
STOPWORDS = set("yang dan di ke dari itu ini ada aja juga lagi buat sama kalau tapi jadi bikin lebih kayak karena "
                "punya bukan cuma udah sudah akan atau dengan untuk pada para kita lu lo gue gua aku kamu dia".split())


def _clean_vo(s: str) -> str:
    s = re.sub(r"\([^)]*\)", "", s)                    # stage directions
    s = s.replace("“", "").replace("”", "").replace('"', "").strip()
    return re.sub(r"\s+", " ", s)


def _clean_title(s: str) -> str:
    s = s.strip().strip('"')
    s = s.replace("→", " {arrow} ").replace("->", " {arrow} ")
    s = EMOJI_DOT.sub(" {dot}", s)
    s = EMOJI_ANY.sub("", s)
    return re.sub(r"\s+", " ", s).strip()


def parse(text: str) -> tuple[str, list[dict]]:
    """-> (title, rows[{vo, title, visual}])"""
    title, rows, header = "", [], None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^(judul|title)\s*[:：]\s*(.+)$", line, re.I)
        if m:
            title = m.group(2).strip(); continue
        if "|" in line:
            cells = [c.strip() for c in line.strip("|").split("|")]
        elif "\t" in raw:
            cells = [c.strip() for c in raw.split("\t")]
        else:
            cells = [line]
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
            continue                                       # markdown separator row
        low = [c.lower() for c in cells]
        if any(re.search(r"ucapan|\bvo\b|narasi|dialog", c) for c in low) and len(cells) > 1:
            header = {}
            for i, c in enumerate(low):
                if re.search(r"waktu|detik|time", c): header["time"] = i
                elif re.search(r"ucapan|\bvo\b|narasi|dialog", c): header["vo"] = i
                elif re.search(r"teks|text|layar|caption|judul", c): header["title"] = i
                elif re.search(r"visual|gambar|adegan|scene|shot", c): header["visual"] = i
            continue
        if len(cells) > 1:
            h = header or ({"time": 0, "vo": 1, "title": 2, "visual": 3} if len(cells) >= 4 else
                           {"vo": 0, "title": 1, "visual": 2} if len(cells) == 3 else {"vo": 0, "visual": 1})
            get = lambda k: cells[h[k]] if k in h and h[k] < len(cells) else ""
            vo = _clean_vo(get("vo"))
            if vo:
                rows.append({"vo": vo, "title": _clean_title(get("title")), "visual": get("visual")})
        else:
            vo = _clean_vo(re.sub(r"^\s*\d+\s*[–-]\s*\d+\s*(dtk|detik|s)?\s*", "", line))
            if vo:
                rows.append({"vo": vo, "title": "", "visual": ""})
    return title, rows


def _has(rx, s):
    return re.search(rx, s, re.I) is not None


def _word_in(vo, rx):
    m = re.search(rf"\b({rx})\w*", vo, re.I)
    return m.group(1).lower() if m else None


def _split_long(row):
    """Long VO -> two shots at a sentence boundary (more visual variety)."""
    parts = re.split(r"(?<=[.!?…])\s+", row["vo"])
    if len(row["vo"].split()) < 15 or len(parts) < 2:
        return [row]
    best = min(range(1, len(parts)), key=lambda k: abs(len(" ".join(parts[:k]).split()) - len(row["vo"].split()) / 2))
    a, b = dict(row, vo=" ".join(parts[:best]), part=1), dict(row, vo=" ".join(parts[best:]), title=None, cont=True, part=2)
    if re.match(r"\s*(cut ke|lalu|kemudian|terus|pindah ke|ganti ke)\b", row["visual"], re.I):
        a.update(title=None, carry=True)          # first sentence stays in the previous shot
        b.update(title=row["title"])              # the visual (and its on-screen text) belong to part 2
    return [a, b]


def build(text: str, voice: str = "brian", music: str = "") -> dict:
    title, rows = parse(text)
    if not rows:
        raise ValueError("tidak ada kalimat narasi yang terbaca. Tempel tabel (Waktu | Ucapan | Teks di layar | Visual) atau satu kalimat per baris.")
    full = " ".join(r["vo"] + " " + r["visual"] for r in rows).lower()
    chars = {}
    if _has(r"gurita", full):
        chars["gurita"] = {"type": "octopus", "color": "#E8704A"}
    names = []
    for m in re.finditer(r"\b(Pak|Bu|Mbak|Mas|Bang)\s+([A-Z][a-z]+)", " ".join(r["vo"] for r in rows)):
        nid = m.group(2).lower()
        if nid not in chars:
            k = len(names)
            chars[nid] = {"shirt": ["hijau", "coklat", "biru", "merah"][k % 4], "sarong": ["coklat", "abu", "hijau", "merah"][k % 4],
                          "hat": "caping" if m.group(1) == "Pak" and k % 2 == 0 else ("peci" if m.group(1) == "Pak" else None),
                          "mustache": m.group(1) == "Pak" and k % 2 == 1}
            names.append(nid)
    if _has(r"\b(kamu|gue|gua|aku|saya|narator|creator|kreator)\b", " ".join(r["visual"] for r in rows)) or _has(r"rebahan", full):
        chars.setdefault("kamu", {"shirt": "biru", "sarong": "abu"})

    lines, scenes, cur_set, prev_cast = [], [], None, []
    shots_cycle = ["medium", "wide", "low", "medium", "closeup"]
    row_items = [x for r in rows for x in _split_long(r)]
    for i, r in enumerate(row_items):
        vis, vo = ("" if r.get("carry") else r["visual"].lower()), r["vo"]
        both = vis + " " + vo.lower()
        st = None if r.get("carry") else (next((n for n, rx in SETS if _has(rx, vis)), None) or
                                           (None if r.get("cont") else next((n for n, rx in SETS if _has(rx, vo)), None)))
        cur_set = st or cur_set or ("laut" if "gurita" in chars else "sawah")
        # cast: characters named in the visual, else carry over, else the set's natural lead
        who = [] if r.get("carry") else [c for c in chars if _has(rf"\b{c}\b", vis)]
        if not r.get("carry") and "kamu" in chars and _has(r"\b(kamu|gue|gua|aku|saya)\b", vis) and "kamu" not in who:
            who.append("kamu")
        if not who:
            who = [c for c in prev_cast if (cur_set == "laut") == (chars[c].get("type") == "octopus")] or (
                ["gurita"] if cur_set == "laut" and "gurita" in chars else
                ["kamu"] if cur_set == "kamar" and "kamu" in chars else names[:1])
        if cur_set != "laut":
            who = [c for c in who if chars[c].get("type") != "octopus"]
        if not who and cur_set == "sawah":
            chars.setdefault("petani", {"shirt": "hijau", "sarong": "coklat", "hat": "caping"})
            who = ["petani"]
        prev_cast = who

        sc = {"set": cur_set, "cast": [], "events": []}
        if r.get("title"):
            sc["title"] = r["title"]
            tw = re.findall(r"[A-Za-z]{3,}", r["title"])
            num = {"1": "satu", "2": "dua", "3": "tiga", "4": "empat", "5": "lima"}.get((re.search(r"\d", r["title"]) or [None])[0] or "", None)
            if num and re.search(rf"\b{num}\b", vo.lower()):
                sc["title_word"] = num
            else:
                hit = next((w for w in tw if re.search(rf"\b{w.lower()}", vo.lower())), None)
                if hit:
                    sc["title_word"] = hit.lower()
        # shot
        if _has(r"close.?up|closeup|dekat|zoom", vis):
            sc["shot"] = "closeup"
        elif _has(r"wide|lebar|jauh|luas|dari atas", vis):
            sc["shot"] = "wide" if not _has(r"dari atas", vis) else "high"
        elif _has(r"diagram|titik|x.?ray", vis):
            sc["shot"] = "medium"
        elif i == 0:
            sc["shot"] = "establishing" if cur_set == "sawah" else "medium"
        else:
            sc["shot"] = shots_cycle[i % len(shots_cycle)]
        if _has(r"zoom", vis):
            sc["zoom"] = 1.3
        if r.get("cont"):
            sc["shot"] = {"closeup": "medium", "medium": "closeup", "wide": "medium"}.get(sc["shot"], "medium")
            sc.pop("zoom", None)

        # moves, moods, poses
        for k, c in enumerate(who):
            ch = chars[c]
            entry = {"who": c}
            if ch.get("type") == "octopus":
                src = vis if (vis and not r.get("cont")) else vo.lower()
                if r.get("cont") and _has(r"capek|lelah|ngos|kecapekan|mogok", vo):
                    src = vo.lower()
                if _has(r"capek|lelah|ngos|kecapekan|mogok", src) and not _has(r"berenang|merayap", vis if not r.get("cont") else ""):
                    entry.update(mode="tired", at=[0, -2.2])
                elif _has(r"merayap|merangkak|merambat|jalan pelan", src):
                    entry.update(mode="crawl", at=[-1.4, -2.2], walk_to=[1.4, -2.0])
                elif _has(r"berenang|renang", src):
                    entry.update(mode="swim", at=[-2.4, -2.6], walk_to=[2.4, -2.0])
                else:
                    entry.update(mode="idle", at=[0, -2.2])
            elif cur_set == "kamar":
                entry["at"] = [0, -0.72] if _has(r"rebahan|rebah|tiduran|berbaring|tidur", vis) else [0.4 * k, 0.4]
                if _has(r"rebahan|rebah|tiduran|berbaring|tidur", vis):
                    entry["pose"] = "lying"
                    sc["focus"] = [0, -0.45, -0.72]
                    sc["dist"] = 1.75
            else:
                entry["at"] = [k * 1.5, -0.6]
                if _has(r"berjalan|jalan|datang", vis):
                    entry.update(at=[k * 1.5 + 6, -0.6], walk_to=[k * 1.5 + 0.8, -0.6])
            if ch.get("type") != "octopus":
                for rx, pose in [(r"melambai|dadah", "wave"), (r"menunjuk|nunjuk", "point"), (r"sorak|seneng banget|bahagia|selebrasi", "cheer"),
                                 (r"kaget|panik|pusing", "hands_head"), (r"mikir|berpikir|bingung", "think"), (r"angkat bahu|shrug", "shrug"),
                                 (r"bawa|membawa|memikul", "carry")]:
                    if _has(rx, vis) and "pose" not in entry:
                        entry["pose"] = pose
            if _has(r"datar|flat|bete|cuek", vis):
                entry["mood"] = "neutral"
            elif _has(r"sedih|kesal|marah|kecewa|cemberut|capek|lelah", both):
                entry["mood"] = "frown"
            elif _has(r"senyum|senang|ketawa|tertawa|bahagia|seneng", both):
                entry["mood"] = "grin"
            sc["cast"].append(entry)

        # events
        octo = any(chars[c].get("type") == "octopus" for c in who)
        row_vo = " ".join(x["vo"] for x in row_items if x.get("visual") == r["visual"] and x.get("part"))
        row_jantung = _has(r"jantung", row_vo or vo)
        if octo and (_has(r"diagram|titik|jantung|x.?ray", vis) or (i > 0 and (_has(r"jantung", vo) or (r.get("part") and row_jantung)))):
            sc["events"].append({"type": "hearts"})
        if cur_set == "laut" and _has(r"biru|laut dalam|gelap", both):
            sc["events"].append({"type": "deep"})
            if octo:
                sc["events"].append({"type": "blue"})
        stopw = _word_in(vo, r"berhenti|mogok|stop")
        if octo and stopw and any(e["type"] == "hearts" for e in sc["events"]):
            sc["events"].append({"type": "heart_stop", "word": stopw})
        row_stop = _word_in(row_vo, r"berhenti|mogok|stop") if r.get("part") else stopw
        if _has(r"freeze|beku|diam", vis) and (stopw or not row_stop or r.get("part") == 1 and not row_stop):
            sc["events"].append({"type": "freeze", **({"word": stopw} if stopw else {})})
        if cur_set == "sawah":
            if _has(r"angin|berhembus|bertiup", both): sc["events"].append({"type": "wind", "strength": 0.3})
            if _has(r"panen|menguning", both): sc["events"].append({"type": "harvest"})
            if _has(r"burung", both) and _has(r"datang|menyerbu|hinggap|makan", both): sc["events"].append({"type": "birds_arrive", "target": "A"})
            if _has(r"burung", both) and _has(r"kabur|terbang|pergi|kaget", both): sc["events"].append({"type": "birds_flee"})
        if not sc["events"]:
            sc.pop("events")
        lines.append(vo)
        scenes.append(sc)

    keywords = sorted({w.lower() for r in rows for w in re.findall(r"[A-Za-z][A-Za-z-]{2,}", r.get("title") or "")
                       if w.lower() not in STOPWORDS and w.lower() not in ("arrow", "dot")} | ({"gurita"} if "gurita" in chars else set()))
    if not music:
        music = "desa" if all(s["set"] == "sawah" for s in scenes) else "ceria"
    return {"title": title or lines[0][:40], "voice": voice, "language": "id", "music": music, "keywords": keywords,
            "script": lines, "characters": chars, "world": {"props": []}, "scenes": scenes}


def summary(spec: dict) -> list[str]:
    out = []
    for i, (ln, s) in enumerate(zip(spec["script"], spec["scenes"]), 1):
        cast = ", ".join(f"{c['who']}" + (f" ({c.get('mode') or c.get('pose')})" if c.get("mode") or c.get("pose") else "") for c in s.get("cast", []))
        ev = ", ".join(e["type"] for e in s.get("events", []))
        out.append(f"{i}. [{s['set']} · {s.get('shot')}{' · zoom' if s.get('zoom') else ''}] {cast}{' · ' + ev if ev else ''}"
                   f"{' · teks: ' + s['title'] if s.get('title') else ''}  —  “{ln[:60]}{'…' if len(ln) > 60 else ''}”")
    return out
