export class Track {
	constructor(
		public stream: MediaStream,
		public kind: "audio" | "video",
		public sender: string,
	) {}
}
