# Changelog

moSHion follows [semantic versioning](https://semver.org/). Releases are git
tags (`v0.1.0`) with a GitHub Release. The public site
(<https://moshion.lefthanddev.com/>) deploys from `main`, so it can be ahead of
the latest tag.

## Unreleased

Ported from shCode, where these had been local patches on top of v0.1.0, so the
two now ship one engine.

- `sprite.useTextureHitbox()`: a sprite collides like its picture (an L, a
  ring, a gap) instead of a plain box or circle. It follows the sprite's size
  and rotation, survives `clone()`, and works for `overlaps()` too.
- `background('textureName')`: fills the canvas with a texture, cropped to
  cover, fixed while the camera moves, animated if the texture is.
- `saveTexture(name, dataUrl, { hitbox, smooth })`: new options. `hitbox:
  { w, h, mask }` saves the collision shape; `smooth: true` keeps a picture
  soft when scaled, for art drawn with curves.
- Docs: three new pages (hitbox, picture background, smooth option), each with a
  runnable example.

## v0.1.0 — first release

The engine, its docs site and the starter games, as used by the shCode
JavaScript course.

### Engine
- Sprites, groups and a Box2D world (planck.js 1.5.0) behind a handful of
  globals: `Sprite`, `Group`, `world`, `camera`, `kb`, `mouse`. No imports, no
  build step: write `setup()` / `update()` / `draw()` / `drawTop()`.
- Colliders and sensors, joints (hinge with stiffness and limits, distance,
  slider, wheel, grabber, glue), `world.rayCast`, `sprite.jump()` with
  `maxJumps`, `sprite.clone()`, `world.maxSpeed`, `Tiles`, `Walls`, timers.
- Input: keyboard, mouse, `sprite.mouse` hover/drag state, and single-touch
  mapped to the mouse. Losing focus releases held keys and buttons.
- Drawing: text with fonts, layout and `textLayer(n)`, `drawTop()` for HUDs,
  `world.origin = 'math'` with `showGrid()` / `showMouse()`, render culling.
- Art and sound: 126 named pixel-art textures (21 animated), sprite sheets and
  `addAni`, `sprite.pattern`, 8-bit sound palette, `loadSound('coin')`,
  `preload()`, `deltaTime`.
- Saving: `storeItem` / `getItem` over a postMessage bridge; the sketch never
  rides the URL.
- Runs inside a sandboxed iframe without `allow-same-origin` (`runner.html`).

### Docs and site
- Docs site with a runnable example for every page and every name, generated
  from `docs/content/` and the typed reference in `docs/moshion.d.ts`.
- Live editor (`sandbox.html`) and a homepage demo panel.
- Starter games: asteroids, platformer, runner, portal, ray-siege, web-swinger,
  with on-screen touch controls.

### Known limits
- Gravity starts at 0; set `world.gravity.y` for things to fall.
- Tests need Playwright and a Chromium; see `docs/CLAUDE.md`.
