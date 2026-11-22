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
`hat`: caping | peci | (kosong) · `mustache`, `blush`: true/false.
Hewan: `{"type": "octopus"}` (set laut; `mode`: idle, swim, crawl, tired) · `{"type": "wombat"}` (set semak; `mode`: idle, proud; jalan lewat `walk_to`).

## Set (`scenes[i].set`)
sawah (default) · laut · kamar · semak (Australia, senja) · ilustrasi (animasi 2D, `illustration`: usus_kubus)

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
Semua bisa diberi `set` (sawah, laut, kamar, semak).
Semua: `id`, `x`, `z`, `hidden: true` = tersembunyi sampai event `appear`.

## Adegan (`scenes[i]` untuk `script[i]`)
- `shot`: establishing (hanya adegan pertama) · wide · medium · closeup · low · high · track (mengikuti yang berjalan)
- `focus`: id karakter / properti, atau `[x, y, z]`; `side`: 1 / -1 (kamera dari kanan/kiri)
- `cast`: `{ "who", "at": [x, z], "walk_to": [x, z], "face": "camera"|"left"|"right"|"away"|id|radian, "pose", "mood" }`
  - `pose`: idle, hands_hips, wave, cheer, hands_head, point, reach_up, push, hold_up, carry, look_up, shrug, think
  - `mood`: smile, grin, frown, neutral
- `events`: `wind {strength}`, `harvest`, `appear {target}`, `disappear {target}`, `raise {target}`,
  `birds_land {target}`, `birds_leave`, `birds_arrive {target: "A"|"B"}`, `birds_flee`, `knock {target, words}`

Teks layar (`title`) mendukung `{arrow}`, `{dot}`, `{trophy}` (digambar, karena font tidak punya → 🔵 🏆).

Adegan berganti tepat saat kalimat narasinya mulai diucapkan. Durasi video mengikuti panjang narasi (+2,4 detik).
