# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
the moSHion engine in this repository.

## Repository layout

This is the in-repo source of the **moSHion** teaching engine — a small,
hand-authored JavaScript facade over [planck.js][] (a pure-JS/TS port of
Box2D). The engine has no build step, no bundler and no linter. The docs
have one small build (`node scripts/build-docs.mjs`, no dependencies), and the
tests are the Playwright spec suite under `tests/`.

- `moshion.js` (~5,400 lines) — the entire engine. Edit directly; do not split
  without discussion.
- `docs/moshion.d.ts` (~1,500 lines) — public API types. Keep in sync with
  runtime behavior in `moshion.js`. Every name's doc comment is also its line in
  the docs' generated API reference, so write it for a beginner.
- `docs/content/*.mjs` — THE docs, one file per section, every page with a
  permanent `id` (never rename one). `node scripts/build-docs.mjs` turns them,
  plus a reference generated from `docs/moshion.d.ts`, into
  `docs/data/moshion-docs.js`, which the docs site and shCode (through its
  `npm run sync:moshion`) both read. Never edit `docs/data/` by hand;
  `node scripts/build-docs.mjs --check` fails when it is stale.
- `planck.min.js` — vendored planck.js v1.5.0 (MIT). Do not edit.
- `runner.html` — sandbox host used by the app's preview iframes
  (`/moshion/runner.html`; the sketch rides the postMessage bridge, with
  `?code=<base64url>` as a small-sketch fallback).
- `index.html` / `sandbox.html` — the public homepage (demo panel) and the
  live editor. Both embed `runner.html` in a sandboxed iframe.
- `games/*.js` — the six demo sketches the homepage loads by `fetch`.
- `tests/*.spec.mjs` — browser specs driving the real surface (see Commands).
- `textures/` — the `sprite.texture = 'name'` catalog: 105 PNGs plus a
  generated `textures.json` / `textures.js`. **Generated, not hand-edited.**
  Regenerate with `python scripts/make-textures.py`; adding a texture means
  adding a name -> tile index there, never dropping a PNG in by hand.
  Third-party CC0 art (Kenney) -- see LICENSE.md section 5, not section 1.
  `scripts/check-textures.mjs` gates the pipeline, including that `runner.html`
  loads `textures.js` **before** `moshion.js` (the catalog must exist before a
  sketch runs -- `.texture` is a synchronous setter). `sprite.pattern` is a
  different thing: a repeating fill for big surfaces, taking a URL.
- `assets/` — sprite-sheet art for lesson examples, plus the 8-bit sound palette (`coin.wav`, `music.wav`, and the effect/menu cues).

## Commands

Each spec is a standalone script that serves the repo, drives a real Chromium
and prints `PASS`/`FAIL` per assertion (exit 0 only if all pass):

```sh
bun tests/api-audit.spec.mjs      # engine: sizes, group cascade, colliders, mouse buttons, sensors, hit-tests, joints, angleMode, 60fps cap, seeding
bun tests/raycast.spec.mjs        # engine: world.rayCast
bun tests/drawtop.spec.mjs        # engine: the drawTop() HUD hook
bun tests/textlayer.spec.mjs      # engine: textLayer(n), text() among the sprites by layer
bun tests/touch.spec.mjs          # engine: touch drives the mouse counters
bun tests/focus.spec.mjs          # engine: losing focus releases held keys/buttons
bun tests/clone-maxspeed.spec.mjs # engine: sprite.clone() and world.maxSpeed
bun tests/jumping.spec.mjs        # engine: sprite.jump(ground), maxJumps, jumpPower, jumpsLeft, onGround
bun tests/touch-controls.spec.mjs # games' own on-screen touch controls
bun tests/portal.spec.mjs         # games/portal.js
bun tests/ray-siege.spec.mjs      # games/ray-siege.js
bun tests/web-swinger.spec.mjs    # games/web-swinger.js
bun tests/starter-games.spec.mjs  # games/{asteroids,platformer,runner}.js
bun tests/integration.spec.mjs    # index.html demo panel
bun tests/viewport.spec.mjs       # the demo viewport shows the whole sketch
bun tests/docs.spec.mjs           # every example on the docs site actually runs
bun tests/docs-build.spec.mjs     # docs/data is built from docs/content; the reference lists every typed name
bun tests/council-fixes.spec.mjs  # engine: newSprite defaults, pressed/remove notes, text 0, vector assignment, rgba
bun tests/gaps.spec.mjs           # broadphase exactness, culling, square, Tiles, Walls, timers, addSensor
bun tests/math-origin.spec.mjs    # world.origin = 'math' (centre, y up) + showGrid/showMouse; default unchanged
bun tests/tiles-perf.bench.mjs    # NOT a spec: frame cost with 300..2400 tile sprites
```

