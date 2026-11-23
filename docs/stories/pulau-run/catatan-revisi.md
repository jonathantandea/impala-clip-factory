# Pulau Run — catatan untuk revisi berikutnya (belum dikerjakan)

Catatan dari review video panjang 16:9 (versi 23 Nov 2026, durasi 10:47).

## 1. VO error di sekitar menit 2
- Ada kesalahan di VO sekitar menit ke-2: akhir Bab 1, kira-kira 1:50–2:15 ("…pulau paling barat… adalah Pulau Run" lalu masuk Bab 2).
- Petunjuk dari transkrip Whisper: "Run" sering terbaca **"Ran"** (lafal Inggris) di banyak tempat (Bab 1–6). Juga "Timurnusantara" (tanpa jeda), "Courthope" terdengar "Corthope", "Stuyvesant" terdengar "Stoivacant", dan "Pulau Tetanggarun".
- Untuk revisi: cek ulang bagian itu dengan telinga, generate ulang per bab yang bermasalah (bukan seluruh VO), pakai pronunciation dictionary ElevenLabs untuk "Run" (rʊn / "Run" seperti bahasa Indonesia), Courthope, Stuyvesant. Penyelaras VO cukup dijalankan ulang untuk bab yang diganti.

## 2. Visual kurang variatif dan terlalu statis
Yang terasa:
- Terlalu banyak adegan "teks di tengah layar kosong" (statement, angka besar, kartu perbandingan) dengan latar yang sama.
- Kamera peta banyak yang diam; zoom hanya di beberapa adegan.
- Satu adegan bisa bertahan 15–30 detik tanpa perubahan visual.
- Tidak ada gambar arsip, ilustrasi tokoh, atau objek (semua peta + tipografi).

Ide perbaikan:
- Aturan ritme: perubahan visual setiap 4–6 detik (kamera bergerak, elemen baru masuk, potongan ke detail).
- Kamera peta selalu bergerak pelan (drift/zoom 3–5% per adegan), plus potongan cepat dunia → Banda → Run.
- Pecah adegan panjang jadi beberapa beat yang disinkronkan ke kata (pin, label, ikon, angka muncul bergantian).
- Variasi jenis visual: ilustrasi 2D (kapal, benteng, Courthope sebagai siluet, kebun pala), gambar arsip domain publik (Wikimedia/Rijksmuseum, perlu akses jaringan), tekstur kertas tua, parallax.
- Animasi kartu: kapal berlayar dengan jejak, benteng dibangun, penghitung hari dengan kalender, bendera berganti.
- Transisi antar adegan (wipe peta, zoom-through), bukan potongan langsung.
- Gunakan gaya karakter 2D outline (gaya "flat") untuk adegan cerita (Courthope, warga Run, Stuyvesant) diselingi peta.

## 3. Lain-lain
- End screen 10 detik (bukan 20): panjangkan bila memakai elemen end screen YouTube.
- Garis pantai Banda masih dari data OSM yang disederhanakan; ganti dengan data Overpass saat aksesnya jalan.
- Shorts 9:16 (3 potong) belum dibuat.

## Revisi v2 (23 Nov 2026) — sudah dikerjakan
- **Penyebab utama "VO error di menit 2": audio terpotong di 2:05.** Musik latar bawaan hanya 125 detik dan mixing memotong seluruh audio mengikuti musik. Diperbaiki di engine (musik di-loop, VO di-pad), berlaku untuk semua video panjang.
- **Jeda antar bab**: Bab 2–7 menyambung tanpa jeda di rekaman. Disisipkan jeda ±1,6 detik di titik paling hening (total +10,7 detik), tanpa generate ulang.
- **Visual**: 46 → 78 adegan; kamera peta selalu bergerak pelan; transisi crossfade + push 0,5 detik antar adegan; peta samar bergerak di belakang adegan teks; jenis visual baru: kapal layar, benteng digambar bertahap, siluet tokoh (Courthope, Stuyvesant, orang kaya Banda), bendera berganti, kalender hari pengepungan, gulungan Perjanjian Breda dengan stempel, rantai harga, kebun pala, titik populasi.

## Masih terbuka
- "Run" terbaca "Ran" (lafal Inggris) di rekaman ElevenLabs. Perlu generate ulang kalimat yang menyebut "Pulau Run" dengan pronunciation dictionary / ejaan fonetik, lalu jalankan ulang penyelarasan. Kalimat terdampak: 7, 8, 30, 47, 48, 51, 54, 70, 77, 116, 119, 122, 125, 141, 146, 150 (indeks kalimat di `docs/examples/pulau-run.json`).
