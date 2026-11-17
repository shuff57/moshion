# `load()`: get the files ready before the game starts

Status: **draft, 2026-11-17. Not built.** Open questions for the owner are at the end.

## The problem

A sketch's files load in the background, and the game starts without waiting for them:

| File | How it loads today | What a student runs into |
| --- | --- | --- |
| a sound, `loadSound('jump.mp3')` | fetched and decoded in the background (`Sound.ready` is a promise) | `jump.play()` in `setup()` does nothing; the engine warns once ("play it on an event... or use .loop()") |
| a picture by URL, `sprite.image = 'hero.png'` | an `<img>` per URL, shared, drawn once it is ready | the sprite is blank for a frame or two; its picture's size is not known in `setup()` |
| data, `loadJSON('levels.json', cb)` | `fetch`, then the object fills in and the callback runs | the data cannot be used in `setup()`; 6.5.14 teaches the callback form for that reason |
| a font named in `textFont('pixel')` | the shCode runner waits up to 2 s for names it finds in the code | nothing: already solved, out of scope here |

The engine notes the gap at `loadJSON`: matching a preload gate "would mean changing moshion's boot sequence (`start()`)".

## What the student writes

```js
let jump, levels, hero;

// ONCE, before everything: the files your game needs
function load() {
  jump = loadSound('jump.mp3');
  levels = loadJSON('levels.json');
  hero = loadImage('hero.png');
}

// ONCE, when every file is ready
function setup() {
  new Canvas(400, 400);
  player = new Sprite(200, 200, hero.width, hero.height);
  player.image = hero;
  level = levels.world1;
}
```

The rules, in the course's words:

1. `load()` is optional. It runs once, before `setup()`.
2. Inside `load()`, `loadSound()`, `loadJSON()` and `loadImage()` hand the file back at once, as they do today, and the game waits until every one is ready.
3. Then `setup()` runs, then `update()` / `draw()` / `drawTop()` every frame, exactly as now.
4. A file that fails, or is still not ready after 10 seconds, never stops the game. The console says which file and why, and the game starts anyway.
5. Outside `load()` the loaders behave exactly as today: in the background, no waiting.

## What it does not fix (the docs must say this)

**Browsers keep sound off until the player clicks or presses a key on the page.** Loading does not change that rule. A sound played in `setup()` is ready but still waits for the first click, so the docs keep today's advice: play effects on an event (a key, a hit), and use `.loop()` for music, which starts as soon as the browser allows. `load()` is worth it for **data** (`levels.world1` in `setup()`), **pictures** (no blank first frames, and the size is known), and for one clear place that lists a game's files.

Open question 4 below is about what `play()` should do in that window.

## Engine changes (`moshion.js`)

1. **A pending list.** `LOAD_PENDING_` is an array only while `load()` runs, otherwise `null`.
2. **Loaders join it.** `loadSound()` pushes its `ready`, `loadJSON()` its promise, and the new `loadImage()` a promise that settles on the image's `load` or `error` event. Each still returns its object synchronously.
3. **`loadImage(url)`, new.** It returns the `HTMLImageElement` from the existing `loadArt_` cache, so `sprite.image = img` and `sprite.image = 'hero.png'` share one decode. `img.width` / `img.height` are real in `setup()`. Failure follows the existing art path (`_failed`, the existing warning).
4. **`start()` in two halves.** If `typeof global.load === 'function'`: show the loading note, run `load()`, then `await Promise.allSettled(pending)` raced against a 10 s timer, remove the note, then run today's `start()` body unchanged. `START_TIME_` stays anchored right before `setup()`, so `millis()` and `frameCount` count from the game's start, not the loading.
5. **The loading note.** There is no canvas before `setup()`, so the note is a small DOM element ("Loading... 2 of 3 files") centred in `document.body`. It appears only if loading takes more than 300 ms, so a fast load never flashes.
6. **A slow file.** At 10 s the game starts. The console says once per file: "hero.png was still loading after 10 seconds, so the game started without it. Check the name, or make the file smaller."
7. **An error inside `load()`** (a typo, a missing variable) is reported the same way an error in `setup()` is, and the game does not start, as with `setup()`.
8. **Auto-boot is unchanged.** It still starts on a `setup()` function. A sketch with `load()` and no `setup()` gets one console line: "load() ran, but there is no setup() to start the game."
9. **`docs/moshion.d.ts`:** the `load` hook and `loadImage(url): HTMLImageElement`.

## shCode side (after the engine merges and is vendored)

- **`scripts/moshion-harness.mjs`:** the headless gate. Promises in `start()` now need a microtask flush before `pump()`. The gate must still produce byte-identical draw ops for every existing sketch, because none of them defines `load()`.
- **Docs (`lib/moshion-docs.ts`):** the lifecycle page gets `load()` ("only if your game uses files"), the sound and JSON pages show the `load()` form, and the Sound page says plainly that the first click still turns sound on.
- **Curriculum:** nothing changes on day one. 6.5.14's callback lesson stays correct, and a later reading can introduce `load()`.
- **Before shipping:** count (not read) the students' saved sandbox and lesson code containing `function load(`. Such a function would start running before `setup()`. No lesson, doc page or built-in game has one today.

## Tests (`tests/load.spec.mjs`, new)

- `load()` runs once, before `setup()`, and `setup()` does not run until every file has settled.
- In `setup()`: `levels.world1` is filled in, `hero.width > 0`, and `jump.loaded === true`.
- A missing file: the game still starts, with one console line naming the file.
- A file that never answers: the game starts at 10 s, with a line naming it.
- The note appears for a slow load and never for a load under 300 ms.
- `millis()` is near 0 at the start of `setup()`, not 3 s for a 3 s load.
- A loader called in `setup()` or `draw()` does not wait (rule 5).
- A sketch with no `load()` boots on the same frame as today, with identical draw ops (the regression guard).

## Open questions for the owner

1. **The name.** `load()` (recommended: one word, matches `setup` / `update` / `draw`) or `preload()` (p5.js 1.x; p5 2.0 and q5 dropped it for `async setup()` with `await`). Neither name is used anywhere today.
2. **The time limit.** Is 10 s right for a school network?
3. **The note.** The wording, and whether a student can style it.
4. **`play()` before the first click.** Today a ready sound played while the browser still has sound off is queued and sounds at the first click, late. Should it do nothing and warn ("sound turns on after the first click or key press") instead? This matters more once `load()` makes sounds ready in `setup()`.
