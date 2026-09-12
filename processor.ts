class PcmPlayerProcessor extends AudioWorkletProcessor {
	constructor() {
		super();

		this.queue = [];
		this.readIndex = 0;
		this.started = false;

		this.port.onmessage = (event) => {
			if (event.data.type === "pcm") {
				this.queue.push(event.data.samples);
			}

			if (this.queue.length >= 3) {
				this.started = true;
			}
		};
	}

	process(_, outputs) {
		const output = outputs[0];

		if (!this.started || this.queue.length === 0) {
			for (const channel of output) {
				channel.fill(0);
			}
			return true;
		}

		const left = output[0];
		const right = output[1];

		for (let i = 0; i < left.length; i++) {
			const current = this.queue[0];
			const frameCount = current.length / 2;

			left[i] = current[this.readIndex * 2];
			right[i] = current[this.readIndex * 2 + 1];

			this.readIndex++;

			if (this.readIndex >= frameCount) {
				this.queue.shift();
				this.readIndex = 0;
			}
		}

		return true;
	}
}

registerProcessor("pcm-player", PcmPlayerProcessor);
