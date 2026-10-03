"""Draws textures/runner.png (6-frame run cycle) and textures/runnerJump.png
(1 frame) from ASCII pixel maps. They are catalog entries: make-textures.py
lists them (ORIGINAL) and check-textures.mjs gates them. Original art, no source image is read.
Frames are 24x24 (a 12x12 grid at 2x) so they draw 1:1 into the runner's
24x24 player. Deterministic; re-run to regenerate."""
from PIL import Image
import os

PAL = {'.': None, 'B': (91, 170, 253), 'D': (47, 111, 184), 'L': (160, 208, 255),
       'W': (255, 255, 255), 'K': (30, 31, 41), 'O': (255, 184, 108)}

HEAD = [
    "...BBBBBB...",
    "..BLLBBBBB..",
    "..BBBBWWKB..",
    "..BBBBBBBBO.",
    "...BBBBBB...",
]
BODY = [
    "...DBBBBD...",
    "..DDBBBBDD..",
    "..D.BBBB.D..",
    "....DDDD....",
]
LEGS = {
    # contact, front leg reaching
    0: ["...DD..DD...", "..DD....DD..", ".DD......DD."],
    # down, weight on one leg
    1: ["....DD.DD...", "....DD.DD...", "....DD..DD.."],
    # passing, legs crossing under the body
    2: ["....DDDD....", ".....DD.....", "....DD.DD..."],
    # contact, other leg forward
    3: ["...DD..DD...", "..DD....DD..", "DD........DD"],
    # down
    4: ["...DD.DD....", "...DD.DD....", "..DD..DD...."],
    # passing
    5: ["....DDDD....", ".....DD.....", "...DD.DD...."],
}
BOB = {0: 0, 1: 1, 2: 0, 3: 0, 4: 1, 5: 0}  # body drops a pixel on the "down" frames
JUMP_LEGS = ["...DD..DD...", "....DDDD....", "............"]


def frame(legs, bob):
    rows = HEAD + BODY + legs
    # bob: shift the upper body down one row, dropping the last leg row
    if bob:
        rows = ["............"] + rows[:-1]
    img = Image.new("RGBA", (24, 24), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            c = PAL[ch]
            if c:
                for dy in (0, 1):
                    for dx in (0, 1):
                        img.putpixel((x * 2 + dx, y * 2 + dy), c + (255,))
    return img


here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "textures")
sheet = Image.new("RGBA", (24 * 6, 24), (0, 0, 0, 0))
for i in range(6):
    sheet.paste(frame(LEGS[i], BOB[i]), (i * 24, 0))
sheet.save(os.path.join(out, "runner.png"))
frame(JUMP_LEGS, 0).save(os.path.join(out, "runnerJump.png"))
