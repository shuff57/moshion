// moSHion type declarations — hand-authored from public/moshion/moshion.js.
// Covers the full public API surface exported by the engine IIFE.
//
// Coordinates: by default (0, 0) is the canvas's top-left corner, x grows to
// the right and y grows DOWN, like the browser canvas and p5play. That is
// `world.origin = 'screen'`. A sketch can ask for the grid from math class
// instead: `world.origin = 'math'` puts (0, 0) at the CENTRE of the canvas
// with y growing UP and angles turning counter-clockwise. Every x, y, angle
// and velocity in this file is then read in that frame. See World.origin.
//
// Units, all in one place (they are deliberately not all the same kind):
//   position, size            pixels
//   vel, speed, maxSpeed       pixels per FRAME (a game runs 60 frames a second
//                              on every screen, so vel.x = 2 is 120 px/s)
//   rotation, direction        degrees; angularVelocity in degrees per frame
//   gravity                    m/s² as Box2D has it (y = 10 is about 1g)
//   applyForce, attractTo      newtons
//   every, after, life,        frames
//   holdThreshold
//   Sound.fade                 seconds;  millis() milliseconds
//   cos, sin, tan, atan2       radians, or degrees after angleMode(DEGREES)

// ---- vector types --------------------------------------------------------

/** A point or a direction: an x and a y. */
interface Vec2 {
  /** Across, in pixels (or the x part of a speed or force). */
  x: number;
  /** Up or down, in pixels (or the y part of a speed or force). */
  y: number;
}

// ---- animation -----------------------------------------------------------

/** An animation: a strip of pictures shown one after another. `sprite.ani` and `sprite.texture` read back one. */
declare class Ani {
  /** The animation's name, as given to addAni() or the texture catalog. */
  name: string;
  /** How many pictures (frames) the animation has. */
  frameCount: number;
  /** Game frames each picture stays on screen before the next one (default 4). */
  frameDelay: number;
  /** Optional per-frame holds (game frames), one per frame; null = uniform frameDelay. */
  frameDelays: number[] | null;
  /** The frame showing, 0 first. Set it to jump there: a whole number, wrapped
   *  (-1 is the last frame), and the frame starts from the beginning of its duration. */
  frame: number;
  /** Game frames the current frame has been showing, 0 when it just started.
   *  Set it after `frame` to start part-way through a frame (kept below its duration). */
  tick: number;
  /** How many times it plays: true (default) forever, false once, a number n
   *  plays it n times (`loop = 3`). A finished animation stays on its last frame.
   *  Set `frame = 0` to play it again (the count starts over). Reads back true,
   *  false or the whole number set. */
  get loop(): boolean | number;
  set loop(v: boolean | number);
  /** Freezes the animation on the frame showing. `sprite.texture.pause()`. */
  pause(): void;
  /** Carries on from where pause() stopped it. Does not restart a finished
   *  animation: set `frame = 0` for that. */
  play(): void;
  /** true while paused. */
  readonly paused: boolean;
  /** The picture the frames are cut from. */
  spriteSheet: HTMLImageElement;
  /** The name, so `'using ' + sprite.texture` reads 'using coin'. */
  toString(): string;
}

/** What `sprite.texture` reads back for a still (one-picture) texture: the
 *  same fields as an animated one, with frameCount 1. */
declare class StillTexture {
  /** The texture's name, as in `sprite.texture = 'coin'`. */
  name: string;
  /** Always 0: one picture. */
  frame: number;
  /** Always 1. */
  frameCount: number;
  /** No effect on a still. */
  frameDelay: number;
  /** Always null: a still has no per-frame holds. */
  frameDelays: null;
  /** No effect on a still. */
  loop: boolean | number;
  /** No effect on a still. */
  pause(): void;
  /** No effect on a still. */
  play(): void;
  /** Always false: a still has nothing to pause. */
  readonly paused: boolean;
  /** The name, so `'using ' + sprite.texture` reads 'using coin'. */
  toString(): string;
}

/** A sprite's animations by name, filled in by addAni(). */
declare class Anis {
  /** One animation, by the name it was added under. */
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
/** A thing in the game: a shape or picture with physics. `new Sprite(x, y, w, h)` makes a box; `new Sprite(x, y, d)` a circle. */
declare class Sprite {
  /** No arguments: a 50x50 square where the camera is looking (the canvas
   *  centre until the camera moves). */
  constructor();
  constructor(x: number, y: number);
  constructor(x: number, y: number, d: number);
  constructor(x: number, y: number, w: number, h: number);
  /** A circle with a collider type: `new Sprite(200, 50, 30, 'static')`. */
  constructor(x: number, y: number, d: number, collider: Collider);
  constructor(x: number, y: number, w: number, h: number, collider: Collider);

  /** Where the sprite is (its centre), live: `player.pos = createVector(100, 50)` or `[100, 50]` moves it there, and Vector methods such as `player.pos.set(100, 50)` work on it too. */
  pos: Vector;
  /** How fast it moves, in pixels per frame. `player.vel.x = 3`, or `player.vel = createVector(3, 0)` to set both. */
  vel: Vector;
  /** @deprecated Another name for pos: use pos instead. */
  position: Vector;
  /** The x of the sprite's centre, in pixels. */
  x: number;
  /** The y of the sprite's centre, in pixels. */
  y: number;
  /** Fill colour of the shape, any CSS colour: 'red', '#ff79c6', rgba(255, 0, 0, 0.5). */
  color: string;
  /** Degrees. Positive turns clockwise in the default mode and
   *  counter-clockwise in math mode (world.origin = 'math'). */
  rotation: number;
  /** Degrees per frame, same turning direction as .rotation. */
  angularVelocity: number;
  /** Drawing order: a higher layer is drawn on top. Default 0. */
  layer: number;
  /** False hides the sprite; it still moves and collides. */
  visible: boolean;
  /** How big the art is drawn: `scale.x` across, `scale.y` up and down (1 = normal). The collider keeps its size. */
  scale: Vec2;
  /** Outline colour, or null for no outline. */
  stroke: string | null;
  /** Outline thickness, in pixels. */
  strokeWeight: number;
  /** Width and height. Setting either resizes the collider too (and on a
   *  circle, setting either sets both: a circle has one size). */
  w: number;
  /** Height in pixels. Setting it resizes the collider too. */
  h: number;
  /** 'box' is accepted as another name for 'rect'. Anything else throws. */
  shape: 'circle' | 'rect';
  /** How the sprite takes part in physics:
   *   'dynamic'   moves, falls, gets pushed (the default)
   *   'static'    never moves: floors and walls
   *   'kinematic' moves only by its vel, nothing pushes it: moving platforms
   *   'none'      passes through everything; overlaps() still sees it
   *  Any case, or the first letter ('s'), is accepted; anything else throws. */
  collider: Collider;
  /** @deprecated Another name for collider: use collider instead. */
  body: Collider;
  /** A circle's width across, in pixels. */
  diameter: number;
  /** How bouncy it is: 0 (no bounce, the default) to 1 (bounces back as high). */
  bounciness: number;
  /** How much it grips what it slides on: 0 is ice (the default). */
  friction: number;
  /** Default 1. Setting it rebuilds the collider, as bounciness/friction do. */
  density: number;
  // mass reads straight off the physics body; setting it scales density so
  // the resulting fixture mass matches (a static/kinematic sprite has 0
  // mass and ignores a mass assignment).
  /** How heavy the sprite is; setting it changes its density to match. */
  mass: number;
  // speed (px/frame, magnitude of .vel) and direction (degrees, 0 = right,
  // same convention as .rotation: 90 is down by default and UP in math mode)
  // are a polar view onto .vel — setting one preserves the other. A negative
  // speed reverses.
  /** How fast it moves in its direction, in pixels per frame. A negative speed goes backwards. */
  speed: number;
  /** Which way it moves, in degrees: 0 is right, 90 is down (up in math mode). */
  direction: number;
  // text: a HUD-style label drawn centered over the sprite (axis-aligned,
  // not rotated/scaled with the sprite's art). A number draws too, 0 included;
  // null/'' draws nothing.
  /** A label drawn over the middle of the sprite. Numbers work (0 shows "0"); null or '' shows nothing. */
  text: string | number | null;
  /** Colour of the sprite's label. */
  textColor: string;
  /** Size of the sprite's label, in pixels. */
  textSize: number;
  // opacity: 0..1, honoured by the sprite's own draw (art, debug outline,
  // and text all fade together).
  /** How see-through the sprite is: 0 invisible, 1 solid (the default). */
  opacity: number;
  // debug: draws the collider outline (not the art) in lime.
  /** True draws the collider's outline, to see what really touches. */
  debug: boolean;
  /** The animation playing now, or null. */
  ani: Ani | null;
  /** Still art: an emoji / short text ('🧍'), an image URL, or a ready <img> / <canvas>.
   *  null or '' goes back to the colored shape. Art that fails to load falls
   *  back to the colored shape rather than vanishing. */
  image: string | HTMLImageElement | HTMLCanvasElement | ImageBitmap | null;

