// moSHion type declarations — hand-authored from public/moshion/moshion.js.
// Covers the full public API surface exported by the engine IIFE.

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
  frame: number;
  spriteSheet: HTMLImageElement;
}

declare class Anis {
  [name: string]: Ani;
}

// ---- sprite --------------------------------------------------------------

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
  rotation: number;
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
  // same convention as .rotation) are a polar view onto .vel — setting one
  // preserves the other. A negative speed reverses.
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
  image: string | HTMLImageElement | null;

  addAni(name: string, sheetUrl: string, frameCount: number): Ani;
  changeAni(name: string): void;
  applyForce(fx: number, fy: number): void;
  // Live geometry query (continuous truthy while touching), not edge-
  // triggered — cb fires once per overlapping pair/sprite each call.
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
  // degree convention as .rotation and .direction (0 is right, 90 is down).
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

// ---- group ---------------------------------------------------------------

declare class Group extends Array<Sprite> {
  Sprite: typeof Sprite;

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

declare function loadSound(url: string, opts?: { clips?: SoundClips }): Sound;
/** Scales every sound at once without disturbing their individual volumes.
 *  Call with no argument to read the current value. */
declare function masterVolume(v?: number): number;

interface World {
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
}

// ---- input ---------------------------------------------------------------

interface Kb {
  holdThreshold: number;
  // Key names are normalised before lookup, so all three spellings of the
  // same key work: what the browser reports ('ArrowRight', ' '), the reference API's
  // name ('arrowRight'), and the course's ('right', 'space'). Pressing an
  // arrow OR its WASD twin both answer to 'up'/'down'/'left'/'right'.
  // pressing() returns the frame count while held (0 when idle), not a
  // plain boolean — truthy in every existing `if (kb.pressing(...))` check.
  pressing(key: string): number;
  presses(key: string): boolean;
  holds(key: string): boolean;
  holding(key: string): number;
  held(key: string): boolean;
  released(key: string): boolean;
  // Matches the reference API: pressed() is an alias of released() — it fires on
  // key-UP, not key-down. See the comment above the `kb` object in moshion.js.
  pressed(key: string): boolean;

  // Named-key shorthands: same value kb.pressing(name) returns (0, or the
  // held-frame count). The reference API exposes the raw signed counter here, which is
  // truthy on the release frame too — a deliberate divergence, DECISIONS D13.
  readonly space: number;
  readonly enter: number;
  readonly escape: number;
  readonly tab: number;
  readonly backspace: number;
  readonly shift: number;
  readonly control: number;
  readonly ctrl: number;
  readonly alt: number;
  readonly capsLock: number;
  readonly arrowUp: number;
  readonly arrowDown: number;
  readonly arrowLeft: number;
  readonly arrowRight: number;
  readonly meta: number;
  readonly cmd: number;
  readonly command: number;
  readonly win: number;
  readonly windows: number;
  readonly opt: number;
  readonly option: number;
  /** Alias of released() — true on the frame the key comes back up. */
  releases(key: string): boolean;
}

interface Mouse {
  x: number;
  y: number;
  // x/y/pos are WORLD coordinates (camera included, so they line up with
  // sprite.x/y). canvasPos is the same cursor in screen pixels — what a
  // fixed HUD needs to hit-test against once the camera scrolls.
  readonly pos: Vec2;
  readonly position: Vec2;
  readonly canvasPos: Vec2;
  holdThreshold: number;
  pressing(): number;
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
interface Camera extends Vec2 {
  /** False while drawing is pinned to the screen. */
  readonly isActive: boolean;
  /** Draw in screen space from here on — for HUDs and overlays. */
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

declare function background(color: string): void;
declare function text(str: string, x: number, y: number, size?: number, color?: string): void;
declare function fill(c: string | number): void;
declare function textSize(px: number): void;
declare function textAlign(mode: 'left' | 'center' | 'right'): void;
declare function square(x: number, y: number, s: number): void;
declare function cos(angle: number): number;
declare function sin(angle: number): number;
declare function noLoop(): void;

declare const CENTER: 'center';
declare const LEFT: 'left';
declare const RIGHT: 'right';

declare function storeItem(name: string, val: any): void;
declare function getItem(name: string): any;
declare function removeItem(name: string): void;
declare function clearStorage(): void;

// ---- drawing primitives ---------------------------------------------------

declare function circle(x: number, y: number, d: number): void;
declare function ellipse(x: number, y: number, w: number, h?: number): void;
// Optional 5th arg `r` is a uniform corner radius (real q5's rect() takes
// four independent corner radii; moSHion's rect() only exposes one shared
// value — the only form real lesson code uses).
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