`tests/harness.mjs`'s `serve()` caps the request line at 6KB — what production
actually accepts. GitHub Pages is fronted by Varnish, which 414s "Error:
URI Too Long" past ~6.1KB (measured 2026-09-28: 6.0KB served, 6.2KB 414'd).
That is not a theoretical cap: while the sketch travelled as `?code=`,
ray-siege, portal, web-swinger and asteroids all shipped broken while this
suite stayed green, because this file used to raise the cap to 1MB on the
belief that production had no limit. The source now rides the postMessage
bridge, so the cap only ever bites a regression — leave it tight.

There is no lint or typecheck script for the engine itself. The app's
TypeScript (`tsc --noEmit`) does not type-check `moshion.js` — it's plain JS
loaded in an iframe.

## Runtime architecture

moSHion is a standalone runtime: load `planck.min.js`, then `moshion.js`, then a
global-mode sketch with `setup()` / `update()` / `draw()`. The engine
auto-boots when it sees `window.setup` (deferred check via `setTimeout 0` so
script order doesn't matter).

The main loop (`start()` in `moshion.js`):

1. `setup()` runs once — must call `new Canvas(w, h)` or the engine throws.
2. Each frame: user `update(step)` → physics step → contact tracking →
   user `draw()` → render → user `drawTop()` → edge-trigger flags reset.

Key classes in `moshion.js` (search for the name; line numbers move):

- `Canvas` — creates the canvas element; sets `width`/`height` globals.
- `Sprite` — the heart of the engine. Constructor dispatch:
  `(x,y)` → 50×50 square, `(x,y,d)` → circle, `(x,y,w,h)` → rect,
  `(x,y,w,h,bodyType)` → rect + body type. Physics knobs (`bounciness`,
  `friction`, `shape`, `body`, `collider`) rebuild the planck fixture on
  change via `_buildFixture()`.
- `liveVec` — `pos`/`vel` are live proxy vectors that read/write the
  underlying planck body on every axis access, so `player.vel.x = 3` and
  `player.pos.y += 5` work like the reference API.
- `Ani` / `Anis` — minimal horizontal frame-strip animation.
  `addAni(name, sheetUrl, frameCount)`; first `addAni` auto-activates.
  `changeAni(name)` with an unregistered name changes nothing and warns once per name, listing the names the sprite has.
- `Group` `extends Array` — `new groupName.Sprite(...)` factory copies
  the group's own properties as defaults; `push()` tracks membership in
  `sprite._groups` so `sprite.delete()` can unparent everywhere.
- `allSprites` — implicit group every sprite auto-joins.
- `world` — `world.gravity` is a live proxy vector (raw Box2D m/s²,
  `y = 10` ≈ 1g); `world.getSpriteAt(x, y)` is a top-most layer hit-test.
  Gravity STARTS at 0, as in p5play (`_world()`): a plain
  `new Sprite()` stays put until a sketch sets `world.gravity.y`. It was 9.8
  until 2026-11-01; a sketch that relied on falling now needs its own
  `world.gravity.y = ...` line.
- `camera` — `camera.off()`/`on()` gate the transform that every
  drawing primitive applies for itself.
- `world.origin` — `'screen'` (default: top-left, y down) or `'math'`
  (centre, y up, counter-clockwise angles). See "Coordinates" below.
- Joints — thin facades over planck joints: `HingeJoint`,
  `DistanceJoint`, `SliderJoint`, `WheelJoint`, `GrabberJoint`, `GlueJoint`.
  All share `Joint.delete()`; there is no `joint.remove()`.
- Input — `kb.pressing`/`kb.presses`, `mouse.x/y`,
  `mouse.pressing`/`presses`/`released`. Edge flags reset AFTER the frame's
  update/draw ran (see the comment in `loop()` — reordering this breaks
  `presses()`).

### Coordinates (`world.origin`)

Default = **screen**: (0, 0) top-left, y down, like the browser canvas and
p5play. Opt-in = **math**: (0, 0) at the canvas centre, y up, angles
counter-clockwise. It is a mode, not a new default; no sketch that never sets
`world.origin` may change by a pixel (the 504-sketch shCode corpus was run on
both engines for 180 frames and compared op-for-op when the mode landed).

How it is built, and the rule for extending it: **the physics world is never
converted.** Box2D's own frame is already the math one (y up, CCW), and screen
mode has always drawn that frame onto a y-down canvas without flipping, which
is why `vel.y = 5` moves down there. Math mode changes only the canvas
transform (`_applyFrame()`: centre, `scale(1, -1)`) and flips text, emoji,
pictures and patterns back so they read upright. Every number the sketch sees
-- x/y, vel, rotation, direction, gravity, forces, joint anchors, ray casts,
mouse -- is a Box2D number shown the Box2D way round, so there is no sign to
get wrong twice. The places that have an opinion about which way is up are
each branched on `ORIGIN_` and listed at its declaration: `_applyFrame`,
`background`, `text`, `Sprite._draw`, `_cullView`, `_frameOrigin`
(canvasPos / screen-space hit-tests), `_pointerTo`, `Canvas`/`_parkCamera`,
`Tiles` (row direction), `Walls`, `Group.cull`, `_drawGrid`/`_drawMouse`. A
new feature that asks "which way is up" belongs on that list; one that only
moves or measures things does not need to know.

Consequences a lesson author relies on: a falling world is `gravity.y = -10`;
`direction = 90` and `vel.y > 0` go up; `Tiles` row 0 is still the top row
(y decreases per row); `Walls.top` is still above the screen (larger y);
`addSensor(0, -21, ...)` is the foot sensor; `rect(x, y, w, h)` covers
`y..y+h` (upward); `camera.off()`/`drawTop()`/`screenSpace` draw in the same
centred y-up frame with the camera at (0, 0), so `canvasPos` is "world minus
camera", not raw pixels. A sketch's own `sprite.draw` that writes to the
canvas context directly sees the flipped transform and must counter-flip its
own text and images (the primitives do it for them). `showGrid(step)` and
`showMouse()` paint in pixel space after `render()` and before `drawTop()`.

The setter refuses, with a plain message, any value but the two strings, and
any change once a sprite exists, gravity is non-zero or a frame has run.

### Key invariants when editing

- **The loop runs 60 game frames a second, not one per screen refresh.**
  `loop()` skips a requestAnimationFrame tick that arrives before the next
  frame is due, carrying the remainder (`behind`) so 144 Hz still averages 60.
  Every unit is per frame, so one frame per rAF ran a 144 Hz screen 2.4x fast.
  It never runs two frames in one tick: a slow machine slows down, as before.
- **`w`/`h` are accessors that rebuild the collider**, like `diameter`
  always was (they were plain fields, so the drawing and the collider could
  disagree). A size that cannot be a collider (0, NaN, Infinity) changes the
  drawing only; `_buildFixture()` keeps the last good size in `_physW/_physH`.
  Internally, write `_w/_h` when no rebuild is wanted (constructor, diameter).
- **Group properties cascade.** The names in `GROUP_CASCADE_` are accessors on
  `Group.prototype`: writing one sets every current member and records a
  default in `group._defaults`, which `new group.Sprite()` replays before the
  group's own enumerable fields (the made-up ones like `hp`). Position, motion
  and `life` are deliberately not on the list.
- **`collider` is the one body-type setting**; `body` and `physicsType` are
  aliases of it, and `_colliderName()` normalises/validates every spelling.
- **One walk for the touch verbs**: `Sprite.prototype._verb` (also used by
  `Sensor`) and `Group.prototype._verb`. A new verb is one line on each.
- **`random()`'s default seed is fixed** (headless harnesses replay a sketch
  byte for byte); `runner.html` reseeds it per run so players get fresh dice.

