# Impala Clip Factory v0.1

Ambil video panjang (VOD, podcast, live), pilih momen terbaik secara otomatis, lalu render jadi clip vertikal 1080×1920 dengan caption. Semuanya jalan lokal di Mac: **Whisper** untuk transkripsi, **Ollama (qwen2.5:7b)** untuk memilih momen, dan **ffmpeg** untuk render.

## Pasang di Mac (sekali saja)

Satu perintah, tanpa Homebrew dan tanpa git (cocok untuk Mac Intel lama di macOS 12):

```bash
curl -fsSL https://raw.githubusercontent.com/jonathantandea/impala-clip-factory/main/setup_mac.sh -o ~/setup_mac.sh && bash ~/setup_mac.sh
```

Script memasang ffmpeg, Python 3.12, Whisper, lalu tes render kecil. Aman dijalankan ulang. Kalau gagal, kirim `tail -40 ~/clipfactory-setup.log`.

### Cara Clip Factory memilih momen

Momen dipilih dari sinyal penonton, bukan tebakan: lonjakan **live chat** (chat replay YouTube/Twitch, termasuk WKWK, ANJIR, emoji, "clip"), **Most replayed** YouTube, **puncak suara** (tawa, teriakan) dan **kata reaksi** di transkrip. Tiap clip dibuat dengan setup sebelum momen dan payoff sesudahnya, dipotong di batas kalimat.

**Penilaian konteks oleh Claude (opsional, berbayar):** default-nya mati (mode gratis). Kalau Mac punya API key Anthropic dan kamu mencentang "Pakai Claude API" (atau `--ai`), Claude membaca transkrip tiap kandidat, membuang yang tidak bisa berdiri sendiri, merapikan awal/akhir, dan menulis judul + hook. Biaya kecil per video. Tanpa API key: unduh `untuk_claude.txt` dari halaman project, kirim ke Claude di chat, lalu tempel jawabannya di kotak import.

**Facecam:** layout auto mendeteksi muka di semua clip lalu memakai posisi facecam yang paling disepakati, jadi clip yang deteksinya meleset tetap benar.

## Pemakaian: tampilan web (paling gampang)

Double-click **Clip Factory** di Desktop (dibuat oleh `setup_mac.sh`), atau:

```bash
cd ~/impala-clip-factory && source .venv/bin/activate && python -m clipfactory web
```

Browser terbuka di http://localhost:8765. Pilih video, klik **Mulai scan**, lalu tonton, pilih dan render clip langsung di halaman itu. Hanya bisa dibuka dari Mac ini sendiri.

### Dari link YouTube/Twitch (tanpa download 6 jam)

Tempel link VOD di kotak Video lalu **Mulai scan**:

1. Info + grafik "Most replayed" dibaca tanpa download.
2. Transkrip diambil dari subtitle otomatis YouTube (detik). Kalau tidak ada: hanya audio yang diunduh lalu Whisper.
3. Saat **Render**, hanya potongan terpilih yang diunduh (1080p), lalu Whisper jalan di potongan itu supaya caption akurat.

Video member-only/age-restricted: pilih browser di opsi **Login**. Kalau YouTube berubah dan link gagal, jalankan `setup_mac.sh` lagi (yt-dlp ikut diupdate). Live yang masih berjalan belum bisa; tunggu jadi VOD.

Lewat Terminal: `python -m clipfactory scan "https://www.youtube.com/watch?v=..." --no-llm --render-top 2 --captions --hook`

## Motion Factory (tab kedua di halaman yang sama)

Untuk video motion/cerita 3D (20-120 detik, 9:16). Isi **Brief baru** (judul, gaya, durasi, suara, script, arahan), klik **Simpan brief**, lalu **Salin brief** dan kirim ke Claude di chat. Video jadinya diunduh dari chat lalu ditambahkan lewat **Tambah video…** supaya semua tersimpan di `motion/videos` dan bisa diputar/diunduh dari halaman.

### AI Generation (cerita 3D, dirender di Mac sendiri)

1. Kirim brief/script ke Claude di chat; Claude membalas **naskah adegan** (JSON, format: `docs/scene-format.md`, contoh: `docs/examples/botol-pak-karjo.json`).
2. Motion Factory → tempel di **AI Generation: naskah adegan** → **Buat project**.
3. Isi sekali **API key ElevenLabs** (akun gratis: 10.000 karakter/bulan; lisensi free tier non-komersial). Key disimpan di `~/.impala/elevenlabs.key`.
4. **1. Buat suara** → **2. Preview & Render**: browser merender frame demi frame, ffmpeg menggabungkan video + narasi + musik (lofi, ceria, desa; musik orisinal bebas royalti). Hasil masuk galeri.

## Pemakaian lewat Terminal

Setiap buka Terminal baru: `cd impala-clip-factory && source .venv/bin/activate`.

**Scan + caption + render 3 teratas** (tes pertama):

```bash
python -m clipfactory scan ~/Movies/vod.mp4 --render-top 3
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

- `--layout auto` (default): deteksi muka di tiap clip. Facecam di posisi mana pun dipotong dan ditaruh di atas gameplay; kamera penuh dipotong vertikal mengikuti muka; tanpa muka pakai blur. Keputusan per clip tercatat di halaman web.
- `--layout blur`: video utuh di tengah, latar blur.
- `--layout crop`: potong tengah, memenuhi layar.
- `--layout facecam --facecam x,y,w,h`: posisi facecam ditentukan manual (piksel di video asli).

### Caption

Default: **tanpa caption** (untuk edit manual). `--srt` membuat file `.srt` + `_capcut.txt` saja tanpa ditempel; `--captions` menempel caption otomatis di video; `--hook` menempel teks hook 3 detik pertama.

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
