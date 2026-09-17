package main

import (
	"encoding/json"
	"log"
)

type Control struct {
	Node int  `json:"node"`
	Link bool `json:"link"`
}

func OnControl(msg []byte) {
	control := Control{}
	if err := json.Unmarshal(msg, &control); err != nil {
		log.Printf("invalid control message: %v", string(msg))
		return
	}

	SetLinkState(control.Node, control.Link)
}
