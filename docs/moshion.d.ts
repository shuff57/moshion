// moSHion type declarations — hand-authored from public/moshion/moshion.js.
// Covers the full public API surface exported by the engine IIFE.
//
// Coordinates: by default (0, 0) is the canvas's top-left corner, x grows to
// the right and y grows DOWN, like the browser canvas and p5play. That is
// `world.origin = 'screen'`. A sketch can ask for the grid from math class
// instead: `world.origin = 'math'` puts (0, 0) at the CENTRE of the canvas
// with y growing UP and angles turning counter-clockwise. Every x, y, angle
// and velocity in this file is then read in that frame. See World.origin.

// ---- vector types --------------------------------------------------------

interface Vec2 {
  x: number;
  y: number;
}

// ---- animation -----------------------------------------------------------

declare class Ani {
  name: string;
  frameCount: number;
  frameDelay: number;
  /** Optional per-frame holds (game frames), one per frame; null = uniform frameDelay. */
  frameDelays: number[] | null;
  frame: number;
  spriteSheet: HTMLImageElement;
}

declare class Anis {
  [name: string]: Ani;
}

// ---- sprite --------------------------------------------------------------

// Names a Sprite already uses. A field you add to a sprite (or to a class
// that extends Sprite, or as a group default) with one of these names does
// not make a new field: it drives the built-in one. `this.speed = 5` sets the
// sprite's velocity (and reads back 0 on a static body), `this.life = 3`
// deletes the sprite three frames later, `this.direction` turns its
// velocity, `this.text` draws a label on it. Pick another name: `moveSpeed`,
// `hp`, `heading`, `label`. The full list is every property declared below
// (also color, scale, mass, x, y, w, h, d, r, width, height, visible, removed).
declare class Sprite {
  constructor(x: number, y: number);
  constructor(x: number, y: number, d: number);
  constructor(x: number, y: number, w: number, h: number);
  constructor(x: number, y: number, w: number, h: number, bodyType: 'static' | 'kinematic' | 'dynamic');

  pos: Vec2;
  vel: Vec2;
  position: Vec2; // alias of pos, matches the reference API
  x: number;
  y: number;
  color: string;
  /** Degrees. Positive turns clockwise in the default mode and
   *  counter-clockwise in math mode (world.origin = 'math'). */
  rotation: number;
  /** Degrees per frame, same turning direction as .rotation. */
  angularVelocity: number;
  layer: number;
  visible: boolean;
  scale: Vec2;
  stroke: string | null;
  strokeWeight: number;
  w: number;
  h: number;
  shape: 'circle' | 'rect';
  body: 'static' | 'kinematic' | 'dynamic';
  collider: 'static' | 'kinematic' | 'dynamic' | 'none';
  diameter: number;
  bounciness: number;
  friction: number;
  // density (D2 — capability added, moSHion's own default of 1 kept, NOT
  // real p5play's 5; see DECISIONS.md D1). Setting it rebuilds the fixture,
  // same as bounciness/friction.
  density: number;
  // mass reads straight off the physics body; setting it scales density so
  // the resulting fixture mass matches (a static/kinematic sprite has 0
  // mass and ignores a mass assignment).
  mass: number;
  // speed (px/frame, magnitude of .vel) and direction (degrees, 0 = right,
  // same convention as .rotation: 90 is down by default and UP in math mode)
  // are a polar view onto .vel — setting one preserves the other. A negative
  // speed reverses.
  speed: number;
  direction: number;
  // text: a HUD-style label drawn centered over the sprite (axis-aligned,
  // not rotated/scaled with the sprite's art). null/'' draws nothing.
  text: string | null;
  textColor: string;
  textSize: number;
  // opacity: 0..1, honoured by the sprite's own draw (art, debug outline,
  // and text all fade together).
  opacity: number;
  // debug: draws the collider outline (not the art) in lime.
  debug: boolean;
  ani: Ani | null;
  /** Still art: an emoji / short text ('🧍'), an image URL, or a ready <img> / <canvas>.
   *  null or '' goes back to the colored shape. Art that fails to load falls
   *  back to the colored shape rather than vanishing. */
  image: string | HTMLImageElement | HTMLCanvasElement | ImageBitmap | null;

  /**
   * Named art from the texture catalog, e.g. `sprite.texture = 'coin'`.
   *
   * Reads back as the NAME that was set, not the image. Setting it clears
   * `.image` and `.ani`, and setting either of those clears this. An
   * unknown name warns and leaves the sprite as it was. Drawn with image
   * smoothing off, so pixel art stays crisp when scaled.
   *
   * Names come from `textureNames()`: the built-in catalog plus anything
   * `saveTexture()` has stored. A saved name wins over a built-in one.
   */
  texture: string | null;
  /** A picture that repeats at its natural size inside the sprite's shape
   *  (anchored top-left) instead of stretching. For ground, walls and
   *  platforms. Any `image` / `texture` / `ani` draws instead. null clears it. */
  pattern: string | HTMLImageElement | HTMLCanvasElement | ImageBitmap | null;

