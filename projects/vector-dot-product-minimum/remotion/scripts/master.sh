#!/usr/bin/env bash
# Loudness-master a rendered MP4 to -16 LUFS / -1.5 dBTP (video stream copied untouched).
set -euo pipefail
in="$1"; out="${2:-${1%.mp4}_master.mp4}"
ffmpeg -v error -y -i "$in" -c:v copy -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k "$out"
ffmpeg -i "$out" -af ebur128 -f null - 2>&1 | grep -A1 "Integrated loudness" | tail -1
echo "$out"
