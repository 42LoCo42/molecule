#!/usr/bin/env bash
dir="$(dirname "$0")"
pnpm -C "$dir" exec vite build
cd "$dir/dist/assets" || exit 1
rm -v           \
  ./*.{mp3,ogg} \
  Logo-*        \
  matrix_sdk_*  \
  rust-crypto-*
