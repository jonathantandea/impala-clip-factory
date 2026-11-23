# Naskah adegan (scene.json) untuk AI Generation Factory

Satu file JSON = satu video. Claude menulisnya dari brief; kamu menempelnya di Motion Factory.
Contoh lengkap: `docs/examples/botol-pak-karjo.json`.

```json
{
  "title": "Judul video",
  "voice": "brian",            // brian | sarah | jessica | liam | george | ID suara ElevenLabs
  "language": "id",
  "music": "lofi",             // lofi | ceria | desa | none
  "captions": true,
  "keywords": ["burung"],      // kata yang tampil kuning di caption
  "script": ["Kalimat 1.", "Kalimat 2."],   // satu kalimat narasi = satu adegan
  "characters": { "karjo": { "shirt": "hijau", "sarong": "coklat", "hat": "caping" } },
  "world": { "props": [ { "type": "scarecrow", "id": "orangan", "x": 13, "z": -5 } ] },
  "scenes": [ { "shot": "establishing", "cast": [ { "who": "karjo", "at": [0, -0.6] } ] } ]
}
```

## Dunia (koordinat meter)
- Pematang depan (tempat berdiri/jalan): z = -0.6, x dari -9 sampai 22.
- Sawah A (kiri): x -7..6.6, z -11.4..-1.4. Pematang tengah x = 7. Sawah B (kanan): x 7.4..21.
- Desa + pohon kelapa di belakang (z sekitar -25..-30).

## Karakter
`shirt`: hijau, coklat, biru, merah, ungu, kuning (atau 3 warna hex) · `sarong`: coklat, abu, hijau, merah ·
`hat`: caping | peci | cap (`capColor`) | toga | rimba (topi jagawana) | (kosong) · `mustache`, `blush`, `whistle` (peluit), `baby` (gendong bayi): true/false · `hair`: warna hex (mis. uban).
Hewan hutan: `{"type": "badak"|"rusa"|"babi"|"kancil"|"rangkong"}`, opsi `bucket: true` (bawa ember), `map: true` (bawa peta terbalik). `mode`: idle, cheer, snort, lost, sad, thirsty; `mood`: smile, flat (mata setengah tutup), shock.
Hewan: `{"type": "octopus"}` (set laut; `mode`: idle, swim, crawl, tired) · `{"type": "wombat"}` (set semak; `mode`: idle, proud; jalan lewat `walk_to`).

## Set (`scenes[i].set`)
sawah (default) · laut · kamar · semak (Australia, senja) · kota (Kota Tertib x<0 / Kota Terserah x>0, gerbang di x=0, halte (-14, 4.6), kantor + parkiran x≈-30, angkot (10, 1.6), lampu merah (18, 3.7), sungai + jembatan x=29) · hutan (hutan hujan, area lapang di (0, 0)) · interior (ruangan tahun 90-an: kamar x 0, ruang tamu x 14, kantor x 28, kafe x 42; dinding belakang z = -3) · ilustrasi (animasi 2D, `illustration`: usus_kubus)

## Properti (`world.props`)
| type | opsi |
|---|---|
| `bamboo_pole` | `bottles` (jumlah botol) |
| `scarecrow` | `fallen: true` = rebah sampai event `raise` |
| `sacks` | `count` (1-9), tumpukan karung beras |
| `house`, `palm` | rumah / pohon kelapa tambahan |
| `flat_rock` | batu datar (untuk kubus) |
| `cubes` | `count`, `on`: id batu |
| `trophy` | piala, `scale` |
| `clothes` | tumpukan baju berantakan |
| `bus`, `angkot`, `motor` | kendaraan (set kota), `rot`; bisa ditumpangi lewat `ride` + `seat` dan digerakkan lewat `vehicles` |
| `fruit_tree`, `seedlings`, `dung`, `wallow` (`r`), `path` (`length`), `thicket` (`r`, `count`) | set hutan; berubah lewat event `grow` (buah jatuh, tunas + cahaya, bibit berdesakan, kubangan mengering, jalan tertutup tanaman, semak berduri tumbuh) |
| `bed`, `radio`, `calendar` (`text`, `month`), `landline`, `tv` (`text`, `sub`), `desk`, `fax` (`grow` = kertas keluar), `wall_clock` (`time`), `cafe_table` (`glasses`), `post_box`, `cafe_front` (`name`) | barang tahun 90-an; semua menerima `x`, `y`, `z`, `rot` |
| `sandal`, `ranger_hat` | barang yang tertinggal (pakai `hidden` + `appear`) |
Semua bisa diberi `set` (sawah, laut, kamar, semak, kota, hutan).
Semua: `id`, `x`, `z`, `hidden: true` = tersembunyi sampai event `appear`.

