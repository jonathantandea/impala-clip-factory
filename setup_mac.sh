#!/bin/bash
# Clip Factory one-shot setup for macOS (built for Intel Macs on macOS 12, works on newer too).
# No Homebrew, no git needed. Safe to run again: finished steps are skipped.
#
#   curl -fsSL https://raw.githubusercontent.com/jonathantandea/impala-clip-factory/main/setup_mac.sh -o ~/setup_mac.sh && bash ~/setup_mac.sh

set -u
REPO="jonathantandea/impala-clip-factory"
APP="$HOME/impala-clip-factory"
BIN="$HOME/bin"
PY_VER="3.12.10"
PY_FW="/Library/Frameworks/Python.framework/Versions/3.12/bin"
LOG="$HOME/clipfactory-setup.log"
: > "$LOG"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
ok()   { printf '\033[1;32m    OK\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m    !\033[0m %s\n' "$1"; }
fail() {
  printf '\n\033[1;31mGAGAL / FAILED:\033[0m %s\n' "$1"
  printf 'Kirim ke Claude: screenshot ini + isi file log:\n  cat %s | tail -40\n' "$LOG"
  exit 1
}
add_path_line() {  # add a PATH line to both zsh and bash profiles, once
  local line="$1"
  for f in "$HOME/.zprofile" "$HOME/.bash_profile"; do
    touch "$f"
    grep -qxF "$line" "$f" || echo "$line" >> "$f"
  done
}
fetch() {  # fetch URL FILE: download with retries, fail on HTTP errors
  curl -fL --retry 3 --retry-delay 2 --connect-timeout 20 -o "$2" "$1" >>"$LOG" 2>&1
}

step "0/5 Cek Mac"
ARCH=$(uname -m); OSV=$(sw_vers -productVersion)
echo "arch=$ARCH macOS=$OSV" >> "$LOG"
ok "macOS $OSV, $ARCH, $(( $(sysctl -n hw.memsize) / 1073741824 )) GB RAM"
command -v curl >/dev/null || fail "curl tidak ada (aneh untuk macOS)."

# ---------------------------------------------------------------- ffmpeg
step "1/5 ffmpeg"
mkdir -p "$BIN"
export PATH="$BIN:$PATH"
add_path_line 'export PATH="$HOME/bin:$PATH"'
if "$BIN/ffmpeg" -version >/dev/null 2>&1 && "$BIN/ffprobe" -version >/dev/null 2>&1; then
  ok "sudah terpasang: $("$BIN/ffmpeg" -version | head -1 | cut -d' ' -f1-3)"
else
  TMP=$(mktemp -d)
  got=0
  # Source A: evermeet.cx (zip). Source B: GitHub mirror of the same Intel build (gz).
  if fetch "https://evermeet.cx/ffmpeg/getrelease/zip" "$TMP/ffmpeg.zip" \
     && fetch "https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip" "$TMP/ffprobe.zip" \
     && unzip -o -q "$TMP/ffmpeg.zip" -d "$TMP" && unzip -o -q "$TMP/ffprobe.zip" -d "$TMP" \
     && [ -s "$TMP/ffmpeg" ] && [ -s "$TMP/ffprobe" ]; then
    got=1; echo "ffmpeg from evermeet" >> "$LOG"
  else
    warn "evermeet.cx gagal, coba sumber cadangan (GitHub) ..."
    GH="https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0"
    if [ "$ARCH" = "arm64" ]; then SUF="darwin-arm64"; else SUF="darwin-x64"; fi
    if fetch "$GH/ffmpeg-$SUF.gz" "$TMP/ffmpeg.gz" && fetch "$GH/ffprobe-$SUF.gz" "$TMP/ffprobe.gz" \
       && gunzip -f "$TMP/ffmpeg.gz" "$TMP/ffprobe.gz" && [ -s "$TMP/ffmpeg" ] && [ -s "$TMP/ffprobe" ]; then
      got=1; echo "ffmpeg from github mirror" >> "$LOG"
    fi
  fi
  [ "$got" = 1 ] || fail "Tidak bisa download ffmpeg dari dua sumber. Cek internet/VPN lalu jalankan lagi."
  mv -f "$TMP/ffmpeg" "$TMP/ffprobe" "$BIN/"
  chmod +x "$BIN/ffmpeg" "$BIN/ffprobe"
  xattr -d com.apple.quarantine "$BIN/ffmpeg" "$BIN/ffprobe" 2>/dev/null || true
  rm -rf "$TMP"
  "$BIN/ffmpeg" -version >>"$LOG" 2>&1 || fail "ffmpeg terdownload tapi tidak bisa jalan."
  ok "$("$BIN/ffmpeg" -version | head -1 | cut -d' ' -f1-3)"
