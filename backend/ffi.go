package main

// #cgo CFLAGS: -std=c23 -DCGO -Wall -Wextra
// #cgo pkg-config: libpipewire-0.3
// #include "pipewire.c"
import "C"

import (
	"encoding/json"
	"log"
	"unsafe"
)

type Target struct {
	Node    int    `json:"node"`
	Name    string `json:"name"`
	Running bool   `json:"running"`
	Linked  bool   `json:"linked"`
}

var lastTargets []byte

////////////////////////////////////////////////////////////////////////////////

func InitAudioCapture() {
	C.initAudioCapture()
}

func SetAudioCaptureState(state bool) {
	C.setAudioCaptureState(C.bool(state))
}

func SetLinkState(node int, link bool) {
	C.setLinkState(C.int(node), C.bool(link))
}

////////////////////////////////////////////////////////////////////////////////

//export Broadcast
func Broadcast(data *C.uchar, length C.int) {
	payload := C.GoBytes(unsafe.Pointer(data), length)

	select {
	case audioClients.Queue <- payload:
	default:
	}
}

//export Targets
func Targets(list *C.PWNode, length C.size_t) {
	targets := []Target{}

	data := (*[1 << 28]C.PWNode)(unsafe.Pointer(list))[:length]
	for _, it := range data {
		target := Target{
			Node:    int(it.node),
			Name:    C.GoString((*C.char)(unsafe.Pointer(&it.display))),
			Running: bool(it.running),
			Linked:  it.links[0] != nil,
		}

		targets = append(targets, target)
	}

	payload, err := json.Marshal(targets)
	if err != nil {
		log.Fatalf("failed to marshal targets: %v", targets)
	}

	lastTargets = payload

	select {
	case controlClients.Queue <- payload:
	default:
	}
}
