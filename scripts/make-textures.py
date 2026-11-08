"""Slice moSHion's built-in texture catalog out of Kenney's Pixel Redux sheet.

`sprite.texture = 'crate'` resolves a NAME, not a URL. The names below are the
whole catalog: each one is a 21x21 tile cut from the packed tilemap that ships
in scripts/assets/kenney-pixel-redux/.

Provenance, because this repo has been burned once already (see
docs/LICENSE.md section 4 -- the assets/ directory held art
byte-identical to q5play's while the license claimed it as original work):

  Pack     Kenney, "Platformer Art: Pixel Redux", created 2020-04-22
  License  CC0 1.0 Universal -- the pack's own License.txt says "free to use
           in personal, educational and commercial projects"
  Source   github.com/ETdoFresh/kenney.nl/platformerart_pixelredux_2
  Sheet    Tilemap/tilemap_packed.png, sha256 883071fc...99bdc78, 630x630
  Layout   30x30 grid of 21x21 tiles, row-major; tile index N is at
           (N % 30, N // 30). Verified against the pack's own Tiles/tile_NNNN.png
           -- tile_0000.png is byte-identical to the slice at index 0.

Nothing here is redrawn or modified: each output PNG is an exact crop. CC0
imposes no attribution requirement, but the pack's License.txt is vendored
beside the sheet anyway so the provenance travels with the bytes.

Adding a texture: add a name -> tile index below and re-run. To find an index,
crop the sheet with a labelled grid -- index = row * 30 + col.

Run:  python scripts/make-textures.py
"""

import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, "assets", "kenney-pixel-redux", "tilemap_packed.png")
LICENSE = os.path.join(HERE, "assets", "kenney-pixel-redux", "License.txt")
OUT = os.path.join(HERE, "..", "textures")

TILE = 21
GRID = 30

# name -> tile index. Grouped the way the docs page groups them; the group
# names are cosmetic here but the picker in the app reads them from the
# generated manifest, so keep a texture in the group a student would look in.
CATALOG = {
    "characters": {
        "player": 19,
        "playerBlue": 49,
        "playerPink": 79,
        "playerYellow": 109,
        "playerBeige": 139,
    },
    "pickups": {
        "coin": 78,
        "coinSilver": 77,
        "coinBronze": 76,
        "star": 106,
        "heart": 373,
        "heartHalf": 374,
        "gem": 379,
        "gemGreen": 377,
        "gemYellow": 376,
        "gemOrange": 378,
        "key": 14,
        "keyGreen": 15,
        "keyBlue": 45,
        "keyOrange": 44,
    },
    "blocks": {
        "crate": 192,
        "crateX": 191,
        "block": 130,
        "door": 167,
        "torch": 316,
        "bomb": 257,
        "mushroom": 108,
        "mushroomBrown": 107,
        "cactus": 18,
        "exitSign": 253,
    },
    "creatures": {
        "slime": 260,
        "slimeBlue": 290,
        "bee": 354,
        "bat": 441,
        "ghost": 445,
        "fish": 350,
        "fishPink": 380,
        "bird": 410,
        "snail": 414,
        "ladybug": 475,
        "worm": 294,
        "frog": 418,
        "monster": 718,
    },
    # Added 2026-11-07 for shCode's Library built-in packs (its board games and
    # Quest): ground to build levels and boards from, signs and switches,
    # gear for a battle, effects, digits for a score or a die, and candy.
    "terrain": {
        "grass": 122,
        "sand": 2,
        "snow": 62,
        "stone": 301,
        "brick": 693,
        "brickTan": 690,
        "water": 11,
        "waterDeep": 40,
        "lava": 13,
        "lavaDeep": 42,
        "ice": 490,
        "spikes": 70,
        "tree": 673,
        "bush": 46,
        "rock": 48,
    },
    "things": {
        "flag": 310,
        "flagGreen": 311,
        "flagRed": 312,
        "flagBlue": 313,
        "sign": 254,
        "signArrow": 255,
        "lock": 194,
        "lockGreen": 195,
        "spring": 284,
        "lever": 250,
        "apple": 506,
    },
    "battle": {
        "sword": 713,
        "swordGold": 714,
        "shield": 715,
        "shieldSilver": 716,
        "shieldGold": 717,
        "blaster": 706,
        "burst": 866,
        "burstGreen": 867,
        "burstOrange": 896,
        "burstBlue": 897,
    },
    "numbers": {
        "num0": 434, "num1": 435, "num2": 436, "num3": 437, "num4": 438,
        "num5": 439, "num6": 463, "num7": 464, "num8": 465, "num9": 466,
    },
    "candy": {
        "candyOrange": 623,
        "candyGreen": 624,
        "candyYellow": 625,
        "swirl": 626,
        "swirlMint": 596,
    },
}