fi

# ---------------------------------------------------------------- Deno (yt-dlp needs a JS runtime for YouTube)
if "$BIN/deno" --version >/dev/null 2>&1; then
  ok "deno sudah ada ($("$BIN/deno" --version | head -1))"
else
  if [ "$ARCH" = "arm64" ]; then DZ="deno-aarch64-apple-darwin.zip"; else DZ="deno-x86_64-apple-darwin.zip"; fi
  TMP=$(mktemp -d)
  if fetch "https://github.com/denoland/deno/releases/latest/download/$DZ" "$TMP/deno.zip" \
     && unzip -o -q "$TMP/deno.zip" -d "$TMP" && mv -f "$TMP/deno" "$BIN/deno" && chmod +x "$BIN/deno"; then
    xattr -d com.apple.quarantine "$BIN/deno" 2>/dev/null || true
    "$BIN/deno" --version >>"$LOG" 2>&1 && ok "deno terpasang (untuk link YouTube)" \
      || warn "deno terdownload tapi tidak jalan; link YouTube mungkin terbatas"
  else
    warn "download deno gagal; link YouTube mungkin terbatas (file lokal tetap bisa)"
  fi
  rm -rf "$TMP"
fi

# ---------------------------------------------------------------- Python
step "2/5 Python 3.12"
PY=""
for c in "$PY_FW/python3.12" "$(command -v python3.12 2>/dev/null)"; do
  if [ -n "$c" ] && [ -x "$c" ] && "$c" -c 'import sys; assert sys.version_info[:2]==(3,12)' 2>/dev/null; then PY="$c"; break; fi
done
if [ -n "$PY" ]; then
  ok "sudah terpasang: $("$PY" --version)"
else
  PKG="$HOME/Downloads/python-$PY_VER-macos11.pkg"
  if [ ! -s "$PKG" ]; then
    echo "    download Python $PY_VER (~45 MB) ..."
    fetch "https://www.python.org/ftp/python/$PY_VER/python-$PY_VER-macos11.pkg" "$PKG" \
      || fail "Download Python gagal. Download manual: https://www.python.org/downloads/release/python-31210/ (macOS 64-bit universal2 installer), double-click, lalu jalankan script ini lagi."
  fi
  echo "    Masukkan password Mac kamu (tidak kelihatan saat diketik), lalu Enter:"
  if ! sudo installer -pkg "$PKG" -target / >>"$LOG" 2>&1; then
    warn "Install otomatis gagal. Membuka installer biasa: klik Continue sampai selesai, lalu jalankan script ini lagi."
    open "$PKG"
    exit 1
  fi
  PY="$PY_FW/python3.12"
  [ -x "$PY" ] || fail "Python terpasang tapi tidak ditemukan di $PY_FW."
  ok "$("$PY" --version)"
fi
add_path_line 'export PATH="/Library/Frameworks/Python.framework/Versions/3.12/bin:$PATH"'
CERT="/Applications/Python 3.12/Install Certificates.command"
if [ -f "$CERT" ] && ! "$PY" -c 'import certifi' 2>/dev/null; then
  bash "$CERT" >>"$LOG" 2>&1 && ok "sertifikat SSL dipasang" || warn "Install Certificates gagal (lanjut dulu)"
fi

# ---------------------------------------------------------------- Clip Factory code
step "3/5 Kode Clip Factory -> $APP"
if [ -d "$APP/.git" ] && command -v git >/dev/null && git -C "$APP" pull -q >>"$LOG" 2>&1; then
  ok "diperbarui (git pull)"
