#!/usr/bin/env python3
"""Build the ScoutKit custom icon font (`scoutkit-icons`).

The Scout core font (`scoutIcons`) ships no plus-in-circle or trash-can glyph, but the project
action-icon rule (CLAUDE.md) requires them (new -> plus-circle, delete -> trash; edit reuses the
built-in `icons.PENCIL`). This generates `apps/web/res/fonts/scoutkit-icons.woff` with those two
glyphs at private-use codepoints, so they can be referenced as `font:scoutkit-icons <char>` via the
constants in `apps/web/src/main/Icons.ts`.

Glyph outlines are FontAwesome Free 5 *solid* paths (icons licensed CC BY 4.0,
https://fontawesome.com/license/free). Run: `python3 apps/web/scripts/build-icon-font.py`
(needs `pip install fonttools brotli`). The emitted .woff is committed; re-run only to change glyphs.
"""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
import os

UPM = 512
ASCENT = 448
DESCENT = -64

# (codepoint, glyph name, viewBox width, FontAwesome 5 solid path 'd')
GLYPHS = [
    (0xE900, "plusCircle", 512,
     "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm144 276c0 6.6-5.4 "
     "12-12 12h-92v92c0 6.6-5.4 12-12 12h-56c-6.6 0-12-5.4-12-12v-92h-92c-6.6 0-12-5.4-12-12v-56c0"
     "-6.6 5.4-12 12-12h92v-92c0-6.6 5.4-12 12-12h56c6.6 0 12 5.4 12 12v92h92c6.6 0 12 5.4 12 12v56z"),
    (0xE901, "trash", 448,
     "M432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 "
     "0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16zM53.2 467a48 48 0 "
     "0 0 47.9 45h245.8a48 48 0 0 0 47.9-45L416 128H32z"),
]

def build_glyph(width, d):
    pen = TTGlyphPen(None)
    # SVG is y-down; flip to font y-up (y' = ASCENT - y) and center horizontally in the UPM box.
    dx = (UPM - width) / 2.0
    tpen = TransformPen(Cu2QuPen(pen, max_err=1.0, reverse_direction=True), (1, 0, 0, -1, dx, ASCENT))
    parse_path(d, tpen)
    return pen.glyph()

glyph_order = [".notdef"] + [name for _, name, _, _ in GLYPHS]
glyphs = {".notdef": TTGlyphPen(None).glyph()}
metrics = {".notdef": (UPM, 0)}
cmap = {}
for cp, name, width, d in GLYPHS:
    glyphs[name] = build_glyph(width, d)
    metrics[name] = (UPM, 0)
    cmap[cp] = name

fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder(glyph_order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
fb.setupNameTable({"familyName": "scoutkit-icons", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=ASCENT, sTypoDescender=DESCENT, usWinAscent=ASCENT, usWinDescent=-DESCENT)
fb.setupPost()

out = os.path.join(os.path.dirname(__file__), "..", "res", "fonts", "scoutkit-icons.woff")
out = os.path.normpath(out)
fb.font.flavor = "woff"
fb.save(out)
print("wrote", out, "glyphs:", ", ".join(f"{name}=U+{cp:04X}" for cp, name, _, _ in GLYPHS))
