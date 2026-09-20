_help:
	just --list

# run a development instance of the frontend
frontend:
	pnpm -C frontend exec vite

# run the backend aka system audio capture daemon
backend:
	go -C backend run .

# listen to what the backend is currently recording
listen:
	websocat -b ws://localhost:37812/audio \
	| pw-play --raw --format f32 --rate 48000 -

# subset & compress Iosevka for the frontend
font:
	./frontend/subset.py $IOSEVKA frontend/iosevka.ttf
	woff2_compress frontend/iosevka.ttf

# bundle the frontend for use with Caddy
dist:
	./frontend/build.sh

# test the pipewire interaction layer
backend-test:
	#!/usr/bin/env bash
	tmp="$(mktemp -d)"
	cc                                                \
		-std=c23 -Wall -Wextra                        \
		$(pkg-config --cflags --libs libpipewire-0.3) \
		backend/pipewire.c -o "$tmp/molecule"
	"$tmp/molecule"
