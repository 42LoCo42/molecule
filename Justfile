frontend:
	pnpm -C frontend exec vite

backend:
	go -C backend run .

listen:
	websocat -b ws://localhost:37812/audio \
	| pw-play --raw --format f32 --rate 48000 -

font:
	./frontend/subset.py $IOSEVKA frontend/iosevka.ttf
	woff2_compress frontend/iosevka.ttf

dist:
	./frontend/build.sh

backend-test:
	#!/usr/bin/env bash
	tmp="$(mktemp -d)"
	cc                                                \
		-std=c23 -Wall -Wextra                        \
		$(pkg-config --cflags --libs libpipewire-0.3) \
		backend/pipewire.c -o "$tmp/molecule"
	"$tmp/molecule"