- **Units are pixels-per-frame for velocity, degrees-per-frame for angular
  velocity, raw Newtons for `applyForce`, raw m/s² for gravity.** The facade
  converts to Box2D meters behind the scenes (`PXM = 30` px/m, `FPS = 60`).
  Don't "unify" these — the px/frame convention is what the curriculum
  teaches (A10.2 asks students to compute px/s from vel.x).
- **`overlaps()` and `colliding()` are NOT aliases.** `overlaps()` is a manual
  bounding-box query (works for `collider = 'none'` sensors); `colliding()`
  reads planck's real contact list and excludes sensor fixtures. See
  `_updateContacts()`. `overlaps()` is a QUERY, not p5play's
  pass-through rule: calling it once in setup() changes nothing. A fixture
  made by `addSensor()` carries its `Sensor` as fixture user data (no other
  fixture has any), and `_updateContacts()` routes sensor contacts to it only
  while `SENSORS_` is non-empty.
- **The overlap broadphase must stay EXACT.** `_updateOverlaps()` hands only
  the pairs `_overlapCandidates()` lets through to `_overlapsOne()`; a pair it
  drops must be one `_overlapsOne()` could never pass (its boxes are inclusive
  and padded, because the circle test counts exact touching), and it returns
  null (test every pair) for a non-stock `_overlapsOne`/`_bounds`, a non-finite
  edge, or a small world. `tests/gaps.spec.mjs` P1 compares `overlapping()`
  with `overlaps()` for every pair, every frame; a strict broadphase fails it.