  addAni(name: string, sheetUrl: string, frameCount: number): Ani;
  changeAni(name: string): void;
  /** A new sprite that looks and behaves like this one: size, shape, colour,
   *  outline, art, layer, rotation and physics settings, in the same groups.
   *  Made in the same spot and still; move it before the next frame (two
   *  solid sprites on top of each other push apart). Does not copy motion,
   *  life, joints, or properties the sketch made up (hp, points). */
  clone(): Sprite;
  applyForce(fx: number, fy: number): void;
  // Live geometry query (continuous truthy while touching), not edge-
  // triggered — cb fires once per overlapping pair/sprite each call.
  // A QUESTION, not a setting: it answers "are these touching right now?"
  // and changes nothing. Calling a.overlaps(b) once in setup() does not
  // let a and b pass through each other (it does in p5play); to make a
  // pickup or a bullet pass through, set its collider to 'none'.
  overlaps(other: Sprite | Group): boolean;
  overlaps(other: Sprite | Group, cb: (self: Sprite, other: Sprite) => void): boolean;
  // colliding/collides/collided and overlapping/overlapped are the p5play
  // edge/count/release triple, backed by a per-pair signed frame counter:
  // collides()/overlaps() fire once on the first touching frame, colliding()/
  // overlapping() return the running frame count, collided()/overlapped()
  // fire once on the frame contact ends.
  // colliding/collides/collided take the same cb form as overlaps() above —
  // cb(self, other) fires once per truthy pair.
  colliding(other: Sprite | Group): number;
  colliding(other: Sprite | Group, cb: (self: Sprite, other: Sprite) => void): number;
  collides(other: Sprite | Group): boolean;
  collides(other: Sprite | Group, cb: (self: Sprite, other: Sprite) => void): boolean;
  collided(other: Sprite | Group): boolean;
  collided(other: Sprite | Group, cb: (self: Sprite, other: Sprite) => void): boolean;
  overlapping(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): number;
  overlapped(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  // Steps this fraction (default 0.1) of the remaining distance to (x, y)
  // every call — call once per update() frame for a smooth approach.
  // Distance and bearing to another point or sprite. angleTo uses the same
  // degree convention as .rotation and .direction (0 is right; 90 is down by
  // default and up in math mode).
  distanceTo(x: number, y: number): number;
  distanceTo(target: { x: number; y: number }): number;
  angleTo(x: number, y: number): number;
  angleTo(target: { x: number; y: number }): number;
  // Multiplies the current .scale rather than replacing it. Art only — the
  // collider keeps the size set by .w/.h. (the reference API's .scale DOES resize the
  // physics shape; moSHion's is deliberately visual, as its docs state.)
  scaleBy(x: number, y?: number): void;
  moveTowards(x: number, y: number, tracking?: number): void;
  moveTowards(target: { x: number; y: number }, tracking?: number): void;
  // The opposite of moveTowards. The reference API declares this but never implements
  // it; ours follows the documented meaning.
  moveAway(x: number, y: number, repel?: number): void;
  moveAway(target: { x: number; y: number }, repel?: number): void;
  // Applies a force (newtons, like applyForce) toward/away from a point,
  // the same strength whatever the distance.
  attractTo(x: number, y: number, force?: number): void;
  attractTo(target: { x: number; y: number }, force?: number): void;
  repelFrom(x: number, y: number, force?: number): void;
  repelFrom(target: { x: number; y: number }, force?: number): void;
  // Steps .rotation toward `angle` by at most `speed` degrees per call (the
  // shorter signed direction); with no `speed`, snaps immediately. Returns a
  // Promise for API parity with real p5play — the rotation itself already
  // happened synchronously by the time it resolves.
  rotateTo(angle: number, speed?: number): Promise<Sprite>;
  // Unlike rotateTo, sets a spin speed proportional to the angle remaining,
  // so the sprite eases round over several frames instead of stepping.
  rotateTowards(angle: number, tracking?: number): void;
  rotateTowards(target: { x: number; y: number }, tracking?: number): void;
  delete(): void;
  remove(): void;
  /** A box riding on this sprite that only detects: it pushes nothing,
   *  weighs nothing, and colliding() never counts it. Offsets are from the
   *  sprite's centre and turn with it, in the active coordinates (+offsetY is
   *  below the sprite by default and ABOVE it in math mode); defaults are no
   *  offset and the sprite's own size. The usual one is a ground sensor, a
   *  thin strip under a player (`addSensor(0, 21, 26, 4)` on a 30x40 player,
   *  or `addSensor(0, -21, 26, 4)` in math mode):
   *  `feet.overlaps(ground)` is true on the floor and false against
   *  a wall or a ceiling, where `player.colliding(ground)` is true in all
   *  three. Box2D only reports contacts that involve a dynamic body, so a
   *  sensor on a static or kinematic sprite sees only dynamic sprites.
   *  world.rayCast reports a sensor's box as part of its sprite. */
  addSensor(offsetX?: number, offsetY?: number, w?: number, h?: number): Sensor;

  // ---- physics -------------------------------------------------------------
  /** Linear damping — air resistance. 0 = none. */
  drag: number;
  /** Angular damping. */
  rotationDrag: number;
  /** True freezes rotation. Unlike Box2D's own flag, this also blocks
   *  explicit angularVelocity writes — see DECISIONS D21. */
  rotationLock: boolean;
  /** Live alias of angularVelocity, degrees per frame. The reference API's name for it. */
  rotationSpeed: number;
  /** Per-sprite multiplier on world gravity. 0 = weightless. */
  gravityScale: number;
  /** Alias of drag; planck has no true rolling resistance. */
  rollingResistance: number;
  applyTorque(t: number): void;
  /** Like applyForce but multiplied by this sprite's mass, so sprites of
   *  different mass accelerate equally. */
  applyForceScaled(fx: number, fy: number): void;
  sleeping: boolean;
  allowSleeping: boolean;
  /** Continuous collision detection — for anything fast enough to tunnel. */
  isSuperFast: boolean;
  resetMass(): void;
  /** Read-only, in pixels. */
  readonly centerOfMass: Vec2;
  /** Alias of .collider. */
  physicsType: 'dynamic' | 'static' | 'kinematic' | 'none';
  /** False leaves the sprite drawn but out of the simulation. */
  physicsEnabled: boolean;
  /** Conveyor-belt tangent speed, px/frame, re-applied to live contacts. */
  surfaceSpeed: number;
  /** Draw only — no physics body participation. NOTE: shares one underlying
   *  flag with physicsEnabled, so the two can drift out of sync. */
  visualOnly: boolean;

  // ---- motion ---------------------------------------------------------------
  /** The turn needed to face a point, in degrees (signed, shortest). */
  angleToFace(x: number | { x: number; y: number }, y?: number, facing?: number): number;
  /** The absolute rotation that would face a point. */
  rotationToFace(x: number | { x: number; y: number }, y?: number, facing?: number): number;
  setSpeedAndDirection(speed: number, direction: number): void;
  readonly isMoving: boolean;
  /** Position at the end of the previous frame. */
  readonly prevPos: Vec2;
  readonly previousPosition: Vec2;
  readonly prevRotation: number;
  readonly previousRotation: number;
  /** This sprite in screen pixels rather than world coordinates. */
  readonly canvasPos: Vec2;

  // ---- lifecycle and presentation -------------------------------------------
  /** Frames remaining; counts down and deletes at 0. Unset = immortal. */
  life: number;
  readonly removed: boolean;
  /** Aliases of .color. */
  colour: string;
  fill: string;
  textFill: string;
  textStroke: string;
  textStrokeWeight: number;
  readonly groups: Group[];
  readonly joints: Joint[];
  /** Default true. False skips this sprite in the render / update pass. */
  autoDraw: boolean;
  autoUpdate: boolean;
  /** True pins the sprite to the screen instead of the world: it ignores the
   *  camera and draws after everything else. For HUDs. moSHion's own — the reference API
   *  handles UI with camera.off() around drawing primitives instead. */
  screenSpace: boolean;
  /** Assign to run your own logic each frame, or to take over drawing. */
  update?: () => void;
  draw?: () => void;

  // Aliases for numbers the sprite already has, so material written against
  // p5/the reference API works unchanged. Not new capabilities.
  width: number;
  height: number;
  hw: number;
  hh: number;
  halfWidth: number;
  halfHeight: number;
  d: number;
  r: number;
  radius: number;
  velocity: Vec2;
}

/** What sprite.addSensor() returns. Answers from this frame's physics step,
 *  like colliding(). */
declare class Sensor {
  /** The sprite it rides on. */
  readonly sprite: Sprite;
  /** True while this sensor touches `other` (any member, for a Group). */
  overlaps(other: Sprite | Group): boolean;
  /** Frames it has been touching `other` (the longest member, for a Group); 0 when not. */
  overlapping(other: Sprite | Group): number;
  /** Takes the sensor off its sprite. Deleting the sprite does this too. */
  remove(): void;
}

// ---- group ---------------------------------------------------------------

declare class Group extends Array<Sprite> {
  Sprite: typeof Sprite;
  /** Catalog texture name for every member, current and future. */
  texture: string | null;
  /** Repeating picture for every member, current and future. */
  pattern: string | HTMLImageElement | HTMLCanvasElement | ImageBitmap | null;
  /** Art for every member, current and future (`new group.Sprite()`). */
  image: string | HTMLImageElement | HTMLCanvasElement | ImageBitmap | null;

