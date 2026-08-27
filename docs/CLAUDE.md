# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
the moSHion engine in this repository.

## Repository layout

This is the in-repo source of the **moSHion** teaching engine — a small,
hand-authored JavaScript facade over [planck.js][] (a pure-JS/TS port of
Box2D). There is no build step, no bundler, no test suite, and no linter
configured.

- `moshion.js` (~800 lines) — the entire engine. Edit directly; do not split
  without discussion.
- `moshion.d.ts` (~170 lines) — public API types. Keep in sync with runtime
  behavior in `moshion.js`.
- `planck.min.js` — vendored planck.js v1.5.0 (MIT). Do not edit.
- `runner.html` — sandbox host used by the app's preview iframes
  (`/moshion/runner.html?code=<base64url>`).
- `assets/` — sprite-sheet art for lesson examples.

## Commands

There are no tests, lint, or typecheck scripts for the engine itself. Validate
changes by loading a sketch in a browser via `runner.html`, or by running the
app (`npm run dev`) and using a lesson's preview pane. The app's TypeScript
(`tsc --noEmit`) does not type-check `moshion.js` — it's plain JS loaded in an
iframe.

## Runtime architecture

moSHion is a standalone runtime: load `planck.min.js`, then `moshion.js`, then a
global-mode sketch with `setup()` / `update()` / `draw()`. The engine
auto-boots when it sees `window.setup` (deferred check via `setTimeout 0` so
script order doesn't matter).

The main loop (`start()` in `moshion.js`):

1. `setup()` runs once — must call `new Canvas(w, h)` or the engine throws.
2. Each frame: user `update(step)` → physics step → contact tracking →
   user `draw()` → render → edge-trigger flags reset.

Key classes and where they live in `moshion.js`:

- `Canvas` (~110) — creates the canvas element; sets `width`/`height` globals.
- `Sprite` (~146) — the heart of the engine. Constructor dispatch:
  `(x,y)` → 50×50 square, `(x,y,d)` → circle, `(x,y,w,h)` → rect,
  `(x,y,w,h,bodyType)` → rect + body type. Physics knobs (`bounciness`,
  `friction`, `shape`, `body`, `collider`) rebuild the planck fixture on
  change via `_buildFixture()`.
- `liveVec` (~137) — `pos`/`vel` are live proxy vectors that read/write the
  underlying planck body on every axis access, so `player.vel.x = 3` and
  `player.pos.y += 5` work like the reference API.
- `Ani` (~390) / `Anis` (~409) — minimal horizontal frame-strip animation.
  `addAni(name, sheetUrl, frameCount)`; first `addAni` auto-activates.
  `changeAni(name)` is a silent no-op for unregistered names.
- `Group` (~413) `extends Array` — `new groupName.Sprite(...)` factory copies
  the group's own properties as defaults; `push()` tracks membership in
  `sprite._groups` so `sprite.delete()` can unparent everywhere.
- `allSprites` (~468) — implicit group every sprite auto-joins.
- `world` (~92) — `world.gravity` is a live proxy vector (raw Box2D m/s²,
  `y = 10` ≈ 1g); `world.getSpriteAt(x, y)` is a top-most layer hit-test.
- Joints (~501–595) — thin facades over planck joints: `HingeJoint`,
  `DistanceJoint`, `SliderJoint`, `WheelJoint`, `GrabberJoint`, `GlueJoint`.
  All share `Joint.delete()`; there is no `joint.remove()`.
- Input (~74–84) — `kb.pressing`/`kb.presses`, `mouse.x/y`,
  `mouse.pressing`/`presses`/`released`. Edge flags reset AFTER the frame's
  update/draw ran (see the comment at ~728 — reordering this breaks
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
  `_updateContacts()` (~606).
- **`group.remove(sprite)` only unparents** — the sprite keeps existing,
  drawing, and running physics. `sprite.delete()` (alias `remove()`) is full
  destruction: destroys the body and unparents from every group.
- **`sprite.image` heuristic:** a string with no `.` is an emoji placeholder
  (`'🧍'`), anything else is an image URL. Mutually exclusive with an active
  `ani`.
- **`DistanceJoint.length` is settable post-construction** and wakes both
  bodies (planck doesn't wake on joint property changes — a settled body
  would keep its old separation forever).
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
