#ifndef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 200112L
#endif

#ifndef _XOPEN_SOURCE
#define _XOPEN_SOURCE 700
#endif

void initAudioCapture(void);
void setAudioCaptureState(bool state);

#if __INCLUDE_LEVEL__ == 0

#include <err.h>
#include <pthread.h>

#include <pipewire/pipewire.h>
#include <spa/param/audio/format-utils.h>

void Broadcast(char* data, uint32_t length);

static pthread_barrier_t      barrier;
static int                    targetNode = -1;
static struct pw_thread_loop* thread_loop;
static struct pw_stream*      stream;

static void on_registry_event(
	void*, uint32_t id, uint32_t, const char* type, uint32_t,
	const struct spa_dict* props
) {
	const char* mediaClass = NULL;

	if(targetNode == -1 &&                                          //
	   strcmp(type, PW_TYPE_INTERFACE_Node) == 0 &&                 //
	   (mediaClass = spa_dict_lookup(props, PW_KEY_MEDIA_CLASS)) && //
	   strcmp(mediaClass, "Audio/Sink") == 0) {
		targetNode = id;
		pthread_barrier_wait(&barrier);
	}
}

static const char* streamStateShow(enum pw_stream_state state) {
	switch(state) {
	case PW_STREAM_STATE_ERROR:
		return "error";
	case PW_STREAM_STATE_UNCONNECTED:
		return "unconnected";
	case PW_STREAM_STATE_CONNECTING:
		return "connecting";
	case PW_STREAM_STATE_PAUSED:
		return "paused";
	case PW_STREAM_STATE_STREAMING:
		return "streaming";
	}

	return "invalid";
}

static void on_state(
	void*, enum pw_stream_state old, enum pw_stream_state new, const char* error
) {
	printf(
		"state %s -> %s (%s)\n", streamStateShow(old), streamStateShow(new),
		error
	);
}

static void on_data(void* arg) {
	struct pw_stream* stream = arg;

	struct pw_buffer* buffer = pw_stream_dequeue_buffer(stream);
	if(buffer == NULL) errx(1, "buffer is null!");

	struct spa_data data = buffer->buffer->datas[0];
	if(data.data == NULL) errx(1, "data is null!");
	if(data.chunk->offset != 0) errx(1, "data offset != 0");

	Broadcast(data.data, data.chunk->size);

	pw_stream_queue_buffer(stream, buffer);
}

void initAudioCapture(void) {
	pthread_barrier_init(&barrier, NULL, 2);

	pw_init(NULL, NULL);

	thread_loop                  = pw_thread_loop_new("pipewire", NULL);
	struct pw_loop*    main_loop = pw_thread_loop_get_loop(thread_loop);
	struct pw_context* context   = pw_context_new(main_loop, NULL, 0);
	struct pw_core*    core      = pw_context_connect(context, NULL, 0);

	////////////////////////////////////////////////////////////////////////////////

	struct pw_registry* registry =
		pw_core_get_registry(core, PW_VERSION_REGISTRY, 0);

	static struct spa_hook registry_listener = {0};

	static struct pw_registry_events registry_events = {
		.version = PW_VERSION_REGISTRY_EVENTS,
		.global  = on_registry_event,
	};

	pw_registry_add_listener(
		registry, &registry_listener, &registry_events, NULL
	);

	////////////////////////////////////////////////////////////////////////////

	pw_thread_loop_start(thread_loop);

	puts("waiting for an Audio/Sink node to appear...");
	pthread_barrier_wait(&barrier);
	printf("got node %d\n", targetNode);

	////////////////////////////////////////////////////////////////////////////

	pw_thread_loop_lock(thread_loop);

	char node[128] = {0};
	snprintf(node, sizeof(node), "%d", targetNode);

	struct pw_properties* props = pw_properties_new(
		PW_KEY_MEDIA_TYPE, "Audio", //
		PW_KEY_TARGET_OBJECT, node, NULL
	);

	stream = pw_stream_new(core, "molecule", props);

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

	pw_stream_set_active(stream, false);
	pw_thread_loop_unlock(thread_loop);
}

void setAudioCaptureState(bool state) {
	pw_thread_loop_lock(thread_loop);
	pw_stream_set_active(stream, state);
	pw_thread_loop_unlock(thread_loop);
}

#endif

#ifndef CGO

int main(void) {
	initAudioCapture();

	bool state = false;
	for(;;) {
		getchar();
		state ^= true;
		printf("enabled %d\n", state);
		setAudioCaptureState(state);
	}
}

void Broadcast(char*, uint32_t len) {
	printf("got data %u\n", len);
}

#endif