- **Culling skips only the stock `_draw()`.** A sketch's `sprite.draw` always
  runs, `ani` always advances, and nothing is culled unless the context is
  untransformed at render time and has `getTransform()` (the shCode node
  harness's stub has none, so it never culls there).
- **`group.remove(sprite)` only unparents** — the sprite keeps existing,
  drawing, and running physics, and the console warns once (`_warnOnce`)
  because a beginner writing `coins.remove(c)` means destroy. `sprite.delete()`
  (alias `remove()`) is full destruction: destroys the body and unparents from
  every group. `kb.pressed`/`mouse.pressed` warn once the same way (they are
  up-edge aliases of `released()`, as in p5play).
- **`sprite.image` heuristic:** a string with no `.` is an emoji placeholder
  (`'🧍'`), anything else is an image URL. Mutually exclusive with an active
  `ani`.
- **`DistanceJoint.length` is settable post-construction** and wakes both
  bodies (planck doesn't wake on joint property changes — a settled body
  would keep its old separation forever).
- **`render()` runs AFTER the user's `draw()`**, so anything a sketch draws
  with primitives lands UNDERNEATH every sprite. That is what `drawTop()`
  exists for: it runs after `render()`, with the camera off for its duration
  and restored afterwards, which is exactly what a HUD wants. Before it
  existed, portal's left wall ate the first two letters of its timer and the
  floor hid its control hint completely. `camera.off()` alone fixes the
  position, not the z-order. Every demo in `games/` draws its HUD in
  `drawTop()`; a sprite-based HUD (`screenSpace = true`) still works and is
  still the answer when the HUD *is* a sprite.
- **Pointer coords are divided by the canvas's displayed scale.** A host may
  show the canvas at a size other than its backing store, so `_pointerTo()`
  converts through `CANVAS_.width / rect.width`. It is a no-op at 1:1.
  Without it, aiming on a scaled canvas lands short of the cursor by exactly
  the scale factor. `runner.html` shrinks a sketch to fit its frame always,
  and scales one UP only when asked with `?fit=1` — opt-in, so the sandbox
  still shows a student's `new Canvas(200, 200)` at 200x200 rather than
  blowing it up. The homepage panel asks for it; sandbox and docs do not.
- **A single touch drives the left-mouse counters**, so `mouse.x`,
  `mouse.presses()` and friends work on a phone without a sketch changing a
  line. Three things about the handlers are load-bearing, in order of how
  quietly they break:
  1. `touchstart` sets the POSITION before the press counter. A tap carries
     both in one event with no hover first, so a sketch that aims on
     `presses()` otherwise reads the previous tap — or (0, 0) on the first.
  2. Both touch handlers call `preventDefault()` (hence `{ passive: false }`).
     Without it the browser replays the gesture as synthetic mouse events
     ~300ms later, pressing everything twice, and scrolls the page under the
     sketch. Note `tests/touch.spec.mjs` asserts `defaultPrevented` rather
     than the replay: Playwright's touchscreen never emits it, so a
     press-counting check stays green with the `preventDefault()` deleted.
  3. `touchend`/`touchcancel` are on `window` and bail while
     `e.touches.length` is non-zero — a finger leaving the canvas, the OS
     stealing the gesture, or a second finger lifting each used to leave the
     press stuck down forever.
  Multi-touch is deliberately unmapped: every gesture that could stand in for
  a right-click needs a timing state machine that guesses wrong too often. So
  the four games that needed more than the mouse's left button — a right-click,
  WASD, or arrow keys with no mouse at all — each draw their own on-screen
  controls, gated on `navigator.maxTouchPoints > 0` so a desktop mouse/keyboard
  never sees them:
  - `portal`: no right-click on touch, so a small pill toggle (tap it) picks
    which color the next tap places; right-click still forces blue on desktop.
  - `asteroids` / `platformer` / `ray-siege`: on-screen buttons for rotate/
    move/thrust/jump (held, via `mouse.pressing()` + `mouse.canvasPos` against
    a button rect) and fire/weapon-select (tapped, via `mouse.presses()`).
    `ray-siege` also excludes a tap landing on any button from also firing —
    a button and the world share one input, so a weapon swap must not also
    take a shot at that screen point.
  This is a game-level pattern (`BTN`/`inRect`/`btnHeld`/`btnTapped`), not new
  engine API — `mouse.canvasPos` already existed for exactly this kind of
  screen-pinned hit-test.
- **`moshion.js` and `moshion.d.ts` ship together** — public API changes must be
  reflected in both. The `.d.ts` is hand-authored, not generated.
- **The docs are `docs/content/`**, here, and nowhere else: shCode copies the
  built file in. If you change the engine API, change the page that teaches it
  and the doc comment in `docs/moshion.d.ts` (that comment IS its line in the
  generated API reference), then `node scripts/build-docs.mjs`.

## Committing and pushing: then check shCode

shCode (`../shCode`, default branch `cs-3d`) carries a copy of this engine in
`public/moshion/` and of these docs in `lib/moshion-docs-shared.generated.ts`,
so a push here is not finished until shCode has been synced. After a commit that
changes `moshion.js`, `docs/moshion.d.ts` or `docs/content/`:

1. Here: `node scripts/build-docs.mjs`, then the specs (`tests/docs-build.spec.mjs`
   and `tests/docs.spec.mjs` for docs; the engine specs for the engine).
2. In shCode, in a `git worktree` off `origin/cs-3d` (its main checkout often has
   other work in progress): `npm run sync:moshion`. It copies the engine, typings
   and docs from this repo's pushed `main` (or `MOSHION_REF=<branch>` before the
   push), regenerates the autocomplete and runs shCode's moSHion gates. Its
   `public/moshion/VENDORED.md` says what is copied and what is shCode's own.
3. If shCode's `scripts/test-moshion-docs.mjs` reports that a page shCode adds to
   (`lib/moshion-docs-shcode.ts`) changed here, re-read that note in shCode.
   shCode's own `public/moshion/runner.html` is never copied over: port a runner
   behaviour change by hand.
4. Commit in shCode on a branch. Its deploy refuses while its copy differs from
   this repo's `main`.

A change that only touches this repo's demo games, homepage or tests needs no
shCode sync, but still say so when reporting the push.

## Consuming moSHion (context for user-facing questions)

Students load `planck.min.js` + `moshion.js` (via `runner.html` in the app),
then write a global-mode sketch with `setup()` / `update()` / `draw()` and
instantiate `Sprite` / `Group` / joints. The engine auto-boots on `setup`.
`update()` runs in the physics phase (before the step); `draw()` runs after,
before render.

[planck.js]: https://github.com/shakiba/planck.js
