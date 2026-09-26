//go:build !release

package main

import (
	"io/fs"
	"os"
)

func Frontend() fs.FS {
	return os.DirFS("../frontend/dist")
}