  /**
   * Named art from the texture catalog, e.g. `sprite.texture = 'coin'`.
   *
   * Reads back as the texture itself: `sprite.texture.name` is 'coin', and an
   * animated one is controlled here too (`.frameDelay`, `.frame`, `.loop`,
   * `.frameCount`; it is the same object as `sprite.ani`). null when the
   * sprite has no texture. An animation made with `addAni()` counts too:
   * `sprite.texture` is the one showing, and `sprite.texture = 'run'`
   * switches to the sprite's own animation 'run' like `changeAni('run')`.
   * Setting the name it already shows does nothing
   * (no restart); a different name starts at its first picture. Setting it clears
   * `.image` and `.ani`, and setting either of those clears this. An
   * unknown name warns and leaves the sprite as it was. Drawn with image
   * smoothing off, so pixel art stays crisp when scaled.
   *
   * Names come from `textureNames()`: the built-in catalog plus anything
   * `saveTexture()` has stored. A saved name wins over a built-in one.
   */
  get texture(): Ani | StillTexture | null;
  set texture(name: string | Ani | StillTexture | null);
  /** A picture that repeats at its natural size inside the sprite's shape
   *  (anchored top-left) instead of stretching. For ground, walls and
   *  platforms. Any `image` / `texture` / `ani` draws instead. null clears it. */
  pattern: string | HTMLImageElement | HTMLCanvasElement | ImageBitmap | null;

