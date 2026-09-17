package main

import (
	"log"
	"sync"
)

type Clients struct {
	Queue   chan []byte
	Entries map[*Client]any
	Mutex   sync.RWMutex
}

var (
	audioClients   = NewClients()
	controlClients = NewClients()
)

func NewClients() Clients {
	return Clients{
		Queue:   make(chan []byte, 256),
		Entries: map[*Client]any{},
	}
}

func (c *Clients) BroadcastLoop() {
	for data := range c.Queue {
		c.Mutex.RLock()

		for c := range c.Entries {
			select {
			case c.Send <- data:
			default:
				log.Print("disconnecting slow client")
				go c.Remove()
			}
		}

		c.Mutex.RUnlock()
	}
}