  newSprite(x: number, y: number, w?: number, h?: number): Sprite;
  push(...sprites: Sprite[]): number;
  remove(s: Sprite): void;
  overlaps(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  colliding(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): number;
  collides(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  collided(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  overlapping(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): number;
  overlapped(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;

  // Cascading versions of the Sprite methods of the same name — a group
  // already cascades properties, so these complete the pattern.
  applyForce(fx: number, fy: number): void;
  moveTowards(x: number | { x: number; y: number }, y?: number, tracking?: number): void;
  moveAway(x: number | { x: number; y: number }, y?: number, repel?: number): void;
  attractTo(x: number | { x: number; y: number }, y?: number, force?: number): void;
  repelFrom(x: number | { x: number; y: number }, y?: number, force?: number): void;

  // Deletes members that have drifted this far outside the canvas and
  // returns how many went. With a callback, runs that instead of deleting —
  // the hook for wrapping or respawning rather than destroying.
  cull(margin?: number, cb?: (sprite: Sprite, n: number) => void): number;
  cull(top: number, bottom: number, left: number, right: number, cb?: (sprite: Sprite, n: number) => void): number;

  /** Alias of push. */
  add(...sprites: Sprite[]): number;
  contains(s: Sprite): boolean;
  /** Deletes every member and empties the group. */
  delete(): void;
  deleteAll(): void;
  /** Read or set the member count — setting spawns or deletes to match. */
  amount: number;
  applyTorque(t: number): void;
  applyForceScaled(fx: number, fy: number): void;
  autoDraw: boolean;
  autoUpdate: boolean;
}

// ---- tile maps and walls ---------------------------------------------------

/**
 * Builds a level out of rows of text. Each character the legend names becomes
 * one `new group.Sprite()` from that group, so the group's defaults
 * (collider, color, diameter, texture, custom fields) apply; any other
 * character (a space, '.') is an empty cell. Column c of row r is centred at
 * (x + c * w, y + r * h): x, y is the CENTRE of the top-left tile. The first
 * string is always the TOP row on the screen, so in math mode (y up) row r is
 * centred at y - r * h instead. A group default size (e.g. `coins.diameter`)
 * wins over the tile size. `h` defaults to `w`. Legend keys are single
 * characters, emoji included.
 *
 *     walls = new Group(); walls.collider = 'static';
 *     coins = new Group(); coins.collider = 'none'; coins.diameter = 14;
 *     level = new Tiles(['#####', '# c #', '#####'], 20, 20, 40, 40, { '#': walls, 'c': coins });
 *
 * The result is a Group of every sprite made, in reading order, so
 * `level.delete()` clears the level. Array methods on it (filter, map, slice)
 * return a plain Group. p5play's form, where each group carries a `.tile`
 * letter and there is no legend, is not supported.
 */
declare class Tiles extends Group {
  constructor(map: string[], x: number, y: number, w: number, h: number | undefined, legend: Record<string, Group>);
}

/**
 * Four static walls just OUTSIDE the edges of what the canvas shows, so
 * sprites bounce off the edges of the screen and the whole canvas stays
 * playable (the walls are off screen, so not seen). Call after new Canvas().
 * Placed where the camera is looking when called; they do not follow it.
 * `player.colliding(walls)` asks "touching any edge";
 * `player.colliding(walls.bottom)` asks "on the floor". `top` is the wall
 * above the screen in both coordinate modes (the larger y in math mode).
 */
declare class Walls extends Group {
  constructor(thickness?: number); // default 50
  readonly top: Sprite;
  readonly bottom: Sprite;
  readonly left: Sprite;
  readonly right: Sprite;
}

// ---- joints --------------------------------------------------------------

interface JointOptions {
  anchor?: Vec2;
  length?: number;
  axis?: Vec2;
  maxForce?: number;
}

declare class Joint {
  delete(): void;
}

declare class HingeJoint extends Joint {
  constructor(a: Sprite, b: Sprite, opt?: JointOptions);
}

declare class DistanceJoint extends Joint {
  constructor(a: Sprite, b: Sprite, opt?: JointOptions);
  length: number;
}

declare class SliderJoint extends Joint {
  constructor(a: Sprite, b: Sprite, opt?: JointOptions);
}

declare class WheelJoint extends Joint {
  constructor(a: Sprite, b: Sprite, opt?: JointOptions);
}

declare class GrabberJoint extends Joint {
  constructor(a: Sprite, b: Sprite, opt?: JointOptions);
}

declare class GlueJoint extends Joint {
  constructor(a: Sprite, b: Sprite);
}

// ---- world ---------------------------------------------------------------

// ---- sound ---------------------------------------------------------------

/** One file, many clips: { jump: [startSeconds, endSeconds], ... } */
interface SoundClips {
  [name: string]: [number, number];
}

declare class Sound {
  constructor(url: string, opts?: { clips?: SoundClips });
  readonly url: string;
  /** Starts a NEW voice each call, so rapid repeats overlap instead of
   *  cutting each other off. With a clip name, plays just that slice.
   *  A no-op until the file has loaded — a late sound effect is worse than
   *  none — and a no-op for a clip name that isn't defined. */
  play(clip?: string): unknown;
  /** Starts the one looping voice. Idempotent, so it is safe to call from
   *  draw(). Unlike play(), a loop() issued before the file has loaded is
   *  remembered and starts as soon as it lands — `music.loop()` in setup()
   *  always runs before the download finishes. */
  loop(clip?: string): unknown;
  /** Web Audio cannot resume a stopped source, so this is stop(). Kept
   *  because it is the word people reach for. */
  pause(): void;
  stop(): void;
  readonly playing: boolean;
  /** 0 to 1, this sound's own level. Scaled by masterVolume(). */
  volume: number;
  /** -1 hard left, 0 centre, 1 hard right. */
  pan: number;
  /** Playback speed. Also shifts pitch — cheap variety from one effect. */
  rate: number;
  /** Ramp to a volume over `seconds` (default 0.5). Fading to 0 stops the
   *  voices when it lands, so a silent source isn't left running. */
  fade(to: number, seconds?: number): Sound;
  /** 0 until the file has downloaded and decoded. */
  readonly duration: number;
  readonly loaded: boolean;
  /** Resolves when the file is downloaded and decoded (null if it failed). */
  readonly ready: Promise<unknown>;
  /** Set if the download or decode failed; the sound then stays silent. */
  readonly error: string | null;
  /** True if the browser refused to start audio. Sound is blocked until the
   *  player has clicked or pressed a key — moSHion unlocks it automatically on
   *  the first input, so this is rare. */
  readonly blocked: boolean;
}

/** Load a sound from a URL. A bare code-safe name (letters, digits, _) is
 *  looked up first in the store under `sound:<name>`, so a host page can save a
 *  wave with storeItem() and a sketch can play it by name. If nothing is saved,
 *  the name is used as a URL. A path or a data: URI is fetched directly and is
 *  never looked up. */
declare function loadSound(url: string, opts?: { clips?: SoundClips }): Sound;
/** Scales every sound at once without disturbing their individual volumes.
 *  Call with no argument to read the current value. */
declare function masterVolume(v?: number): number;

interface World {
  /**
   * Which way the coordinates go. Read it any time; set it once, at the top
   * of setup(), before any sprite is made and before gravity is set.
   *
   *   'screen' (the default): (0, 0) is the top-left corner of the canvas,
   *            x grows to the right, y grows DOWN. Like the browser canvas
   *            and p5play. Every sketch that never sets this runs exactly as
   *            it always has.
   *   'math':  (0, 0) is the CENTRE of the canvas, x grows to the right,
   *            y grows UP, and a positive rotation turns counter-clockwise
   *            from the +x axis, like a graph in math class.
   *
   * In math mode every number keeps its meaning but points the math way:
   * `vel.y = 5` moves a sprite up, a falling world is `world.gravity.y = -10`,
   * `direction = 90` points up, and the camera starts at (0, 0). Text and
   * pictures still read upright. Any other value throws a TypeError naming
   * the two choices; changing it after a sprite exists, after gravity is set
   * or after the first frame throws an Error that says so.
   */
  origin: 'screen' | 'math';
  /** Raw Box2D m/s²; y = 10 is about 1g. Starts at (0, 0), as in p5play:
   *  nothing falls until you set world.gravity.y. In math mode (y up) a
   *  falling world is y = -10. */
  gravity: Vec2;
  getSpriteAt(x: number, y: number): Sprite | undefined;
  /** Every live sprite at a point, topmost first. Optional radius (measured
   *  to the nearest edge) and group filter. Returns [] for an inactive mouse. */
  getSpritesAt(
    x: number | { x: number; y: number },
    y?: number,
    radius?: number,
    group?: Group,
  ): Sprite[];
  /** Radial impulse. Falloff ramps from full strength at the centre to
   *  `falloff` of it at the rim — our approximation, not Box2D's curve.
   *  NOTE the solver clamps velocity at 60 px/frame, so a large magnitude
   *  makes every sprite in range come out at the same speed. */
  explodeAt(
    x: number | { x: number; y: number },
    y?: number,
    radius?: number,
    magnitude?: number,
    falloff?: number,
  ): void;
  allowSleeping: boolean;
  /** Default true. False hands stepping to the sketch via physicsUpdate(). */
  autoStep: boolean;
  physicsUpdate(step?: number): void;
  /** Restitution velocity threshold, px/frame. */
  bounceThreshold: number;
  /** The speed cap, px/frame: no body moves farther than this in one frame.
   *  Default 60. Raise it to go faster; the cost is that a very fast sprite
   *  can skip past a thin one between frames. A number above 0, or it throws. */
  maxSpeed: number;
  /**
   * Ray-cast the world for all fixtures in the path of the ray.
   * @param x1 - Start X (pixels) or {x, y} object
   * @param y1 - Start Y (pixels) or {x, y} object for end point
   * @param x2 - End X (pixels)
   * @param y2 - End Y (pixels)
   * @param callback - Called for each fixture hit. Receives (sprite, point, normal, fraction).
   *   Return `fraction` (0..1) to clip ray at hit and continue (finds closest).
   *   Return `0` to stop at first hit (finds any).
   *   Return `1` to continue without clipping (finds all).
   *   Return `-1` to filter this fixture and continue.
   *   `point` and `normal` are in world pixels; `fraction` is 0..1 along the ray.
   *   `sprite` is the hit Sprite, or null if the fixture has no sprite userData.
   */
  rayCast(
    x1: number | { x: number; y: number },
    y1: number | { x: number; y: number },
    x2: number,
    y2: number,
    callback: (sprite: Sprite | null, point: Vec2, normal: Vec2, fraction: number) => number
  ): void;
}

// ---- input ---------------------------------------------------------------

interface Kb {
  holdThreshold: number;
  // Key names are normalised before lookup, so all three spellings of the
  // same key work: what the browser reports ('ArrowRight', ' '), the reference API's
  // name ('arrowRight'), and the course's ('right', 'space'). Pressing an
  // arrow OR its WASD twin both answer to 'up'/'down'/'left'/'right'.
  // pressing() returns a plain boolean, true every frame the key is held
  // (matches the course: 5.1.5/6.3.3). Use holding(key) for the frame count.
  pressing(key: string): boolean;
  presses(key: string): boolean;
  holds(key: string): boolean;
  holding(key: string): number;
  held(key: string): boolean;
  released(key: string): boolean;
  // Matches the reference API: pressed() is an alias of released() — it fires on
  // key-UP, not key-down. See the comment above the `kb` object in moshion.js.
  pressed(key: string): boolean;

  // Named-key shorthands: same value kb.pressing(name) returns (a plain
  // boolean). The reference API exposes the raw signed counter here, which is
  // truthy on the release frame too — a deliberate divergence.
  readonly space: boolean;
  readonly enter: boolean;
  readonly escape: boolean;
  readonly tab: boolean;
  readonly backspace: boolean;
  readonly shift: boolean;
  readonly control: boolean;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly capsLock: boolean;
  readonly arrowUp: boolean;
  readonly arrowDown: boolean;
  readonly arrowLeft: boolean;
  readonly arrowRight: boolean;
  readonly meta: boolean;
  readonly cmd: boolean;
  readonly command: boolean;
  readonly win: boolean;
  readonly windows: boolean;
  readonly opt: boolean;
  readonly option: boolean;
  /** Alias of released() — true on the frame the key comes back up. */
  releases(key: string): boolean;
}

// `mouse` is the pointer, not strictly a mouse: a single touch drives exactly
// these same properties, so a sketch written against mouse.x / mouse.presses()
// works on a phone with no changes. A second finger is ignored — there is no
// touch gesture standing in for the right button, so .right never fires from
// touch and a sketch that needs two buttons needs a keyboard fallback too.
interface Mouse {
  x: number;
  y: number;
  // x/y/pos are WORLD coordinates (camera included, so they line up with
  // sprite.x/y, in whichever coordinate mode world.origin picks). canvasPos
  // is the same cursor with the camera taken out — the frame drawTop() draws
  // in — which is what a fixed HUD needs to hit-test against once the camera
  // scrolls.
  readonly pos: Vec2;
  readonly position: Vec2;
  readonly canvasPos: Vec2;
  holdThreshold: number;
  pressing(): boolean;
  presses(): boolean;
  holds(): boolean;
  holding(): number;
  held(): boolean;
  released(): boolean;
  pressed(): boolean;
  // Per-button counters; pressing() above stays "any button".
  readonly left: number;
  readonly center: number;
  readonly right: number;
  releases(): boolean;
  /** True while the cursor is over the canvas. */
  readonly isOnCanvas: boolean;
  /** False until the browser first reports a cursor position — until then
   *  mouse.x/y are 0, which is a real coordinate and not a safe target. */
  readonly isActive: boolean;
  /** CSS cursor on the canvas element. */
  cursor: string;
  /** Wheel movement since the last frame, zeroed each frame. */
  readonly scrollDelta: Vec2;
  /** Per-button drag counters, same signed-counter scheme as the press verbs. */
  drag(button?: number): number;
  dragging(button?: number): number;
  drags(button?: number): boolean;
  dragged(button?: number): boolean;
}

// ---- canvas --------------------------------------------------------------

declare class Canvas {
  constructor(w: number, h: number);
}

// ---- globals -------------------------------------------------------------

declare const world: World;
/** camera.x/y is the world point the canvas is CENTRED on. new Canvas() parks
 *  it on the canvas centre, so an untouched camera changes nothing: that is
 *  (w/2, h/2) by default and (0, 0) in math mode. */
interface Camera extends Vec2 {
  /** False while drawing is pinned to the screen. */
  readonly isActive: boolean;
  /** Draw in screen space from here on — for HUDs and overlays. In math mode
   *  "screen space" is still centred and y-up; the camera is just back at
   *  (0, 0), so text(score, -190, 130) sits near the top-left of a 400x300
   *  canvas. */
  off(): void;
  /** Back to world space. */
  on(): void;
}
declare const camera: Camera;
declare const kb: Kb;
declare const mouse: Mouse;
declare const allSprites: Group;
// Collider-type constants — the same strings .collider already accepts, so
// `s.collider = STATIC` and `s.collider = 'static'` are interchangeable.
declare const STATIC: 'static';
declare const DYNAMIC: 'dynamic';
declare const KINEMATIC: 'kinematic';
declare const STA: 'static';
declare const DYN: 'dynamic';
declare const KIN: 'kinematic';
declare const frameCount: number;
declare const width: number;
declare const height: number;
declare const mouseX: number;
declare const mouseY: number;

// ---- sketch lifecycle ----------------------------------------------------

// The four hooks the engine calls. A sketch defines the ones it needs as
// plain global functions; the engine auto-boots as soon as it sees setup().

/** Runs once, before the first frame. Must call `new Canvas(w, h)`. */
declare function setup(): void;
/** Runs each frame BEFORE the physics step, so a sprite moved here is moved
  * before this frame's collisions are resolved. `step` is the frame's
  * duration in seconds, capped at 0.05. */
declare function update(step: number): void;
/** Runs each frame after physics, BEFORE sprites are rendered. Anything drawn
  * here is painted underneath every sprite — draw backgrounds and world
  * decoration here, and put a HUD in drawTop(). */
declare function draw(): void;
/** Runs each frame AFTER sprites are rendered, in screen space (the camera is
  * off for its duration and restored afterwards). This is where a HUD goes:
  * `text('SCORE ' + score, 14, 20)` lands 14px from the canvas's left edge and
  * on top of the world, instead of behind whatever sprite is there. */
declare function drawTop(): void;

declare function background(color: string): void;
/** Text with its baseline on y. The letters rise above the baseline in both
 *  coordinate modes, so in math mode they rise toward +y; never mirrored. */
declare function text(str: string, x: number, y: number, size?: number, color?: string): void;
/**
 * Draws a light grid with labelled axes over the canvas, in the ACTIVE
 * coordinates, so students can see where (0, 0) is and which way y goes:
 * in math mode the axes cross at the centre and the y labels grow upward;
 * by default 0,0 is the top-left corner and the y labels grow downward.
 * `step` is the distance between lines (default 50). Call it from draw()
 * every frame you want it shown. It is painted after the sprites and before
 * drawTop(), so it shows over the world and under your HUD. It only draws:
 * no sprite, physics or collision changes.
 */
declare function showGrid(step?: number): void;
/** Prints the pointer's (x, y) in the active coordinates beside it. Call it
 *  from draw(); painted with showGrid(), over the sprites. */
declare function showMouse(): void;
declare function fill(c: string | number): void;
declare function textSize(px: number): void;
declare function textAlign(mode: 'left' | 'center' | 'right'): void;
/** rect(x, y, s, s, r): uses fill(), stroke(), noFill() and noStroke() like
 *  every other shape (before 2026-10-31 it ignored fill() and drew black). */
declare function square(x: number, y: number, s: number, r?: number): void;
declare function cos(angle: number): number;
declare function sin(angle: number): number;
declare function noLoop(): void;

declare const CENTER: 'center';
declare const LEFT: 'left';
declare const RIGHT: 'right';

/** Every texture name usable right now — built-ins plus saved art, sorted. */
declare function textureNames(): string[];
/** True if `sprite.texture = name` would resolve. */
declare function hasTexture(name: string): boolean;
/**
 * Save art under a name so `sprite.texture = name` finds it.
 *
 * `dataUrl` must be a `data:` URL; small pixel art only (the store caps a
 * value at 64 KB and the whole store at 512 KB).
 *
 * Pass `{ frames: n }` and `dataUrl` is read as a horizontal strip of n
 * equal frames — `sprite.texture = name` then animates it, no addAni needed.
 * `frameDelay` is game frames per animation frame (default 4); `delays` holds
 * each frame for its own number of game frames.
 */
declare function saveTexture(
  name: string,
  dataUrl: string,
  anim?: { frames: number; frameDelay?: number; delays?: number[] }
): void;
/** Forget a saved texture. Built-ins cannot be deleted. */
declare function deleteTexture(name: string): void;
declare function storeItem(name: string, val: any): void;
declare function getItem(name: string): any;
declare function removeItem(name: string): void;
declare function clearStorage(): void;

// ---- drawing primitives ---------------------------------------------------

declare function circle(x: number, y: number, d: number): void;
declare function ellipse(x: number, y: number, w: number, h?: number): void;
// Optional 5th arg `r` is a uniform corner radius (real q5's rect() takes
// four independent corner radii; moSHion's rect() only exposes one shared
// value — the only form real lesson code uses). The rectangle covers x..x+w
// and y..y+h in the active coordinates: from its corner (x, y) it extends
// down the screen by default and UP in math mode.
declare function rect(x: number, y: number, w: number, h: number, r?: number): void;
declare function line(x1: number, y1: number, x2: number, y2: number): void;
declare function clear(): void;
declare function stroke(c: string | number): void;
declare function noStroke(): void;
declare function strokeWeight(n: number): void;
declare function noFill(): void;

// ---- math & random ---------------------------------------------------------

declare function random(): number;
declare function random(max: number): number;
declare function random(min: number, max: number): number;
declare function random<T>(choices: T[]): T;
declare function randomSeed(seed: number): void;
declare function lerp(a: number, b: number, t: number): number;
// `clamp` (6th arg) swaps its bounds when ostart > ostop (a descending
// output range) — matches real q5's map(), not a fixed p5-only signature.
declare function map(value: number, istart: number, istop: number, ostart: number, ostop: number, clamp?: boolean): number;
declare function constrain(v: number, lo: number, hi: number): number;
// Arity-dispatched like real q5's dist(): two {x,y} points, four coords, or
// six coords for the 3D form.
declare function dist(a: Vec2, b: Vec2): number;
declare function dist(x1: number, y1: number, x2: number, y2: number): number;
declare function dist(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number;
declare function round(n: number, decimals?: number): number;
declare function ceil(n: number): number;
declare function floor(n: number): number;
declare function int(n: number): number; // alias of floor (real q5: NOT Math.trunc)
declare function abs(n: number): number;
declare function min(...values: number[]): number;
declare function min(values: number[]): number;
declare function max(...values: number[]): number;
declare function max(values: number[]): number;
declare function sqrt(n: number): number;
declare function pow(base: number, exponent: number): number;
declare function atan2(y: number, x: number): number;
declare function radians(deg: number): number;
declare function degrees(rad: number): number;
declare function nf(num: number, left?: number, right?: number): string;

declare const PI: number;
declare const TWO_PI: number;
declare const HALF_PI: number;

declare function millis(): number;
// Read-only in moSHion: real q5's frameRate(hz) also retargets the loop's
// cadence when `hz` is given — moSHion's fixed rAF loop doesn't support that,
// only the getter form ("frameRate() returns the actual fps") is real.
declare function frameRate(): number;

// ---- frame timers ------------------------------------------------------------

/** What every() and after() return. */
interface FrameTimer {
  /** False once stopped, or once an after() timer has fired. */
  readonly active: boolean;
  /** Cancels the timer. */
  stop(): void;
}
/** Calls fn every `frames` frames, starting `frames` frames from now. Counts
 *  frames, not seconds, so it pauses with noLoop() and stays in step with
 *  frameCount: every(60, fn) made in setup() fires on the same frames as
 *  `if (frameCount % 60 === 0)`. Timers run after update(), before physics. */
declare function every(frames: number, fn: () => void): FrameTimer;
/** Calls fn once, `frames` frames from now. Never in the frame that made it. */
declare function after(frames: number, fn: () => void): FrameTimer;

// ---- vector ----------------------------------------------------------------

declare class Vector {
  constructor(x?: number, y?: number);
  x: number;
  y: number;
  set(x: number | Vec2, y?: number): Vector;
  copy(): Vector;
  add(x: number | Vec2, y?: number): Vector;
  sub(x: number | Vec2, y?: number): Vector;
  mult(n: number): Vector;
  div(n: number): Vector;
  mag(): number;
  dist(v: Vec2): number;
  normalize(): Vector;
}

declare function createVector(x?: number, y?: number): Vector;

// ---- async loading -----------------------------------------------------------

// Returns a plain object synchronously (empty until the fetch resolves, then
// populated in place via Object.assign) and is thenable, so `await
// loadJSON(url)` also works — matches real q5. moSHion teaches (and only
// implements) the callback form; see 6.5.14.
declare function loadJSON(path: string, callback?: (data: any) => void): Promise<any> & Record<string, any>;

declare function start(): void;
