#!/bin/bash
# Double-click to start Clip Factory in your browser (http://localhost:8765).
cd "$HOME/impala-clip-factory" || { echo "Folder ~/impala-clip-factory tidak ada. Jalankan setup_mac.sh dulu."; read -r; exit 1; }
export PATH="$HOME/bin:/Library/Frameworks/Python.framework/Versions/3.12/bin:$PATH"
source .venv/bin/activate || { echo "Belum terpasang. Jalankan setup_mac.sh dulu."; read -r; exit 1; }
echo "Clip Factory jalan. Biarkan jendela ini terbuka; tutup untuk berhenti."
python -m clipfactory web
