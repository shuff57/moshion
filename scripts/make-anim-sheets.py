"""Draws the built-in ANIMATED textures that are moved versions of single tiles:
a spinning coin, a blinking heart, a heart losing half, a jumping player, a
sparkling gem, a waving flag, a flickering torch, a twinkling star and a boom.

Each one starts from a tile make-textures.py already cut out of Kenney's
Pixel Redux sheet (CC0 1.0, see that script) and moves it: squash and stretch,
a narrower copy for a coin's edge, a white flash, a column-by-column wave.
No other source image is read, so the provenance is the same as the tile's.

Output: textures/<name>.png, a horizontal strip of 21x21 frames,
the same strip addAni()/saveTexture() slice, so `sprite.texture = 'coinSpin'`
just plays. make-textures.py lists every name below in ORIGINAL (group,
frames, hold) and writes the manifest; check-textures.mjs gates them.

Order matters: run make-textures.py once first (it writes the base
tiles), then this, then make-textures.py again (manifest).
Deterministic; re-run to regenerate.

Run:  python scripts/make-anim-sheets.py
"""

import math
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "textures")
T = 21
WHITE = (255, 255, 255)


def load(name):
    return Image.open(os.path.join(OUT, f"{name}.png")).convert("RGBA")


def blank():
    return Image.new("RGBA", (T, T), (0, 0, 0, 0))


def scaled(im, sx, sy, anchor="center"):
    """The tile's drawn part resized by (sx, sy) with hard pixels, kept centred
    (or standing on the same bottom row with anchor='bottom')."""
    l, t, r, b = im.getbbox()
    part = im.crop((l, t, r, b))
    w = max(1, round((r - l) * sx))
    h = max(1, round((b - t) * sy))
    part = part.resize((w, h), Image.Resampling.NEAREST)
    out = blank()
    x = round((l + r) / 2 - w / 2)
    y = (b - h) if anchor == "bottom" else round((t + b) / 2 - h / 2)
    out.alpha_composite(part, (max(0, min(T - w, x)), max(0, min(T - h, y))))
    return out


def tint(im, rgb, amount):
    """Every drawn pixel moved `amount` of the way to rgb (a flash)."""
    out = im.copy()
    px = out.load()
    for y in range(T):
        for x in range(T):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (
                    round(r + (rgb[0] - r) * amount),
                    round(g + (rgb[1] - g) * amount),
                    round(b + (rgb[2] - b) * amount),
                    a,
                )
    return out


def faded(im, alpha):
    out = im.copy()
    px = out.load()
    for y in range(T):
        for x in range(T):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (r, g, b, round(a * alpha))
    return out


def darkest(im):
    """The darkest drawn colour, for a coin seen edge-on."""
    cols = [p for p in im.getdata() if p[3]]
    return min(cols, key=lambda p: p[0] + p[1] + p[2])


