#include <assert.h>

void foo(void);

#if __INCLUDE_LEVEL__ == 0

#include <err.h>

#include <pipewire/pipewire.h>
#include <spa/param/audio/format-utils.h>

void Broadcast(char* data, uint32_t length);

void on_state(
	void* data, enum pw_stream_state old, enum pw_stream_state state,
	const char* error
) {
	printf("state %d -> %d (%s)\n", old, state, error);
}

void on_data(void* arg) {
	struct pw_stream* stream = arg;

	struct pw_buffer* buffer = pw_stream_dequeue_buffer(stream);
	if(buffer == NULL) errx(1, "buffer is null!");

	struct spa_data data = buffer->buffer->datas[0];
	if(data.data == NULL) errx(1, "data is null!");
	if(data.chunk->offset != 0) errx(1, "data offset != 0");

	Broadcast(data.data, data.chunk->size);

	pw_stream_queue_buffer(stream, buffer);
}

void foo(void) {
	pw_init(NULL, NULL);

	struct pw_thread_loop* thread_loop = pw_thread_loop_new("pipewire", NULL);
	struct pw_loop*        main_loop   = pw_thread_loop_get_loop(thread_loop);
	struct pw_context*     context     = pw_context_new(main_loop, NULL, 0);
	struct pw_core*        core        = pw_context_connect(context, NULL, 0);

	struct pw_properties* props = pw_properties_new(
		PW_KEY_MEDIA_TYPE, "Audio", //
		NULL
	);

	struct pw_stream* stream = pw_stream_new(core, "molecule", props);

	static struct spa_hook         listener = {0};
	static struct pw_stream_events events   = {
		  .version       = PW_VERSION_STREAM_EVENTS,
		  .state_changed = on_state,
		  .process       = on_data,
    };

	pw_stream_add_listener(stream, &listener, &events, stream);

	uint8_t buffer[1024] = {0};

	struct spa_pod_builder builder =
		SPA_POD_BUILDER_INIT(buffer, sizeof(buffer));

	const struct spa_pod* params[1] = {
		spa_format_audio_raw_build(
			&builder, SPA_PARAM_EnumFormat,
			&SPA_AUDIO_INFO_RAW_INIT(
					.format   = SPA_AUDIO_FORMAT_F32_LE, //
					.channels = 2,                       //
					.rate     = 48000,                   //
			)
		),
	};

	pw_stream_connect(
		stream, PW_DIRECTION_INPUT, PW_ID_ANY,
		0                                //
			| PW_STREAM_FLAG_MAP_BUFFERS //
			| PW_STREAM_FLAG_RT_PROCESS  //
			| PW_STREAM_FLAG_AUTOCONNECT //
		,
		params, 1
	);

	pw_thread_loop_start(thread_loop);
}

#endif

#ifdef TEST

int main(void) {
	foo();
	pause();
}

#endif