  /** `sheet` is a picture's path or the name of a texture (a drawn animation brings its
   *  own frames and durations; a count given here overrides them). */
  addAni(name: string, sheet: string, frameCount?: number): Ani;
  /** Switches to an animation added with addAni(); an unknown name warns and changes nothing. */
  changeAni(name: string): void;
  /** A new sprite that looks and behaves like this one: size, shape, colour,
   *  outline, art, layer, rotation and physics settings, in the same groups.
   *  Made in the same spot and still; move it before the next frame (two
   *  solid sprites on top of each other push apart). Does not copy motion,
   *  life, joints, or properties the sketch made up (hp, points). */
  clone(): Sprite;
  /** Pushes the sprite with a force (newtons) this frame. */
  applyForce(fx: number, fy: number): void;
  // The touch verbs. One table, the same words on Sprite, Group and Sensor:
  //
  //               first frame   every frame (count)   last frame
  //   physics     collides      colliding             collided
  //   overlap     overlaps*     overlapping           overlapped
  //
  // physics = the solid bodies are touching (never counts collider 'none').
  // overlap = the shapes overlap, whatever the colliders (works for 'none').
  // * overlaps() is the exception: it is true on EVERY frame the two
  //   overlap, not only the first. It is a question, not a setting: calling
  //   a.overlaps(b) once in setup() does not let a and b pass through each
  //   other (it does in p5play); set a collider to 'none' for that. For the
  //   first frame only, use `overlapping(b) === 1`.
  //
  // `other` may be a Group: the count verbs answer with the longest count,
  // the rest with "any member". With a callback, cb(self, other) fires once
  // per sprite that answered, and may delete() sprites.
  // The touch verbs (see the table on Sprite), asked of every member.
  /** True every frame this sprite's shape overlaps `other`. It is a question; it does not let them pass through each other. */
  overlaps(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  /** Frames the two solid bodies have been touching; 0 when not touching. */
  colliding(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): number;
  /** True on the first frame the two solid bodies touch. */
  collides(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  /** True on the frame the two solid bodies stop touching. */
  collided(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  /** Frames the two shapes have been overlapping; 0 when not. */
  overlapping(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): number;
  /** True on the frame the two shapes stop overlapping. */
  overlapped(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  // Distance and bearing to another point or sprite. angleTo uses the same
  // degree convention as .rotation and .direction (0 is right; 90 is down by
  // default and up in math mode).
  /** Distance in pixels from this sprite's centre to a point or another sprite. */
  distanceTo(x: number, y: number): number;
  distanceTo(target: { x: number; y: number }): number;
  /** The angle in degrees from this sprite to a point or another sprite (0 is right). */
  angleTo(x: number, y: number): number;
  angleTo(target: { x: number; y: number }): number;
  // Multiplies the current .scale rather than replacing it. Art only — the
  // collider keeps the size set by .w/.h. (p5play's .scale also resizes the
  // collider; moSHion's is deliberately visual.)
  /** Multiplies the art's current scale; the collider keeps its size. */
  scaleBy(x: number, y?: number): void;
  /** Steps this fraction (default 0.1) of the remaining distance to the
   *  target every call — call once per update() frame for a smooth approach. */
  moveTowards(x: number, y: number, tracking?: number): void;
  moveTowards(target: { x: number; y: number }, tracking?: number): void;
  // The opposite of moveTowards.
  /** Steps away from a point or sprite: the opposite of moveTowards(). */
  moveAway(x: number, y: number, repel?: number): void;
  moveAway(target: { x: number; y: number }, repel?: number): void;
  // Applies a force (newtons, like applyForce) toward/away from a point,
  // the same strength whatever the distance.
  /** Pulls the sprite toward a point with a force (newtons), the same at any distance. */
  attractTo(x: number, y: number, force?: number): void;
  attractTo(target: { x: number; y: number }, force?: number): void;
  /** Pushes the sprite away from a point with a force (newtons), the same at any distance. */
  repelFrom(x: number, y: number, force?: number): void;
  repelFrom(target: { x: number; y: number }, force?: number): void;
  // Steps .rotation toward `angle` by at most `speed` degrees per call (the
  // shorter signed direction); with no `speed`, snaps immediately. Returns a
  // Promise only so `await` works as in p5play — the turn has already
  // happened by the time it resolves.
  /** Turns toward `angle` by at most `speed` degrees per call; with no speed it turns at once. */
  rotateTo(angle: number, speed?: number): Promise<Sprite>;
  // Unlike rotateTo, sets a spin speed proportional to the angle remaining,
  // so the sprite eases round over several frames instead of stepping.
  /** Spins toward an angle or a point, easing round over several frames. */
  rotateTowards(angle: number, tracking?: number): void;
  rotateTowards(target: { x: number; y: number }, tracking?: number): void;
  /** Destroys the sprite: it leaves the screen, the physics and every group. */
  delete(): void;
  /** Another name for delete(): destroys the sprite. (group.remove(s) is
   *  different: it only takes s out of the group.) */
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

  // ---- jumping -------------------------------------------------------------
  /** Jump, if a jump is left: launches it upward fast enough to rise
   *  120 px x jumpPower, at any gravity. True when it
   *  jumped, false when none were left. `ground` is what the sprite jumps off,
   *  like colliding(ground): a sprite or a Group. Only landing on it gives the
   *  jumps back (a crate or an enemy's head does not); the sprite remembers it.
   *  With nothing, any solid sprite is ground. It need not be touching ground to
   *  jump: with maxJumps 2 the second jump is in mid-air. Walking off a ledge
   *  uses up the first jump. The ground check is a thin sensor under the feet,
   *  made the first time any jump member is used (set them after the size), so
   *  a wall beside the sprite never counts, nor does a collider 'none' sprite.
   *  `if (kb.presses(' ')) { player.jump(platforms); }` */
  jump(ground?: Sprite | Group): boolean;
  /** The most jumps before landing again: 1 (the default) a normal jump, 2 a
   *  double jump. Whole numbers, 0 or more. */
  maxJumps: number;
  /** How high a jump goes: 1 (the default) is a normal jump of about 120 px,
   *  2 twice as high, 0.5 half, whatever world.gravity.y is (the launch speed
   *  is worked out from the gravity the sprite feels). 0 or more. */
  jumpPower: number;
  /** How many jumps are left before landing. Set it to give jumps back, even
   *  in mid-air: `player.jumpsLeft = player.maxJumps`. */
  jumpsLeft: number;
  /** True while ground is under the sprite's feet: what was last given to
   *  jump(ground), or any solid sprite. Never true while moving upward. */
  onGround: boolean;

  // ---- physics -------------------------------------------------------------
  /** How quickly it slows down, like air resistance: 0 is none. */
  drag: number;
  /** How quickly its spinning slows down: 0 is none. */
  rotationDrag: number;
  /** True freezes rotation, including explicit angularVelocity writes. */
  rotationLock: boolean;
  /** @deprecated Another name for angularVelocity: use angularVelocity instead. */
  rotationSpeed: number;
  /** Per-sprite multiplier on world gravity. 0 = weightless. */
  gravityScale: number;
  /** @deprecated Another name for drag: use drag instead. */
  rollingResistance: number;
  /** Twists the sprite with a turning force. */
  applyTorque(t: number): void;
  /** Like applyForce but multiplied by this sprite's mass, so sprites of
   *  different mass accelerate equally. */
  applyForceScaled(fx: number, fy: number): void;
  /** True while physics has let the sprite rest because it stopped moving. */
  sleeping: boolean;
  /** False keeps the sprite awake even when it stops moving. */
  allowSleeping: boolean;
  /** Continuous collision detection — for anything fast enough to tunnel. */
  isSuperFast: boolean;
  /** Works out the sprite's mass again from its size and density. */
  resetMass(): void;
  /** Read-only, in pixels. */
  readonly centerOfMass: Vec2;
  /** @deprecated Another name for collider: use collider instead. */
  physicsType: Collider;
  /** False leaves the sprite drawn but out of the simulation. */
  physicsEnabled: boolean;
  /** Makes the sprite a conveyor belt: what stands on it is carried this many pixels per frame, right when
   *  positive, left when negative, whichever sprite was made first. The surface runs round the sprite like a
   *  belt loop (clockwise on the screen when positive), so something under it goes the other way. Both
   *  sprites need a friction above 0 for the belt to grip. */
  surfaceSpeed: number;
  /** The opposite of physicsEnabled (the same flag, read the other way). */
  visualOnly: boolean;

  // ---- motion ---------------------------------------------------------------
  /** The turn needed to face a point, in degrees (signed, shortest). */
  angleToFace(x: number | { x: number; y: number }, y?: number, facing?: number): number;
  /** The absolute rotation that would face a point. */
  rotationToFace(x: number | { x: number; y: number }, y?: number, facing?: number): number;
  /** Sets the speed (pixels per frame) and direction (degrees) in one go. */
  setSpeedAndDirection(speed: number, direction: number): void;
  /** True when the sprite has any speed at all. */
  readonly isMoving: boolean;
  /** Position at the end of the previous frame. */
  readonly prevPos: Vec2;
  /** @deprecated Another name for prevPos: use prevPos instead. */
  readonly previousPosition: Vec2;
  /** The rotation at the end of the previous frame, in degrees. */
  readonly prevRotation: number;
  /** @deprecated Another name for prevRotation: use prevRotation instead. */
  readonly previousRotation: number;
  /** This sprite in screen pixels rather than world coordinates. */
  readonly canvasPos: Vec2;
  /** The mouse as this sprite sees it: hovering(), hovers(), hovered(), and
   *  presses() / pressing() / released() / dragging() for a press that began
   *  on this sprite. */
  readonly mouse: SpriteMouse;

  // ---- lifecycle and presentation -------------------------------------------
  /** Frames remaining; counts down and deletes at 0. Unset = immortal. */
  life: number;
  /** True once the sprite has been deleted. */
  readonly removed: boolean;
  /** @deprecated Another name for color: use color instead. */
  colour: string;
  /** @deprecated Another name for color: use color instead. */
  fill: string;
  /** @deprecated Another name for textColor: use textColor instead. */
  textFill: string;
  /** Outline colour for the sprite's label, or null for none. */
  textStroke: string;
  /** Outline thickness for the sprite's label, in pixels. */
  textStrokeWeight: number;
  /** Every group this sprite is in (a copy of the list). */
  readonly groups: Group[];
  /** Every joint attached to this sprite (a copy of the list). */
  readonly joints: Joint[];
  /** Default true. False skips this sprite in the render / update pass. */
  autoDraw: boolean;
  /** Default true. False stops this sprite's own update() running each frame. */
  autoUpdate: boolean;
  /** True pins the sprite to the screen instead of the world: it ignores the
   *  camera and draws after everything else. For HUDs. (p5play has no such
   *  flag; there a HUD is drawn with camera.off() instead.) */
  screenSpace: boolean;
  /** Assign to run your own logic each frame, or to take over drawing. */
  update?: () => void;
  /** Assign a function to draw the sprite yourself instead of the usual shape or art. */
  draw?: () => void;

  // Other names for numbers the sprite already has, so code written for
  // p5play works unchanged. Setting any of them resizes the collider.
  /** Another name for w: the width in pixels. */
  width: number;
  /** Another name for h: the height in pixels. */
  height: number;
  /** Half the width, in pixels. */
  hw: number;
  /** Half the height, in pixels. */
  hh: number;
  /** Another name for hw: half the width. */
  halfWidth: number;
  /** Another name for hh: half the height. */
  halfHeight: number;
  /** Another name for diameter. */
  d: number;
  /** A circle's radius: half its diameter. */
  r: number;
  /** Another name for r: half the diameter. */
  radius: number;
  /** @deprecated Another name for vel: use vel instead. */
  velocity: Vector;
}

/** The four collider types (see Sprite.collider). */
type Collider = 'dynamic' | 'static' | 'kinematic' | 'none';

/** What sprite.addSensor() returns. Answers from this frame's physics step,
 *  like colliding(). */
declare class Sensor {
  /** The sprite it rides on. */
  readonly sprite: Sprite;
  /** True while this sensor touches `other` (any member, for a Group). */
  overlaps(other: Sprite | Group, cb?: (sensor: Sensor, other: Sprite) => void): boolean;
  /** Frames it has been touching `other` (the longest member, for a Group); 0 when not. */
  overlapping(other: Sprite | Group, cb?: (sensor: Sensor, other: Sprite) => void): number;
  /** True on the frame it stops touching `other`. */
  overlapped(other: Sprite | Group, cb?: (sensor: Sensor, other: Sprite) => void): boolean;
  /** Takes the sensor off its sprite. Deleting the sprite does this too. */
  remove(): void;
}

// ---- group ---------------------------------------------------------------

/**
 * A list of sprites that share settings. Setting a sprite property on a group
 * sets it on every member it has NOW and remembers it for every member made
 * later with `new group.Sprite()`: color, stroke, layer, visible, opacity,
 * text and its styling, size (w, h, diameter...), shape, collider,
 * bounciness, friction, density, drag, rotationDrag, rotationLock,
 * gravityScale, and image / texture / pattern. Where a sprite is and how it
 * moves (x, y, vel, rotation, life) are not passed on to existing members.
 * A field you make up (`enemies.hp = 3`) is a starting value for new
 * members only.
 */
declare class Group extends Array<Sprite> {
  /** Makes a sprite that joins this group with its settings: `new coins.Sprite(x, y, 20)`. */
  Sprite: typeof Sprite;
  /** Catalog texture name for every member, current and future. */
  texture: string | null;
  /** Repeating picture for every member, current and future. */
  pattern: string | HTMLImageElement | HTMLCanvasElement | ImageBitmap | null;
  /** Art for every member, current and future (`new group.Sprite()`). */
  image: string | HTMLImageElement | HTMLCanvasElement | ImageBitmap | null;
  /** Scale for every member, current and future. A number sets both axes;
   *  `group.scale.y = 3` or `group.scale = { y: 3 }` sets one and leaves the other. */
  get scale(): { x: number; y: number };
  set scale(v: number | [number, number] | { x?: number; y?: number });

  /** The same as `new group.Sprite(x, y, w, h)`: a sprite with this group's settings, in this group. */
  newSprite(x: number, y: number, w?: number, h?: number): Sprite;
  /** Adds sprites to the group; a sprite already in it is not added twice. */
  push(...sprites: Sprite[]): number;
  /** True if any member overlaps `other` this frame (see Sprite.overlaps). */
  overlaps(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  /** The longest count of frames any member has been touching `other`. */
  colliding(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): number;
  /** True on the first frame any member touches `other`. */
  collides(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  /** True on the frame any member stops touching `other`. */
  collided(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;
  /** The longest count of frames any member has been overlapping `other`. */
  overlapping(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): number;
  /** True on the frame any member stops overlapping `other`. */
  overlapped(other: Sprite | Group, cb?: (self: Sprite, other: Sprite) => void): boolean;

  // Cascading versions of the Sprite methods of the same name — a group
  // already cascades properties, so these complete the pattern.
  /** Pushes every member with a force (newtons). */
  applyForce(fx: number, fy: number): void;
  /** Moves every member a step toward a point or sprite. */
  moveTowards(x: number | { x: number; y: number }, y?: number, tracking?: number): void;
  /** Moves every member a step away from a point or sprite. */
  moveAway(x: number | { x: number; y: number }, y?: number, repel?: number): void;
  /** Pulls every member toward a point with a force. */
  attractTo(x: number | { x: number; y: number }, y?: number, force?: number): void;
  /** Pushes every member away from a point with a force. */
  repelFrom(x: number | { x: number; y: number }, y?: number, force?: number): void;

  // Deletes members that have drifted this far outside the canvas and
  // returns how many went. With a callback, runs that instead of deleting —
  // the hook for wrapping or respawning rather than destroying.
  /** Deletes members that drifted `margin` pixels past the canvas edge and returns how many; with a callback, calls it instead. */
  cull(margin?: number, cb?: (sprite: Sprite, n: number) => void): number;
  cull(top: number, bottom: number, left: number, right: number, cb?: (sprite: Sprite, n: number) => void): number;

  /** Alias of push. */
  add(...sprites: Sprite[]): number;
  /** True if `s` is in this group. */
  contains(s: Sprite): boolean;
  /** Takes `s` out of this group only: it stays on screen, moving and
   *  colliding. To get rid of it, call s.remove() (or s.delete()). The first
   *  time this leaves a sprite on screen in a run, the console says so. */
  remove(s: Sprite): void;
  /** Deletes every member and empties the group. */
  delete(): void;
  /** @deprecated Another name for delete(): use delete() instead. */
  deleteAll(): void;
  /** Read or set the member count — setting spawns or deletes to match. */
  amount: number;
  /** Twists every member with a turning force. */
  applyTorque(t: number): void;
  /** Pushes every member with a force times its own mass, so all speed up the same. */
  applyForceScaled(fx: number, fy: number): void;
  /** Set on every member AND remembered for sprites that join later, so
   *  `allSprites.autoDraw = false` once in setup() covers sprites made
   *  afterwards. Reads true only if every member agrees (an empty group reads
   *  what it was last told, true if never). */
  autoDraw: boolean;
  /** Like autoDraw: false stops each member's own update(), for members now
   *  and later. */
  autoUpdate: boolean;
  /** Draws this group's sprites now, lowest layer first, with the camera,
   *  whatever their autoDraw says. With `allSprites.autoDraw = false`, call
   *  `allSprites.draw()` in update() or draw() to choose when the world is
   *  painted (background first, text after). screenSpace members are drawn
   *  after the rest, without the camera. */
  draw(): void;
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
  /** Builds the level: one string per row, the legend maps each character to the group it makes. */
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
  /** Four walls just off the edges of the screen; `thickness` defaults to 50 pixels. */
  constructor(thickness?: number); // default 50
  /** The wall above the screen. */
  readonly top: Sprite;
  /** The wall below the screen: `player.colliding(walls.bottom)` means on the floor. */
  readonly bottom: Sprite;
  /** The wall off the left edge. */
  readonly left: Sprite;
  /** The wall off the right edge. */
  readonly right: Sprite;
}

// ---- joints --------------------------------------------------------------

/** Settings a joint can be made with: `new HingeJoint(a, b, { anchor: { x: 100, y: 50 } })`. */
interface JointOptions {
  /** Where the joint holds the two sprites together, in world pixels. */
  anchor?: Vec2;
  /** DistanceJoint: how far apart it keeps the two centres, in pixels. */
  length?: number;
  /** SliderJoint and WheelJoint: the direction it slides or springs along, like { x: 1, y: 0 }. */
  axis?: Vec2;
  /** GrabberJoint: how hard it may pull (default 100). */
  maxForce?: number;
  /** HingeJoint: 0 (floppy, the default) to 1 (holds its starting pose). */
  stiffness?: number;
  /** HingeJoint: the smallest angle it may turn to, in degrees from the starting pose. */
  lowerLimit?: number | null;
  /** HingeJoint: the largest angle it may turn to, in degrees from the starting pose. */
  upperLimit?: number | null;
}

/** Every joint throws a TypeError if either argument is not a live Sprite,
 *  or if both are the same sprite. Where the joint pins the two together
 *  (`anchor`) defaults per joint: Hinge and Slider at sprite a, Wheel and
 *  Grabber at sprite b, Glue at sprite a; Distance joins the two centres. */
declare class Joint {
  /** Removes the joint; the two sprites carry on free. */
  delete(): void;
  /** Same as delete(). */
  remove(): void;
}

/** Angles are in degrees, counted from the pose the two sprites were in when
 *  the hinge was made, in the same direction as `rotation`. */
declare class HingeJoint extends Joint {
  /** Pins sprite a and sprite b together at one point so they can turn around it. */
  constructor(a: Sprite, b: Sprite, opt?: JointOptions);
  /** How hard it holds its starting pose: 0 floppy (default) to 1 stiff. */
  stiffness: number;
  /** Stops it turning below this angle; null for no limit. */
  lowerLimit: number | null;
  /** Stops it turning past this angle; null for no limit. */
  upperLimit: number | null;
  /** How far it has turned from the starting pose. */
  readonly angle: number;
}

/** Keeps two sprites a set distance apart, like a stick between them. */
declare class DistanceJoint extends Joint {
  /** Joins a and b at their current distance (or `opt.length`). */
  constructor(a: Sprite, b: Sprite, opt?: JointOptions);
  /** The distance it keeps between the two centres, in pixels; you can change it later. */
  length: number;
}

/** Lets sprite b slide along a line on sprite a, like a drawer. */
declare class SliderJoint extends Joint {
  /** Joins a and b so b slides along `opt.axis` (default across). */
  constructor(a: Sprite, b: Sprite, opt?: JointOptions);
}

/** A wheel on a spring: sprite b turns freely and bounces along an axis on sprite a. */
declare class WheelJoint extends Joint {
  /** Joins wheel b to body a, springing along `opt.axis` (default up and down). */
  constructor(a: Sprite, b: Sprite, opt?: JointOptions);
}

/** Pulls sprite b toward a target point, for dragging things with the mouse. */
declare class GrabberJoint extends Joint {
  /** Makes a grabber that pulls b; set `target` each frame to drag it. */
  constructor(a: Sprite, b: Sprite, opt?: JointOptions);
  /** Where sprite b is pulled to. Set it every frame to drag:
   *  `grab.target = mouse`. An untouched mouse is ignored. */
  target: Vec2;
}

/** Sticks two sprites together so they move as one. */
declare class GlueJoint extends Joint {
  /** Glues a and b together where they are now. */
  constructor(a: Sprite, b: Sprite);
}

// ---- world ---------------------------------------------------------------

// ---- sound ---------------------------------------------------------------

/** One file, many clips: { jump: [startSeconds, endSeconds], ... } */
interface SoundClips {
  /** A clip's start and end, in seconds. */
  [name: string]: [number, number];
}

/** A sound to play. Make one with loadSound(). */
declare class Sound {
  /** Loads a sound from a URL; `clips` names parts of one file to play on their own. */
  constructor(url: string, opts?: { clips?: SoundClips });
  /** The address the sound was loaded from. */
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
  /** Stops the sound but remembers the place: the next loop() (or play(),
   *  for music started with play()) carries on from there. The place is the
   *  loop's, else the newest play() still sounding; other voices just stop.
   *  stop() forgets it. */
  pause(): void;
  /** True between pause() and the next play(), loop() or stop(). */
  readonly paused: boolean;
  /** Stops every voice of this sound. */
  stop(): void;
  /** True while any voice of this sound is playing. */
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
  /** True once the file has downloaded and decoded. */
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

/** Load a sound from a URL or by name. A bare code-safe name (letters, digits,
 *  _) is looked up first in the store under `sound:<name>`, so a host page can
 *  save a wave with storeItem() and a sketch can play it by name. If nothing is
 *  saved, a built-in name (blip, clang, coin, crown, dice, door, explode, hit,
 *  jump, laser, levelup, lose, music, pop, potion, powerup, select, step,
 *  sword, title, tone, whoosh, win) plays the engine's own sound:
 *  `loadSound('coin')`. Any other name is used as a URL. A path or a data: URI
 *  is fetched directly and is never looked up. */
declare function loadSound(url: string, opts?: { clips?: SoundClips }): Sound;
/** Scales every sound at once without disturbing their individual volumes.
 *  Call with no argument to read the current value. */
declare function masterVolume(v?: number): number;

/** The physics world: gravity, which way the coordinates go, and questions like "what is here?". */
interface World {
  /**
   * Which way the coordinates go: 'screen' (the default; (0, 0) is the
   * top-left corner, y grows down) or 'math' ((0, 0) is the centre, y grows
   * up). Read it any time; set it once, at the top of setup(), before any
   * sprite is made and before gravity is set.
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
   *  falling world is y = -10. `world.gravity = createVector(0, 10)` or
   *  `[0, 10]` sets both at once. */
  gravity: Vec2;
  /** The topmost sprite at a point (highest layer; on a tie, the one made
   *  later), or undefined. Hits HUD (screenSpace) sprites where they are drawn. */
  getSpriteAt(x: number, y: number): Sprite | undefined;
  getSpriteAt(point: { x: number; y: number }): Sprite | undefined;
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
  /** False keeps every sprite awake, even ones that stopped moving. */
  allowSleeping: boolean;
  /** Default true. False hands stepping to the sketch via physicsUpdate(). */
  autoStep: boolean;
  /** Moves the physics on one step yourself (only when autoStep is false). */
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
  /** With no callback: the closest SOLID sprite on the line (sensors and
   *  collider 'none' are looked through), or null.
   *  `if (world.rayCast(p.x, p.y, p.x, p.y + 30)) { onGround = true; }` */
  rayCast(x1: number, y1: number, x2: number, y2: number): RayHit | null;
  rayCast(from: Vec2, to: Vec2): RayHit | null;
  rayCast(
    x1: number | { x: number; y: number },
    y1: number | { x: number; y: number },
    x2: number,
    y2: number,
    callback: (sprite: Sprite | null, point: Vec2, normal: Vec2, fraction: number) => number
  ): void;
}

/** What world.rayCast() hands back: the sprite hit and where. */
interface RayHit {
  /** The sprite hit, or null for a body that is not a sprite. */
  sprite: Sprite | null;
  /** Where the ray hit, in world pixels. */
  point: Vec2;
  /** Which way the surface faces where the ray hit (a direction of length 1). */
  normal: Vec2;
  /** 0..1, how far along the ray. */
  fraction: number;
}

// ---- input ---------------------------------------------------------------

/** The keyboard. Ask about a key by name: `kb.presses('space')`, `kb.pressing('left')`. */
interface Kb {
  /** Frames a key must stay down to count as held (default 12). */
  holdThreshold: number;
  // Key names are normalised, so every spelling of a key works: what the
  // browser reports ('ArrowRight', ' '), p5play's ('arrowRight'), and the
  // course's ('right', 'space'). An arrow OR its WASD twin answers to
  // 'up'/'down'/'left'/'right'.
  //
  //   presses(k)   the first frame it goes down
  //   pressing(k)  true every frame it is held (holding(k) gives the count)
  //   holds(k)     the one frame it has been held holdThreshold frames
  //   released(k)  the frame it comes back up
  //   held(k)      the frame it comes up after being held past holdThreshold
  /** True on the first frame the key goes down. */
  presses(key: string): boolean;
  /** True every frame the key is held down. */
  pressing(key: string): boolean;
  /** True on the one frame the key has been held holdThreshold frames. */
  holds(key: string): boolean;
  /** Frames held, once held past holdThreshold; 0 before that. */
  holding(key: string): number;
  /** True on the frame the key comes up after being held past holdThreshold. */
  held(key: string): boolean;
  /** True on the frame the key comes back up. */
  released(key: string): boolean;
  /** @deprecated Fires when the key comes back UP (it is released(), as in
   *  p5play), not when it goes down: use kb.presses() for the moment it goes
   *  down, or kb.released() for this same moment. The first call each run
   *  says so in the console. */
  pressed(key: string): boolean;

  // Named-key shorthands: the same as kb.pressing(name), true while held.
  /** True while the space bar is held. */
  readonly space: boolean;
  /** True while Enter is held. */
  readonly enter: boolean;
  /** True while Escape is held. */
  readonly escape: boolean;
  /** True while Tab is held. */
  readonly tab: boolean;
  /** True while Backspace is held. */
  readonly backspace: boolean;
  /** True while Shift is held. */
  readonly shift: boolean;
  /** True while Control is held. */
  readonly control: boolean;
  /** True while Control is held (short for control). */
  readonly ctrl: boolean;
  /** True while Alt (Option on a Mac) is held. */
  readonly alt: boolean;
  /** True while Caps Lock is held. */
  readonly capsLock: boolean;
  /** True while the up arrow is held. */
  readonly arrowUp: boolean;
  /** True while the down arrow is held. */
  readonly arrowDown: boolean;
  /** True while the left arrow is held. */
  readonly arrowLeft: boolean;
  /** True while the right arrow is held. */
  readonly arrowRight: boolean;
  /** True while the Windows or Command key is held. */
  readonly meta: boolean;
  /** True while the Command key is held (another name for meta). */
  readonly cmd: boolean;
  /** True while the Command key is held (another name for meta). */
  readonly command: boolean;
  /** True while the Windows key is held (another name for meta). */
  readonly win: boolean;
  /** True while the Windows key is held (another name for meta). */
  readonly windows: boolean;
  /** True while Option (Alt) is held (another name for alt). */
  readonly opt: boolean;
  /** True while Option (Alt) is held (another name for alt). */
  readonly option: boolean;
  /** @deprecated Another name for released(): use released() instead. */
  releases(key: string): boolean;
}

// `mouse` is the pointer, not strictly a mouse: a single touch drives exactly
// these same properties, so a sketch written against mouse.x / mouse.presses()
// works on a phone with no changes. A second finger is ignored — there is no
// touch gesture standing in for the right button, so .right never fires from
// touch and a sketch that needs two buttons needs a keyboard fallback too.
/** The mouse, or a finger on a touch screen: where it is and what its buttons are doing. */
interface Mouse {
  /** The pointer's x, in world coordinates (lines up with sprite.x). */
  x: number;
  /** The pointer's y, in world coordinates (lines up with sprite.y). */
  y: number;
  // x/y/pos are WORLD coordinates (camera included, so they line up with
  // sprite.x/y, in whichever coordinate mode world.origin picks). canvasPos
  // is the same cursor with the camera taken out — the frame drawTop() draws
  // in — which is what a fixed HUD needs to hit-test against once the camera
  // scrolls.
  /** The pointer as a point, in world coordinates. */
  readonly pos: Vec2;
  /** Another name for pos: the pointer as a point. */
  readonly position: Vec2;
  /** The pointer in screen pixels, with the camera taken out: for a HUD. */
  readonly canvasPos: Vec2;
  /** Frames a button must stay down to count as held (default 12). */
  holdThreshold: number;
  // The same verbs as kb, for a button: 'left', 'center' or 'right'. With no
  // button they answer for ANY button. `mouse.presses('right')` is the first
  // frame of a right-click. Any other name throws.
  /** True every frame the button is held down. */
  pressing(button?: MouseButton): boolean;
  /** True on the first frame the button goes down. */
  presses(button?: MouseButton): boolean;
  /** True on the one frame the button has been held holdThreshold frames. */
  holds(button?: MouseButton): boolean;
  /** Frames held, once held past holdThreshold; 0 before that. */
  holding(button?: MouseButton): number;
  /** True on the frame the button comes up after being held past holdThreshold. */
  held(button?: MouseButton): boolean;
  /** True on the frame the button comes back up. */
  released(button?: MouseButton): boolean;
  /** @deprecated Fires when the button comes back UP, like kb.pressed(): use
   *  mouse.presses() for the moment it goes down, or mouse.released() for this
   *  same moment. The first call each run says so in the console. */
  pressed(button?: MouseButton): boolean;
  /** @deprecated Another name for released(): use released() instead. */
  releases(button?: MouseButton): boolean;
  /** Frames this button has been held (0 when up). Prefer pressing('left'). */
  readonly left: number;
  /** Frames the middle button has been held (0 when up). */
  readonly center: number;
  /** Frames the right button has been held (0 when up). */
  readonly right: number;
  /** True while the cursor is over the canvas. */
  readonly isOnCanvas: boolean;
  /** False until the browser first reports a cursor position — until then
   *  mouse.x/y are 0, which is a real coordinate and not a safe target. */
  readonly isActive: boolean;
  /** CSS cursor on the canvas element ('pointer', 'crosshair', 'none'...).
   *  Set before new Canvas() it is applied when the canvas is made. */
  cursor: string;
  /** False hides the pointer over the canvas (cursor 'none'); true brings
   *  back the cursor it had before. */
  visible: boolean;
  /** Wheel movement since the last frame, zeroed each frame. */
  readonly scrollDelta: Vec2;
  /** The raw drag counter for a button (default 'left'): frames moved while
   *  held, negative for one frame on release. Also readable as
   *  mouse.drag.left / .center / .right. */
  drag: ((button?: MouseButton) => number) & { readonly left: number; readonly center: number; readonly right: number };
  /** Frames the pointer has moved with this button held; 0 when not. */
  dragging(button?: MouseButton): number;
  /** The first frame of a drag. */
  drags(button?: MouseButton): boolean;
  /** The frame a drag ends. */
  dragged(button?: MouseButton): boolean;
}
/** A mouse button by name. */
type MouseButton = 'left' | 'center' | 'right';

// ---- canvas --------------------------------------------------------------

/** The drawing area. Make one at the top of setup(). */
declare class Canvas {
  /** Makes the canvas, `w` pixels wide and `h` tall, and sets width and height. */
  constructor(w: number, h: number);
}

// ---- globals -------------------------------------------------------------

/** The physics world: gravity, coordinates, ray casts and more. */
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
/** The camera: move camera.x and camera.y to scroll the world. */
declare const camera: Camera;
/** The keyboard: `kb.presses('space')`, `kb.pressing('left')`. */
declare const kb: Kb;
/** The mouse (or one finger): `mouse.x`, `mouse.presses()`. */
declare const mouse: Mouse;

/** sprite.mouse. Buttons are 'left' | 'center' | 'right', or nothing for any
 *  button, as for mouse. The point test is world.getSpriteAt()'s, so a
 *  sprite under another one still counts as hovered. */
interface SpriteMouse {
  /** True while the pointer is over the sprite. */
  hovering(): boolean;
  /** True on the first frame the pointer is over the sprite. */
  hovers(): boolean;
  /** True on the first frame after the pointer left the sprite. */
  hovered(): boolean;
  /** True on the first frame of a press that began over the sprite. */
  presses(button?: MouseButton): boolean;
  /** True while a press that began over the sprite is held, even if the
   *  pointer has slid off it since. */
  pressing(button?: MouseButton): boolean;
  /** True on the frame a press that began over the sprite is let go. */
  released(button?: MouseButton): boolean;
  /** Frames the pointer has moved with a press that began over the sprite
   *  held (default 'left'), else 0. */
  dragging(button?: MouseButton): number;
}
/** The group every sprite joins by itself. */
declare const allSprites: Group;
// Collider-type constants — the same strings .collider already accepts, so
// `s.collider = STATIC` and `s.collider = 'static'` are interchangeable.
// STA/DYN/KIN are the same three again, shorter.
/** 'static': a collider that never moves (floors, walls). */
declare const STATIC: 'static';
/** 'dynamic': a collider that moves, falls and gets pushed. */
declare const DYNAMIC: 'dynamic';
/** 'kinematic': a collider that moves only by its vel; nothing pushes it. */
declare const KINEMATIC: 'kinematic';
/** Short for STATIC. */
declare const STA: 'static';
/** Short for DYNAMIC. */
declare const DYN: 'dynamic';
/** Short for KINEMATIC. */
declare const KIN: 'kinematic';
/** How many frames have run since the game started. */
declare const frameCount: number;
/** Milliseconds since the previous frame, as in p5: about 16.7 at 60 frames a
 *  second, more when the computer is slow. `deltaTime / 1000` is the same in
 *  seconds, so `x += 120 * deltaTime / 1000` moves 120 pixels a second whatever
 *  the frame rate. 0 before the first frame. */
declare const deltaTime: number;
/** The canvas width, in pixels. */
declare const width: number;
/** The canvas height, in pixels. */
declare const height: number;
/** Another name for mouse.x. */
declare const mouseX: number;
/** Another name for mouse.y. */
declare const mouseY: number;

// ---- sketch lifecycle ----------------------------------------------------

// The four hooks the engine calls. A sketch defines the ones it needs as
// plain global functions; the engine auto-boots as soon as it sees setup().

/** Runs once, before the first frame. Must call `new Canvas(w, h)`. */
declare function setup(): void;
/** Runs each frame BEFORE the physics step, so a sprite moved here is moved
  * before this frame's collisions are resolved. The game runs 60 frames a
  * second on any screen (a 144 Hz monitor does not speed it up). `step` is
  * the real time since the last frame in seconds, capped at 0.05. */
declare function update(step: number): void;
/** Runs each frame after physics, BEFORE sprites are rendered. Anything drawn
  * here is painted underneath every sprite — draw backgrounds and world
  * decoration here, and put a HUD in drawTop(). The one exception is text()
  * after textLayer(n) (here or in update()), which is painted among the
  * sprites by layer. */
declare function draw(): void;
/** Runs each frame AFTER sprites are rendered, in screen space (the camera is
  * off for its duration and restored afterwards). This is where a HUD goes:
  * `text('SCORE ' + score, 14, 20)` lands 14px from the canvas's left edge and
  * on top of the world, instead of behind whatever sprite is there. */
declare function drawTop(): void;
/** Optional. Runs once, BEFORE setup(), and the game waits until every file
  * it asks for is ready: loadSound(), loadJSON() and loadImage() called here
  * hand their object back at once, and by setup() it is loaded (a picture's
  * width/height are real, the JSON object is filled in). No time limit; a file
  * that fails is reported in the console and the game starts without it; if no
  * file finishes for 10 s, a Start anyway button appears. Called anywhere else
  * the loaders load in the background, as always. */
declare function preload(): void;

/** Paints the whole canvas one colour: a CSS colour, a grey 0-255, or r, g, b (and alpha 0-255). */
declare function background(c: string | number): void;
declare function background(gray: number, alpha: number): void;
declare function background(r: number, g: number, b: number, alpha?: number): void;
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
/** A CSS colour ('red', '#ff79c6'), one number for grey (0-255), grey and
 *  alpha, r, g, b, or r, g, b, alpha. Alpha is 0-255. */
declare function fill(c: string | number): void;
declare function fill(gray: number, alpha: number): void;
declare function fill(r: number, g: number, b: number, alpha?: number): void;
/** A colour from red, green and blue (0-255) and how solid it is (alpha 0-1,
 *  default 1), as a CSS string for fill(), stroke(), background() or .color:
 *  `rgba(255, 99, 71, 0.5)` is 'rgba(255, 99, 71, 0.5)'. `rgba([r, g, b], a)`
 *  works too. Numbers are rounded and kept in range. */
declare function rgba(r: number, g: number, b: number, a?: number): string;
declare function rgba(rgb: [number, number, number] | [number, number, number, number], a?: number): string;
/** A random colour as a CSS string: randomColor() is solid, randomColor(0.5)
 *  half see-through, randomColor(0.2, 0.8) a random alpha in that range. Uses
 *  random(), so randomSeed() repeats it. */
declare function randomColor(minAlpha?: number, maxAlpha?: number): string;
/** Size of the letters text() draws, in pixels. */
declare function textSize(px: number): void;
/** Where text() lines up with its x: LEFT, CENTER or RIGHT. */
declare function textAlign(mode: 'left' | 'center' | 'right'): void;
/** Bold or italic text: textStyle(BOLD), textStyle(ITALIC), textStyle(BOLDITALIC)
 *  for both, textStyle(NORMAL) to go back. Each call replaces the last one
 *  (BOLD is weight 700, NORMAL is 400 and upright), and it lasts until you
 *  change it, like textSize(). With nothing, it returns the style in force.
 *  Throws a TypeError for any other value. */
declare function textStyle(style: 'normal' | 'bold' | 'italic' | 'bold italic'): void;
declare function textStyle(): 'normal' | 'bold' | 'italic' | 'bold italic';
/** How thick the letters are, 100 (thin) to 900 (heavy): 400 is normal, 700
 *  is bold. A font without that weight uses its nearest one. With nothing,
 *  returns the weight in force. Throws a TypeError for anything else. */
declare function textWeight(weight: number): void;
declare function textWeight(): number;
/** The typeface for text(): a built-in font ('sans', 'serif', 'code',
 *  'rounded', 'pixel', 'arcade', 'handwriting', 'comic', 'bubbly', 'space',
 *  'spooky', 'slab', 'blocky', 'script', 'tall') or the name of a font you
 *  saved. textFont('monospace') goes back to the default. An unknown name
 *  warns once in the console and leaves the font as it was. With nothing,
 *  returns the font's name. */
declare function textFont(name: string): void;
declare function textFont(): string;
/** Every font name textFont() accepts right now: 'monospace', the built-in
 *  fonts and the ones you saved, sorted. */
declare function fontNames(): string[];
/** A line under the text (UNDERLINE), through it (STRIKETHROUGH), both, or
 *  NONE. The line is the text's colour and grows with its size. With
 *  nothing, returns 'none', 'underline', 'line-through' or both. */
declare function textDecoration(...lines: Array<'underline' | 'line-through' | 'none'>): void;
declare function textDecoration(): string;
/** An outline around every letter, drawn behind it: textOutline('black', 3).
 *  Thickness is in pixels (default 2). textOutline() turns it off. */
declare function textOutline(color?: string | number | null, thickness?: number): void;
/** Extra pixels between letters; a negative number squeezes them. 0 is
 *  normal. With nothing, returns the spacing in force. */
declare function textSpacing(px: number): void;
declare function textSpacing(): number;
/** Pixels from one line of text to the next (a '\n' in text(), or textWrap()).
 *  textLeading(null) goes back to 1.25 x the text size. */
declare function textLeading(px: number | null): void;
declare function textLeading(): number | null;
/** Breaks text() onto new lines so it fits inside `width` pixels: between
 *  words (WORD, the default) or anywhere (CHAR). A '\n' always starts a new
 *  line. textWrap() turns wrapping off. */
declare function textWrap(width?: number | null, mode?: 'word' | 'char'): void;
/** Puts the text() calls that follow, in update() or draw(), on layer `n` among the
 *  sprites: over every sprite whose `.layer` is `n` or lower, under every
 *  sprite whose `.layer` is higher (a tie goes to the text). Texts on one
 *  layer keep the order they were written in. Like textSize(), it lasts until
 *  you change it; `textLayer()` with nothing (or null) goes back to the
 *  default, painted at once, under every sprite. The fill, size, alignment and
 *  camera (on or off) are the ones in force when text() is called.
 *  screenSpace sprites and drawTop() still go over it, and text() in drawTop()
 *  is painted at once whatever this says. Throws a TypeError for anything
 *  that is not a number. */
declare function textLayer(n?: number | null): void;
/** rect(x, y, s, s, r): uses fill(), stroke(), noFill() and noStroke() like
 *  every other shape (before 2026-10-31 it ignored fill() and drew black). */
declare function square(x: number, y: number, s: number, r?: number): void;
/** Radians by default; degrees after angleMode(DEGREES), the unit every
 *  sprite angle (rotation, direction, angleTo) already uses. */
declare function cos(angle: number): number;
/** The sine of an angle (radians, or degrees after angleMode(DEGREES)). */
declare function sin(angle: number): number;
/** The tangent of an angle (radians, or degrees after angleMode(DEGREES)). */
declare function tan(angle: number): number;
/** Returns radians, or degrees after angleMode(DEGREES). */
declare function atan(v: number): number;
/** Sets the unit cos/sin/tan take and atan/atan2 return. With no argument,
 *  returns the current one. Default RADIANS. */
declare function angleMode(mode?: typeof DEGREES | typeof RADIANS): typeof DEGREES | typeof RADIANS;
/** For angleMode(DEGREES): angles in degrees. */
declare const DEGREES: 'degrees';
/** For angleMode(RADIANS): angles in radians (the default). */
declare const RADIANS: 'radians';
/** Stops the game loop: no more frames. */
declare function noLoop(): void;

/** 'center', for textAlign(CENTER). */
declare const CENTER: 'center';
/** 'left', for textAlign(LEFT). */
declare const LEFT: 'left';
/** 'right', for textAlign(RIGHT). */
declare const RIGHT: 'right';
/** 'normal', for textStyle(NORMAL). */
declare const NORMAL: 'normal';
/** 'bold', for textStyle(BOLD). */
declare const BOLD: 'bold';
/** 'italic', for textStyle(ITALIC). */
declare const ITALIC: 'italic';
/** 'bold italic', for textStyle(BOLDITALIC). */
declare const BOLDITALIC: 'bold italic';
/** 'underline', for textDecoration(UNDERLINE). */
declare const UNDERLINE: 'underline';
/** 'line-through', for textDecoration(STRIKETHROUGH). */
declare const STRIKETHROUGH: 'line-through';
/** 'none', for textDecoration(NONE). */
declare const NONE: 'none';
/** 'word', for textWrap(width, WORD): break between words. */
declare const WORD: 'word';
/** 'char', for textWrap(width, CHAR): break anywhere. */
declare const CHAR: 'char';

/** Every texture name usable right now — built-ins plus saved art, sorted. */
declare function textureNames(): string[];
/** True if `sprite.texture = name` would resolve. */
declare function hasTexture(name: string): boolean;
/**
 * Save art under a name so `sprite.texture = name` finds it.
 *
 * `dataUrl` must be a `data:` URL; small pixel art only (up to 64 KB each;
 * the page running the game sets the total).
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
/** Saves a value under a name so it is still there next time the game runs. */
declare function storeItem(name: string, val: any): void;
/** Reads back a value saved with storeItem(), or null if there is none. */
declare function getItem(name: string): any;
/** Forgets the value saved under a name. */
declare function removeItem(name: string): void;
/** Forgets every value saved with storeItem, by every sketch on the site; saved pictures, sounds and fonts are kept. */
declare function clearStorage(): void;

// ---- drawing primitives ---------------------------------------------------

/** Draws a circle centred on (x, y), `d` pixels across. */
declare function circle(x: number, y: number, d: number): void;
/** Draws an ellipse centred on (x, y), `w` wide and `h` tall (h defaults to w). */
declare function ellipse(x: number, y: number, w: number, h?: number): void;
// Optional 5th arg `r` is a uniform corner radius (real q5's rect() takes
// four independent corner radii; moSHion's rect() only exposes one shared
// value — the only form real lesson code uses). The rectangle covers x..x+w
// and y..y+h in the active coordinates: from its corner (x, y) it extends
// down the screen by default and UP in math mode.
/** Draws a rectangle from corner (x, y), `w` wide and `h` tall, with optional round corners `r`. */
declare function rect(x: number, y: number, w: number, h: number, r?: number): void;
/** Draws a line from (x1, y1) to (x2, y2). */
declare function line(x1: number, y1: number, x2: number, y2: number): void;
/** Wipes the whole canvas to see-through. */
declare function clear(): void;
/** A CSS colour ('red', '#ff79c6'), one number for grey (0-255), grey and
 *  alpha, r, g, b, or r, g, b, alpha. Alpha is 0-255. */
declare function stroke(c: string | number): void;
declare function stroke(gray: number, alpha: number): void;
declare function stroke(r: number, g: number, b: number, alpha?: number): void;
/** Shapes drawn after this have no outline. */
declare function noStroke(): void;
/** Outline thickness for shapes drawn after this, in pixels. */
declare function strokeWeight(n: number): void;
/** Shapes drawn after this have no fill. */
declare function noFill(): void;

// ---- math & random ---------------------------------------------------------

// random() is seeded fresh on every run in runner.html, so each playthrough
// differs. randomSeed(n) in setup() makes a run repeatable.
/** A random number: 0 up to 1, 0 up to max, min up to max, or a random item from a list. */
declare function random(): number;
declare function random(max: number): number;
declare function random(min: number, max: number): number;
declare function random<T>(choices: T[]): T;
/** Starts random() from a fixed point so a run is the same every time. */
declare function randomSeed(seed: number): void;
/** The number `t` of the way from a to b (t = 0.5 is halfway). */
declare function lerp(a: number, b: number, t: number): number;
// `clamp` (6th arg) swaps its bounds when ostart > ostop (a descending
// output range) — matches real q5's map(), not a fixed p5-only signature.
/** Converts a value from one range to another: map(50, 0, 100, 0, 1) is 0.5. */
declare function map(value: number, istart: number, istop: number, ostart: number, ostop: number, clamp?: boolean): number;
/** Keeps v between lo and hi. */
declare function constrain(v: number, lo: number, hi: number): number;
// Arity-dispatched like real q5's dist(): two {x,y} points, four coords, or
// six coords for the 3D form.
/** The distance between two points. */
declare function dist(a: Vec2, b: Vec2): number;
declare function dist(x1: number, y1: number, x2: number, y2: number): number;
declare function dist(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number;
/** Rounds to the nearest whole number, or to `decimals` places. */
declare function round(n: number, decimals?: number): number;
/** Rounds up to a whole number. */
declare function ceil(n: number): number;
/** Rounds down to a whole number. */
declare function floor(n: number): number;
/** Rounds down to a whole number (the same as floor). */
declare function int(n: number): number; // alias of floor (real q5: NOT Math.trunc)
/** The number without its minus sign. */
declare function abs(n: number): number;
/** The smallest of some numbers, or of a list. */
declare function min(...values: number[]): number;
declare function min(values: number[]): number;
/** The largest of some numbers, or of a list. */
declare function max(...values: number[]): number;
declare function max(values: number[]): number;
/** The square root. */
declare function sqrt(n: number): number;
/** `base` to the power of `exponent`. */
declare function pow(base: number, exponent: number): number;
/** Returns radians, or degrees after angleMode(DEGREES). */
declare function atan2(y: number, x: number): number;
/** Turns degrees into radians. */
declare function radians(deg: number): number;
/** Turns radians into degrees. */
declare function degrees(rad: number): number;
/** A number as text, padded to `left` digits before the point and `right` after: nf(7, 3) is '007'. */
declare function nf(num: number, left?: number, right?: number): string;

/** Pi, about 3.14159: half a turn in radians. */
declare const PI: number;
/** Two times pi: a whole turn in radians. */
declare const TWO_PI: number;
/** Half of pi: a quarter turn in radians. */
declare const HALF_PI: number;

/** Milliseconds since setup() started. */
declare function millis(): number;
// Read-only in moSHion: real q5's frameRate(hz) also retargets the loop's
// cadence when `hz` is given — moSHion's fixed rAF loop doesn't support that,
// only the getter form ("frameRate() returns the actual fps") is real.
/** Frames per second the game is really running at. */
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

/** A point or arrow with x and y, made with createVector(). */
declare class Vector {
  /** Makes a vector; x and y default to 0. */
  constructor(x?: number, y?: number);
  /** The x part. */
  x: number;
  /** The y part. */
  y: number;
  /** Sets x and y (or copies another point); returns the same vector. */
  set(x: number | Vec2 | [number, number], y?: number): Vector;
  /** A new vector with the same x and y. */
  copy(): Vector;
  /** Adds another point (or x and y) to this one; returns the same vector. */
  add(x: number | Vec2 | [number, number], y?: number): Vector;
  /** Takes another point (or x and y) away from this one; returns the same vector. */
  sub(x: number | Vec2 | [number, number], y?: number): Vector;
  /** Multiplies x and y by n; returns the same vector. */
  mult(n: number): Vector;
  /** Divides x and y by n; returns the same vector. */
  div(n: number): Vector;
  /** The vector's length. */
  mag(): number;
  /** The distance to another point. */
  dist(v: Vec2 | [number, number]): number;
  /** Makes the vector length 1, keeping its direction; returns the same vector. */
  normalize(): Vector;
}

/** Makes a Vector: `createVector(3, 0)`. */
declare function createVector(x?: number, y?: number): Vector;

// ---- async loading -----------------------------------------------------------

// Returns a plain object synchronously (empty until the fetch resolves, then
// populated in place via Object.assign) and is thenable, so `await
// loadJSON(url)` also works — matches real q5. moSHion teaches (and only
// implements) the callback form; see 6.5.14.
/** Loads a JSON file. Use the callback, `await loadJSON(url)`, or call it in preload() and use the object in setup(). */
declare function loadJSON(path: string, callback?: (data: any) => void): Promise<any> & Record<string, any>;
/** A picture by URL (or data: URI), the same shared <img> that
  * `sprite.image = url` uses. Call it in preload() and img.width/img.height are
  * real in setup(); `sprite.image = img` draws it. */
declare function loadImage(url: string): HTMLImageElement;

/** Starts the game. The engine calls this by itself when it sees setup(), so a sketch never needs to. */
declare function start(): void;