## Adegan (`scenes[i]` untuk `script[i]`)
- `shot`: establishing (hanya adegan pertama) · wide · medium · closeup · low · high · track (mengikuti yang berjalan)
- `focus`: id karakter / properti, atau `[x, y, z]`; `side`: 1 / -1 (kamera dari kanan/kiri)
- `cast`: `{ "who", "at": [x, z], "walk_to": [x, z], "face": "camera"|"left"|"right"|"away"|id|radian, "pose", "mood" }`
  - `pose`: idle, hands_hips, wave, cheer, hands_head, point, reach_up, push, hold_up, carry, look_up, shrug, think
  - `mood`: smile, grin, frown, neutral
- `events`: `wind {strength}`, `harvest`, `appear {target}`, `disappear {target}`, `raise {target}`,
  `birds_land {target}`, `birds_leave`, `birds_arrive {target: "A"|"B"}`, `birds_flee`, `knock {target, words}`

- `offset`: geser awal adegan (detik); `at_word`: mulai adegan di kata ke-sekian dalam kalimat (untuk montase dalam satu kalimat).
- `cam`: kamera manual `{ "pos": [x,y,z], "look": [x,y,z], "to": {pos, look}, "follow": id }` (dengan `follow`, pos/look relatif ke kendaraan). `cam_9x16` / `cam_16x9` = kamera khusus per format.
- `vehicles`: `[{ "id", "from": [x,z], "to": [x,z], "rot", "dur" | "word", "delay", "ease", "bump" }]`.
- Penumpang: cast `{ "who", "ride": "angkot", "seat": "driver"|"kiri1"|"kiri2"|"kanan1"|"kanan2", "turn" }` · motor: `"depan"|"belakang"`.
- Masuk frame: cast `"enter": { "from": [x,y,z], "word": "prit", "hidden": true }`; `"y"` = tinggi berdiri.
- Pose tambahan: watch (lihat jam), hold_out (minta uang), ride, whistle, lying, struggle (meronta), panic, hug, thirsty. `mood`: shock (mulut O).
- Cast `"item"`: hp | radio | kabel | gagang | surat (dipegang tangan kanan). `"lying": true` = berbaring, `"sit": true` = duduk. `"pose_at": [{"word", "pose", "mood"}]` = ganti pose di kata tertentu. Karakter: `hairLong` (rambut panjang).
- Pose: grope, press, scroll, phone, hp, point_fwd, point_l, point_r, awkward, nervous.
- Adegan: `"hide": [id]` menyembunyikan properti di adegan itu.
- Cast `"puff": { "mode": "out"|"in", "word" | "at" }`: hilang / muncul dengan asap. `"hat_off": "topi"`: topi lepas di kata itu; `"hat": false` = tanpa topi.
- Event baru: `grow {target, from, to, word, delay, dur}` (nilai bertahan setelah adegan), `day {n}` (lencana HARI KE-n), `bubble {who, text, at|word, y, dx}` (balon dialog), `snort {who, at}` (asap kecil dari hidung). `appear` / `disappear` juga bisa diberi `word`.
- Ilustrasi 2D: `jam_pasir` (`day`), `peta_indonesia` (`label`, titik berkedip di Ujung Kulon), `papan_skor` (`score`), `kalender` (`from`, `to`, `month`), `post_sosmed` (`text`, `user`, `likes`), `usus_kubus`.

Gaya flat (karakter 2D outline tebal di set 3D bertekstur, latar blur, warna hangat): `"style": "flat"`, karakter `{"type": "puppet", "hijab" | "hair", "peci", "mustache", "tunic", "skirt", "skin", "collar"}`; mood: smile, happy, smug, suspicious, worried, shock, whisper, angry, neutral; cast `look` (-1..1), `sit`, pose point / whisper / thumb. Set: warung, rumah. Properti: fan (`grow` = kecepatan, `rps`), door (`grow` = terbuka), foot_switch, bill (`amount`). Adegan: `blur` (px), `sharp: [id properti]` = tetap tajam, `soft: [id karakter]` = ikut blur. Event `grow` bisa diberi `start_word`.
Suara: `voice_settings` (mis. `{"speed": 1.08}`), per baris `speed` / `settings`.

Opsi atas: `voices` (`{ "narator": "brian", "budi": "george" }`) + baris naskah `{ "text", "speaker", "pause", "gap" }` untuk banyak suara; `caption_color` (hex).
Format: setiap project bisa dirender 9:16 dan 16:9 (tombol di halaman render). Contoh multi-suara + kota: `docs/examples/kota-part1-berangkat-kerja.json`. Hutan + hewan: `docs/examples/badak-hilang.json`. Interior 90-an: `docs/examples/genz-tanpa-hp.json`. Gaya flat: `docs/examples/kipas-pak-darto.json`.

Teks layar (`title`) mendukung `{arrow}`, `{dot}`, `{trophy}` (digambar, karena font tidak punya → 🔵 🏆).

Adegan berganti tepat saat kalimat narasinya mulai diucapkan. Durasi video mengikuti panjang narasi (+2,4 detik).
