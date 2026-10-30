#!/usr/bin/env bash
# Resizes + compresses images from ./generated/ into ./assets/img/photos/ (macOS, uses built-in `sips`).
# Name each generated image after its slot, e.g. generated/approach-1.png or generated/services/landscaping-pools-2.png
set -euo pipefail
SRC="generated"; DST="assets/img/photos"
[ -d "$SRC" ] || { echo "Create a '$SRC' folder next to this script and put your images in it."; exit 1; }
count=0
while IFS= read -r -d '' f; do
  rel="${f#$SRC/}"; name="${rel%.*}"
  out="$DST/$name.jpg"; mkdir -p "$(dirname "$out")"
  case "$name" in hero-*|feature-banner) w=1920;; *) w=1600;; esac
  sips -s format jpeg -s formatOptions 75 --resampleWidth "$w" "$f" --out "$out" >/dev/null
  printf '✓ %-55s %s\n' "$out" "$(du -h "$out" | cut -f1)"; count=$((count+1))
done < <(find "$SRC" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.heic' \) -print0)
echo "$count image(s) ready. Refresh the site to see them."
