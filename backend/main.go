package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gorilla/websocket"
)

const usage = `molecule: usage:
  -g, --gomuks:  What address to contact gomuks on?
  -l, --listen:  What address to listen on?
      --version: Print version and exit.
`

var version = "dev"

func main() {
	var gomuksAddr string
	flag.StringVar(&gomuksAddr, "g", "", "")
	flag.StringVar(&gomuksAddr, "gomuks", "http://localhost:29325", "")

	var listenAddr string
	flag.StringVar(&listenAddr, "l", "", "")
	flag.StringVar(&listenAddr, "listen", ":37812", "")

	var printVersion bool
	flag.BoolVar(&printVersion, "version", false, "")

	flag.Usage = func() { fmt.Print(usage) }
	flag.Parse()

	if printVersion {
		fmt.Printf("molecule %v\n", version)
		return
	}

	InitAudioCapture()

	go audioClients.BroadcastLoop()
	go controlClients.BroadcastLoop()

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	gomuksURL, err := url.Parse(gomuksAddr)
	if err != nil {
		log.Fatal(err)
	}

	gomuksProxy := httputil.NewSingleHostReverseProxy(gomuksURL)

	frontend := http.StripPrefix("/room", http.FileServer(http.FS(Frontend())))

	http.HandleFunc("/molecule/audio", func(w http.ResponseWriter, r *http.Request) {
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

	http.HandleFunc("/molecule/control", func(w http.ResponseWriter, r *http.Request) {
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

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Embedder-Policy", "credentialless")
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")

		if strings.HasPrefix(r.URL.Path, "/room") {
			frontend.ServeHTTP(w, r)
		} else {
			gomuksProxy.ServeHTTP(w, r)
		}
	})

	log.Print("start!")
	log.Fatal(http.ListenAndServe(listenAddr, nil))
}
