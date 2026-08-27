# moSHion

moSHion is a beginner-friendly 2D game engine for the web, built for the CSCI 4
JavaScript course. It pairs a simple drawing canvas with **real Box2D physics**
(via [planck.js][]) so students can draw shapes and make them bump into each
other without wiring the two worlds together themselves.

The whole API is a handful of globals: `Sprite`, `Group`, `world`, `camera`,
`kb`, `mouse`. No imports, no install, no build step — write `setup()` and
`draw()`, and the engine runs them for you.

## What's in this folder

| File | Covers |
|---|---|
| `moshion.d.ts` | Full public API (hand-authored types). Anchor notation: `moshion → moshion.d.ts → <ClassName>` |
| `challenges.md` | Challenge ladder written against the real engine API — concepts + verifiable goals per tier |
| `CLAUDE.md` | Engine architecture notes (lifecycle, class map, invariants) — dev reference, not student-facing |
| `LICENSE.md` | License terms for every file in `public/moshion/` |
| `index.html` | Docs index page (open `docs/` in a browser) |

## Runtime layout

- `moshion.js` — the entire engine (~800 lines, hand-authored, no build step).
- `planck.min.js` — planck.js v1.5.0 (Box2D port), MIT.
- `runner.html` — sandbox host: loads planck + moSHion, injects a student sketch
  from `?code=<base64url>`, pipes console/errors back to the parent app.
- `assets/` — sprite-sheet art used by lesson examples.

## Licensing

`moshion.js` is an original MIT-licensed facade written for this course. It is
**not** the reference API and carries no the reference API license obligations. `planck.min.js` is
MIT (Erin Catto, Ali Shakiba). See `LICENSE.md` for the full text.

## Credits

- [planck.js][] — Ali Shakiba's pure-JS/TS port of Box2D (MIT).
- Erin Catto — creator of the Box2D physics simulator.
- The the reference API project (Quinton Ashley) — the API surface moSHion mirrors was
  designed there; moSHion is an independent, license-clean reimplementation.

[planck.js]: https://github.com/shakiba/planck.js
