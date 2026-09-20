#ifndef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 200112L
#endif

#ifndef _XOPEN_SOURCE
#define _XOPEN_SOURCE 700
#endif

void initAudioCapture(void);
void setAudioCaptureState(bool state);
void setLinkState(int nodeID, bool link);

typedef struct {
	int              node;
	int              ports[2];
	struct pw_proxy* links[2];

	char display[128];
	int  nameLen;

	bool running;

	struct spa_hook* listener;

} PWNode;

#if __INCLUDE_LEVEL__ == 0 /////////////////////////////////////////////////////

#include <err.h>
#include <pthread.h>
#include <strings.h>

#include <pipewire/pipewire.h>
#include <spa/param/audio/format-utils.h>

#define arrlen(x) (sizeof(x) / sizeof(*(x)))

extern char* program_invocation_short_name;
#define APP_NAME program_invocation_short_name

#define log(fmt, ...)                                                          \
	fprintf(                                                                   \
		stderr, "%s: %s:%d: " fmt "\n", APP_NAME, __FILE__,                    \
		__LINE__ __VA_OPT__(, ) __VA_ARGS__                                    \
	)

void Broadcast(char* data, uint32_t length);
void Targets(PWNode* targets, size_t length);

static pthread_barrier_t barrier;

static struct {
	struct pw_thread_loop* thread_loop;
	struct pw_loop*        main_loop;
	struct pw_context*     context;
	struct pw_core*        core;
	struct pw_registry*    registry;
	struct pw_stream*      stream;
} PW;

static PWNode stream = {.node = -1};

static PWNode targets[1024];
static size_t targetsLen = 0;

static void targetsSync(void) {
	Targets(targets, targetsLen);
}

static PWNode* targetByID(int id) {
	for(size_t i = 0; i < targetsLen; i++) {
		PWNode* it = &targets[i];
		if(it->node == id) return it;
	}

	return NULL;
}

static int targetComp(const void* v1, const void* v2) {
	return strcasecmp(((PWNode*) v1)->display, ((PWNode*) v2)->display);
}

static void targetsSort(void) {
	qsort(targets, targetsLen, sizeof(*targets), targetComp);
}

static void targetAdd(PWNode node) {
	if(targetsLen >= arrlen(targets)) errx(1, "too many target nodes!");
	targets[targetsLen++] = node;
	targetsSort();
	targetsSync();
}

static void targetDel(int id) {
	PWNode* it = targetByID(id);

	if(it == NULL) return;

	free(it->listener);

	memcpy(it, &targets[--targetsLen], sizeof(*it));
	targetsSort();
	targetsSync();
}

static void on_node_info(void*, const struct pw_node_info* info) {
	PWNode* node = targetByID(info->id);
	if(node == NULL) {
		errx(1, "unreachable: node info for unregistered node %d", info->id);
	}

	node->running = info->state == PW_NODE_STATE_RUNNING;

	const char* mediaName = spa_dict_lookup(info->props, PW_KEY_MEDIA_NAME);
	if(mediaName != NULL) {
		char buf[sizeof(node->display)] = {0};
		snprintf(
			buf, sizeof(buf), "%.*s: %s", //
			node->nameLen, node->display, mediaName
		);
		strncpy(node->display, buf, sizeof(node->display));
	}

	targetsSync();
}

static void on_registry_event(
	void*, uint32_t id, uint32_t, const char* type, uint32_t version,
	const struct spa_dict* props
) {
	if(strcmp(type, PW_TYPE_INTERFACE_Node) == 0) {
		if(stream.node == -1 && PW.stream != NULL &&
		   (stream.node = pw_stream_get_node_id(PW.stream)) != -1) {
			pthread_barrier_wait(&barrier);
		}

		const char* mediaClass = NULL;
		if((mediaClass = spa_dict_lookup(props, PW_KEY_MEDIA_CLASS)) &&
		   strcmp(mediaClass, "Stream/Output/Audio") == 0) {
			PWNode target = {
				.node     = id,
				.listener = malloc(sizeof(*target.listener)),
			};

			target.nameLen = snprintf(
				target.display, sizeof(target.display), "%s",
				spa_dict_lookup(props, PW_KEY_NODE_NAME)
			);

			targetAdd(target);

			struct pw_node* node =
				pw_registry_bind(PW.registry, id, type, version, 0);

			static struct pw_node_events node_events = {
				.version = PW_VERSION_NODE_EVENTS,
				.info    = on_node_info,
			};

			pw_node_add_listener(node, target.listener, &node_events, NULL);
		}
	} else if(strcmp(type, PW_TYPE_INTERFACE_Port) == 0) {
		int         nodeID = atoi(spa_dict_lookup(props, PW_KEY_NODE_ID));
		size_t      portID = atoi(spa_dict_lookup(props, PW_KEY_PORT_ID));
		const char* dir    = spa_dict_lookup(props, PW_KEY_PORT_DIRECTION);

		if(nodeID == stream.node && strcmp(dir, "in") == 0) {
			if(portID >= arrlen(stream.ports)) {
				errx(1, "unreachable: got stream port ID %zu", portID);
			}

			stream.ports[portID] = id;
			pthread_barrier_wait(&barrier);
		} else if(strcmp(dir, "out") == 0) {
			PWNode* target = targetByID(nodeID);
			if(target == NULL) return;

			if(portID >= arrlen(target->ports)) {
				warnx(
					"ignoring high port %d.%zu for node %d!", //
					id, portID, nodeID
				);
			} else {
				target->ports[portID] = id;
			}
		}
	}
}

