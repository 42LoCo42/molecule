#!/usr/bin/env python3
from os.path import dirname
from sys import argv

from fontTools.subset import Subsetter
from fontTools.ttLib import TTFont

font = TTFont(argv[1])

REPL = 0xFFFD  # unicode replacement character "�"

subsetter = Subsetter()
subsetter.populate(unicodes=(list(range(32, 128)) + [REPL]))
subsetter.subset(font)

glyphs = font["glyf"].glyphs
for table in font["cmap"].tables:
    if table.isUnicode():
        repl = table.cmap.get(REPL)
        if repl != None:
            glyphs[".notdef"] = glyphs[repl]
            break

font.save(argv[2])
