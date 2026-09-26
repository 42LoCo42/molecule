//go:build release

package main

import (
	"embed"
	"io/fs"
	"log"
)

//go:embed dist
var frontend embed.FS

func Frontend() fs.FS {
	subtree, err := fs.Sub(frontend, "dist")
	if err != nil {
		log.Fatal(err)
	}

	return subtree
}