static void on_registry_remove(void*, uint32_t id) {
	targetDel(id);
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
	log("state %s -> %s (%s)", //
	    streamStateShow(old), streamStateShow(new), error);
}

static void on_data(void*) {
	struct pw_buffer* buffer = pw_stream_dequeue_buffer(PW.stream);
	if(buffer == NULL) errx(1, "buffer is null!");

	struct spa_data data = buffer->buffer->datas[0];
	if(data.data == NULL) errx(1, "data is null!");
	if(data.chunk->offset != 0) errx(1, "data offset != 0");

	Broadcast(data.data, data.chunk->size);

	pw_stream_queue_buffer(PW.stream, buffer);
}

void initAudioCapture(void) {
	pthread_barrier_init(&barrier, NULL, 2);

	pw_init(NULL, NULL);

	PW.thread_loop = pw_thread_loop_new("pipewire", NULL);
	PW.main_loop   = pw_thread_loop_get_loop(PW.thread_loop);
	PW.context     = pw_context_new(PW.main_loop, NULL, 0);
	PW.core        = pw_context_connect(PW.context, NULL, 0);

	////////////////////////////////////////////////////////////////////////////////

	PW.registry = pw_core_get_registry(PW.core, PW_VERSION_REGISTRY, 0);

	static struct spa_hook registry_listener = {0};

	static struct pw_registry_events registry_events = {
		.version       = PW_VERSION_REGISTRY_EVENTS,
		.global        = on_registry_event,
		.global_remove = on_registry_remove,
	};

	pw_registry_add_listener(
		PW.registry, &registry_listener, &registry_events, NULL
	);

	////////////////////////////////////////////////////////////////////////////

	struct pw_properties* props = pw_properties_new(
		PW_KEY_MEDIA_TYPE, "Audio", //
		NULL
	);

	PW.stream = pw_stream_new(PW.core, "molecule", props);

	static struct spa_hook         listener = {0};
	static struct pw_stream_events events   = {
		  .version       = PW_VERSION_STREAM_EVENTS,
		  .state_changed = on_state,
		  .process       = on_data,
    };

	pw_stream_add_listener(PW.stream, &listener, &events, NULL);

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
		PW.stream, PW_DIRECTION_INPUT, PW_ID_ANY,
		0                                //
			| PW_STREAM_FLAG_MAP_BUFFERS //
			| PW_STREAM_FLAG_RT_PROCESS  //
		,
		params, 1
	);

	pw_stream_set_active(PW.stream, false);

	////////////////////////////////////////////////////////////////////////////

	pw_thread_loop_start(PW.thread_loop);
	pthread_barrier_wait(&barrier); // wait for stream node ID
	pthread_barrier_wait(&barrier); // wait for stream port 0
	pthread_barrier_wait(&barrier); // wait for stream port 1
	log(
		"got stream ID %d %d %d", //
		stream.node,              //
		stream.ports[0],          //
		stream.ports[1]           //
	);
}

void setAudioCaptureState(bool state) {
	pw_thread_loop_lock(PW.thread_loop);
	pw_stream_set_active(PW.stream, state);
	pw_thread_loop_unlock(PW.thread_loop);
}

void setLinkState(int nodeID, bool link) {

	PWNode* node = targetByID(nodeID);
	if(node == NULL) return;

	for(;;) {
		if(node->ports[0] != 0 && node->ports[1] != 0) break;

		struct timespec wait = {.tv_nsec = 1000 * 1000};
		nanosleep(&wait, NULL);
	}

	pw_thread_loop_lock(PW.thread_loop);

	if(link) {
		for(size_t portID = 0; portID < arrlen(node->ports); portID++) {
			if(node->links[portID] != NULL) continue;

			struct pw_properties* props = pw_properties_new_string("");
			pw_properties_setf(
				props, PW_KEY_LINK_OUTPUT_PORT, "%u", node->ports[portID]
			);
			pw_properties_setf(
				props, PW_KEY_LINK_INPUT_PORT, "%u", stream.ports[portID]
			);

			node->links[portID] = pw_core_create_object(
				PW.core, "link-factory", PW_TYPE_INTERFACE_Link,
				PW_VERSION_LINK, &props->dict, 0
			);

			pw_properties_free(props);
		}
	} else {

		for(size_t portID = 0; portID < arrlen(node->ports); portID++) {
			struct pw_proxy** link = &node->links[portID];
			if(*link != NULL) {
				pw_proxy_destroy(*link);
				*link = NULL;
			}
		}
	}

	pw_thread_loop_unlock(PW.thread_loop);
}

#endif

#ifndef CGO

int main(void) {
	initAudioCapture();
	pause();
}

void Broadcast(char*, uint32_t len) {
	log("got data %u", len);
}

void Targets(PWNode* targets, size_t length) {
	log("↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓");
	for(size_t i = 0; i < length; i++) {
		PWNode it = targets[i];
		log("%s%d %s [%d %d][m",       //
		    it.running ? "" : "[2;3m", //
		    it.node, it.display, it.ports[0], it.ports[1]);
	}
	log("↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑");
}

#endif
