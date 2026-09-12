listen:
	websocat -b ws://localhost:37812/audio \
	| pw-play --raw --format f32 --rate 48000 -
