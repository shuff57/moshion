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
  world.gravity.y = 10; // ≈ 1g
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
- `Canvas`, `Sprite`, `Group`, `allSprites` — drawing + physics
- `world`, `camera` — gravity, hit-testing, viewport
- `kb`, `mouse` — input with edge-triggered events (`kb.presses('w')`). A
  single touch drives the same `mouse` properties, so a pointer sketch works
  on a phone unchanged (no right-button equivalent: a second finger is ignored)
- Joints: `HingeJoint`, `DistanceJoint`, `SliderJoint`, `WheelJoint`,
  `GrabberJoint`, `GlueJoint`
- `storeItem`/`getItem` — saves, bridged to the host page via postMessage
  (works even in opaque-origin iframes)

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
| `assets/` | Sprite-sheet art (regenerable via `scripts/make-moshion-assets.py` in shCode) plus `coin.wav` / `music.wav`, the synthesized sounds the docs' Sound example loads |
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