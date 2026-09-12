preview:
	# without the experimental hyper bundler of death, some fucking ?worker import
	# deep in element-call just decides to fuck me in the ass and break everything
	# thank you javascript, so cool, best fullstack language 10/10 would buy again
	pnpm vite --experimentalBundle

listen:
	websocat -b ws://localhost:37812/audio \
	| pw-play --raw --format f32 --rate 48000 -