def strip(frames):
    s = Image.new("RGBA", (T * len(frames), T), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.alpha_composite(f, (i * T, 0))
    return s


# ---- the animations ---------------------------------------------------------

def coin_spin(base):
    """Full face, narrower, narrower, edge-on, then the narrow copies mirrored:
    reads as a coin turning round."""
    im = load(base)
    l, t, r, b = im.getbbox()
    edge = blank()
    cx = (l + r) // 2
    dark = darkest(im)
    for y in range(t + 1, b - 1):
        edge.putpixel((cx - 1, y), dark)
        edge.putpixel((cx, y), dark)
    narrow = scaled(im, 0.62, 1)
    thin = scaled(im, 0.3, 1)
    return [im, narrow, thin, edge, thin.transpose(Image.Transpose.FLIP_LEFT_RIGHT), narrow.transpose(Image.Transpose.FLIP_LEFT_RIGHT)]


def heart_blink():
    """Full heart and a white flash: low health, or 'you were hit'."""
    h = load("heart")
    return [h, tint(h, WHITE, 0.75)]


def heart_lose():
    """Full heart flashes twice, then shows half. Plays on a loop like every
    animation, so a game shows it for 6 frames x 10 ticks, then sets 'heartHalf'."""
    h, half = load("heart"), load("heartHalf")
    flash = tint(h, WHITE, 0.75)
    return [h, flash, h, flash, half, half]


def player_jump(base):
    """Stand, crouch, stretch up, legs tucked, stretch, land squashed."""
    p = load(base)
    l, t, r, b = p.getbbox()
    crouch = scaled(p, 1.1, 0.8, "bottom")
    stretch = scaled(p, 0.8, 1.0, "bottom")
    # Legs tucked: the body without its two rows of feet, lifted to the top.
    tuck = blank()
    tuck.alpha_composite(p.crop((0, 0, T, b - 2)), (0, 0))
    land = scaled(p, 1.2, 0.75, "bottom")
    return [p, crouch, stretch, tuck, stretch, land]


def gem_sparkle(base):
    """A white twinkle grows and goes at the top left, then a smaller one at
    the bottom right."""
    g = load(base)
    l, t, r, b = g.getbbox()

    def with_twinkle(cx, cy, size):
        f = g.copy()
        pts = [(0, 0)]
        if size >= 2:
            pts += [(1, 0), (-1, 0), (0, 1), (0, -1)]
        if size >= 3:
            pts += [(2, 0), (-2, 0), (0, 2), (0, -2)]
        for dx, dy in pts:
            x, y = cx + dx, cy + dy
            if 0 <= x < T and 0 <= y < T:
                f.putpixel((x, y), (255, 255, 255, 255))
        return f

    tl = (l + 3, t + 2)
    br = (r - 4, b - 6)
    return [
        g,
        with_twinkle(*tl, 1),
        with_twinkle(*tl, 2),
        with_twinkle(*tl, 3),
        with_twinkle(*tl, 2),
        g,
        with_twinkle(*br, 1),
        with_twinkle(*br, 2),
    ]


def flag_wave(base):
    """Kenney's pole, and a cloth drawn fresh in the flag's own two colours: a
    pennant (8 rows tall at the pole, 5 at the tip) whose columns ride a sine
    wave travelling outward. Shifting Kenney's own notched cloth column by column
    tore it, so only its colours are kept."""
    f = load(base)
    pole_right = 4  # columns 0..3 are the pole (and its ball) in Kenney's flags
    px = f.load()
    from collections import Counter
    cloth = Counter(px[x, y] for y in range(T) for x in range(pole_right, T) if px[x, y][3])
    (main, _), (light, _) = sorted(cloth.items(), key=lambda kv: -kv[1])[:2]
    if sum(main[:3]) > sum(light[:3]):
        main, light = light, main
    length = 15
    frames = []
    for k in range(4):
        out = blank()
        out.alpha_composite(f.crop((0, 0, pole_right, T)), (0, 0))
        for i in range(length):
            x = pole_right + i
            if x >= T:
                break
            amp = min(1.0, i / 4)
            dy = round(amp * math.sin(2 * math.pi * (i / 12 - k / 4)))
            h = round(8 - 3 * i / (length - 1))
            top = 3 + dy + (8 - h) // 2
            for y in range(top, top + h):
                out.putpixel((x, y), light if y == top else main)
        frames.append(out)
    return frames


def torch_flicker():
    """The flame's tip leans left, stands, leans right, and its yellow core
    grows a pixel, so the flame dances while the handle stays still."""
    t = load("torch")
    px = t.load()
    flame = [(x, y) for y in range(T) for x in range(T) if px[x, y][3] and px[x, y][:3] in ((255, 153, 0), (255, 204, 0))]
    top = min(y for _, y in flame)
    tip_rows = range(top, top + 3)

    def lean(dx):
        out = t.copy()
        o = out.load()
        for y in tip_rows:
            row = [(x, px[x, y]) for x in range(T) if (x, y) in flame]
            for x, _ in row:
                o[x, y] = (0, 0, 0, 0)
            for x, c in row:
                if 0 <= x + dx < T:
                    o[x + dx, y] = c
        return out

    core = t.copy()
    c = core.load()
    for x, y in flame:
        if y == top + 4 and px[x, y][:3] == (255, 153, 0) and 0 < x < T - 1 and px[x - 1, y][:3] != (255, 204, 0):
            c[x, y] = (255, 204, 0, 255)
    return [t, lean(-1), core, lean(1)]


def star_twinkle():
    """Bright, normal, shrink, smaller, shrink back."""
    s = load("star")
    return [tint(s, WHITE, 0.3), s, scaled(s, 0.82, 0.82), scaled(s, 0.64, 0.64), scaled(s, 0.82, 0.82), s]


def boom():
    """A burst that grows from a spark and fades out. Plays on a loop like every
    animation, so remove the sprite after one play (6 frames x 6 ticks)."""
    b = load("burstOrange")
    return [
        scaled(b, 0.3, 0.3),
        scaled(b, 0.55, 0.55),
        scaled(b, 0.8, 0.8),
        b,
        faded(b, 0.6),
        faded(b, 0.25),
    ]


# name -> (frames). The group and the hold (ticks per frame) live in
# make-textures.py's ORIGINAL table, which builds the manifest.
SHEETS = {
    "coinSpin": lambda: coin_spin("coin"),
    "coinSilverSpin": lambda: coin_spin("coinSilver"),
    "coinBronzeSpin": lambda: coin_spin("coinBronze"),
    "heartBlink": heart_blink,
    "heartLose": heart_lose,
    "playerJump": lambda: player_jump("player"),
    "playerBlueJump": lambda: player_jump("playerBlue"),
    "playerPinkJump": lambda: player_jump("playerPink"),
    "playerYellowJump": lambda: player_jump("playerYellow"),
    "playerBeigeJump": lambda: player_jump("playerBeige"),
    "gemSparkle": lambda: gem_sparkle("gem"),
    "gemGreenSparkle": lambda: gem_sparkle("gemGreen"),
    "gemYellowSparkle": lambda: gem_sparkle("gemYellow"),
    "gemOrangeSparkle": lambda: gem_sparkle("gemOrange"),
    "flagWave": lambda: flag_wave("flag"),
    "flagGreenWave": lambda: flag_wave("flagGreen"),
    "flagRedWave": lambda: flag_wave("flagRed"),
    "flagBlueWave": lambda: flag_wave("flagBlue"),
    "torchFlicker": torch_flicker,
    "starTwinkle": star_twinkle,
    "boom": boom,
}


def main():
    for name, make in SHEETS.items():
        frames = make()
        for i, f in enumerate(frames):
            if not f.getbbox():
                raise SystemExit(f"{name} frame {i} is empty")
        strip(frames).save(os.path.join(OUT, f"{name}.png"), optimize=True)
        print(f"  {name:18} {len(frames)} frames")
    print(f"wrote {len(SHEETS)} animations; now run: python scripts/make-textures.py")


if __name__ == "__main__":
    main()
