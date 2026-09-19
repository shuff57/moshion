# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
the moSHion engine in this repository.

## Repository layout

This is the in-repo source of the **moSHion** teaching engine — a small,
hand-authored JavaScript facade over [planck.js][] (a pure-JS/TS port of
Box2D). There is no build step, no bundler and no linter configured. The only
tooling is the Playwright spec suite under `tests/`.

- `moshion.js` (~2,800 lines) — the entire engine. Edit directly; do not split
  without discussion.
- `docs/moshion.d.ts` (~640 lines) — public API types. Keep in sync with
  runtime behavior in `moshion.js`.
- `planck.min.js` — vendored planck.js v1.5.0 (MIT). Do not edit.
- `runner.html` — sandbox host used by the app's preview iframes
  (`/moshion/runner.html?code=<base64url>`).
- `index.html` / `sandbox.html` — the public homepage (demo panel) and the
  live editor. Both embed `runner.html` in a sandboxed iframe.
- `games/*.js` — the six demo sketches the homepage loads by `fetch`.
- `tests/*.spec.mjs` — browser specs driving the real surface (see Commands).
- `assets/` — sprite-sheet art for lesson examples, plus `coin.wav` / `music.wav` for the Sound one.

## Commands

Each spec is a standalone script that serves the repo, drives a real Chromium
and prints `PASS`/`FAIL` per assertion (exit 0 only if all pass):

```sh
bun tests/raycast.spec.mjs        # engine: world.rayCast
bun tests/drawtop.spec.mjs        # engine: the drawTop() HUD hook
bun tests/touch.spec.mjs          # engine: touch drives the mouse counters
bun tests/portal.spec.mjs         # games/portal.js
bun tests/ray-siege.spec.mjs      # games/ray-siege.js
bun tests/web-swinger.spec.mjs    # games/web-swinger.js
bun tests/starter-games.spec.mjs  # games/{asteroids,platformer,runner}.js
bun tests/integration.spec.mjs    # index.html demo panel
bun tests/viewport.spec.mjs       # the demo viewport shows the whole sketch
```

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

Key classes and where they live in `moshion.js`:

- `Canvas` (~298) — creates the canvas element; sets `width`/`height` globals.
- `Sprite` (~338) — the heart of the engine. Constructor dispatch:
  `(x,y)` → 50×50 square, `(x,y,d)` → circle, `(x,y,w,h)` → rect,
  `(x,y,w,h,bodyType)` → rect + body type. Physics knobs (`bounciness`,
  `friction`, `shape`, `body`, `collider`) rebuild the planck fixture on
  change via `_buildFixture()`.
- `liveVec` (~329) — `pos`/`vel` are live proxy vectors that read/write the
  underlying planck body on every axis access, so `player.vel.x = 3` and
  `player.pos.y += 5` work like the reference API.
- `Ani` (~1252) / `Anis` — minimal horizontal frame-strip animation.
  `addAni(name, sheetUrl, frameCount)`; first `addAni` auto-activates.
  `changeAni(name)` is a silent no-op for unregistered names.
- `Group` (~1275) `extends Array` — `new groupName.Sprite(...)` factory copies
  the group's own properties as defaults; `push()` tracks membership in
  `sprite._groups` so `sprite.delete()` can unparent everywhere.
- `allSprites` (~1468) — implicit group every sprite auto-joins.
- `world` (~241) — `world.gravity` is a live proxy vector (raw Box2D m/s²,
  `y = 10` ≈ 1g); `world.getSpriteAt(x, y)` is a top-most layer hit-test.
- `camera` (~259) — `camera.off()`/`on()` gate the transform that every
  drawing primitive applies for itself.
- Joints (~1683–1820) — thin facades over planck joints: `HingeJoint`,
  `DistanceJoint`, `SliderJoint`, `WheelJoint`, `GrabberJoint`, `GlueJoint`.
  All share `Joint.delete()`; there is no `joint.remove()`.
- Input (~122–240) — `kb.pressing`/`kb.presses`, `mouse.x/y`,
  `mouse.pressing`/`presses`/`released`. Edge flags reset AFTER the frame's
  update/draw ran (see the comment in `loop()` — reordering this breaks
  `presses()`).

### Key invariants when editing

- **Units are pixels-per-frame for velocity, degrees-per-frame for angular
  velocity, raw Newtons for `applyForce`, raw m/s² for gravity.** The facade
  converts to Box2D meters behind the scenes (`PXM = 30` px/m, `FPS = 60`).
  Don't "unify" these — the px/frame convention is what the curriculum
  teaches (A10.2 asks students to compute px/s from vel.x).
- **`overlaps()` and `colliding()` are NOT aliases.** `overlaps()` is a manual
  bounding-box query (works for `collider = 'none'` sensors); `colliding()`
  reads planck's real contact list and excludes sensor fixtures. See
  `_updateContacts()` (~1823).
- **`group.remove(sprite)` only unparents** — the sprite keeps existing,
  drawing, and running physics. `sprite.delete()` (alias `remove()`) is full
  destruction: destroys the body and unparents from every group.
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
  `runner` and `web-swinger` are fully touch-playable, `portal` (needs the
  right button) and `ray-siege` (needs WASD) are partly, and `asteroids` and
  `platformer` are arrow-keys-only — on-screen controls, if they are ever
  wanted, belong in the games rather than in the engine.
- **`moshion.js` and `moshion.d.ts` ship together** — public API changes must be
  reflected in both. The `.d.ts` is hand-authored, not generated.
- **The in-app docs** (`lib/moshion-docs.ts`, rendered at `/docs/moshion`) are
  hand-authored against this engine's real surface. If you change the engine
  API, update `lib/moshion-docs.ts` and `docs/challenges.md` too.

## Consuming moSHion (context for user-facing questions)

Students load `planck.min.js` + `moshion.js` (via `runner.html` in the app),
then write a global-mode sketch with `setup()` / `update()` / `draw()` and
instantiate `Sprite` / `Group` / joints. The engine auto-boots on `setup`.
`update()` runs in the physics phase (before the step); `draw()` runs after,
before render.

[planck.js]: https://github.com/shakiba/planck.js