else
  TMP=$(mktemp -d)
  fetch "https://codeload.github.com/$REPO/tar.gz/refs/heads/main" "$TMP/src.tgz" \
    || fail "Download kode dari GitHub gagal."
  tar -xzf "$TMP/src.tgz" -C "$TMP" || fail "File kode rusak, jalankan lagi."
  mkdir -p "$APP"
  # Copy code over, keep user's out/, .venv and kamus.txt.
  (cd "$TMP"/impala-clip-factory-main && tar -cf - .) | (cd "$APP" && tar -xf -)
  rm -rf "$TMP"
  ok "kode terbaru diunduh"
fi

# ---------------------------------------------------------------- venv + packages
step "4/5 Paket Python (Whisper + PyTorch). Ini paling lama, 5-15 menit"
cd "$APP" || fail "Folder $APP tidak ada."
if [ ! -x .venv/bin/python ]; then
  "$PY" -m venv .venv >>"$LOG" 2>&1 || fail "Gagal membuat .venv"
fi
VPY="$APP/.venv/bin/python"
"$VPY" -m pip install -q --upgrade pip setuptools wheel >>"$LOG" 2>&1 || warn "upgrade pip gagal (lanjut)"
if ! "$VPY" -m pip install --prefer-binary -r requirements.txt >>"$LOG" 2>&1; then
  warn "Install pertama gagal, coba sekali lagi tanpa cache ..."
  "$VPY" -m pip install --prefer-binary --no-cache-dir -r requirements.txt >>"$LOG" 2>&1 \
    || fail "pip install gagal. Baris error ada di log."
fi
"$VPY" -m pip install -q --prefer-binary -U "yt-dlp[default]" >>"$LOG" 2>&1 && ok "yt-dlp $("$VPY" -m yt_dlp --version 2>/dev/null) (selalu diupdate)" \
  || warn "update yt-dlp gagal (lanjut)"
"$VPY" -c "import whisper, torch; print('whisper OK, torch', torch.__version__)" >>"$LOG" 2>&1 \
  || fail "Whisper terpasang tapi tidak bisa di-import."
ok "Whisper + torch $("$VPY" -c 'import torch; print(torch.__version__)' 2>/dev/null)"

# ---------------------------------------------------------------- smoke test
step "5/5 Tes render kecil"
T=$(mktemp -d)
ffmpeg -v error -f lavfi -i testsrc2=size=1280x720:rate=30:duration=6 -f lavfi -i sine=frequency=400:duration=6 \
  -c:v libx264 -preset ultrafast -c:a aac -shortest "$T/test.mp4" >>"$LOG" 2>&1 || fail "ffmpeg tidak bisa membuat video tes."
mkdir -p "$T/out"
cat > "$T/out/transcript.json" <<'JSON'
{"language":"id","model":"test","segments":[{"start":0.5,"end":5.5,"text":"halo ini tes clip factory","words":[
{"w":"halo","s":0.5,"e":1.2},{"w":"ini","s":1.3,"e":1.8},{"w":"tes","s":1.9,"e":2.6},{"w":"clip","s":2.8,"e":3.6},{"w":"factory","s":3.7,"e":5.5}]}]}
JSON
cat > "$T/out/candidates.json" <<JSON
{"video":"$T/test.mp4","duration":6,"clips":[{"id":1,"start":0,"end":6,"title":"tes","hook":"Tes Clip Factory","reason":"","score":10,"source":"test"}]}
JSON
if "$VPY" -m clipfactory render "$T/out" --captions --hook >>"$LOG" 2>&1 && [ -s "$T/out/clips/clip_01.mp4" ]; then
  ok "render + caption jalan"
else
  fail "Tes render gagal."
fi
rm -rf "$T"

# Double-click launcher on the Desktop.
if [ -f "$APP/clipfactory.command" ]; then
  cp -f "$APP/clipfactory.command" "$HOME/Desktop/Clip Factory.command" 2>/dev/null \
    && chmod +x "$HOME/Desktop/Clip Factory.command" && ok "ikon 'Clip Factory' dibuat di Desktop"
fi

cat <<EOF

$(printf '\033[1;32m')SELESAI. Clip Factory siap dipakai.$(printf '\033[0m')

Cara pakai: double-click 'Clip Factory' di Desktop.
Browser terbuka di http://localhost:8765. Biarkan jendela Terminal-nya tetap terbuka.

Atau lewat Terminal:
  cd ~/impala-clip-factory && source .venv/bin/activate && python -m clipfactory web
EOF
