package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

func main() {
	InitAudioCapture()

	go audioClients.BroadcastLoop()
	go controlClients.BroadcastLoop()

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	http.HandleFunc("/audio", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade failed: %v", err)
			return
		}

		new(Client{
			Conn:          conn,
			Send:          make(chan []byte, 16),
			Clients:       &audioClients,
			ControlsAudio: true,
		}).Register()

		SetAudioCaptureState(true)
	})

	http.HandleFunc("/control", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade failed: %v", err)
			return
		}

		client := new(Client{
			Conn:          conn,
			Send:          make(chan []byte, 16),
			Clients:       &controlClients,
			ControlsAudio: false,
			OnMessage:     OnControl,
		})

		client.Register()
		client.Conn.WriteMessage(websocket.BinaryMessage, lastTargets)
	})

	log.Print("start!")
	log.Fatal(http.ListenAndServe(":37812", nil))
}
