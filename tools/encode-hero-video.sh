#!/usr/bin/env bash
# Converts the CLEAN (watermark-free) export into the 4 hero video files.
# Usage: ./encode-hero-video.sh original.mp4
set -euo pipefail
IN="$1"; OUT="assets/video"; mkdir -p "$OUT"
# Desktop 1920 wide, ~15 s max, no audio
ffmpeg -y -i "$IN" -t 15 -an -vf "scale=1920:-2,fps=30" -c:v libvpx-vp9 -b:v 2.5M -row-mt 1 "$OUT/hero.webm"
ffmpeg -y -i "$IN" -t 15 -an -vf "scale=1920:-2,fps=30" -c:v libx264 -profile:v high -crf 23 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT/hero.mp4"
# Mobile: centre-cropped portrait-friendly 720 wide
ffmpeg -y -i "$IN" -t 15 -an -vf "crop=ih*9/16*1.6:ih,scale=720:-2,fps=30" -c:v libvpx-vp9 -b:v 1M -row-mt 1 "$OUT/hero-mobile.webm"
ffmpeg -y -i "$IN" -t 15 -an -vf "crop=ih*9/16*1.6:ih,scale=720:-2,fps=30" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT/hero-mobile.mp4"
ls -lh "$OUT"
