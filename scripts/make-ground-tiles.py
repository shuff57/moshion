"""Draws assets/ground_tile.png (16x16 seamless stone/dirt) and
assets/grass_tile.png (16x16 seamless grassy top) from a seeded RNG.
Original art, no source image is read. Deterministic; re-run to regenerate."""
from PIL import Image
import os, random

def tile(base, shades, speck_n, seed, top=None):
    r = random.Random(seed)
    img = Image.new("RGBA", (16, 16), base + (255,))
    for _ in range(speck_n):
        x, y = r.randrange(16), r.randrange(16)
        c = r.choice(shades)
        img.putpixel((x, y), c + (255,))
        if r.random() < 0.5:                      # 2px specks read as grit, not noise
            img.putpixel(((x + 1) % 16, y), c + (255,))  # wraps -> seamless
    if top:
        for x in range(16):
            img.putpixel((x, 0), top[0] + (255,))
            img.putpixel((x, 1), top[1] + (255,))
    return img

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
# stone: close in value to the game's #333844 so it stays quiet behind the action
tile((51, 56, 68), [(60, 66, 80), (43, 47, 58), (70, 77, 94)], 26, 7).save(os.path.join(out, "ground_tile.png"))
# platform: same stone, lit top edge
tile((51, 56, 68), [(60, 66, 80), (43, 47, 58)], 14, 11, top=((152, 195, 121), (98, 140, 80))).save(os.path.join(out, "grass_tile.png"))
