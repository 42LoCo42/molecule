package main

// #cgo pkg-config: libpipewire-0.3
// #include "pipewire.c"
import "C"

import (
	"log"
	"net/http"
	"sync"
	"unsafe"

	"github.com/gorilla/websocket"
)

type Client struct {
	conn *websocket.Conn
	send chan []byte
}

var queue = make(chan []byte, 256)
var clients = make(map[*Client]any)
var clientsMu sync.RWMutex

func main() {
	C.foo()
	go BroadcastLoop()

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			log.Printf("origin: %v", r.Header.Get("origin"))
			return true
		},
	}

	http.HandleFunc("/audio", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("websocket upgrade failed: %v", err)
			return
		}

		client := new(Client{
			conn: conn,
			send: make(chan []byte, 16),
		})

		clientsMu.Lock()
		clients[client] = struct{}{}
		clientsMu.Unlock()

		go client.WriteLoop()
		client.ReadLoop()
	})

	log.Print("start!")
	log.Fatal(http.ListenAndServe(":37812", nil))
}

//export Broadcast
func Broadcast(data *C.uchar, length C.int) {
	payload := C.GoBytes(unsafe.Pointer(data), length)

	select {
	case queue <- payload:
	default:
	}
}

func BroadcastLoop() {
	for data := range queue {
		clientsMu.RLock()

		for c := range clients {
			select {
			case c.send <- data:
			default:
				log.Print("disconnecting slow client")
				go c.Remove()
			}
		}

		clientsMu.RUnlock()
	}
}

func (c *Client) ReadLoop() {
	defer c.Remove()

	for {
		if _, _, err := c.conn.ReadMessage(); err != nil {
			return
		}
	}
}

func (c *Client) WriteLoop() {
	defer c.Remove()

	for data := range c.send {
		if err := c.conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
			return
		}
	}
}

func (c *Client) Remove() {
	clientsMu.Lock()

	if _, ok := clients[c]; ok {
		delete(clients, c)
		close(c.send)
		c.conn.Close()
	}

	clientsMu.Unlock()
}
