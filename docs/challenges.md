# moSHion Challenges

Challenge ideas written against the real moSHion engine API (`moshion.d.ts` +
`moshion.js`). None of these are copied from any external textbook — they're
designed from the engine's actual public surface and the lesson set that
already exercises it.

Each challenge has:
- **Concepts** — the API surface it exercises
- **Goal** — a verifiable success condition
- **Stretch** — optional extension

Difficulty scales top to bottom.

---

## Tier 1 — Sprites and movement

### 1. Hello Sprite
**Concepts:** `Canvas`, `Sprite`, `color`, `background`
**Goal:** Draw a single colored sprite in the middle of a 400×400 canvas.
Change its color when you refresh the page (random from a palette).
**Stretch:** Add three sprites in a row, each a different shape (circle, box,
triangle).

### 2. Falling Block
**Concepts:** `world.gravity`, static vs dynamic sprites
**Goal:** A dynamic block falls from the top and lands on a static floor. It
should come to rest without jittering.
**Stretch:** Vary the block's `bounciness` so it rebounds once before settling.

### 3. Arrow-Key Mover
**Concepts:** `kb.pressing`, `Sprite.vel`
**Goal:** Move a sprite with arrow keys (or WASD). It should stop when no key
is pressed.
**Stretch:** Use acceleration instead of direct velocity — holding a key
speeds the sprite up to a max.

### 4. Space Jumper
**Concepts:** `kb.presses` (edge-triggered), `colliding`, jump physics
**Goal:** A sprite on a floor can jump with the spacebar — but only when it's
actually touching the ground (no double-jumps).
**Stretch:** Add coyote time (100ms grace period after leaving a ledge).

---

## Tier 2 — Physics feel

### 5. Brick Wall
**Concepts:** Many dynamic sprites, mass, collisions
**Goal:** Build a 4×6 wall of bricks. A player-controlled ball can knock them
down.
**Stretch:** Add a score counter for every brick that ends up below a certain
y.

### 6. Bouncy Ball Court
**Concepts:** `bounciness`, `friction`, walls
**Goal:** A ball bounces inside a walled box. It should never lose energy over
time.
**Stretch:** Add paddles controlled by two players — make it a pong clone.

### 7. Swinging Pendulum
**Concepts:** `HingeJoint`, anchors
**Goal:** A rod hangs from a fixed anchor point and swings under gravity. Click
to give it a push.
**Stretch:** Chain three rods into a triple pendulum.

### 8. Car on a Ramp
**Concepts:** `WheelJoint`, multi-body vehicles
**Goal:** A chassis with two wheels drives up a ramp. Arrow keys accelerate.
**Stretch:** Add suspension stiffness tuning and a hilly terrain.

---

## Tier 3 — Groups, overlaps, scoring

### 9. Apple Catcher
**Concepts:** `Group`, timers, overlap callbacks
**Goal:** Apples spawn at random x positions at the top and fall. A basket at
the bottom (arrow-key controlled) catches them. Score increments on catch;
missed apples decrement lives.
**Stretch:** Add golden apples worth 3 points and rocks that cost a life.

### 10. Asteroid Field
**Concepts:** Groups, `overlaps`, wrap-around borders
**Goal:** A ship (rotate + thrust) in a field of drifting asteroids.
Collisions end the game.
**Stretch:** Shoot bullets (another group) that destroy asteroids on overlap.

### 11. Color Sort
**Concepts:** Multiple groups, palette, drag or click
**Goal:** Three bins at the bottom (red/blue/green). Sprites of those colors
spawn at the top and fall. Drag them into the matching bin.
**Stretch:** Speed up spawn rate over time.

---

## Tier 4 — Animation and camera

### 12. Walking Character
**Concepts:** `Ani`, `Anis`, sprite sheets, animation state machine
**Goal:** A character sprite with idle / walk / jump animations that switch
based on velocity and ground contact.
**Stretch:** Add a crouch animation triggered by the down key.

### 13. Side-Scrolling Platformer
**Concepts:** `camera`, tiled levels, goal sprite
**Goal:** A level wider than the canvas. Camera follows the player. Reach a
flag on the far right to win.
**Stretch:** Add pits that respawn the player at the start.

---

## Tier 5 — Capstone

### 14. Mini Angry Blocks
**Concepts:** `GrabberJoint` or mouse `drag`, `DistanceJoint` / slingshot,
scoring
**Goal:** Drag a ball back from an anchor, release to launch. Knock down a
tower of blocks. Score by how many fall below a line.
**Stretch:** Three shots per level, three levels of increasing difficulty.

### 15. Two-Player Sumo
**Concepts:** arena walls, knockout, `kb` split controls
**Goal:** Two sprites in a ring, one controlled by WASD, the other by arrow
keys. Push the other out of the ring to win.
**Stretch:** Add round timers, best-of-three, and a heavyweight/lightweight
character pick.

---

## Notes on progression

- Tiers 1–2 cover everything a student needs for a basic platformer.
- Tier 3 introduces collection/collection-iteration mental models (groups) —
  the biggest conceptual jump.
- Tier 4 adds time-based state (animation frames) and world-larger-than-
  viewport thinking (camera).
- Tier 5 combines everything from prior tiers.

A reasonable pacing: one challenge per class period for tiers 1–3, two periods
per tier-4 challenge, a full week for each capstone.