# Animations built from consecutive Kenney tiles: name -> (tile indices, hold).
# Each output is a horizontal strip of exact 21x21 crops, the same strip
# addAni()/saveTexture() slice, so `sprite.texture = 'batFly'` just moves.
# Colour variants of the astronaut sit 30 tiles (one sheet row) apart.
WALK = [26, 28, 27, 28]            # step, neutral, other step, neutral
ANIMATED = {
    "creatures": {
        "batFly": ([441, 442, 443, 442], 6),
        "beeFly": ([354, 355, 356, 355], 5),
        "fishSwim": ([350, 351, 352, 351], 8),
        "ladybugWalk": ([475, 476, 477, 476], 8),
        "snailCrawl": ([414, 415, 416, 415], 14),
    },
    "characters": {
        "playerWalk": ([i + 0 for i in WALK], 8),
        "playerBlueWalk": ([i + 30 for i in WALK], 8),
        "playerPinkWalk": ([i + 60 for i in WALK], 8),
        "playerYellowWalk": ([i + 90 for i in WALK], 8),
        "playerBeigeWalk": ([i + 120 for i in WALK], 8),
    },
}

# Original art (NOT Kenney): drawn by make-runner-sheet.py into this directory.
# name -> (group, frames, hold, frame size in px). The PNGs must already exist; the checker
# verifies each is `frames` tiles wide.
ORIGINAL = {
    "runner": ("characters", 6, 4, 24),
    "runnerJump": ("characters", 1, 4, 24),
}


def main():
    sheet = Image.open(SHEET).convert("RGBA")
    if sheet.size != (TILE * GRID, TILE * GRID):
        raise SystemExit(f"unexpected sheet size {sheet.size}; expected 630x630")

    os.makedirs(OUT, exist_ok=True)
    written = []
    for group, tiles in CATALOG.items():
        for name, index in tiles.items():
            col, row = index % GRID, index // GRID
            tile = sheet.crop(
                (col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE)
            )
            # A fully transparent crop means the index points at an empty cell
            # -- an off-by-one in the table, which is silent otherwise: the
            # texture loads fine and the sprite just draws nothing.
            if not tile.getbbox():
                raise SystemExit(f"tile {index} ({name}) is empty -- wrong index?")
            path = os.path.join(OUT, f"{name}.png")
            tile.save(path, optimize=True)
            written.append((group, name, index))

    anim_meta = {}
    for group, anims in ANIMATED.items():
        for name, (indices, hold) in anims.items():
            strip = Image.new("RGBA", (TILE * len(indices), TILE), (0, 0, 0, 0))
            for k, index in enumerate(indices):
                col, row = index % GRID, index // GRID
                t = sheet.crop((col * TILE, row * TILE, (col + 1) * TILE, (row + 1) * TILE))
                if not t.getbbox():
                    raise SystemExit(f"tile {index} ({name}) is empty -- wrong index?")
                strip.paste(t, (k * TILE, 0))
            strip.save(os.path.join(OUT, f"{name}.png"), optimize=True)
            written.append((group, name, indices[0]))
            anim_meta[name] = (len(indices), hold, TILE)
    for name, (group, frames, hold, size) in ORIGINAL.items():
        path = os.path.join(OUT, f"{name}.png")
        if not os.path.exists(path):
            raise SystemExit(f"{name}.png missing -- run scripts/make-runner-sheet.py first")
        written.append((group, name, -1))
        anim_meta[name] = (frames, hold, size)

    with open(LICENSE, "r", encoding="utf-8") as fh:
        license_text = fh.read()
    with open(os.path.join(OUT, "LICENSE.txt"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(license_text)

    # Two shapes of the same manifest, because they have two consumers with
    # incompatible needs:
    #
    #   textures.json  the app (a React picker) fetches it -- async is fine
    #   textures.js    runner.html loads it as a <script> BEFORE moshion.js
    #
    # The .js form is the load-bearing one. `sprite.texture = 'crate'` is a
    # synchronous property setter, so the catalog has to already be in memory
    # when a sketch's setup() runs -- a fetch() would resolve a frame or two
    # too late and the first draw would silently miss.
    manifest = {
        "tile": TILE,
        "source": "Kenney -- Platformer Art: Pixel Redux (CC0 1.0)",
        "base": "textures/",
        "groups": {
            group: sorted(
                list(CATALOG.get(group, {})) + list(ANIMATED.get(group, {}))
                + [n for n, (g, _, _, _) in ORIGINAL.items() if g == group]
            )
            for group in CATALOG
        },
        "textures": {
            name: dict(
                {"file": f"{name}.png", "w": anim_meta.get(name, (1, 0, TILE))[2] * anim_meta.get(name, (1, 0, TILE))[0], "h": anim_meta.get(name, (1, 0, TILE))[2], "group": group},
                **({"frames": anim_meta[name][0], "frameDelay": anim_meta[name][1]} if anim_meta.get(name, (1,))[0] > 1 else {}),
            )
            for group, name, _ in written
        },
    }
    blob = json.dumps(manifest, indent=2, sort_keys=False)
    with open(os.path.join(OUT, "textures.json"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(blob + "\n")
    with open(os.path.join(OUT, "textures.js"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(
            "/* GENERATED by scripts/make-textures.py -- do not edit.\n"
            " * Loaded by runner.html before moshion.js so `sprite.texture = name`\n"
            " * can resolve synchronously. See that script for provenance. */\n"
            "window.MOSHION_TEXTURES = " + blob + ";\n"
        )

    print(f"wrote {len(written)} textures to textures/")
    for group in CATALOG:
        names = [n for g, n, _ in written if g == group]
        print(f"  {group:12} {len(names):2}  {' '.join(names)}")
    print("  + textures.json, textures.js, LICENSE.txt")
    print("\nnow run: node scripts/check-textures.mjs")


if __name__ == "__main__":
    main()
