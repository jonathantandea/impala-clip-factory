# Impala Clip Factory v0.1

Ambil video panjang (VOD, podcast, live), pilih momen terbaik secara otomatis, lalu render jadi clip vertikal 1080×1920 dengan caption. Semuanya jalan lokal di Mac: **Whisper** untuk transkripsi, **Ollama (qwen2.5:7b)** untuk memilih momen, dan **ffmpeg** untuk render.

## Pasang di Mac (sekali saja)

```bash
brew install ffmpeg python@3.12 ollama git
```

```bash
git clone https://github.com/<akun>/impala-clip-factory.git && cd impala-clip-factory
```

```bash
python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

```bash
ollama serve
```

Biarkan `ollama serve` jalan di tab Terminal itu. Buka tab baru, lalu:

```bash
ollama pull qwen2.5:7b
```

## Pemakaian

Setiap buka Terminal baru: `cd impala-clip-factory && source .venv/bin/activate`.

**Scan + caption + render 3 teratas** (tes pertama):

```bash
python -m clipfactory scan ~/Movies/vod.mp4 --captions --hook --render-top 3
```

Hasilnya ada di `out/<nama video>/`:

| File | Isi |
|---|---|
| `candidates.md` | daftar momen: waktu, judul, hook, alasan, skor, lama transkripsi/render |
| `candidates.jpg` | satu frame per kandidat, berlabel nomor & waktu |
| `clips/clip_01.mp4` | clip vertikal siap upload |
| `clips/clip_01.srt` | subtitle (untuk CapCut/Premiere) |
| `clips/clip_01_capcut.txt` | teks caption baris per baris |
| `transcript.json` | transkrip lengkap dengan waktu per kata (dipakai ulang, tidak transkripsi lagi) |

**Render kandidat lain belakangan** (tanpa transkripsi ulang):

```bash
python -m clipfactory render out/vod --ids 2,5 --captions --hook
```

### Layout

- `--layout blur` (default): video utuh di tengah, latar blur.
- `--layout crop`: potong tengah, memenuhi layar.
- `--layout facecam --facecam x,y,w,h`: facecam di atas, gameplay di bawah. `x,y,w,h` adalah posisi kotak facecam di video asli dalam piksel. Contoh untuk facecam di pojok kanan bawah video 1920×1080: `--facecam 1440,700,480,380`.

### Opsi berguna

- `--whisper-model small` (default). `medium` lebih akurat tapi lebih lambat; `base` untuk tes cepat.
- `--prompt "Impala, Valorant, Jonathan"`: nama/istilah yang sering muncul, membantu ejaan Whisper.
- `--kamus kamus.txt`: koreksi kata otomatis (`salah => benar`, lihat `kamus.example.txt`).
- `--top 8`, `--min-len 20`, `--max-len 60`: jumlah dan panjang kandidat.
- `--no-llm`: pilih momen dengan heuristik (tanpa Ollama).
- `--encoder auto`: di Mac otomatis pakai `h264_videotoolbox` (cepat, hardware).

## Yang dicek di tes pertama

1. Apakah momen pilihan Ollama masuk akal? (`candidates.md` + `candidates.jpg`)
2. Seberapa banyak kata yang salah dari Whisper? (caption di clip)
3. Berapa lama transkripsi dan render di Mac? (tercatat di `candidates.md`)

## Rencana v0.2

- stable-ts: waktu kata lebih akurat, TXT CapCut lebih rapi
- whisper.cpp: transkripsi lebih cepat di Apple Silicon
- yt-dlp: input langsung dari link YouTube
- Kamus kata diperluas kalau Whisper banyak salah
