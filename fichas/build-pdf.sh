#!/usr/bin/env bash
# Gera o PDF a partir do HTML de origem usando o Chromium headless,
# que respeita as regras @media print e @page do próprio arquivo.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$DIR/pre-fermentos-teste-qt.html"
OUT="$DIR/QT-ensaio-pre-fermentos.pdf"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

CHROME="${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"

# O HTML de origem é fragmento (serve também como Artifact), então
# embrulhamos em um documento completo antes de imprimir.
{
  printf '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
  printf '<style>html,body{margin:0;padding:0}</style></head><body>'
  cat "$SRC"
  printf '</body></html>'
} > "$TMP/print.html"

"$CHROME" \
  --headless \
  --disable-gpu \
  --no-sandbox \
  --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw \
  --virtual-time-budget=10000 \
  --print-to-pdf="$OUT" \
  "file://$TMP/print.html" 2>/dev/null

echo "PDF gerado: $OUT"
