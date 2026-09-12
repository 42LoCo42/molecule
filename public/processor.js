class PcmPlayerProcessor extends AudioWorkletProcessor {
	constructor(options) {
		super();

		const { sampleRate, samples, indexes } = options.processorOptions;

		this.sampleRate = sampleRate;
		this.samples = new Float32Array(samples);
		this.indexes = new Int32Array(indexes);
	}

	process(_, outputs) {
		const output = outputs[0];

		const left = output[0];
		const right = output[1];

		const write = Atomics.load(this.indexes, 0);
		let read = Atomics.load(this.indexes, 1);
		let avail = write - read;

		for (let i = 0; i < left.length; i++) {
			if (avail > 0) {
				const frameIndex = read % this.sampleRate;
				const sampleIndex = frameIndex * 2;

				left[i] = this.samples[sampleIndex];
				right[i] = this.samples[sampleIndex + 1];

				read++;
				avail--;
			} else {
				left[i] = 0;
				right[i] = 0;
			}
		}

		Atomics.store(this.indexes, 1, read);
		return true;
	}
}

registerProcessor("pcm-player", PcmPlayerProcessor);
