package main

import (
	"github.com/gorilla/websocket"
)

type Client struct {
	Conn          *websocket.Conn
	Send          chan []byte
	Clients       *Clients
	ControlsAudio bool
	OnMessage     func(msg []byte)
}

func (c *Client) ReadLoop() {
	defer c.Remove()

	for {
		_, msg, err := c.Conn.ReadMessage()
		if err != nil {
			return
		}

		if c.OnMessage != nil {
			c.OnMessage(msg)
		}
	}
}

func (c *Client) WriteLoop() {
	defer c.Remove()

	for data := range c.Send {
		if err := c.Conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
			return
		}
	}
}

func (c *Client) Register() {
	c.Clients.Mutex.Lock()
	c.Clients.Entries[c] = struct{}{}
	c.Clients.Mutex.Unlock()

	go c.ReadLoop()
	go c.WriteLoop()
}

func (c *Client) Remove() {
	c.Clients.Mutex.Lock()

	if _, ok := c.Clients.Entries[c]; ok {
		delete(c.Clients.Entries, c)
		close(c.Send)
		c.Conn.Close()

		if c.ControlsAudio {
			SetAudioCaptureState(len(c.Clients.Entries) > 0)
		}
	}

	c.Clients.Mutex.Unlock()
}
