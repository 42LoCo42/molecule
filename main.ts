async function offerDance(src: RTCPeerConnection, dst: RTCPeerConnection) {
	const offer = await src.createOffer();
	await src.setLocalDescription(offer);
	await dst.setRemoteDescription(src.localDescription as RTCSessionDescription);

	const answer = await dst.createAnswer();
	await dst.setLocalDescription(answer);
	await src.setRemoteDescription(dst.localDescription as RTCSessionDescription);
}

(document.getElementById("startbtn") as HTMLButtonElement).onclick =
	async () => {
		const audioContext = new AudioContext({
			sampleRate: 48000,
		});

		await audioContext.audioWorklet.addModule("processor.js");
		await audioContext.resume();

		const player = new AudioWorkletNode(audioContext, "pcm-player", {
			numberOfInputs: 0,
			numberOfOutputs: 1,
			outputChannelCount: [2],
		});

		const destination = audioContext.createMediaStreamDestination();
		player.connect(destination);

		const socket = new WebSocket("ws://localhost:37812");
		socket.binaryType = "arraybuffer";

		socket.onmessage = async (event) => {
			const bytes = new Uint8Array(event.data);
			if (bytes.byteLength % 4 !== 0) return;

			const aligned = new ArrayBuffer(bytes.byteLength);
			new Uint8Array(aligned).set(bytes);

			const samples = new Float32Array(aligned);
			player.port.postMessage({ type: "pcm", samples }, [samples.buffer]);
		};

		const src = new RTCPeerConnection({
			iceServers: [
				{
					urls: [
						"stun:stun.l.google.com:19302",
						"stun:stun1.l.google.com:19302",
					],
				},
			],
		});

		const dst = new RTCPeerConnection({
			iceServers: [
				{
					urls: [
						"stun:stun.l.google.com:19302",
						"stun:stun1.l.google.com:19302",
					],
				},
			],
		});

		src.onicecandidate = ({ candidate }) => {
			if (candidate) {
				// console.log("src cand", candidate.toJSON());
				dst.addIceCandidate(candidate);
			}
		};

		dst.onicecandidate = ({ candidate }) => {
			if (candidate) {
				// console.log("dst cand", candidate.toJSON());
				src.addIceCandidate(candidate);
			}
		};

		dst.ontrack = async ({ track, streams }) => {
			console.log(track, streams);

			switch (track.kind) {
				case "audio":
					const audio = document.getElementById("audio") as HTMLAudioElement;
					audio.srcObject = streams[0] as MediaStream;
					break;

				case "video":
					const video = document.getElementById("video") as HTMLVideoElement;
					video.srcObject = streams[0] as MediaStream;
					// video.requestPictureInPicture();
					break;
			}
		};

		// system audio
		src.addTrack(
			destination.stream.getAudioTracks()[0] as MediaStreamTrack,
			destination.stream,
		);

		const userMedia = await navigator.mediaDevices.getUserMedia({
			audio: true, // microphone
			video: true, // webcam
		});

		src.addTrack(userMedia.getVideoTracks()[0] as MediaStreamTrack, userMedia);

		const displayMedia = await navigator.mediaDevices.getDisplayMedia({
			video: true, // screenshare
		});

		src.addTrack(
			displayMedia.getVideoTracks()[0] as MediaStreamTrack,
			displayMedia,
		);

		offerDance(src, dst);
	};
