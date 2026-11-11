# moSHion

**moSHion** is a beginner-friendly 2D game engine for the web: a simple drawing
canvas with **real Box2D physics** (via [planck.js][]) in one API. It was built
for the [shCode](https://github.com/shuff57/shCode) high-school JavaScript
course, where students write sprites-and-physics games in a sandboxed iframe.

The whole API is a handful of globals — `Sprite`, `Group`, `world`, `camera`,
`kb`, `mouse`. No imports, no install, no build step. Write `setup()` and
`draw()`, and the engine runs them for you.

```js
// A ball that bounces
function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10; // ≈ 1g (gravity starts at 0, so nothing falls without this)
  ball = new Sprite(200, 50, 30);
  ball.bounciness = 0.9;
}

function draw() {
  background('#111');
  fill('white');
}
```

## Try it

Open **[the live demo](https://shuff57.github.io/moshion/)** — it embeds the
runner in a sandboxed iframe, exactly the way a host app is meant to.

## Use it in your own page

moSHion runs inside a host iframe. The host loads `runner.html` with a
**sandboxed iframe without `allow-same-origin`** — student/visitor code then
runs in an opaque origin and cannot touch your app:

```html
<iframe sandbox="allow-scripts allow-downloads"
        src="https://shuff57.github.io/moshion/runner.html"></iframe>
```

The frame posts `{source: 'preview-storage-request'}` to its parent; the host
answers `{source: 'preview-storage-init', data: <store>, code: <sketch>}`. One
handshake carries both the save store and the sketch, and the sketch never
touches the URL — a full sketch base64s to ~17KB and GitHub Pages (Varnish)
answers `414 Error: URI Too Long` past a ~6.1KB request line. A host that
skips the bridge gets an empty store after 400ms; `?code=<base64url>` still
works as a fallback for small sketches. Inside the sketch you get the full
global API ([`docs/moshion.d.ts`](docs/moshion.d.ts) is the complete,
full global API ([`docs/moshion.d.ts`](docs/moshion.d.ts) is the complete,
hand-authored reference):

- `setup()` / `update()` / `draw()` / `drawTop()` — the lifecycle hooks the
  engine calls. `drawTop()` runs after sprites are drawn, in screen space, so
  a HUD lands on top of the world instead of behind it
- `text()` with `fill()` / `textSize()` / `textAlign()` / `textLayer()` —
  text drawn in `draw()` sits under every sprite; after `textLayer(n)` it is
  painted among them instead, over sprites whose `.layer` is `n` or lower and
  under higher ones (`textLayer()` with nothing goes back)
- `Canvas`, `Sprite`, `Group`, `allSprites` — drawing + physics. Setting a
  sprite's `w`/`h` resizes its collider too, and a group setting
  (`enemies.color = 'red'`) reaches the members it already has as well as
  new ones
- `Tiles` (a level built from rows of text and a legend of groups), `Walls`
  (static walls round the canvas edges), `sprite.addSensor()` (a detect-only
  box, e.g. a ground sensor)
- `every(frames, fn)` / `after(frames, fn)` — frame timers
- `world`, `camera` — gravity, hit-testing, viewport, ray casts
  (`world.rayCast(x1, y1, x2, y2)` with no callback returns the closest solid
  hit, or null); `world.origin = 'math'`
  for centre-origin, y-up coordinates (see Coordinates below), with
  `showGrid()` / `showMouse()` to label whichever mode is active
- `kb`, `mouse` — input with edge-triggered events (`kb.presses('w')`,
  `mouse.presses('right')`; with no button a mouse verb means any button). A
  single touch drives the same `mouse` properties, so a pointer sketch works
  on a phone unchanged (no right-button equivalent: a second finger is ignored)
- Joints: `HingeJoint`, `DistanceJoint`, `SliderJoint`, `WheelJoint`,
  `GrabberJoint` (`grab.target = mouse` drags), `GlueJoint`
- `angleMode(DEGREES)` — makes `cos`/`sin`/`atan2` use degrees, like every
  sprite angle already does (radians stay the default)
- The game runs 60 frames a second on any screen: a 120 or 144 Hz monitor
  does not speed it up. `runner.html` seeds `random()` fresh each run;
  `randomSeed(n)` makes a run repeatable
- `storeItem`/`getItem` — saves, bridged to the host page via postMessage
  (works even in opaque-origin iframes)
- `loadSound` — a path or a data: URI loads that file; a bare code-safe name is
  looked up first in the store under `sound:<name>`, so a host page can save a
  wave and a sketch can play it by name

### Sound saved by name

`loadSound('jump.wav')` loads a file, exactly as before. `loadSound('zap')`
first looks for a saved sound in the moSHion store under `sound:zap`; a host
page can write one with `storeItem('sound:zap', dataUri)` (a WAV data: URI).
If nothing is saved, the name is used as a URL. This is how a host-side sound
editor can hand a student's own effect to a sketch without an upload. The store
is the same one `storeItem`/`getItem` use, including the preview bridge.

## Coordinates

By default moSHion uses **screen** coordinates: `(0, 0)` is the top-left corner
of the canvas, x grows to the right and y grows **down**, like the browser canvas
and p5play. Every sketch that never mentions `world.origin` runs exactly as it
always has.

A sketch can ask for the grid from math class instead:

```js
function setup() {
  new Canvas(400, 300);
  world.origin = 'math';   // first line after the canvas, before any sprite
  world.gravity.y = -10;   // y points up now, so a falling world is negative
  ball = new Sprite(0, 100, 30);   // (0, 0) is the centre; this is 100 above it
}

function draw() {
  background('#111');
  showGrid(50);   // labelled axes, so students can see where (0, 0) is
  showMouse();    // prints the pointer's (x, y) beside it
}
```

In **math** mode `(0, 0)` is the **centre** of the canvas, y grows **up**, and a
positive rotation turns counter-clockwise from the +x axis. Every number keeps
its meaning but points the math way: `vel.y = 5` moves up, `direction = 90`
points up, `camera` starts at `(0, 0)`, `Tiles` still puts its first row at the
top of the screen, `Walls.top` is still the wall above the screen, and text and
pictures still read upright. `showGrid(step)` and `showMouse()` work in both
modes and label whichever one is active, so the same two lines tell the truth
in a default sketch too (0,0 at the top-left, y labels growing downward).

`world.origin` accepts only `'screen'` and `'math'` (anything else throws a
TypeError naming both) and must be set before the first sprite, before gravity
and before the first frame; nothing already in the world is converted, so a late
change throws instead of moving things.

Console output and runtime errors are piped to the host with `postMessage`
(`source: 'preview-console'` / `'preview-error'`), so hosts can show them in
their own console pane. Hosts answer a `preview-storage-request` message with
`preview-storage-init` to provide the save store — or ignore it; the runner
starts after 400 ms with an empty store either way.

## In this repo

| File | Covers |
|---|---|
| `moshion.js` | The entire engine, hand-authored, no build step |
| `planck.min.js` | planck.js v1.5.0 (Box2D port), MIT, vendored |
| `runner.html` | Sandboxed iframe host: loads the engine, takes the sketch over postMessage, pipes console/errors out |
| `index.html` | The homepage: a demo panel that runs any of the six games, plus an inline editor |
| `sandbox.html` | Live editor — write a sketch, hit Run, see it in the sandboxed iframe |
| `games/` | The six demo sketches (`portal`, `ray-siege`, `web-swinger`, `asteroids`, `platformer`, `runner`) |
| `tests/` | Playwright specs driving the real browser surface: `bun tests/<name>.spec.mjs` |
| `assets/` | Sprite-sheet art (regenerable via `scripts/make-runner-sheet.py` / `make-ground-tiles.py` here) plus the 8-bit sound palette: `coin.wav`, `music.wav`, `jump.wav`, `hit.wav`, `laser.wav`, `powerup.wav`, `explode.wav`, `blip.wav`, `select.wav`, `tone.wav`, `title.wav`, `win.wav`, `lose.wav`, and for board and battle games `dice.wav`, `step.wav`, `sword.wav`, `clang.wav`, `potion.wav`, `levelup.wav`, `crown.wav`, `whoosh.wav`, `pop.wav`, `door.wav` |
| `textures/` | The `sprite.texture = 'coin'` catalog: 40 CC0 pixel-art PNGs (Kenney) plus a generated manifest. Generated by `scripts/make-textures.py`, gated by `scripts/check-textures.mjs` |
| `scripts/` | Generators for `textures/` and the original art in `assets/` (`make-runner-sheet.py`, `make-ground-tiles.py`) |
| `docs/` | Full API types (`moshion.d.ts`), challenge ladder, architecture notes, license notes |

## Security model

- Sketches run in an **opaque origin**: the iframe must be embedded with
  `sandbox="allow-scripts allow-downloads"` and **without** `allow-same-origin`.
- `runner.html` refuses to execute `?code=` when opened as a top-level document
  (`window.top === window.self`). It is defence in depth behind the sandbox
  attribute — embedded, the sandbox is what contains the code; direct-open is
  refused so a link with code in the URL never runs on the app's own origin.
- The engine and runner are plain static files. There is no server, no
  telemetry, no CDN fetches.

## History

moSHion began life as an in-app engine for the shCode course. An early version
vendored [q5play](https://github.com/quinton-ashley/q5play) source and art;
that was removed and the engine rewritten as an original, license-clean facade
(2026-08-25). The public repo is a fresh-history extract of shCode's
`public/moshion/`.

## License

MIT — see [LICENSE](LICENSE). planck.min.js remains MIT under its own
copyright (see `docs/LICENSE.md` for the per-file notes).

[planck.js]: https://github.com/shakiba/planck.js