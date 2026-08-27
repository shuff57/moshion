/* teaching-engine.js — beginner-game-API API spike, physics via planck.js (Box2D).
 *
 * Goal: prove we can reimplement the exact API surface Q2 of the curriculum
 * already teaches, license-clean (our facade is MIT; planck.js is MIT, a
 * pure-JS/TS rewrite of Box2D by Ali Shakiba — vendored in vendor/planck.min.js).
 *
 * Facade — the student-facing API (audited exhaustively against all 86 real
 * lessons/.../script.js + solution.js, plus content.md/lesson.json prose):
 *   new Canvas(w, h)          setup()/update()/draw() hooks
 *   new Sprite(x,y[,w,h[,bodyType]])   (x,y,d) is a circle; (x,y) is 50x50
 *                             .pos .vel .color .rotation .layer .shape .scale
 *                             .body / .collider ('dynamic'|'static'|'kinematic'|'none' sensor)
 *                             .diameter .visible .stroke .strokeWeight
 *                             .bounciness .friction .applyForce
 *                             .overlaps(other[, cb]) .colliding(other) .delete()/.remove()
 *   new Group()               array-like, shared property defaults,
 *                             new groupName.Sprite(...) factory (W10)
 *   allSprites                implicit group every sprite auto-joins
 *   kb.pressing('left')       kb.presses('space')   (edge-triggered)
 *   mouse.x/y                 mouse.pressing()  mouse.presses()  (edge)
 *   world.gravity.y           frameCount        world.getSpriteAt(x,y)
 *   background(color)         camera.x / camera.y
 *   fill(c) textSize(px) textAlign(CENTER|LEFT|RIGHT)   text(str,x,y)
 *   square(x,y,s)  cos/sin  mouseX/mouseY  width/height  noLoop()
 *   storeItem/getItem         (localStorage)
 *   sprite.addAni/changeAni   (2.4.x minimal sprite-sheet animation)
 *   sprite.image = url        (still image; a string with no '.' is an emoji
 *                             placeholder instead of a URL, e.g. '🧍')
 *   new HingeJoint(a,b,opt)   new DistanceJoint(a,b,opt)   joint.delete()
 *   new SliderJoint(a,b,opt)  new WheelJoint(a,b,opt)  new GrabberJoint(a,b,opt)
 *   new GlueJoint(a,b)        joint.length (DistanceJoint, settable post-construction)
 *
 * Physics: REAL Box2D (via planck.js), not arcade.
 *   - Stacking, sleeping, actual circle colliders, joints (W17) all work.
 *   - Units: the FACADE speaks pixels-per-frame (vel.x=4 → 240 px/s at 60fps,
 *     matching what Q2 teaches and A10.2 asks students to compute). The adapter
 *     converts to Box2D meters behind the scenes.
 *   - `overlaps()` is a manual bounding-box query (sensor-style, for
 *     `collider = 'none'` sprites). `colliding()` reads planck's real contact
 *     list (solid-body physics contact) — they are NOT aliases of each other.
 *
 * SCOPE (2D only — 3D is out of scope by design): see bottom of this header.
 */

(function (global) {
  'use strict';

  if (!global.planck) {
    throw new Error('planck.js missing — include vendor/planck.min.js before engine.js');
  }
  const pl = global.planck;

  // Pixels per Box2D meter. 30px = 1m keeps world objects human-sized.
  const PXM = 30;
  const FPS = 60;

  // ---- globals every sketch sees ---------------------------------------

  let CANVAS_ = null;    // HTMLCanvasElement
  let CTX_ = null;       // 2d context
  let W_ = 0, H_ = 0;

  let FRAME_ = 0;
  let START_TIME_ = 0;   // performance.now() right before setup() runs, for millis()
  let FPS_ = 0;           // 1 / last frame's dt, for frameRate()
  let ALL_ = [];         // all sprites, in creation order
  let WORLD_ = null;     // planck World, lazily created
  let JOINTS_ = [];      // all joints, so they survive sprite GC

  // ---- input state ------------------------------------------------------

  // Each input (keyboard key, mouse button) is one signed frame counter —
  // the same state machine the reference API uses (the reference implementation// ~6672-6730 InputDevice, ~8118-8122 the per-frame sweep):
  //   0 idle | 1..N frame count while held | -3 pressed+released same frame
  //   -1 released before holdThreshold | -2 released after holdThreshold
  // Rising/falling edges are set by the DOM handlers below; the
  // continuation (++ while held, decay to 0 one frame after going negative)
  // happens once per frame in loop()'s post-draw sweep — see the comment
  // there for why it must run AFTER update/draw.
  const KEYS_ = {};
  const MOUSE = {
    x: 0, y: 0, _c: 0, _bl: 0, _bc: 0, _br: 0, _seen: false,
    _onCanvas: false,
    scrollDelta: { x: 0, y: 0 },
    // drag counters (see mouse.drag/dragging/drags/dragged) and the
    // per-frame "moved while held" flags the mousemove handler sets, read
    // and cleared once per frame in loop()'s sweep.
    _dl: 0, _dc: 0, _dr: 0,
    _mvl: false, _mvc: false, _mvr: false,
  };

  // A key has three spellings and the engine has to accept all of them: what
  // the DOM reports ('ArrowRight', ' '), what the reference API's docs print
  // ('arrowRight'), and what this course teaches ('right', 'space').
  //
  // Before this existed there was no normalisation at all: `kb.pressing()`
  // read KEYS_['right'] while the keydown handler wrote KEYS_['arrowright'],
  // so 166 call sites across 31 lessons — 5-1-20-moshion-move-keys among them —
  // were permanently false. Nothing threw, so the corpus gate (which never
  // presses a key) stayed green through the whole gauntlet.
  const KEY_ALIASES_ = {
    space: ' ', spacebar: ' ', esc: 'escape', ctrl: 'control',
    cmd: 'meta', command: 'meta', win: 'meta', windows: 'meta',
    opt: 'alt', option: 'alt', del: 'delete', return: 'enter',
  };
  // Pressing an arrow OR its WASD twin bumps the same direction name, so
  // `kb.pressing('left')` answers for both — the reference API's _simpleKeyControls
  // (the reference implementation), which is why its docs can say "arrows or WASD".
  const KEY_DIRS_ = {
    arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    i: 'up2', k: 'down2', j: 'left2', l: 'right2',
  };
  // Single chars pass through as-is (so ' ' stays ' '); longer names lose
  // spaces/underscores/hyphens, matching the reference API's _ac().
  function _key(name) {
    if (typeof name !== 'string') return name;
    const k = name.length === 1 ? name.toLowerCase() : name.replace(/[ _-]/g, '').toLowerCase();
    return KEY_ALIASES_[k] || k;
  }

  const kb = {
    holdThreshold: 12,
    pressing: (k) => { const v = KEYS_[_key(k)] || 0; return v === -3 ? 1 : v > 0 ? v : 0; },
    presses: (k) => { const v = KEYS_[_key(k)] || 0; return v === 1 || v === -3; },
    holds: (k) => (KEYS_[_key(k)] || 0) === kb.holdThreshold,
    holding: (k) => { const v = KEYS_[_key(k)] || 0; return v >= kb.holdThreshold ? v : 0; },
    held: (k) => (KEYS_[_key(k)] || 0) === -2,
    released: (k) => (KEYS_[_key(k)] || 0) <= -1,
    // The reference API's kb.pressed() is (confusingly, but verified against
    // the reference implementation) an ALIAS of released() — it fires the
    // frame the key comes back UP, not the frame it goes down. Matched here
    // exactly even though several reading lessons (6.5.11 etc.) read like
    // they expect a down-edge trigger — see build report for the disagreement.
    pressed: (k) => kb.released(k),
    // The reference API's releases() is a literal alias of released() (verified
    // against the reference implementation: `releases(inp) { return
    // this.released(inp); }`) — both are already true for exactly one frame
    // under this file's counter/decay scheme (the sweep in loop() zeroes any
    // negative value the frame after it's set), so no new state is needed.
    releases: (k) => kb.released(k),
  };
  const mouse = {
    holdThreshold: 12,
    // False until the browser reports the cursor's position at least once.
    // Before that mouse.x/y are both 0, which is a real coordinate on the
    // canvas and therefore indistinguishable from the corner.
    get isActive() { return MOUSE._seen; },
    get x() { return MOUSE.x; },
    get y() { return MOUSE.y; },
    get pos() { return { x: MOUSE.x, y: MOUSE.y }; },
    get position() { return mouse.pos; },
    // mouse.x/y are WORLD coordinates — they include the camera offset, so
    // they line up with sprite.x/y in a scrolling game. canvasPos is the
    // same cursor in SCREEN pixels, which is what a fixed HUD needs: without
    // it, a HUD button hit-tested against mouse.x starts answering wrong the
    // moment the camera moves, and nothing errors.
    get canvasPos() { return { x: MOUSE.x - _camLeft(), y: MOUSE.y - _camTop() }; },
    pressing: () => { const v = MOUSE._c; return v === -3 ? 1 : v > 0 ? v : 0; },
    presses: () => { const v = MOUSE._c; return v === 1 || v === -3; },
    holds: () => MOUSE._c === mouse.holdThreshold,
    holding: () => { const v = MOUSE._c; return v >= mouse.holdThreshold ? v : 0; },
    held: () => MOUSE._c === -2,
    released: () => MOUSE._c <= -1,
    pressed: () => mouse.released(),
    // Same alias relationship as kb.releases() above (the reference implementation).
    releases: () => mouse.released(),
    // True once the browser has reported the cursor inside the canvas and
    // stays true until a mouseleave — tracked by the two listeners in
    // start(). The reference API exposes the same name (mouse.isOnCanvas).
    get isOnCanvas() { return MOUSE._onCanvas; },
    // CSS cursor on the canvas element itself — the reference API's mouse.cursor
    // (the reference implementation) reads/writes $.canvas.style.cursor directly.
    get cursor() { return CANVAS_ ? CANVAS_.style.cursor : 'default'; },
    set cursor(v) { if (CANVAS_) CANVAS_.style.cursor = v; },
    // Wheel delta accumulated since the last frame, zeroed in the per-frame
    // sweep (matches the reference API's postDraw: `m.scrollDelta.x = 0` etc,
    // the reference implementation) — read it once per draw() call, not per event.
    get scrollDelta() { return MOUSE.scrollDelta; },
    // drag/dragging/drags/dragged: the reference API's separate per-button counter for
    // "moved while this button was held", NOT the same counter as
    // pressing/presses/released above. Ported from the reference implementation +
    // the onpointermove/onpointerup/postDraw wiring at ~6997-7020/8097-8107:
    // `drag` is the raw {left,center,right} frame-count object itself (goes
    // negative for one frame on release, like every other counter here);
    // dragging()/drags()/dragged() are the level/edge/release readers on it.
    get drag() { return { left: MOUSE._dl, center: MOUSE._dc, right: MOUSE._dr }; },
    dragging: (inp) => { const v = MOUSE[_dragSlot(inp)]; return v > 0 ? v : 0; },
    drags: (inp) => MOUSE[_dragSlot(inp)] === 1,
    dragged: (inp) => MOUSE[_dragSlot(inp)] <= -1,
  };
  // left/center/right (default 'left', matching the reference API's Mouse._default,
  // the reference implementation) -> the MOUSE.* drag-counter slot each name backs.
  function _dragSlot(inp) {
    const k = (inp || 'left').toString().toLowerCase();
    return k === 'right' ? '_dr' : (k === 'center' || k === 'middle') ? '_dc' : '_dl';
  }
  // Per-button counters. `mouse.pressing()` stays "any button" so existing
  // lessons are untouched; left/center/right answer for one button each.
  const MOUSE_BTN_ = { 0: '_bl', 1: '_bc', 2: '_br' };
  for (const [prop, slot] of Object.entries({ left: '_bl', center: '_bc', right: '_br' })) {
    Object.defineProperty(mouse, prop, {
      enumerable: true,
      get() { const v = MOUSE[slot]; return v === -3 ? 1 : v > 0 ? v : 0; },
    });
  }

  // Named-key properties, so `kb.space` and `kb.arrowUp` work alongside
  // `kb.pressing('space')`.
  //
  // The reference API exposes these as the RAW signed counter, which is truthy on the
  // release frames (-1/-2) — `if (kb.space) jump()` there fires a second time
  // when the key comes back up. Ours returns what kb.pressing() returns: 0, or
  // the held-frame count. A deliberate divergence (DECISIONS.md D13); the
  // parity check that measures it is marked informational.
  for (const [prop, key] of Object.entries({
    space: ' ', enter: 'enter', escape: 'escape', tab: 'tab', backspace: 'backspace',
    shift: 'shift', control: 'control', ctrl: 'control', alt: 'alt', capsLock: 'capslock',
    arrowUp: 'arrowup', arrowDown: 'arrowdown', arrowLeft: 'arrowleft', arrowRight: 'arrowright',
    // meta/cmd/command/win/windows all name the same OS key; opt/option
    // name Alt on a Mac keyboard. KEY_ALIASES_ already folds every one of
    // these spellings down to 'meta'/'alt' for kb.pressing('cmd') etc — this
    // just exposes the same normalized key as a named property, like kb.space.
    meta: 'meta', cmd: 'meta', command: 'meta', win: 'meta', windows: 'meta',
    opt: 'alt', option: 'alt',
  })) {
    Object.defineProperty(kb, prop, { enumerable: true, get: () => kb.pressing(key) });
  }

  // world.gravity — raw Box2D m/s², exactly like the reference API's world.gravity.
  // `world.gravity.y = 10` is ~1g; `= 0` is zero-G. The px/frame² facade
  // unit was 60x too strong (10 px/frame² = 1200 m/s² = 122g), which crushed
  // wheel-joint suspensions and sent pong balls flying. Live proxy vector so
  // `world.gravity.y = 0` sticks (a plain getter returning a fresh object
  // made gravity writes silent no-ops).
  const world = {};
  Object.defineProperty(world, 'gravity', {
    get() {
      const g = _world().getGravity();
      return {
        get x() { return g.x; },
        get y() { return g.y; },
        set x(v) { const c = _world().getGravity(); _world().setGravity(pl.Vec2(v, c.y)); },
        set y(v) { const c = _world().getGravity(); _world().setGravity(pl.Vec2(c.x, v)); },
      };
    },
    set(v) { _world().setGravity(pl.Vec2(v.x, v.y)); },
  });

  // camera.off() / camera.on() switch drawing between world space and screen
  // space, the reference API's idiom for HUDs (the reference implementation turns it off before the
  // post-draw pass). While off, drawing primitives ignore the camera, so a
  // score or a button stays put while the level scrolls underneath it.
  const camera = {
    // camera.x/y is the world point the viewport is CENTRED ON, which is
    // what the reference API means by it and what every 6.4 lesson says it means.
    // It is not a top-left translation offset: new Canvas() sets these to
    // the canvas centre, so an untouched camera shows the world exactly as
    // authored, and `camera.x = player.x` puts the player dead-centre.
    // Measured 2026-08-25: as an offset it pinned the player to the left
    // edge, half off-canvas, in the course's own 6.4.16 example.
    x: 0,
    y: 0,
    _active: true,
    get isActive() { return camera._active; },
    off() { camera._active = false; },
    on() { camera._active = true; },
  };

  // Every camera transform in the file goes through here. Eight call sites
  // used to repeat the translate inline; one of them missing the isActive
  // check would put a single primitive in the wrong space, which is the kind
  // of bug you chase for an hour.
  // The world coordinate at the viewport's top-left corner. Every conversion
  // between world and screen space goes through these two, so the centre-vs-
  // corner question is answered in exactly one spot.
  function _camLeft() { return camera.x - (W_ || 0) / 2; }
  function _camTop() { return camera.y - (H_ || 0) / 2; }

  function _applyCamera() {
    if (camera._active) CTX_.translate(-_camLeft(), -_camTop());
  }

  // Named collider-type constants, matching the reference API's globals. Their VALUES
  // are exactly the strings .body/.collider/.physicsType already accept
  // (see Sprite._buildFixture -> this._body.setType(this._bodyType)), so
  // `sprite.body = STATIC` and `sprite.body = 'static'` are identical.
  const DYNAMIC = 'dynamic', STATIC = 'static', KINEMATIC = 'kinematic';
  const DYN = DYNAMIC, STA = STATIC, KIN = KINEMATIC;

  // ---- canvas -----------------------------------------------------------

  class Canvas {
    constructor(w, h) {
      W_ = w; H_ = h;
      CANVAS_ = document.createElement('canvas');
      CANVAS_.width = w; CANVAS_.height = h;
      CTX_ = CANVAS_.getContext('2d');
      // An untouched camera must be a no-op, so it starts centred on the
      // canvas rather than at the world origin.
      camera.x = w / 2;
      camera.y = h / 2;
      document.body.appendChild(CANVAS_);
    }
  }

  function background(color) {
    CTX_.save();
    _applyCamera();
    CTX_.fillStyle = color;
    CTX_.fillRect(_camLeft(), _camTop(), W_, H_);
    CTX_.restore();
  }

  function _world() {
    if (!WORLD_) WORLD_ = pl.World({ gravity: pl.Vec2(0, 9.8) });
    return WORLD_;
  }

  // ---- sprite -----------------------------------------------------------

  // A live vector: reads/writes the underlying Box2D body on every axis access,
  // so `player.vel.x = 3` and `player.pos.y += 5` work exactly like the reference API.
  function liveVec(read, write) {
    return {
      get x() { return read().x; },
      get y() { return read().y; },
      set x(v) { const c = read(); write(v, c.y); },
      set y(v) { const c = read(); write(c.x, v); },
    };
  }

  class Sprite {
    constructor(x, y, w, h, bodyType) {
      // The reference API constructor-argument dispatch, matched to actual lesson
      // call shapes (audited across all 86 real script.js/solution.js):
      //   new Sprite(x, y)             -> 50x50 square (group-factory shorthand)
      //   new Sprite(x, y, d)          -> circle, diameter d (2.2.6 lab)
      //   new Sprite(x, y, w, h)       -> rect
      //   new Sprite(x, y, w, h, type) -> rect + bodyType ('static'|'kinematic'|'dynamic')
      let isCircle = false;
      if (w !== undefined && h === undefined) { isCircle = true; h = w; }
      else if (w === undefined) { w = 50; h = 50; }

      this._body = _world().createBody({ type: 'dynamic', position: pl.Vec2(x / PXM, y / PXM) });
      this._body.setUserData(this);

      this.w = w;
      this.h = h;
      this.color = 'deeppink';
      this.layer = 0;
      this.visible = true;
      this._scale = { x: 1, y: 1 };
      // true pins this sprite to the screen instead of the world — it ignores
      // the camera and draws after everything else. For HUDs. See render().
      this.screenSpace = false;
      this.stroke = null;
      this.strokeWeight = 1;
      this.ani = null;
      this._anis = null;
      this._img = null;
      this._emoji = null;
      this._groups = []; // every Group this sprite currently belongs to (incl. allSprites)

      // real p5play Sprite surface (D2: add the knob, keep moSHion's current
      // effective default so no existing sketch changes behavior).
      this.text = null;
      this.textColor = 'white';
      this.textSize = 16;
      this._textStroke = null;
      this._textStrokeWeight = null;
      this.opacity = 1;
      this.debug = false;
      this._direction = 0; // cached heading (deg) so it survives a zero-speed moment
      this._surfaceSpeed = 0; // px/frame, re-applied to every active contact each frame — see surfaceSpeed
      this._joints = []; // every Joint currently attached to this sprite — see `joints`
      this.autoDraw = true;
      this.autoUpdate = true;
      this._visualOnly = false;
      this._prevPos = null; // snapshotted once per frame in loop() — see prevPos
      this._prevRotation = null;

      // raw physics knobs — getters/setters below rebuild the fixture on change
      this._shape = isCircle ? 'circle' : 'rect';
      this._bodyType = bodyType || 'dynamic';
      this._sensor = false; // true when collider = 'none' (sensor, no collision response)
      this._bounciness = 0;
      this._friction = 0;
      // D2/D1: expose density, defaulted to moSHion's current hardcoded 1 —
      // NOT p5play's 5 (that default is a deliberate curriculum choice, see
      // DECISIONS.md D1; only the capability is new, not the default).
      this._density = 1;
      this._buildFixture();

      this.pos = liveVec(
        () => { const p = this._body.getPosition(); return { x: p.x * PXM, y: p.y * PXM }; },
        (x, y) => this._body.setPosition(pl.Vec2(x / PXM, y / PXM)),
      );
      // planck (Box2D) clamps a body's per-step translation to 2 metres —
      // its anti-tunnelling safety, so a fast body can't skip through a
      // thin wall between physics steps. At PXM=30 that's a hard ceiling of
      // 60 px/frame: setting vel.x = 900 silently settles to 60 by the next
      // step, with no error and no warning. DO NOT raise the clamp to chase
      // a higher number — planck exposes no per-body override, and a config
      // that did raise it would let sprites pass through walls. If a lesson
      // needs faster motion, the fix is a bigger world scale (larger PXM),
      // not a bigger vel.x.
      this.vel = liveVec(
        () => { const v = this._body.getLinearVelocity(); return { x: v.x * PXM / FPS, y: v.y * PXM / FPS }; },
        (x, y) => this._body.setLinearVelocity(pl.Vec2(x * FPS / PXM, y * FPS / PXM)),
      );

      ALL_.push(this);
      allSprites.push(this);
    }

    _buildFixture() {
      if (this._fixture) { this._body.destroyFixture(this._fixture); }
      const r = (this._shape === 'circle' ? this.w : this.w) / 2 / PXM;
      const hw = this.w / 2 / PXM;
      const hh = this.h / 2 / PXM;
      const shape = this._shape === 'circle' ? pl.Circle(r) : pl.Box(hw, hh);
      const fd = {
        shape,
        density: this._bodyType === 'dynamic' ? this._density : 0,
        friction: this._friction,
        restitution: this._bounciness,
        isSensor: !!this._sensor,
      };
      this._fixture = this._body.createFixture(fd);
      this._body.setType(this._bodyType);
    }

    get shape() { return this._shape; }
    set shape(s) { this._shape = s; this._buildFixture(); }
    get body() { return this._bodyType; }
    set body(t) { this._bodyType = t; this._buildFixture(); }
    get bounciness() { return this._bounciness; }
    set bounciness(v) { this._bounciness = v; this._buildFixture(); }
    get friction() { return this._friction; }
    set friction(v) { this._friction = v; this._buildFixture(); }
    // density (D2): fixture density in Box2D units — rebuilds the fixture,
    // same convention as bounciness/friction above.
    get density() { return this._density; }
    set density(v) { this._density = v; this._buildFixture(); }

    // real p5play Sprite surface: mass reads straight off the planck body;
    // setting it scales density so the resulting fixture mass matches
    // (planck has no direct "set mass" — mass is a function of density and
    // shape area). A static/kinematic sprite has 0 mass (0 density) and a
    // mass assignment on one is a no-op, matching real physics.
    get mass() { return this._body.getMass(); }
    set mass(m) {
      const current = this._body.getMass();
      if (current > 0) this.density = this._density * (m / current);
    }

    // ---- physics knobs (SPEC-surface #1) — thin get/set facades over the
    // planck Body/Fixture calls named in each comment. Ported 1:1 from
    // the reference implementation's own get/set pairs (drag ~1835, rotationDrag ~1988,
    // rotationLock ~1996, gravityScale ~2371, isSuperFast ~1873,
    // allowSleeping ~1603, physicsEnabled ~1622, physicsType ~1632); none of
    // these change any EXISTING getter, so no prior sketch is affected.
    get drag() { return this._body.getLinearDamping(); }
    set drag(v) { this._body.setLinearDamping(v); }
    get rotationDrag() { return this._body.getAngularDamping(); }
    set rotationDrag(v) { this._body.setAngularDamping(v); }
    get rotationLock() { return this._body.isFixedRotation(); }
    set rotationLock(v) {
      this._body.setFixedRotation(v);
      if (v) this._body.setAngularVelocity(0);
    }
    // rotationSpeed is the reference API's OWN name for this file's angularVelocity
    // (deg/frame) — a literal alias, both stay live (the reference implementation).
    get rotationSpeed() { return this.angularVelocity; }
    set rotationSpeed(v) { this.angularVelocity = v; }
    get gravityScale() { return this._body.getGravityScale(); }
    set gravityScale(v) { this._body.setGravityScale(v); }
    applyTorque(t) { this._body.applyTorque(t, true); }
    // Force scaled by this sprite's own mass, so the same fx/fy accelerates
    // every sprite equally regardless of size (the reference implementation).
    applyForceScaled(fx, fy) {
      const m = this.mass;
      this._body.applyForceToCenter(pl.Vec2(fx * m, fy * m), true);
    }
    get sleeping() { return !this._body.isAwake(); }
    set sleeping(v) { this._body.setAwake(!v); }
    get allowSleeping() { return this._body.isSleepingAllowed(); }
    set allowSleeping(v) { this._body.setSleepingAllowed(v); }
    // Continuous collision detection — for a body moving fast enough to
    // tunnel through a thin wall between physics steps (the reference implementation).
    get isSuperFast() { return this._body.isBullet(); }
    set isSuperFast(v) { this._body.setBullet(v); }
    // Recompute mass/inertia from the current fixture's density and shape —
    // needed after directly poking density/shape in a way that should
    // re-derive mass rather than preserve it (the reference implementation simplified;
    // planck's resetMassData() already recenters on the fixture's centroid).
    resetMass() { this._body.resetMassData(); }
    // Read-only, in pixels — the fixture's centroid, which is the origin
    // physics forces/torques actually act around (may differ from .pos for
    // an off-center shape, though every shape here is centered today).
    get centerOfMass() {
      const c = this._body.getWorldCenter();
      return { x: c.x * PXM, y: c.y * PXM };
    }
    // 'dynamic' | 'static' | 'kinematic' | 'none' — the taught name for
    // .collider (2.3.x); same underlying bodyType, just the reference API's spelling.
    get physicsType() { return this.collider; }
    set physicsType(v) { this.collider = v; }
    // false = body stops participating in physics (no forces, no contacts)
    // but keeps drawing — planck's setActive (the reference implementation).
    get physicsEnabled() { return this._body.isActive(); }
    set physicsEnabled(v) { this._body.setActive(v); }
    // Conveyor-belt tangent speed, px/frame — same unit convention as vel
    // (see units table, top of file). Box2D/planck's tangentSpeed does NOT
    // live on the Fixture the spec's table suggested — grepping
    // planck.min.js turns up exactly one setTangentSpeed/getTangentSpeed
    // pair, both on Contact2.prototype (the live touching-pair object), not
    // on Fixture. There is no persistent per-fixture slot to write once at
    // creation; it has to be re-applied to every ACTIVE contact this sprite
    // is part of, every frame. Stored here and applied in _updateContacts()
    // below, which already walks the live contact list once per frame for
    // colliding()/collides()/collided() — see the comment there.
    get surfaceSpeed() { return this._surfaceSpeed; }
    set surfaceSpeed(v) { this._surfaceSpeed = v; }
    // planck has no rolling-resistance concept (it's an arcade-physics idea,
    // not a Box2D one) — implemented as a plain alias of `drag` (overall
    // linear damping) rather than skipped, so `sprite.rollingResistance = x`
    // does SOMETHING sensible instead of silently no-oping. Argued in the
    // build report per the spec's invitation to make this call either way.
    get rollingResistance() { return this.drag; }
    set rollingResistance(v) { this.drag = v; }

    // speed/direction: a polar view onto .vel (magnitude px/frame, heading
    // degrees — 0 = right, matching .rotation's convention). Setting one
    // preserves the other. direction is cached in _direction so it survives
    // a momentary zero-speed frame (atan2(0,0) would otherwise reset it).
    get speed() { return Math.hypot(this.vel.x, this.vel.y); }
    set speed(s) {
      const rad = (this.direction * Math.PI) / 180;
      this.vel.x = Math.cos(rad) * s;
      this.vel.y = Math.sin(rad) * s;
    }
    get direction() {
      if (Math.hypot(this.vel.x, this.vel.y) > 1e-6) {
        this._direction = (Math.atan2(this.vel.y, this.vel.x) * 180) / Math.PI;
      }
      return this._direction;
    }
    set direction(deg) {
      const speed = this.speed;
      this._direction = deg;
      const rad = (deg * Math.PI) / 180;
      this.vel.x = Math.cos(rad) * speed;
      this.vel.y = Math.sin(rad) * speed;
    }

    // setSpeedAndDirection: set both polar components in one call instead of
    // two assignments that would otherwise each read the OTHER's stale value
    // mid-update (`s.speed = 4; s.direction = 90;` — the speed write already
    // recomputed vel from the OLD direction, so the direction write's own
    // "preserve current speed" then reads a moving target). Not itself a
    // The reference API member; direction is degrees, same convention as .direction.
    setSpeedAndDirection(speed, dir) {
      this._direction = dir;
      const rad = (dir * Math.PI) / 180;
      this.vel.x = Math.cos(rad) * speed;
      this.vel.y = Math.sin(rad) * speed;
    }

    // isMoving: the reference API's own definition, exactly (the reference implementation) —
    // `vel.x != 0 || vel.y != 0`. Not a magnitude/epsilon check on purpose:
    // matching the source literally, including its willingness to read true
    // on a physics-noise-sized velocity that hasn't fully settled to zero.
    get isMoving() {
      return this.vel.x != 0 || this.vel.y != 0;
    }

    // heading and bearing (SPEC-surface #2) are deliberately NOT built.
    // Read against the source per lead's request: `heading`'s own
    // getter/setter are asymmetric in the reference API (the reference implementation) — the
    // getter returns a compass STRING (default 'right', the reference implementation) while
    // the setter just forwards to `.direction` (the reference implementation), which
    // only updates that string when it's GIVEN a string, so a later numeric
    // direction write leaves the string stale. `bearing` (the reference implementation) is
    // a plain stored field with no computed behavior at all — a user slot,
    // not a real feature. Lead judged the asymmetry not worth copying
    // blindly; skipped rather than guessed at a "fixed" version.

    // rotationToFace/angleToFace: port of the reference implementation. rotationToFace
    // is the ABSOLUTE angle that would point at (x,y); angleToFace is the
    // SHORTEST SIGNED turn from the current rotation to get there (what you
    // actually add to .rotation, or feed to rotateTo's `speed` step).
    rotationToFace(x, y, facing) {
      const t = this._target(x, y, facing);
      if (t.x === undefined) return 0;
      // The reference API's own "too close to rotate toward" guard (the reference implementation).
      if (Math.abs(t.x - this.x) < 0.01 && Math.abs(t.y - this.y) < 0.01) return 0;
      return this.angleTo(t.x, t.y) + (t.opt || 0);
    }
    angleToFace(x, y, facing) {
      const ang = this.rotationToFace(x, y, facing);
      return (((ang - this.rotation + 540) % 360) - 180);
    }

    // canvasPos: this sprite's position in SCREEN pixels (camera-relative),
    // mirroring mouse.canvasPos above — a HUD element parented to a sprite
    // needs this the same way a HUD hit-test against the cursor does.
    // A screenSpace sprite is drawn WITHOUT the camera transform, so the
    // pixel it appears at is its own x/y. Subtracting the camera from it
    // reported a HUD button at x=-440 while it was plainly visible at x=60.
    // canvasPos means "where is this on screen"; for these it is identity.
    get canvasPos() {
      if (this.screenSpace) return { x: this.x, y: this.y };
      return { x: this.x - _camLeft(), y: this.y - _camTop() };
    }

    // prevPos/previousPosition, prevRotation/previousRotation: the position
    // and rotation as of the END of the PREVIOUS frame. Snapshotted once per
    // frame in loop()'s post-draw sweep (see the comment there for why it
    // has to happen after this frame's physics/draw, not before) — reading
    // these mid-frame always answers "as of last frame", the same guarantee
    // The reference API gives (the reference implementation, itself just get/set aliases over
    // prevPos/prevRotation — same relationship kept here).
    get prevPos() { return this._prevPos || { x: this.x, y: this.y }; }
    get previousPosition() { return this.prevPos; }
    get prevRotation() { return this._prevRotation ?? this.rotation; }
    get previousRotation() { return this.prevRotation; }

    // Every "move/point at a thing" method below accepts either a pair of
    // numbers or anything with .x/.y (a sprite, mouse, {x,y}) — the reference API does,
    // and `enemy.moveTowards(player)` is the first thing a student writes.
    // Returns null when the target is unusable, so callers can bail.
    _target(x, y, third) {
      if (x !== null && typeof x === 'object') {
        // The cursor sits at (0,0) until the browser reports a mousemove, so
        // `sprite.attractTo(mouse)` on a sketch nobody has touched yet hauls
        // the sprite into the top-left corner. The reference API guards this with
        // mouse.isActive (the reference implementation); no target is better than a wrong one.
        if (x === mouse && !mouse.isActive) return { x: undefined };
        return { x: x.x, y: x.y, opt: y };
      }
      return { x, y, opt: third };
    }

    // moveTowards(x, y, tracking = 0.1): step this fraction of the remaining
    // distance to (x, y) every time it's called (real lesson usage calls it
    // once per update() frame — not a self-driving animation).
    moveTowards(x, y, tracking) {
      const t = this._target(x, y, tracking);
      if (t.x === undefined) return;
      const k = t.opt === undefined ? 0.1 : t.opt;
      this.x += (t.x - this.x) * k;
      this.y += (t.y - this.y) * k;
    }

    // distanceTo / angleTo: the two questions you ask about another sprite
    // before you do anything to it. Both take a pair of numbers or anything
    // with .x/.y.
    //
    // distanceTo is the name 5-3-16-reading-methods-intro uses to TEACH what
    // a method is — with a hand-rolled `class Point { distanceTo(other) }`.
    // A student who learned the word there will type it on a real sprite.
    distanceTo(x, y) {
      const t = this._target(x, y);
      if (t.x === undefined) return NaN;
      return Math.hypot(t.x - this.x, t.y - this.y);
    }
    // Degrees, measured the same way as sprite.rotation and sprite.direction.
    angleTo(x, y) {
      const t = this._target(x, y);
      if (t.x === undefined) return NaN;
      return (Math.atan2(t.y - this.y, t.x - this.x) * 180) / Math.PI;
    }

    // .scale takes either form: `s.scale = 2` for both axes, or
    // `s.scale.x = -1` to mirror one. Both are in use — 6-4-5 and 6-4-19
    // teach the .x form for flipping a sprite to face left, while the docs
    // describe the uniform form.
    //
    // It used to be a plain `{x, y}` object, so `s.scale = 2` replaced it
    // with a number and rendering then called ctx.scale(undefined, undefined).
    // That sets a NaN transform in a real browser and the sprite VANISHES —
    // silently, with nothing thrown. The headless ctx stub accepts the call,
    // which is exactly why no test caught it. Matches the reference API's setter
    // (the reference implementation), which takes a number or an {x,y}.
    // A scale of exactly 0 is the same trap wearing a different hat: 0 is a
    // finite number, so it sails past the harness's NaN guard, but
    // ctx.scale(0, 0) is a degenerate (non-invertible) matrix and a real
    // browser draws nothing after it — the sprite vanishes with no error.
    // The reference API clamps to 0.01 for this reason (the reference implementation). At 0.01 a 40px
    // sprite is 0.4px, visually the same "gone" the student asked for, but
    // the transform stays valid and the next sprite still draws.
    get scale() { return this._scale; }
    set scale(v) {
      const nz = (n, fallback) => (typeof n === 'number' ? (n || 0.01) : fallback);
      if (typeof v === 'number') { this._scale.x = this._scale.y = v || 0.01; }
      else if (v) {
        // `[2, 3]` as well as `{x: 2, y: 3}` — the reference API's typings advertise the
        // array form (the reference typings, `set scale(val: number | [] | {x,y})`) and
        // its setter reads val[0]/val[1]. Without this branch the assignment
        // is a silent no-op: no error, no change, nothing to debug.
        this._scale.x = nz(v.x ?? v[0], this._scale.x);
        this._scale.y = nz(v.y ?? v[1], this._scale.y);
      }
    }

    // scaleBy multiplies the current scale instead of replacing it, so
    // `s.scaleBy(2)` doubles whatever the sprite is already at. One argument
    // scales both axes. Note this changes the ART only — .scale does not
    // resize the collider, which is why growing a hitbox still means .w/.h.
    scaleBy(x, y) {
      if (y === undefined) y = x;
      // Routed through the setter so scaleBy(0) gets the same zero-clamp as
      // `scale = 0`; writing _scale directly would slip past it.
      this.scale = { x: this._scale.x * x, y: this._scale.y * y };
    }

    // The opposite of moveTowards. The reference API DECLARES this (the reference typings (line 910))
    // but ships no implementation for it — verified by grepping the reference implementation,
    // which has attractTo/repelFrom/moveTowards and no moveAway at all. So
    // this is written to the documented meaning rather than ported.
    moveAway(x, y, repel) {
      const t = this._target(x, y, repel);
      if (t.x === undefined) return;
      const k = t.opt === undefined ? 0.1 : t.opt;
      this.x -= (t.x - this.x) * k;
      this.y -= (t.y - this.y) * k;
    }

    // attractTo/repelFrom apply a real force (newtons, like applyForce) toward
    // or away from a point, scaled so the pull is the same strength whatever
    // the distance. Direct port of the reference implementation.
    attractTo(x, y, force) {
      const t = this._target(x, y, force);
      if (t.x === undefined) return;
      const f = t.opt === undefined ? 1 : t.opt;
      const dx = t.x - this.x, dy = t.y - this.y;
      const c = Math.hypot(dx, dy);
      if (c === 0) return; // same point: no direction to pull in
      this.applyForce((dx / c) * f, (dy / c) * f);
    }
    repelFrom(x, y, force) {
      const t = this._target(x, y, force);
      if (t.x === undefined) return;
      this.attractTo(t.x, t.y, -(t.opt === undefined ? 1 : t.opt));
    }

    // rotateTo(angle, speed): step .rotation toward `angle` by at most
    // `speed` degrees (shortest signed direction); with no speed, snap
    // immediately. Real p5play returns a Promise — matched for API parity
    // (`await sprite.rotateTo(...)` doesn't throw) even though the rotation
    // itself already happened synchronously by the time it resolves.
    rotateTo(angle, speed) {
      if (speed === undefined) {
        this.rotation = angle;
      } else {
        const diff = (((angle - this.rotation + 540) % 360) - 180);
        const step = Math.sign(diff) * Math.min(Math.abs(diff), speed);
        this.rotation += step;
      }
      return Promise.resolve(this);
    }

    // rotateTowards(angle | target, tracking = 0.1): unlike rotateTo, this
    // does NOT snap or step the rotation directly — it sets a spin speed
    // proportional to how far there is left to turn, so the sprite eases
    // round over several frames. The reference API sets .rotationSpeed (the reference implementation);
    // moSHion's equivalent unit is angularVelocity, also degrees per frame.
    rotateTowards(angle, tracking) {
      let target = angle, k = tracking;
      if (angle !== null && typeof angle === 'object') {
        target = (Math.atan2(angle.y - this.y, angle.x - this.x) * 180) / Math.PI;
        k = tracking;
      }
      if (target === undefined) return;
      if (k === undefined) k = 0.1;
      // Shortest signed way round, ALWAYS — including the plain-number form.
      //
      // The reference API normalises only its object/coordinate form (via angleToFace +
      // minAngleDist); the plain-number form takes the delta raw
      // (the reference implementation, `angle -= this.rotation`), so rotateTowards(350) from
      // rotation 0 spins 350 degrees the long way round instead of 10 the
      // short way. We diverge deliberately — see DECISIONS.md D17. moSHion's
      // own rotateTo() already takes "the shorter signed direction" and says
      // so in its docs; two rotation methods disagreeing on which way round
      // they turn is a worse trap than disagreeing with the reference API.
      const diff = (((target - this.rotation + 540) % 360) - 180);
      this.angularVelocity = diff * k;
    }

    // sensor/collider concept (2.3.x): 'none' = passes through everything,
    // detectable only via overlaps() (bounding box); 'static'/'kinematic'/
    // 'dynamic' behave exactly like the .body property (they're the same
    // underlying bodyType — collider is just the taught name for it).
    get collider() { return this._sensor ? 'none' : this._bodyType; }
    set collider(v) {
      if (v === 'none') {
        this._sensor = true;
        // A 'none' sprite is a trigger zone, a pickup, a decoration — the
        // curriculum's own words are "sensor-style" and "did I enter this
        // trigger zone?". It kept a DYNAMIC body, so in any world with
        // gravity it quietly fell out of the level.
        //
        // Measured in lessons/6-4-18-a15-1-platformer: the goal sprite the
        // student has to reach starts at y=230 and is at y=1588 by frame 180,
        // 1188px below a 400px canvas. Nothing threw, so all 271 corpus
        // sketches passed over it.
        //
        // The body stays dynamic so `vel` still drives 'none' sprites (bullets
        // and moving pickups rely on that) — only gravity is switched off.
        if (this._body.getGravityScale() !== 0) {
          this._gravityBeforeNone = this._body.getGravityScale();
          this._body.setGravityScale(0);
        }
      } else {
        this._sensor = false;
        this._bodyType = v;
        if (this._gravityBeforeNone !== undefined) {
          this._body.setGravityScale(this._gravityBeforeNone);
          this._gravityBeforeNone = undefined;
        }
      }
      this._buildFixture();
    }

    // shorthand size setter for circular sprites (group default + per-sprite,
    // e.g. `apples.diameter = 20`, `leftWheel.diameter = 20`).
    get diameter() { return this.w; }
    set diameter(v) { this.w = v; this.h = v; this._shape = 'circle'; this._buildFixture(); }

    // Aliases for numbers the sprite already has. None of these is a new
    // capability — they exist because a student arriving from p5/the reference API
    // material types `.width` or `.velocity` before they type `.w` or `.vel`,
    // and an unknown property is a silent undefined, not an error.
    get width() { return this.w; }
    set width(v) { this.w = v; }
    get height() { return this.h; }
    set height(v) { this.h = v; }
    get hw() { return this.w / 2; }
    set hw(v) { this.w = v * 2; }
    get hh() { return this.h / 2; }
    set hh(v) { this.h = v * 2; }
    get halfWidth() { return this.hw; }
    set halfWidth(v) { this.hw = v; }
    get halfHeight() { return this.hh; }
    set halfHeight(v) { this.hh = v; }
    get d() { return this.diameter; }
    set d(v) { this.diameter = v; }
    get r() { return this.diameter / 2; }
    set r(v) { this.diameter = v * 2; }
    get radius() { return this.r; }
    set radius(v) { this.r = v; }
    // Assigning .velocity copies into the existing vector rather than
    // replacing it — sprite.vel is a live proxy onto the physics body, so
    // swapping the object out would disconnect it.
    get velocity() { return this.vel; }
    set velocity(v) { this.vel.x = v.x; this.vel.y = v.y; }

    // still art — mutually exclusive with an active `ani` (2.4.3d).
    // A string with no '.' is treated as an emoji/text placeholder rather
    // than an image URL (matches the reference API's `img` setter heuristic —
    // exercised by real lesson code, e.g. `player.image = '🧍'`).
    get image() { return this._img || this._emoji; }
    set image(url) {
      if (typeof url === 'string' && !url.includes('.')) {
        this._emoji = url;
        this._img = null;
      } else {
        this._img = new Image();
        this._img.src = url;
        this._emoji = null;
      }
      this.ani = null;
    }

    // minimal sprite-sheet animation (2.4.3a–2.4.3c): a named animation is a
    // horizontal frame-strip; only one is "active" (this.ani) at a time.
    addAni(name, sheetUrl, frameCount) {
      const ani = new Ani(name, sheetUrl, frameCount);
      if (!this._anis) this._anis = new Anis();
      this._anis[name] = ani;
      if (!this.ani) this.ani = ani; // first addAni auto-activates
      this._img = null; // mutually exclusive with a still `.image` (2.4.3d)
      this._emoji = null;
      return ani;
    }

    changeAni(name) {
      const ani = this._anis && this._anis[name];
      if (!ani) return; // unregistered name — silent no-op, matches the reference API
      this.ani = ani;
    }

    get x() { return this.pos.x; }
    set x(v) { this.pos.x = v; }
    get y() { return this.pos.y; }
    set y(v) { this.pos.y = v; }

    // `sprite.position` is the reference API's own name for `sprite.pos` (verified
    // against the reference implementation) — plain alias, same live vector.
    get position() { return this.pos; }
    set position(v) { this.pos.x = v.x; this.pos.y = v.y; }

    get rotation() { return (this._body.getAngle() * 180) / Math.PI; }
    set rotation(deg) { this._body.setAngle((deg * Math.PI) / 180); }

    // angularVelocity — degrees per frame, matching the facade's px/frame unit
    // convention (2.3.19 pendulum kick, 2.3.21 car-ramp wheel drive).
    get angularVelocity() { return ((this._body.getAngularVelocity() * 180) / Math.PI) / FPS; }
    set angularVelocity(degPerFrame) {
      // rotationLock means "this sprite does not turn". Box2D's fixed-rotation
      // flag only stops TORQUE from spinning a body — an explicit angular
      // velocity write still turns it, so a locked sprite handed a spin would
      // rotate anyway with nothing to explain why. The reference API has that hole too;
      // honouring the lock here is a deliberate divergence (D21).
      if (this._body.isFixedRotation()) return;
      this._body.setAngularVelocity((degPerFrame * Math.PI / 180) * FPS);
    }

    applyForce(fx, fy) {
      // raw Box2D Newtons, like the reference API's applyForce — the old px/frame²
      // conversion (x120) made forces 120x too strong.
      this._body.applyForceToCenter(pl.Vec2(fx, fy), true);
    }

    _bounds() {
      const w = this._shape === 'circle' ? this.w : this.w;
      const h = this._shape === 'circle' ? this.w : this.h;
      return { l: this.x - w / 2, r: this.x + w / 2, t: this.y - h / 2, b: this.y + h / 2 };
    }

    // boolean form: `sprite.overlaps(other)`. Also accepts a Group — true if
    // ANY member overlaps — and the callback form `overlaps(group, cb)` /
    // `overlaps(sprite, cb)`, which fires `cb(self, other)` once per
    // overlapping pair/sprite, after this method has finished its own
    // iteration (safe to delete() inside cb). Deliberately a LIVE geometry
    // query (continuous truthy while touching), not the edge-triggered
    // `_overlap` counter below — the reference API's overlaps() IS edge-triggered,
    // but that ledger is only populated once per frame by _updateOverlaps()
    // (run inside the main loop), so a call from setup() — before any frame
    // has run — would always read empty and never fire. overlapping()/
    // overlapped() below use the counter instead; see build report.
    overlaps(other, cb) {
      if (other instanceof Group) {
        let hit = false;
        for (const s of [...other]) {
          if (s === this) continue;
          if (this._overlapsOne(s)) {
            hit = true;
            if (cb) cb(this, s);
          }
        }
        return hit;
      }
      const hit = this._overlapsOne(other);
      if (hit && cb) cb(this, other);
      return hit;
    }

    // Rect-vs-rect (and rect-vs-circle) stays AABB — rotation-awareness is
    // explicitly out of scope. Circle-vs-circle uses true circle-distance
    // math so this agrees with world.getSpriteAt()'s real circle test;
    // AABB corners can overlap for two circles whose radii don't.
    _overlapsOne(other) {
      if (this._shape === 'circle' && other._shape === 'circle') {
        const dx = this.x - other.x, dy = this.y - other.y;
        const rr = this.w / 2 + other.w / 2;
        return dx * dx + dy * dy <= rr * rr;
      }
      const a = this._bounds(), b = other._bounds();
      return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    }

    // solid-body physics contact (2.3.17) — truthy (a running frame count)
    // while actually touching `other` (or, if `other` is a Group, the
    // longest-touching member). Backed by planck's real contact list, not
    // the manual bounding-box math `overlaps()` uses — see _updateContacts().
    //
    // collides/colliding/collided and overlapping/overlapped (added here)
    // are the p5play edge/count/release triple for collision and overlap —
    // see the _touch/_overlap counter comment at _updateContacts().
    //
    // cb, like overlaps() above, fires cb(this, other) once per truthy pair
    // — a plain loop, not .some(), so a Group target is visited in full
    // even after the first hit (the return value is identical either way,
    // but a later pair's callback would otherwise never fire).
    colliding(other, cb) {
      if (other instanceof Group) {
        let count = 0;
        for (const s of other) {
          const v = this._collidingOne(s);
          if (v > count) count = v;
          if (v && cb) cb(this, s);
        }
        return count;
      }
      const v = this._collidingOne(other);
      if (v && cb) cb(this, other);
      return v;
    }
    _collidingOne(other) {
      const v = (this._touch && this._touch.get(other)) || 0;
      return v <= -3 ? 1 : v > 0 ? v : 0;
    }
    collides(other, cb) {
      if (other instanceof Group) {
        let hit = false;
        for (const s of [...other]) {
          if (this._collidesOne(s)) {
            hit = true;
            if (cb) cb(this, s);
          }
        }
        return hit;
      }
      const hit = this._collidesOne(other);
      if (hit && cb) cb(this, other);
      return hit;
    }
    _collidesOne(other) {
      const v = (this._touch && this._touch.get(other)) || 0;
      return v === 1 || v <= -3;
    }
    collided(other, cb) {
      if (other instanceof Group) {
        let hit = false;
        for (const s of [...other]) {
          if (this._collidedOne(s)) {
            hit = true;
            if (cb) cb(this, s);
          }
        }
        return hit;
      }
      const hit = this._collidedOne(other);
      if (hit && cb) cb(this, other);
      return hit;
    }
    _collidedOne(other) {
      const v = (this._touch && this._touch.get(other)) || 0;
      return v <= -1;
    }

    // overlapping()/overlapped() — the count/release verbs backing the
    // edge-triggered overlaps() above, read from the persistent `_overlap`
    // ledger _updateOverlaps() fills every frame (see there).
    overlapping(other, cb) {
      if (other instanceof Group) {
        let count = 0;
        for (const s of other) {
          if (s === this) continue;
          const n = this._overlappingOne(s);
          if (n > 0) {
            count = Math.max(count, n);
            if (cb) cb(this, s);
          }
        }
        return count;
      }
      const n = this._overlappingOne(other);
      if (n > 0 && cb) cb(this, other);
      return n;
    }
    _overlappingOne(other) {
      const v = (this._overlap && this._overlap.get(other)) || 0;
      return v <= -3 ? 1 : v > 0 ? v : 0;
    }
    // Plain loop, not .some() — .some() short-circuits on the first truthy
    // member, so a callback would only ever see one of several ended overlaps.
    // That exact bug was fixed on the other verbs; this one was missed.
    overlapped(other, cb) {
      if (other instanceof Group) {
        let hit = false;
        for (const s of [...other]) {
          if (s === this) continue;
          if (this._overlappedOne(s)) {
            hit = true;
            if (cb) cb(this, s);
          }
        }
        return hit;
      }
      const hit = this._overlappedOne(other);
      if (hit && cb) cb(this, other);
      return hit;
    }
    _overlappedOne(other) {
      const v = (this._overlap && this._overlap.get(other)) || 0;
      return v <= -1;
    }

    // ---- presentation & lifecycle (SPEC-surface #3) ------------------------

    // life: frames remaining. Counts down once per frame in loop()'s sweep
    // (after this frame's update/draw, same spot prevPos snapshots) and
    // calls delete() at 0. Only stored, never initialized — matching
    // The reference API's own Sprite (no default assignment anywhere in its
    // constructor; only its Group.Visuals subclass defaults to Infinity,
    // the reference implementation) — so `undefined - 1` is NaN, never <= 0, and an
    // untouched sprite is immortal for free. -1 is this file's own explicit
    // "immortal" sentinel for a sketch that wants to say so out loud.
    get life() { return this._life; }
    set life(v) { this._life = v; }
    // True once delete() has run — the public read-only view of the
    // internal `_dead` flag every other method already checks.
    get removed() { return !!this._dead; }
    // colour/fill: both directions, plain aliases of .color — the reference API calls
    // it colour in its own props list (the reference implementation) and fill is the
    // q5.js-global name (this file's own `fill(c)` sets DEFAULT text/shape
    // color; sprite.fill is unrelated to it, matching the reference API's per-sprite
    // `fill` alias, not the global function).
    get colour() { return this.color; }
    set colour(v) { this.color = v; }
    get fill() { return this.color; }
    set fill(v) { this.color = v; }
    // textFill is the reference API's actual name for what this file calls
    // textColor (the reference implementation) — aliased both directions onto the
    // SAME storage, so old code using textColor and new code using textFill
    // agree. Default stays moSHion's 'white', not the reference API's black (D1: keep
    // moSHion's effective defaults, adopt the surface).
    get textFill() { return this.textColor; }
    set textFill(v) { this.textColor = v; }
    // textStroke/textStrokeWeight: outline for sprite.text, drawn in _draw()
    // below only when a stroke color is set (the reference implementation).
    get textStroke() { return this._textStroke; }
    set textStroke(v) { this._textStroke = v; }
    get textStrokeWeight() { return this._textStrokeWeight; }
    set textStrokeWeight(v) { this._textStrokeWeight = v; }
    // Read-only views onto bookkeeping this file already maintains — copies,
    // so mutating the returned array can't corrupt the real membership list.
    get groups() { return [...this._groups]; }
    get joints() { return [...this._joints]; }
    // visualOnly: skip physics entirely (no forces, no contacts, no
    // collision response) while still drawing every frame. Implemented as
    // the same setActive(false) physicsEnabled already uses — planck still
    // lets a manually-positioned inactive body report its transform, which
    // is exactly "draw only".
    get visualOnly() { return this._visualOnly; }
    set visualOnly(v) { this._visualOnly = v; this._body.setActive(!v); }

    // Full destruction: tears down the physics body and removes this sprite
    // from every group it belongs to (including the implicit allSprites) —
    // matches the real `sprite.delete()` contract (2.3.3/2.3.7/2.3.8).
    delete() {
      this._dead = true;
      // Every joint attached to this sprite dies with it — destroyed BEFORE
      // the body below, not after: Box2D/planck auto-drops a body's joints
      // the instant the body itself is destroyed, so destroyJoint() on one
      // of them afterward would be operating on an already-gone reference.
      // This way each Joint.delete() runs against a still-live world.
      for (const j of this._joints.slice()) j.delete();
      this._joints.length = 0;
      _world().destroyBody(this._body);
      for (const g of this._groups.slice()) {
        const i = g.indexOf(this);
        if (i >= 0) g.splice(i, 1);
      }
      this._groups.length = 0;
    }

    // `sprite.remove()` is used interchangeably with `delete()` in real
    // lesson code (e.g. 2.6.11, 2.6.13) — same full-destroy behavior.
    remove() { this.delete(); }

    _draw() {
      if (!this.visible) return;
      CTX_.save();
      CTX_.globalAlpha = this.opacity;
      CTX_.translate(this.x, this.y);
      CTX_.rotate((this.rotation * Math.PI) / 180);
      CTX_.scale(this.scale.x, this.scale.y);
      if (this.ani && this.ani.spriteSheet.complete) {
        const img = this.ani.spriteSheet;
        const fw = img.naturalWidth / this.ani.frameCount;
        CTX_.drawImage(img, this.ani.frame * fw, 0, fw, img.naturalHeight, -this.w / 2, -this.h / 2, this.w, this.h);
      } else if (this._img && this._img.complete) {
        CTX_.drawImage(this._img, -this.w / 2, -this.h / 2, this.w, this.h);
      } else if (this._emoji) {
        CTX_.font = `${this.h}px sans-serif`;
        CTX_.textAlign = 'center';
        CTX_.textBaseline = 'middle';
        CTX_.fillText(this._emoji, 0, 0);
      } else if (!this.ani && !this._img) {
        CTX_.fillStyle = this.color;
        if (this.shape === 'circle') {
          CTX_.beginPath();
          CTX_.arc(0, 0, this.w / 2, 0, Math.PI * 2);
          CTX_.fill();
          if (this.stroke) { CTX_.strokeStyle = this.stroke; CTX_.lineWidth = this.strokeWeight; CTX_.stroke(); }
        } else {
          CTX_.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
          if (this.stroke) { CTX_.strokeStyle = this.stroke; CTX_.lineWidth = this.strokeWeight; CTX_.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h); }
        }
      }
      CTX_.restore();

      // debug: collider outline, drawn rotated but NOT scaled (matches
      // real p5play — it's showing the physics shape, not the art).
      if (this.debug) {
        CTX_.save();
        CTX_.globalAlpha = this.opacity;
        CTX_.translate(this.x, this.y);
        CTX_.rotate((this.rotation * Math.PI) / 180);
        CTX_.strokeStyle = 'lime';
        CTX_.lineWidth = 1;
        CTX_.beginPath();
        if (this.shape === 'circle') {
          CTX_.arc(0, 0, this.w / 2, 0, Math.PI * 2);
        } else {
          CTX_.rect(-this.w / 2, -this.h / 2, this.w, this.h);
        }
        CTX_.stroke();
        CTX_.restore();
      }

      // text: a HUD-style label centered over the sprite — NOT rotated or
      // scaled with the sprite's art (real p5play draws sprite text
      // axis-aligned; six lessons use this for HP/score labels that
      // shouldn't spin with the sprite).
      if (this.text) {
        CTX_.save();
        CTX_.globalAlpha = this.opacity;
        CTX_.translate(this.x, this.y);
        CTX_.font = `${this.textSize}px monospace`;
        CTX_.textAlign = 'center';
        CTX_.textBaseline = 'middle';
        // Stroke BEFORE fill (canvas convention for outlined text — a fill
        // laid down first would be covered by a wide stroke).
        if (this._textStroke) {
          CTX_.strokeStyle = this._textStroke;
          CTX_.lineWidth = this._textStrokeWeight || 1;
          CTX_.strokeText(String(this.text), 0, 0);
        }
        CTX_.fillStyle = this.textColor;
        CTX_.fillText(String(this.text), 0, 0);
        CTX_.restore();
      }
    }
  }

  // ---- animation (2.4.x) --------------------------------------------------
  // Minimal sprite-sheet animation: a named horizontal frame-strip, advanced
  // on a fixed delay. Not the reference API's full texture-atlas system (no multi-row
  // atlases, no addAnis) — real lesson code only ever calls addAni/changeAni.

  class Ani {
    constructor(name, sheetUrl, frameCount) {
      this.name = name;
      this.frameCount = frameCount || 1;
      this.frameDelay = 4; // game frames per animation frame (the reference API default)
      this.frame = 0;
      this._tick = 0;
      this.spriteSheet = new Image();
      this.spriteSheet.src = sheetUrl;
    }
    _advance() {
      if (this.frameCount <= 1) return;
      if (++this._tick < this.frameDelay) return;
      this._tick = 0;
      this.frame = (this.frame + 1) % this.frameCount;
    }
  }

  // Per-sprite named-animation registry (`sprite.addAni` fills it in).
  class Anis {}

  // ---- group ------------------------------------------------------------

  class Group extends Array {
    constructor(props) {
      super();
      if (props) Object.assign(this, props);

      // `new groupName.Sprite(...)` factory (2.3.3): a sprite subclass bound to
      // this group instance that copies the group's current own properties on
      // as defaults, then joins the group. Defined non-enumerable so it never
      // shows up in the default-property copy loop below (or in `Object.keys`
      // on the group, which would otherwise see it as a spurious "default").
      const group = this;
      class GroupSprite extends Sprite {
        constructor(...args) {
          super(...args);
          for (const key of Object.keys(group)) {
            if (/^\d+$/.test(key)) continue; // array indices = existing members, not defaults
            this[key] = group[key];
          }
          group.push(this);
        }
      }
      Object.defineProperty(this, 'Sprite', { value: GroupSprite, enumerable: false });
    }
    newSprite(x, y, w, h) { const s = new Sprite(x, y, w, h); this.push(s); return s; }

    // Track membership on every sprite pushed in, however it gets here
    // (direct `.push()`, `.newSprite()`, or the `.Sprite` factory above) —
    // `sprite.delete()` needs to know every group to unparent itself from.
    //
    // Dedupes against the ARRAY itself (`this.includes(s)`), not just the
    // sprite's own `_groups` bookkeeping: a sprite popped out via
    // `coins.pop()` bypasses `remove()`, so it keeps a stale `_groups` entry
    // even though it's no longer in the array. Without this check, pushing
    // it back a second time skipped `_groups` (already listed there) but
    // still called `super.push()`, adding a second array slot — and
    // `delete()`'s `indexOf`/`splice` only ever removes ONE of them,
    // leaving a dead ghost entry that inflates `group.length` forever.
    push(...sprites) {
      for (const s of sprites) {
        if (this.includes(s)) continue; // already a member — a no-op, like the reference API
        if (s && s._groups && !s._groups.includes(this)) s._groups.push(this);
        super.push(s);
      }
      return this.length;
    }

    // `group.remove(sprite)` only unparents — the sprite keeps existing,
    // drawing, and running physics. Use `sprite.delete()` to destroy it
    // (2.3.3/2.3.7: "group.remove(sprite) only unparents; there is no
    // sprite.remove() on Group" — a real, documented distinction this
    // engine previously got wrong by destroying on group.remove()).
    remove(s) {
      const i = this.indexOf(s);
      if (i >= 0) this.splice(i, 1);
      if (s && s._groups) {
        const gi = s._groups.indexOf(this);
        if (gi >= 0) s._groups.splice(gi, 1);
      }
    }
    // add(sprite) is push(sprite) under a different name — same membership
    // bookkeeping, same dedupe-against-the-array behavior.
    add(...sprites) { return this.push(...sprites); }
    contains(s) { return this.includes(s); }
    // delete()/deleteAll(): destroy every CURRENT member. Both do the exact
    // same thing under two names (the reference API documents both spellings) —
    // deleting each sprite already empties this group as a side effect
    // (Sprite.delete() unparents from every group it's in, above), so there
    // is nothing left to separately "clear".
    delete() { for (const s of [...this]) s.delete(); }
    deleteAll() { this.delete(); }
    // amount: the reference API's target-count property (the reference implementation) — get
    // reads member count; SET adds or removes members to reach the target,
    // using this group's own `.Sprite` factory for a real add (so new
    // members inherit the group's defaults exactly like `new coins.Sprite()`
    // would) and deleting from the front to shrink. A genuine spawner, not
    // skipped — this file already has the factory the reference API's version
    // leans on, so building it is a straight port rather than a guess.
    get amount() { return this.length; }
    set amount(target) {
      const diff = target - this.length;
      if (diff > 0) { for (let i = 0; i < diff; i++) new this.Sprite(0, 0); }
      else { for (let i = 0; i < -diff; i++) this[0]?.delete(); }
    }
    // A plain `for` loop, not `.some()` — `.some()` stops calling its
    // callback the instant one member returns true, which would skip every
    // later member's own overlap test (and its cb firings) entirely, not
    // just its own truthy return. Every member must be visited.
    overlaps(other, cb) {
      let hit = false;
      for (const s of [...this]) {
        if (s.overlaps(other, cb)) hit = true;
      }
      return hit;
    }
    colliding(other, cb) {
      let count = 0;
      for (const s of this) count = Math.max(count, s.colliding(other, cb));
      return count;
    }
    // Plain loops (not .some()), matching overlaps() above — every member
    // must be visited so its cb firings (and, for a Group `other`, every
    // cross-pair) aren't skipped once one hit is found.
    collides(other, cb) {
      let hit = false;
      for (const s of [...this]) {
        if (s.collides(other, cb)) hit = true;
      }
      return hit;
    }
    collided(other, cb) {
      let hit = false;
      for (const s of [...this]) {
        if (s.collided(other, cb)) hit = true;
      }
      return hit;
    }
    overlapping(other, cb) {
      let count = 0;
      for (const s of [...this]) count = Math.max(count, s.overlapping(other, cb));
      return count;
    }
    // Was `this.some(...)` — short-circuits on the first ended overlap, so the
    // callback never saw the rest. Same bug the other verbs already fixed.
    overlapped(other, cb) {
      let hit = false;
      for (const s of [...this]) {
        if (s.overlapped(other, cb)) hit = true;
      }
      return hit;
    }

    // Cascading versions of the Sprite methods of the same name. A group
    // already cascades PROPERTIES (`coins.color = 'gold'`), so a student
    // reasonably expects `enemies.moveTowards(player)` to work too — and on
    // The reference API (the reference implementation) it does.
    applyForce(fx, fy) { for (const s of [...this]) s.applyForce(fx, fy); }
    applyTorque(t) { for (const s of [...this]) s.applyTorque(t); }
    applyForceScaled(fx, fy) { for (const s of [...this]) s.applyForceScaled(fx, fy); }
    moveTowards(x, y, tracking) { for (const s of [...this]) s.moveTowards(x, y, tracking); }
    moveAway(x, y, repel) { for (const s of [...this]) s.moveAway(x, y, repel); }
    attractTo(x, y, force) { for (const s of [...this]) s.attractTo(x, y, force); }
    repelFrom(x, y, force) { for (const s of [...this]) s.repelFrom(x, y, force); }

    // autoDraw/autoUpdate: cascading accessors, same pattern as the methods
    // above rather than the factory's copy-to-future-members convention —
    // `enemies.autoDraw = false` freezes every CURRENT enemy on the spot.
    // The getter reports true only if every member agrees, so a
    // partially-toggled group reads as false rather than silently picking
    // one member's answer.
    get autoDraw() { return this.every((s) => s.autoDraw); }
    set autoDraw(v) { for (const s of this) s.autoDraw = v; }
    get autoUpdate() { return this.every((s) => s.autoUpdate); }
    set autoUpdate(v) { for (const s of this) s.autoUpdate = v; }

    // cull(margin) or cull(top, bottom, left, right): delete members that have
    // drifted this far outside the canvas, returning how many went. With a
    // callback, it runs that instead of deleting — the escape hatch for
    // "wrap around" and "respawn at the top" instead of "destroy".
    //
    // Every spawner lesson currently hand-rolls this as a backwards for-loop,
    // and 6-1-12-challenges already sends students to read the docs for it.
    cull(top = 0, bottom, left, right, cb) {
      if (typeof bottom === 'function') { cb = bottom; bottom = undefined; }
      if (bottom === undefined) bottom = top;
      if (left === undefined) left = top;
      if (right === undefined) right = left;
      if ([top, bottom, left, right].some((n) => typeof n !== 'number' || isNaN(n))) {
        throw new TypeError('group.cull() boundaries must be numbers');
      }
      if (cb !== undefined && typeof cb !== 'function') {
        throw new TypeError('the callback to group.cull() must be a function');
      }
      // Bounds are in world space, so a scrolled camera culls against what is
      // actually on screen rather than against the origin.
      const minX = _camLeft() - left, minY = _camTop() - top;
      const maxX = _camLeft() + W_ + right, maxY = _camTop() + H_ + bottom;
      let culled = 0;
      // Snapshot first: deleting a member mutates the array underneath us.
      for (const s of [...this]) {
        if (s.x < minX || s.y < minY || s.x > maxX || s.y > maxY) {
          culled++;
          if (cb) cb(s, culled);
          else s.delete();
        }
      }
      return culled;
    }
  }

  // Implicit group every sprite auto-joins on creation (2.3.7: "removes it
  // from every group it belongs to, including the implicit allSprites").
  // Real usage: `player.colliding(allSprites)` (2.4.10 platformer) to test
  // against "anything", not one specific ground sprite/group.
  const allSprites = new Group();

  // spatial hit-test (2.7.6): top-most (highest layer) live sprite at a point,
  // or undefined. `x`/`y` are world coords, same space as mouse.x/y and sprite.x/y.
  world.getSpriteAt = function (x, y) {
    const hits = ALL_.filter((s) => {
      if (s._dead) return false;
      if (s.shape === 'circle') {
        const dx = x - s.x, dy = y - s.y;
        return dx * dx + dy * dy <= (s.w / 2) ** 2;
      }
      const b = s._bounds();
      return x >= b.l && x <= b.r && y >= b.t && y <= b.b;
    });
    if (!hits.length) return undefined;
    hits.sort((a, b) => a.layer - b.layer);
    return hits[hits.length - 1];
  };

  // Same hit test as getSpriteAt, but every live sprite at the point instead
  // of just the topmost — an explosion/AOE query wants the whole stack.
  // Real signature (the reference implementation): getSpritesAt(x, y, radius, group,
  // cameraActiveWhenDrawn) with the same leading-object form as explodeAt,
  // and the same mouse.isActive guard Sprite._target() already uses (an
  // untouched mouse sits at world (0,0) and would otherwise "hit" whatever
  // happens to be there). cameraActiveWhenDrawn is accepted for signature
  // parity and silently ignored — it queries the reference API's own camera-active
  // draw bookkeeping, which this file has no equivalent of.
  world.getSpritesAt = function (x, y, radius, group /*, cameraActiveWhenDrawn */) {
    if (x === mouse && !mouse.isActive) return [];
    if (x !== null && typeof x === 'object') {
      [x, y, radius, group] = [x.x, x.y, y, radius];
    }
    radius = radius || 0;
    // Group filtering happens on a plain-array COPY, never the live Group —
    // Array.prototype.filter on a Group subclass would run results back
    // through Group's own overridden push() (species construction), which
    // has real side effects (membership bookkeeping) that a read-only hit
    // test must never trigger.
    const pool = group instanceof Group ? [...group] : ALL_;
    const hits = pool.filter((s) => {
      if (s._dead) return false;
      // Screen-space sprites live at screen pixels, so the query point has to
      // be converted before it can hit one. Without this, a HUD button was
      // simply unclickable the moment the camera moved: the natural call,
      // getSpritesAt(mouse.x, mouse.y), tests a world coordinate against a
      // sprite that is not in world space. Doing it here means the natural
      // call keeps working for both kinds at once.
      if (s.screenSpace) {
        const sx = x - _camLeft(), sy = y - _camTop();
        if (radius > 0) {
          if (s.shape === 'circle') return Math.hypot(sx - s.x, sy - s.y) <= s.w / 2 + radius;
          const sb = s._bounds();
          const cx = Math.max(sb.l, Math.min(sx, sb.r));
          const cy = Math.max(sb.t, Math.min(sy, sb.b));
          return Math.hypot(sx - cx, sy - cy) <= radius;
        }
        if (s.shape === 'circle') {
          const dx = sx - s.x, dy = sy - s.y;
          return dx * dx + dy * dy <= (s.w / 2) ** 2;
        }
        const sb = s._bounds();
        return sx >= sb.l && sx <= sb.r && sy >= sb.t && sy <= sb.b;
      }
      if (radius > 0) {
        // Distance to the NEAREST point of the sprite's shape, not
        // center-to-center — a big sprite whose edge only grazes the
        // radius should still count.
        if (s.shape === 'circle') return Math.hypot(x - s.x, y - s.y) <= s.w / 2 + radius;
        const b = s._bounds();
        const nx = Math.max(b.l, Math.min(x, b.r));
        const ny = Math.max(b.t, Math.min(y, b.b));
        return Math.hypot(x - nx, y - ny) <= radius;
      }
      if (s.shape === 'circle') {
        const dx = x - s.x, dy = y - s.y;
        return dx * dx + dy * dy <= (s.w / 2) ** 2;
      }
      const b = s._bounds();
      return x >= b.l && x <= b.r && y >= b.t && y <= b.b;
    });
    hits.sort((a, b) => b.layer - a.layer); // topmost first
    return hits;
  };

  Object.defineProperty(world, 'allowSleeping', {
    get() { return _world().getAllowSleeping(); },
    set(v) { _world().setAllowSleeping(v); },
  });

  // autoStep: false means the sketch drives physics itself via
  // world.physicsUpdate() instead of the automatic call in loop() below.
  let AUTO_STEP_ = true;
  Object.defineProperty(world, 'autoStep', {
    get() { return AUTO_STEP_; },
    set(v) { AUTO_STEP_ = v; },
  });
  // Advance physics one step — `step` in seconds, defaulting to the fixed
  // 1/FPS cadence stepPhysics() below already uses. Also runs the same
  // contact/overlap bookkeeping the automatic path does, so
  // colliding()/overlapping() stay correct when a sketch is driving physics
  // by hand (autoStep = false) rather than skip half the automatic pipeline.
  world.physicsUpdate = function (step) {
    if (step !== undefined) _world().step(step, 8, 3);
    else stepPhysics();
    _updateContacts();
    _updateOverlaps();
  };

  // Restitution velocity threshold: two bodies colliding SLOWER than this
  // (px/frame) don't bounce at all, even with bounciness > 0 — Box2D's own
  // guard against a resting stack jittering forever off its own restitution.
  // planck exposes this as a single global (pl.Settings.velocityThreshold,
  // m/s), not a per-World setting — verified by grepping planck.min.js,
  // which only defines it once on Settings, never on the World prototype.
  Object.defineProperty(world, 'bounceThreshold', {
    get() { return pl.Settings.velocityThreshold * PXM / FPS; },
    set(v) { pl.Settings.velocityThreshold = v * FPS / PXM; },
  });

  // explodeAt: radial impulse to every sprite within radius (default: no
  // limit — the whole world feels it, falling off to 0 at the edge only
  // matters when a radius is given). Not a the reference API member — this file's own
  // addition, the "fun one" the spec asked for. Force falls off linearly
  // with distance so the epicenter gets the full `force` and the edge of
  // `radius` gets none; a sprite exactly AT the epicenter is skipped (no
  // direction to push it in, same "same point" guard attractTo/repelFrom use).
  // explodeAt(x, y, radius, magnitude, falloff) — the reference API's argument order
  // (the reference implementation), including its leading-object form so
  // `world.explodeAt(sprite, 120, 40)` works.
  //
  // The reference API delegates to Box2D v3's b2World_Explode. planck is a Box2D 2.x
  // port and has no such call, so the blast is hand-rolled: an impulse away
  // from the centre, attenuated toward the rim. The curve is OURS — a linear
  // ramp from full strength at the centre to `falloff` of it at the radius —
  // not a match for Box2D's internal one. Treat the shape of the falloff as
  // approximate; only the direction and the radius cutoff are faithful.
  world.explodeAt = function (x, y, radius, magnitude, falloff) {
    if (x !== null && typeof x === 'object') {
      [x, y, radius, magnitude, falloff] = [x.x, x.y, y, radius, magnitude];
    }
    if (radius === undefined) radius = Infinity;
    magnitude = magnitude === undefined ? 1 : magnitude;
    falloff = falloff === undefined ? 0.1 : falloff;
    for (const s of ALL_) {
      if (s._dead || s._sensor) continue;
      const dx = s.x - x, dy = s.y - y;
      const d = Math.hypot(dx, dy);
      if (d === 0 || d > radius) continue;
      // 1 at the centre, `falloff` at the rim
      const k = Number.isFinite(radius) ? 1 - (1 - falloff) * (d / radius) : 1;
      const mag = magnitude * k;
      // An IMPULSE (instant velocity change), not a force — applyLinearImpulse
      // at the body's own center, so an off-axis hit still can't add spin
      // (impulse-through-center-of-mass carries zero net torque by
      // definition). This is the one instruction the lead was explicit
      // about, since the two calls read as interchangeable but aren't:
      // applyForce needs sustained ticks to add up to anything, an
      // explosion is a single instant.
      s._body.applyLinearImpulse(pl.Vec2((dx / d) * mag, (dy / d) * mag), s._body.getWorldCenter(), true);
    }
  };

  // ---- joints (W17) — thin facades over planck joints ---------------------

  function _anchor(a, b, opt) {
    // opt.anchor is in facade pixels (world coords); planck wants local anchors.
    // `!== undefined` (not `||`/ternary-on-truthy) — an explicit anchor of 0
    // is a legitimate coordinate, not "absent". `||` silently discarded it.
    const ax = (opt && opt.anchor && opt.anchor.x !== undefined) ? opt.anchor.x : a.x;
    const ay = (opt && opt.anchor && opt.anchor.y !== undefined) ? opt.anchor.y : a.y;
    const localA = a._body.getLocalPoint(pl.Vec2(ax / PXM, ay / PXM));
    const localB = b._body.getLocalPoint(pl.Vec2(ax / PXM, ay / PXM));
    return { localA, localB };
  }

  // Shared by every joint facade: `joint.delete()` releases the constraint
  // at runtime (2.7.16/2.7.21/2.7.26 — "there is no joint.remove()", only
  // delete()). Each subclass constructor sets `this._joint` before use.
  class Joint {
    // Tracks which two sprites this joint spans, so sprite.joints (Sprite,
    // SPEC-surface #3) can list it and delete() below can detach it from
    // both ends. Every subclass constructor calls this right after super().
    _attach(a, b) {
      this._a = a;
      this._b = b;
      a._joints.push(this);
      b._joints.push(this);
    }
    delete() {
      _world().destroyJoint(this._joint);
      const i = JOINTS_.indexOf(this._joint);
      if (i >= 0) JOINTS_.splice(i, 1);
      if (this._a) { const ai = this._a._joints.indexOf(this); if (ai >= 0) this._a._joints.splice(ai, 1); }
      if (this._b) { const bi = this._b._joints.indexOf(this); if (bi >= 0) this._b._joints.splice(bi, 1); }
    }
  }

  class HingeJoint extends Joint {
    constructor(a, b, opt) {
      super();
      this._attach(a, b);
      const { localA, localB } = _anchor(a, b, opt);
      this._joint = _world().createJoint(new pl.RevoluteJoint({ localAnchorA: localA, localAnchorB: localB }, a._body, b._body));
      JOINTS_.push(this._joint);
    }
  }
  class DistanceJoint extends Joint {
    constructor(a, b, opt) {
      super();
      this._attach(a, b);
      this._bodyA = a._body;
      this._bodyB = b._body;
      // Anchor each body at ITS OWN center. Anchoring both at body A's
      // center (the shared _anchor helper) makes planck's distance
      // constraint dead — the joint never pulls the bodies together.
      const localA = pl.Vec2(0, 0);
      const localB = pl.Vec2(0, 0);
      const dx = b.x - a.x, dy = b.y - a.y;
      const sep = Math.sqrt(dx * dx + dy * dy) / PXM;
      // `!== undefined`, not a truthy ternary — length: 0 is a legitimate
      // (touching) joint length, not "unspecified".
      const len = (opt && opt.length !== undefined) ? opt.length / PXM : sep;
      this._joint = _world().createJoint(new pl.DistanceJoint({ length: len, localAnchorA: localA, localAnchorB: localB }, a._body, b._body));
      JOINTS_.push(this._joint);
    }
    // settable after construction (2.7.12/2.7.26: "set joint length after
    // construction" — `new DistanceJoint(a, b)` then `joint.length = 100`).
    get length() { return this._joint.getLength() * PXM; }
    set length(v) {
      this._joint.setLength(v / PXM);
      // planck doesn't wake bodies when a joint property changes — a settled
      // (asleep) body would keep its old separation forever. Wake both ends.
      if (this._bodyA && typeof this._bodyA.setAwake === 'function') this._bodyA.setAwake(true);
      if (this._bodyB && typeof this._bodyB.setAwake === 'function') this._bodyB.setAwake(true);
    }
  }
  class SliderJoint extends Joint {
    constructor(a, b, opt) {
      super();
      this._attach(a, b);
      const { localA, localB } = _anchor(a, b, opt);
      const axis = (opt && opt.axis) ? pl.Vec2(opt.axis.x, opt.axis.y) : pl.Vec2(1, 0);
      this._joint = _world().createJoint(new pl.PrismaticJoint({ localAnchorA: localA, localAnchorB: localB, localAxisA: axis }, a._body, b._body));
      JOINTS_.push(this._joint);
    }
  }
  class WheelJoint extends Joint {
    constructor(a, b, opt) {
      super();
      this._attach(a, b);
      // Anchor at the WHEEL's position (body B), not the chassis center:
      // the axle lives at the wheel, and a zero-length spring (both anchors
      // at the chassis center) collapses the suspension on ground contact.
      const ax = (opt && opt.anchor && opt.anchor.x !== undefined) ? opt.anchor.x : b.x;
      const ay = (opt && opt.anchor && opt.anchor.y !== undefined) ? opt.anchor.y : b.y;
      const localA = a._body.getLocalPoint(pl.Vec2(ax / PXM, ay / PXM));
      const localB = b._body.getLocalPoint(pl.Vec2(ax / PXM, ay / PXM));
      const axis = (opt && opt.axis) ? pl.Vec2(opt.axis.x, opt.axis.y) : pl.Vec2(0, 1);
      this._joint = _world().createJoint(new pl.WheelJoint({ localAnchorA: localA, localAnchorB: localB, localAxisA: axis, frequencyHz: 4, dampingRatio: 0.7 }, a._body, b._body));
      JOINTS_.push(this._joint);
    }
  }
  class GrabberJoint extends Joint {
    constructor(a, b, opt) {
      super();
      this._attach(a, b);
      // a = anchor body (usually static), b = dragged sprite
      const ax = (opt && opt.anchor && opt.anchor.x !== undefined) ? opt.anchor.x : b.x;
      const ay = (opt && opt.anchor && opt.anchor.y !== undefined) ? opt.anchor.y : b.y;
      const localA = a._body.getLocalPoint(pl.Vec2(ax / PXM, ay / PXM));
      const localB = b._body.getLocalPoint(pl.Vec2(ax / PXM, ay / PXM));
      // maxForce: 0 is a legitimate (inert) grabber, not "unspecified".
      const maxF = (opt && opt.maxForce !== undefined) ? opt.maxForce : 100;
      this._joint = _world().createJoint(new pl.MouseJoint({ maxForce: maxF, target: pl.Vec2(ax / PXM, ay / PXM), localAnchorA: localA, localAnchorB: localB }, a._body, b._body));
      JOINTS_.push(this._joint);
    }
  }
  class GlueJoint extends Joint {
    // Ported from the reference API GlueJoint (the reference implementation):
    // a WeldJoint rigidly fusing a and b at their CURRENT relative pose,
    // anchored at spriteA's position. No `opt` — the reference API's GlueJoint takes
    // only (spriteA, spriteB), unlike this file's other joints.
    constructor(a, b) {
      super();
      this._attach(a, b);
      const worldAnchor = pl.Vec2(a.x / PXM, a.y / PXM);
      const localA = a._body.getLocalPoint(worldAnchor);
      const localB = b._body.getLocalPoint(worldAnchor);
      const referenceAngle = b._body.getAngle() - a._body.getAngle();
      this._joint = _world().createJoint(new pl.WeldJoint({ localAnchorA: localA, localAnchorB: localB, referenceAngle }, a._body, b._body));
      JOINTS_.push(this._joint);
    }
  }

  // ---- physics step -----------------------------------------------------

  function stepPhysics() {
    _world().step(1 / FPS, 8, 3);
  }

  // Advances one signed per-pair contact/overlap counter for one frame's
  // observation — the same collision/input state machine documented at the
  // `kb`/`KEYS_` declaration above: 0 idle, 1..N frame count while touching,
  // -2 the one frame right after a real (>0-frame) contact ends. Both
  // _updateContacts() and _updateOverlaps() below poll geometry/physics
  // exactly once per frame (moSHion has no begin-contact/end-contact
  // listeners wired to planck), so unlike keyboard input — which gets a
  // same-frame -3 flicker from real async DOM events — a collision/overlap
  // pair that begins and ends between two polls is simply never observed;
  // -1/-3/-4 never arise here, only -2. See build report.
  function _advanceContact(prev, touchingNow) {
    if (touchingNow) return prev > 0 ? prev + 1 : 1;
    return prev > 0 ? -2 : 0;
  }

  // sprite.colliding()/collides()/collided() (2.3.17) need real physics
  // contacts, not bounding boxes — walk planck's live contact list every
  // frame and keep a running signed frame count on each sprite.
  function _updateContacts() {
    const now = new Map(); // sprite -> Set(other sprites touching this frame)
    for (let c = _world().getContactList(); c; c = c.getNext()) {
      if (!c.isTouching()) continue;
      // Sensor fixtures (collider = 'none') still show up as "touching" in
      // planck's contact list (only the solver skips their impulse) — but
      // colliding() is documented as solid-body contact only (2.3.17), so
      // a sensor pair must never count here even though overlaps() sees it.
      if (c.getFixtureA().isSensor() || c.getFixtureB().isSensor()) continue;
      const a = c.getFixtureA().getBody().getUserData();
      const b = c.getFixtureB().getBody().getUserData();
      if (!(a instanceof Sprite) || !(b instanceof Sprite)) continue;
      // surfaceSpeed (Sprite, SPEC-surface #1): re-applied to every ACTIVE
      // contact this frame, not stored on the fixture — see the getter
      // comment on surfaceSpeed for why. A's belt speed adds, B's
      // subtracts, so two conveyors moving the same real-world direction
      // partially cancel in the contact's shared tangent frame instead of
      // doubling; a plain single-conveyor-vs-static case is unaffected
      // (whichever side is static contributes 0).
      const beltSpeed = (a._surfaceSpeed || 0) - (b._surfaceSpeed || 0);
      if (beltSpeed) c.setTangentSpeed(beltSpeed * FPS / PXM);
      if (!now.has(a)) now.set(a, new Set());
      if (!now.has(b)) now.set(b, new Set());
      now.get(a).add(b);
      now.get(b).add(a);
    }
    for (const s of ALL_) {
      const cur = now.get(s);
      s._touch ??= new Map();
      const keys = new Set(s._touch.keys());
      if (cur) for (const o of cur) keys.add(o);
      for (const other of keys) {
        const next = _advanceContact(s._touch.get(other) || 0, !!(cur && cur.has(other)));
        if (next === 0) s._touch.delete(other); else s._touch.set(other, next);
      }
    }
  }

  // sprite.overlapping()/overlapped() need a persistent per-pair counter too
  // (overlaps() itself stays a live geometry query — see the comment on
  // Sprite.overlaps()). Unlike _updateContacts() this isn't backed by
  // planck at all — it's the same manual bounding-box/circle test
  // _overlapsOne() uses, just run for every live pair once per frame so a
  // signed counter can be kept.
  function _updateOverlaps() {
    const alive = ALL_.filter((s) => !s._dead);
    const now = new Map();
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i];
      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j];
        if (!a._overlapsOne(b)) continue;
        if (!now.has(a)) now.set(a, new Set());
        if (!now.has(b)) now.set(b, new Set());
        now.get(a).add(b);
        now.get(b).add(a);
      }
    }
    for (const s of alive) {
      s._overlap ??= new Map();
      const cur = now.get(s);
      const keys = new Set(s._overlap.keys());
      if (cur) for (const o of cur) keys.add(o);
      for (const other of keys) {
        const next = _advanceContact(s._overlap.get(other) || 0, !!(cur && cur.has(other)));
        if (next === 0) s._overlap.delete(other); else s._overlap.set(other, next);
      }
    }
  }

  // ---- render -----------------------------------------------------------

  function render() {
    const ordered = ALL_.filter((s) => !s._dead).sort((a, b) => a.layer - b.layer);

    // Two passes: the world, then anything pinned to the screen.
    //
    // The reference API's answer to a HUD is camera.off() around drawing PRIMITIVES,
    // which works here too — but moSHion renders sprites for you, so a HUD
    // built out of sprites had no way to stay put and scrolled off with the
    // level. `sprite.screenSpace = true` is ours, not the reference API's. Screen-space
    // sprites draw last so a HUD is never buried under the world, and their
    // .layer still orders them among themselves.
    const drawPass = (list, useCamera) => {
      if (!list.length) return;
      CTX_.save();
      if (useCamera) _applyCamera();
      for (const s of list) {
        if (!s.autoDraw) continue; // Sprite, SPEC-surface #3: false skips this sprite entirely
        if (s.ani) s.ani._advance();
        // A sketch-assigned sprite.draw REPLACES the default rendering for
        // that sprite (Sprite, SPEC-surface #3) — everything else (layer
        // order, ani advance, autoDraw gating above) still applies around it.
        if (typeof s.draw === 'function') s.draw();
        else s._draw();
      }
      CTX_.restore();
    };

    drawPass(ordered.filter((s) => !s.screenSpace), true);
    drawPass(ordered.filter((s) => s.screenSpace), false);
  }

  // text styling state (fill/textSize/textAlign) — q5.js-style globals that
  // real lesson code sets before every text() call (HUD scores, title
  // screens, game-over messages — 27 real script.js/solution.js files).
  let TEXT_COLOR = 'white', TEXT_SIZE = 14, TEXT_ALIGN = 'left';
  const CENTER = 'center', LEFT = 'left', RIGHT = 'right';
  function fill(c) { TEXT_COLOR = typeof c === 'number' ? `rgb(${c},${c},${c})` : c; }
  function textSize(px) { TEXT_SIZE = px; }
  function textAlign(mode) { TEXT_ALIGN = mode; }

  function text(str, x, y, size, color) {
    CTX_.save();
    _applyCamera();
    CTX_.fillStyle = color || TEXT_COLOR;
    CTX_.font = (size || TEXT_SIZE) + 'px monospace';
    CTX_.textAlign = TEXT_ALIGN;
    CTX_.fillText(str, x, y);
    CTX_.restore();
  }

  // ---- q5.js drawing primitives (used by real lesson code) ---------------

  function square(x, y, s) {
    CTX_.save();
    _applyCamera();
    CTX_.fillRect(x, y, s, s);
    CTX_.restore();
  }

  // stroke() / noStroke() / strokeWeight() / noFill() — general draw state,
  // same convention as fill()/TEXT_COLOR above: shapes drawn below read it
  // at call time, matching p5's real defaults (fill white, stroke black).
  let STROKE_COLOR = 'black', STROKE_WEIGHT = 1, HAS_STROKE = true, HAS_FILL = true;
  function stroke(c) { HAS_STROKE = true; STROKE_COLOR = typeof c === 'number' ? `rgb(${c},${c},${c})` : c; }
  function noStroke() { HAS_STROKE = false; }
  function strokeWeight(n) { STROKE_WEIGHT = n; }
  function noFill() { HAS_FILL = false; }

  // Real q5 tolerates a negative diameter/width/height (Math.abs the radius)
  // — verified against q5-c2d-shapes.js.
  function circle(x, y, d) {
    CTX_.save();
    _applyCamera();
    CTX_.beginPath();
    CTX_.arc(x, y, Math.abs(d / 2), 0, Math.PI * 2);
    if (HAS_FILL) { CTX_.fillStyle = TEXT_COLOR; CTX_.fill(); }
    if (HAS_STROKE) { CTX_.strokeStyle = STROKE_COLOR; CTX_.lineWidth = STROKE_WEIGHT; CTX_.stroke(); }
    CTX_.restore();
  }

  function ellipse(x, y, w, h) {
    h ??= w;
    CTX_.save();
    _applyCamera();
    CTX_.beginPath();
    CTX_.ellipse(x, y, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    if (HAS_FILL) { CTX_.fillStyle = TEXT_COLOR; CTX_.fill(); }
    if (HAS_STROKE) { CTX_.strokeStyle = STROKE_COLOR; CTX_.lineWidth = STROKE_WEIGHT; CTX_.stroke(); }
    CTX_.restore();
  }

  // Hand-rolled via arcTo (not ctx.roundRect — not universally available and
  // not one of the primitives the test harness's recording context stubs).
  function _roundRectPath(x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    CTX_.moveTo(x + r, y);
    CTX_.lineTo(x + w - r, y);
    CTX_.arcTo(x + w, y, x + w, y + r, r);
    CTX_.lineTo(x + w, y + h - r);
    CTX_.arcTo(x + w, y + h, x + w - r, y + h, r);
    CTX_.lineTo(x + r, y + h);
    CTX_.arcTo(x, y + h, x, y + h - r, r);
    CTX_.lineTo(x, y + r);
    CTX_.arcTo(x, y, x + r, y, r);
    CTX_.closePath();
  }

  // Optional 5th arg `r` is a uniform corner radius (real q5's rect() takes
  // four independent corner radii; real lesson code only ever passes one
  // shared value, so a single `r` is the surface actually exercised —
  // verified against 6.5.21's `rect(75, 110, 250, 80, 8)`).
  function rect(x, y, w, h, r) {
    CTX_.save();
    _applyCamera();
    if (r) {
      CTX_.beginPath();
      _roundRectPath(x, y, w, h, r);
      if (HAS_FILL) { CTX_.fillStyle = TEXT_COLOR; CTX_.fill(); }
      if (HAS_STROKE) { CTX_.strokeStyle = STROKE_COLOR; CTX_.lineWidth = STROKE_WEIGHT; CTX_.stroke(); }
    } else {
      if (HAS_FILL) { CTX_.fillStyle = TEXT_COLOR; CTX_.fillRect(x, y, w, h); }
      if (HAS_STROKE) { CTX_.strokeStyle = STROKE_COLOR; CTX_.lineWidth = STROKE_WEIGHT; CTX_.strokeRect(x, y, w, h); }
    }
    CTX_.restore();
  }

  // A line has no fill in p5 — noStroke() means no line at all, not a
  // fill-colored line.
  function line(x1, y1, x2, y2) {
    if (!HAS_STROKE) return;
    CTX_.save();
    _applyCamera();
    CTX_.strokeStyle = STROKE_COLOR;
    CTX_.lineWidth = STROKE_WEIGHT;
    CTX_.beginPath();
    CTX_.moveTo(x1, y1);
    CTX_.lineTo(x2, y2);
    CTX_.stroke();
    CTX_.restore();
  }

  // Resets the transform FIRST (verified against real q5's $.clear) so it
  // wipes the whole physical canvas regardless of camera translation — a
  // camera-relative clearRect would miss whatever the camera has panned past.
  function clear() {
    CTX_.save();
    CTX_.resetTransform();
    CTX_.clearRect(0, 0, W_, H_);
    CTX_.restore();
  }

  // ---- math & random (2.x, 6.x) ------------------------------------------

  // Seedable xorshift32 — NOT a Math.random() wrapper, so randomSeed()
  // genuinely reproduces a sequence. Fixed default seed (not Date.now())
  // keeps the corpus-test harness deterministic: "every run of the same
  // sketch produces byte-identical draw ops" (moshion-harness.mjs header).
  let RNG_STATE = 0x2f6e2b1;
  function _nextRandom() {
    let x = RNG_STATE;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    RNG_STATE = x;
    return (x >>> 0) / 4294967296;
  }
  function randomSeed(seed) { RNG_STATE = (seed | 0) || 1; } // xorshift breaks on a zero state
  // Array form truncates, not rounds — verified against q5-math.js
  // (`a[Math.trunc(a.length * rand())]`) — so it can never index one past
  // the end even though _nextRandom() is always non-negative here anyway.
  function random(a, b) {
    if (Array.isArray(a)) return a[Math.trunc(a.length * _nextRandom())];
    if (a === undefined) return _nextRandom();
    if (b === undefined) return _nextRandom() * a;
    return a + _nextRandom() * (b - a);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function constrain(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
  // Ported verbatim from q5-math.js: `clamp` is opt-in, and clamping swaps
  // its bounds when ostart > ostop (a descending output range).
  function map(value, istart, istop, ostart, ostop, clamp) {
    const val = ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
    if (!clamp) return val;
    return ostart < ostop ? Math.min(Math.max(val, ostart), ostop) : Math.min(Math.max(val, ostop), ostart);
  }
  // Arity-dispatched like real q5's $.dist — not a fixed 4-arg signature:
  //   2 args: two {x,y} objects   4 args: x1,y1,x2,y2   else: 3D x1,y1,z1,x2,y2,z2
  function dist(...a) {
    if (a.length === 2) return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    if (a.length === 4) return Math.hypot(a[0] - a[2], a[1] - a[3]);
    return Math.hypot(a[0] - a[3], a[1] - a[4], a[2] - a[5]);
  }
  // Ported verbatim from q5-math.js.
  function round(x, d = 0) {
    const p = 10 ** d;
    return Math.round(x * p) / p;
  }
  function ceil(n) { return Math.ceil(n); }
  function floor(n) { return Math.floor(n); }
  const int = floor; // real q5: `$.floor = $.int = Math.floor` — a literal alias, not Math.trunc
  function abs(n) { return Math.abs(n); }
  // p5's min/max accept either a spread of numbers or a single array.
  function min(...args) { return Math.min(...(Array.isArray(args[0]) ? args[0] : args)); }
  function max(...args) { return Math.max(...(Array.isArray(args[0]) ? args[0] : args)); }
  function sqrt(n) { return Math.sqrt(n); }
  function pow(b, e) { return Math.pow(b, e); }
  function atan2(y, x) { return Math.atan2(y, x); }
  function radians(deg) { return (deg * Math.PI) / 180; }
  function degrees(rad) { return (rad * 180) / Math.PI; }
  const PI = Math.PI, TWO_PI = Math.PI * 2, HALF_PI = Math.PI / 2;

  function millis() { return performance.now() - START_TIME_; }

  // Real q5's frameRate(hz) also RETARGETS the loop's cadence when `hz` is
  // given — moshion's loop is a fixed rAF cadence with no retargeting
  // mechanism, and building one is a main-loop change out of this task's
  // scope (flagged to team-lead, not built). The read path real lesson code
  // actually uses — "frameRate() returns the actual fps" (5.1.23) — is real.
  function frameRate() { return FPS_; }

  // p5's nf(num, left, right) — zero-pad the integer part to `left` digits,
  // fix the decimal part to `right` digits. Not in the brief's table; found
  // missing only once random/etc. unblocked 6.6.20's later `js live` blocks.
  function nf(num, left, right) {
    const neg = num < 0;
    const abs = Math.abs(num);
    const str = right !== undefined ? abs.toFixed(right) : String(abs);
    let [intPart, decPart] = str.split('.');
    if (left !== undefined) { while (intPart.length < left) intPart = '0' + intPart; }
    const out = decPart !== undefined ? intPart + '.' + decPart : intPart;
    return (neg ? '-' : '') + out;
  }

  // ---- vector (6.5.x) -----------------------------------------------------

  // p5.Vector-shaped: methods mutate in place and return `this` for chaining,
  // matching real p5.js semantics (createVector() is a fresh instance, not
  // tied to a sprite — assigning it to sprite.vel/pos replaces the live
  // physics-backed proxy with a plain vector, exactly like the reference API).
  class Vector {
    constructor(x, y) { this.x = x || 0; this.y = y || 0; }
    set(x, y) {
      if (x && typeof x === 'object') { this.x = x.x; this.y = x.y; }
      else { this.x = x || 0; this.y = y || 0; }
      return this;
    }
    copy() { return new Vector(this.x, this.y); }
    add(x, y) {
      if (x && typeof x === 'object') { this.x += x.x; this.y += x.y; }
      else { this.x += x; this.y += y; }
      return this;
    }
    sub(x, y) {
      if (x && typeof x === 'object') { this.x -= x.x; this.y -= x.y; }
      else { this.x -= x; this.y -= y; }
      return this;
    }
    mult(n) { this.x *= n; this.y *= n; return this; }
    div(n) { this.x /= n; this.y /= n; return this; }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    dist(v) { const dx = this.x - v.x, dy = this.y - v.y; return Math.sqrt(dx * dx + dy * dy); }
    normalize() {
      const m = this.mag();
      if (m !== 0) { this.x /= m; this.y /= m; }
      return this;
    }
  }
  function createVector(x, y) { return new Vector(x, y); }

  // ---- async loading (6.5.x) -----------------------------------------------

  // Real q5 returns a plain object SYNCHRONOUSLY (empty at return time), then
  // Object.assign's the fetched JSON's top-level keys onto that same object
  // when the promise resolves — and the object is thenable, so `await
  // loadJSON(url)` also works. 6.5.14 (the only lesson that touches this
  // global) teaches the callback form only — "you cannot write `let data =
  // loadJSON(...)` and use the return value" — never q5's preload/`_loaders`
  // pattern (loadJSON called in setup(), used unconditionally in draw()
  // because the framework awaited it first). Matching that preload gate
  // would mean changing moshion's boot sequence (`start()`), which is out of
  // scope here — flagged to team-lead, not built.
  function loadJSON(path, callback) {
    const result = {};
    const req = typeof fetch === 'function' ? fetch(path).then((r) => r.json()) : Promise.resolve({});
    const promise = req
      .then((data) => {
        Object.assign(result, data);
        if (typeof callback === 'function') callback(result);
        return result;
      })
      .catch(() => result);
    result.then = promise.then.bind(promise);
    result.catch = promise.catch.bind(promise);
    return result;
  }

  // ---- sound --------------------------------------------------------------
  //
  // moSHion's own design: the reference API ships no sound surface at all, so there is
  // nothing to port and nothing to be faithful to.
  //
  // Built on the Web Audio API. The first version used HTMLAudioElement,
  // which is simpler and got play/loop/volume right, but three things it
  // cannot do are exactly the things a game wants: position a sound in the
  // stereo field, fade one in or out, and hold many short clips in one file.
  //
  // Three facts about Web Audio that shape everything below:
  //
  // 1. The context starts SUSPENDED. Browsers will not make noise until the
  //    user has interacted with the page, so the context has to be resumed
  //    from inside a real input event. We hook that once, globally, on the
  //    first key or click — a sketch never has to think about it.
  // 2. Sound has to be fetched and DECODED before it can play. That is async
  //    and takes a moment. A play() before the buffer is ready is a silent
  //    no-op, not an error and not a queued sound: a sound effect arriving
  //    300ms late is worse than one that never arrives.
  // 3. A BufferSource is single-use. Every play() builds a new one. That is
  //    the intended design, not waste — it is also what makes overlapping
  //    shots free, where the old element-based version had to clone a DOM
  //    node per voice.

  let AUDIO_CTX_ = null;
  let MASTER_GAIN_ = null;
  let MASTER_VOLUME_ = 1;
  const SOUNDS_ = [];

  function _audioCtx() {
    if (AUDIO_CTX_) return AUDIO_CTX_;
    const Ctor = typeof AudioContext !== 'undefined'
      ? AudioContext
      : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
    if (!Ctor) return null; // no Web Audio at all: every sound becomes a no-op
    AUDIO_CTX_ = new Ctor();
    MASTER_GAIN_ = AUDIO_CTX_.createGain();
    MASTER_GAIN_.gain.value = MASTER_VOLUME_;
    MASTER_GAIN_.connect(AUDIO_CTX_.destination);
    return AUDIO_CTX_;
  }

  // Browsers only honour resume() from inside a user-gesture handler, so this
  // is wired to the same keydown/mousedown the input system already listens
  // for (see _unlockAudio() calls in start()). Cheap and idempotent.
  function _unlockAudio() {
    const ctx = AUDIO_CTX_;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  class Sound {
    constructor(url, opts) {
      this.url = url;
      this._volume = 1;
      this._rate = 1;
      this._pan = 0;
      this._buffer = null;
      this._voices = [];      // live BufferSources
      this._loopVoice = null; // the single looping one, if any
      this.blocked = false;
      this.error = null;

      // Audio sprites: one file, many clips, each [startSeconds, endSeconds].
      // Downloading one 40KB file beats twelve 4KB ones, and the clips stay
      // sample-accurate because they are offsets into a decoded buffer.
      this.clips = (opts && opts.clips) || null;

      SOUNDS_.push(this);
      this.ready = this._load();
    }

    async _load() {
      const ctx = _audioCtx();
      if (!ctx || typeof fetch !== 'function') return null;
      try {
        const res = await fetch(this.url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const bytes = await res.arrayBuffer();
        this._buffer = await ctx.decodeAudioData(bytes);
        return this._buffer;
      } catch (e) {
        // A missing or unplayable file must not take the sketch down; the
        // sound just never makes noise. `error` is there for a sketch that
        // wants to say so.
        this.error = e && e.message ? e.message : String(e);
        return null;
      }
    }

    get loaded() { return this._buffer !== null; }
    get duration() { return this._buffer ? this._buffer.duration : 0; }

    // Builds source -> panner -> gain -> master for one voice. Each voice has
    // its own gain and panner so a fade or a pan on one shot cannot disturb
    // another that is already sounding.
    _voice() {
      const ctx = _audioCtx();
      if (!ctx || !this._buffer) return null;
      const src = ctx.createBufferSource();
      src.buffer = this._buffer;
      src.playbackRate.value = this._rate;

      const gain = ctx.createGain();
      gain.gain.value = this._volume;

      let head = src;
      // createStereoPanner is missing on older Safari. Panning is a nicety;
      // losing it must not cost the sound itself.
      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.value = this._pan;
        head.connect(panner);
        head = panner;
        src.__panner = panner;
      }
      head.connect(gain);
      gain.connect(MASTER_GAIN_);
      src.__gain = gain;
      return src;
    }

    // Returns a {offset, duration} for a named clip, or the string 'unknown'
    // when this sound HAS clips but not that one. Callers treat 'unknown' as
    // "play nothing": falling through to the whole file would blast the
    // entire sprite sheet — every sound at once — because a name was
    // mistyped. Silence is the debuggable failure.
    _clip(name) {
      if (!name) return null;
      const c = this.clips && this.clips[name];
      if (!c) return this.clips ? 'unknown' : null;
      const start = Number(c[0]) || 0;
      const end = Number(c[1]);
      return { offset: start, duration: Number.isFinite(end) ? Math.max(0, end - start) : undefined };
    }

    /**
     * play() or play('clipName'). A fresh voice every time, so rapid repeats
     * overlap. Returns the voice, or null if the sound is not loaded yet.
     */
    play(clipName) {
      const src = this._voice();
      if (!src) return null;
      _unlockAudio();
      const clip = this._clip(clipName);
      if (clip === 'unknown') return null;
      src.loop = false;
      try {
        if (clip) src.start(0, clip.offset, clip.duration);
        else src.start(0);
      } catch {
        this.blocked = true;
        return null;
      }
      this._voices.push(src);
      src.onended = () => {
        const i = this._voices.indexOf(src);
        if (i >= 0) this._voices.splice(i, 1);
      };
      return src;
    }

    /**
     * One looping voice, not a new one per call — a sketch calling loop()
     * from draw() calls it 60 times a second and must not stack 60 copies.
     */
    loop(clipName) {
      if (this._loopVoice) return this._loopVoice;
      const src = this._voice();
      if (!src) {
        // The overwhelmingly common line is `music.loop()` in setup(), which
        // ALWAYS runs before the fetch+decode has finished — so the naive
        // version left the music silent for the entire session and gave the
        // author nothing to look at. Remember the intent and start it when
        // the buffer lands.
        //
        // play() deliberately does NOT do this. A looping track starting a
        // beat late is correct; a coin chime arriving 300ms after the coin
        // is worse than no chime, so one-shots stay no-ops.
        if (!this._pendingLoop && this._buffer === null) {
          this._pendingLoop = true;
          this.ready.then(() => {
            this._pendingLoop = false;
            if (this._buffer && !this._loopVoice) this.loop(clipName);
          });
        }
        return null;
      }
      _unlockAudio();
      const clip = this._clip(clipName);
      if (clip === 'unknown') return null;
      src.loop = true;
      if (clip) {
        src.loopStart = clip.offset;
        src.loopEnd = clip.offset + (clip.duration || 0);
      }
      try {
        if (clip) src.start(0, clip.offset, undefined);
        else src.start(0);
      } catch {
        this.blocked = true;
        return null;
      }
      this._loopVoice = src;
      src.onended = () => { if (this._loopVoice === src) this._loopVoice = null; };
      return src;
    }

    // Web Audio has no pause: a stopped BufferSource cannot be restarted.
    // pause() is therefore stop(), and is kept because it is the word a
    // student reaches for. Documented rather than faked with an offset,
    // which would be a resume() that silently drifts.
    pause() { this.stop(); }

    stop() {
      for (const v of this._voices.slice()) { try { v.stop(); } catch { /* already ended */ } }
      this._voices = [];
      if (this._loopVoice) { try { this._loopVoice.stop(); } catch { /* already ended */ } }
      this._loopVoice = null;
    }

    get playing() { return this._voices.length > 0 || this._loopVoice !== null; }

    get volume() { return this._volume; }
    set volume(v) {
      this._volume = Math.max(0, Math.min(1, Number(v) || 0));
      for (const s of this._allVoices()) if (s.__gain) s.__gain.gain.value = this._volume;
    }

    /** -1 hard left, 0 centre, 1 hard right. */
    get pan() { return this._pan; }
    set pan(v) {
      this._pan = Math.max(-1, Math.min(1, Number(v) || 0));
      for (const s of this._allVoices()) if (s.__panner) s.__panner.pan.value = this._pan;
    }

    /** Playback speed. Also shifts pitch — cheap variety from one effect. */
    get rate() { return this._rate; }
    set rate(v) {
      this._rate = Number(v) || 1;
      for (const s of this._allVoices()) s.playbackRate.value = this._rate;
    }

    /**
     * Ramp to a target volume over `seconds`. Fading to 0 stops the voices
     * when it lands, otherwise a silent source keeps running forever.
     *
     * cancelScheduledValues + setValueAtTime(current) first: without that,
     * a second fade starting mid-ramp jumps to wherever the first one was
     * scheduled instead of continuing from what you can actually hear.
     */
    fade(to, seconds) {
      const ctx = _audioCtx();
      const target = Math.max(0, Math.min(1, Number(to) || 0));
      const secs = Math.max(0, Number(seconds) === 0 ? 0 : Number(seconds) || 0.5);
      if (!ctx) { this.volume = target; return this; }
      const now = ctx.currentTime;
      for (const s of this._allVoices()) {
        if (!s.__gain) continue;
        const g = s.__gain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(target, now + secs);
      }
      this._volume = target;
      if (target === 0) {
        const stopAt = secs * 1000;
        setTimeout(() => { if (this._volume === 0) this.stop(); }, stopAt);
      }
      return this;
    }

    _allVoices() {
      return this._loopVoice ? this._voices.concat([this._loopVoice]) : this._voices;
    }
  }

  function loadSound(url, opts) { return new Sound(url, opts); }

  // Scales every sound at once without disturbing their individual volumes —
  // a mute button, or ducking under a cutscene. One gain node at the end of
  // the graph, so it costs nothing per voice.
  function masterVolume(v) {
    if (v === undefined) return MASTER_VOLUME_;
    MASTER_VOLUME_ = Math.max(0, Math.min(1, Number(v) || 0));
    if (MASTER_GAIN_) MASTER_GAIN_.gain.value = MASTER_VOLUME_;
    return MASTER_VOLUME_;
  }

  // ---- persistence ------------------------------------------------------

  // The preview iframe is sandboxed WITHOUT allow-same-origin so student code
  // cannot reach /api/* with the viewer's session cookie. That gives it an
  // opaque origin, where even READING window.localStorage throws SecurityError
  // -- which killed the sketch outright at the first storeItem(). Measured
  // 2026-08-25: black canvas and 'Error: Script error.' for every one of the
  // 42 lesson files that save anything, i.e. the whole of unit 6.5.
  //
  // So: real localStorage when it is genuinely reachable, and otherwise the map
  // the host page hydrated into window.__moshionStorage before this script ran,
  // with each change posted up for the host to persist on its own origin. See
  // lib/moshion-storage.ts and the boot block in runner.html.
  let LS_CACHE_;
  function _ls() {
    if (LS_CACHE_ === undefined) {
      // Probe by USE. Chrome throws on the property access itself, so a
      // truthiness check on window.localStorage is not a test of anything.
      try { window.localStorage.getItem('__moshion_probe'); LS_CACHE_ = window.localStorage; }
      catch (e) { LS_CACHE_ = null; }
    }
    return LS_CACHE_;
  }
  function _bridge() {
    if (!window.__moshionStorage) window.__moshionStorage = {};
    return window.__moshionStorage;
  }
  function _postStore(msg) {
    msg.source = 'preview-storage';
    try { window.parent.postMessage(msg, '*'); } catch (e) { /* no host */ }
  }

  function storeItem(name, val) {
    const raw = JSON.stringify(val);
    const ls = _ls();
    if (ls) { ls.setItem(name, raw); return; }
    _bridge()[name] = raw;
    _postStore({ op: 'set', key: String(name), value: raw });
  }
  function getItem(name) {
    const ls = _ls();
    const store = ls ? null : _bridge();
    const raw = ls ? ls.getItem(name)
      : (Object.prototype.hasOwnProperty.call(store, name) ? store[name] : null);
    if (raw === null || raw === undefined) return null;
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }
  function removeItem(name) {
    const ls = _ls();
    if (ls) { ls.removeItem(name); return; }
    delete _bridge()[name];
    _postStore({ op: 'remove', key: String(name) });
  }
  function clearStorage() {
    const ls = _ls();
    if (ls) { ls.clear(); return; }
    const store = _bridge();
    for (const k of Object.keys(store)) delete store[k];
    _postStore({ op: 'clear' });
  }

  // ---- main loop --------------------------------------------------------

  let _loopRunning = true;

  function noLoop() { _loopRunning = false; }

  function start() {
    const setupFn = window.setup || (() => {});
    const updateFn = window.update || (() => {});
    const drawFn = window.draw || (() => {});

    // Anchored immediately before setup() runs, matching real q5's own
    // `millisStart = performance.now()` placement right before `await
    // $.setup()` (q5-core.js) — not at engine load, not at start()'s top.
    START_TIME_ = performance.now();
    setupFn.call(global);
    if (!CANVAS_) throw new Error('new Canvas(w, h) must be called in setup()');

    // Rising edge: idle (0) or a still-visible negative edge state both
    // become 1 — a fresh keydown always starts a fresh count. Repeated
    // keydown events from OS key-repeat are no-ops (counter already > 0).
    const _pressKey = (n) => { if (!KEYS_[n] || KEYS_[n] < 0) KEYS_[n] = 1; };
    const _releaseKey = (n) => {
      const v = KEYS_[n] || 0;
      KEYS_[n] = v >= kb.holdThreshold ? -2 : v > 1 ? -1 : -3;
    };
    window.addEventListener('keydown', (e) => {
      // Browsers only honour AudioContext.resume() from inside a real user
      // gesture. Hooking it here means a sketch never has to think about it:
      // the first key or click the player presses unlocks sound for good.
      _unlockAudio();
      const k = _key(e.key);
      _pressKey(k);
      // ...and the direction name it doubles as, so 'right' and 'd' both answer.
      if (KEY_DIRS_[k]) _pressKey(KEY_DIRS_[k]);
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const k = _key(e.key);
      _releaseKey(k);
      const dir = KEY_DIRS_[k];
      if (!dir) return;
      // Two keys feed each direction (ArrowRight and 'd' both mean 'right'),
      // so releasing one must NOT release the shared alias while the other is
      // still down. The reference API releases it unconditionally (the reference implementation): hold
      // both, let go of one, and the player stops moving with a key still
      // held. Deliberate divergence — see DECISIONS.md D16.
      const stillHeld = Object.keys(KEY_DIRS_).some(
        (other) => other !== k && KEY_DIRS_[other] === dir && (KEYS_[other] || 0) > 0
      );
      if (!stillHeld) _releaseKey(dir);
    });
    CANVAS_.addEventListener('mousemove', (e) => {
      const r = CANVAS_.getBoundingClientRect();
      MOUSE.x = e.clientX - r.left + _camLeft();
      MOUSE.y = e.clientY - r.top + _camTop();
      MOUSE._seen = true;
      // A mousemove on the canvas IS the cursor being over the canvas. Relying
      // on mouseenter alone left isOnCanvas false for a cursor already inside
      // the element when the sketch started (no enter event is ever fired for
      // that), and for any environment that reports movement without enter.
      MOUSE._onCanvas = true;
      // drag tracking (mouse.drag/dragging/drags/dragged): mark "moved while
      // held" this frame for whichever buttons are currently down —
      // The reference API's onpointermove (the reference implementation). Consumed and cleared
      // once per frame in loop()'s sweep below.
      if (MOUSE._bl > 0) MOUSE._mvl = true;
      if (MOUSE._bc > 0) MOUSE._mvc = true;
      if (MOUSE._br > 0) MOUSE._mvr = true;
    });
    // isOnCanvas (mouse, SPEC-surface #6): plain boundary tracking, distinct
    // from _seen (which only ever turns on, the first time a mousemove is
    // seen at all — the reference implementation keeps the same two flags separate).
    CANVAS_.addEventListener('mouseenter', () => { MOUSE._onCanvas = true; });
    CANVAS_.addEventListener('mouseleave', () => { MOUSE._onCanvas = false; });
    // scrollDelta: accumulate; zeroed once per frame in loop()'s sweep,
    // matching the reference API's postDraw reset (the reference implementation).
    CANVAS_.addEventListener('wheel', (e) => {
      MOUSE.scrollDelta.x += e.deltaX;
      MOUSE.scrollDelta.y += e.deltaY;
    });
    CANVAS_.addEventListener('mousedown', (e) => {
      _unlockAudio(); // same reason as keydown above
      if (!MOUSE._c || MOUSE._c < 0) MOUSE._c = 1;
      const b = MOUSE_BTN_[(e && e.button) || 0];
      if (b && (!MOUSE[b] || MOUSE[b] < 0)) MOUSE[b] = 1;
    });
    window.addEventListener('mouseup', (e) => {
      MOUSE._c = MOUSE._c >= mouse.holdThreshold ? -2 : MOUSE._c > 1 ? -1 : -3;
      const b = MOUSE_BTN_[(e && e.button) || 0];
      if (b) MOUSE[b] = MOUSE[b] >= mouse.holdThreshold ? -2 : MOUSE[b] > 1 ? -1 : -3;
      // drag release: a flat -1 (the reference implementation), not the holdThreshold
      // split press/release above uses — a drag has no "held past
      // threshold" distinction of its own.
      const dragSlot = b === '_bl' ? '_dl' : b === '_bc' ? '_dc' : b === '_br' ? '_dr' : null;
      if (dragSlot && MOUSE[dragSlot] > 0) MOUSE[dragSlot] = -1;
    });

    let last = performance.now();
    function loop(now) {
      if (!_loopRunning) return; // noLoop(): fully stop, don't idle-spin rAF
      const dt = (now - last) / 1000;
      last = now;
      const step = Math.min(dt, 0.05);
      if (dt > 0) FPS_ = 1 / dt; // frameRate() reads this — matches real q5's 1000/deltaTime

      FRAME_++;

      updateFn(step);
      // Per-sprite update override (Sprite, SPEC-surface #3): "before
      // physics", matching where the reference API's own allSprites.update() runs
      // relative to physicsUpdate (its pre-draw pass, ~8049-8057) — a sprite's
      // custom update can move it by hand before this frame's physics step
      // sees that position. autoUpdate = false skips a sprite entirely.
      for (const s of ALL_) {
        if (s._dead || !s.autoUpdate) continue;
        if (typeof s.update === 'function') s.update();
      }
      // world.autoStep (World, SPEC-surface #5): false means the sketch
      // calls world.physicsUpdate() itself instead of this automatic step.
      if (AUTO_STEP_) {
        stepPhysics();
        _updateContacts();
        _updateOverlaps();
      }
      drawFn();
      render();

      // Counter sweep AFTER this frame's update/draw ran, not before —
      // keydown/mousedown fire asynchronously between rAF calls, so
      // resetting at the top of the frame wiped a press before user code
      // (kb.presses()/mouse.presses()) ever got to read it. Pre-existing bug,
      // caught while smoke-testing mouse.presses(); fix is this reorder only.
      // Matches the reference API's postDraw sweep (the reference implementation): a
      // negative (just-released) state is visible for exactly one frame
      // then decays to 0; a positive (held) state keeps counting up.
      for (const k in KEYS_) {
        if (KEYS_[k] < 0) KEYS_[k] = 0;
        else if (KEYS_[k] > 0) KEYS_[k]++;
      }
      // '_c' is the any-button counter; '_bl'/'_bc'/'_br' back mouse.left /
      // .center / .right. All four decay on the same schedule as a key.
      for (const slot of ['_c', '_bl', '_bc', '_br']) {
        if (MOUSE[slot] < 0) MOUSE[slot] = 0;
        else if (MOUSE[slot] > 0) MOUSE[slot]++;
      }
      // drag counters: increment while this button was moved-while-held
      // this frame (flag set by the mousemove handler above), else decay
      // like every other counter here — the reference implementation.
      for (const [dragSlot, moveFlag] of [['_dl', '_mvl'], ['_dc', '_mvc'], ['_dr', '_mvr']]) {
        if (MOUSE[moveFlag]) { MOUSE[dragSlot]++; MOUSE[moveFlag] = false; }
        else if (MOUSE[dragSlot] < 0) MOUSE[dragSlot] = 0;
      }
      MOUSE.scrollDelta.x = 0;
      MOUSE.scrollDelta.y = 0;

      // prevPos/prevRotation + life — both Sprite, once per frame, here:
      // AFTER this frame's physics/draw (so "previous frame" means what it
      // says) and BEFORE the dead-sprite sweep right below (so a sprite
      // whose life just hit 0 is removed from ALL_ this same frame).
      for (const s of ALL_) {
        if (s._dead) continue;
        s._prevPos = { x: s.x, y: s.y };
        s._prevRotation = s.rotation;
        // Only counts down once explicitly set — undefined/-1 stay immortal
        // (see the `life` getter comment on Sprite for why).
        if (s._life !== undefined && s._life !== -1) {
          s._life--;
          if (s._life <= 0) s.delete();
        }
      }

      for (let i = ALL_.length - 1; i >= 0; i--) {
        if (ALL_[i]._dead) ALL_.splice(i, 1);
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // expose
  global.Canvas = Canvas;
  global.Sprite = Sprite;
  global.Group = Group;
  global.HingeJoint = HingeJoint;
  global.DistanceJoint = DistanceJoint;
  global.SliderJoint = SliderJoint;
  global.WheelJoint = WheelJoint;
  global.GrabberJoint = GrabberJoint;
  global.GlueJoint = GlueJoint;
  global.Ani = Ani;
  global.Anis = Anis;
  global.world = world;
  global.camera = camera;
  global.kb = kb;
  global.mouse = mouse;
  global.allSprites = allSprites;
  global.DYNAMIC = DYNAMIC;
  global.STATIC = STATIC;
  global.KINEMATIC = KINEMATIC;
  global.DYN = DYN;
  global.STA = STA;
  global.KIN = KIN;
  Object.defineProperty(global, 'frameCount', { get: () => FRAME_ });
  Object.defineProperty(global, 'width', { get: () => W_ });
  Object.defineProperty(global, 'height', { get: () => H_ });
  Object.defineProperty(global, 'mouseX', { get: () => MOUSE.x });
  Object.defineProperty(global, 'mouseY', { get: () => MOUSE.y });
  global.cos = Math.cos;
  global.sin = Math.sin;
  global.background = background;
  global.text = text;
  global.fill = fill;
  global.textSize = textSize;
  global.textAlign = textAlign;
  global.square = square;
  global.CENTER = CENTER;
  global.LEFT = LEFT;
  global.RIGHT = RIGHT;
  global.storeItem = storeItem;
  global.getItem = getItem;
  global.removeItem = removeItem;
  global.clearStorage = clearStorage;
  global.noLoop = noLoop;
  global.start = start;
  global.circle = circle;
  global.ellipse = ellipse;
  global.rect = rect;
  global.line = line;
  global.clear = clear;
  global.stroke = stroke;
  global.noStroke = noStroke;
  global.strokeWeight = strokeWeight;
  global.noFill = noFill;
  global.random = random;
  global.randomSeed = randomSeed;
  global.lerp = lerp;
  global.map = map;
  global.constrain = constrain;
  global.dist = dist;
  global.round = round;
  global.ceil = ceil;
  global.floor = floor;
  global.int = int;
  global.abs = abs;
  global.min = min;
  global.max = max;
  global.sqrt = sqrt;
  global.pow = pow;
  global.atan2 = atan2;
  global.radians = radians;
  global.degrees = degrees;
  global.PI = PI;
  global.TWO_PI = TWO_PI;
  global.HALF_PI = HALF_PI;
  global.millis = millis;
  global.frameRate = frameRate;
  global.nf = nf;
  global.createVector = createVector;
  global.Vector = Vector;
  global.loadJSON = loadJSON;
  global.loadSound = loadSound;
  global.masterVolume = masterVolume;
  global.Sound = Sound;

  // Auto-boot: if the student sketch defines window.setup (the reference API
  // convention — sketches never call start() themselves), start the engine.
  // The deferred check (setTimeout 0) fires after all synchronous <script>
  // tags in the page have executed, which is when the student sketch has
  // defined window.setup. The immediate check handles the edge case where
  // the engine <script> tag appears after the student sketch.
  function _tryAutoBoot() {
    if (typeof global.setup === 'function' && !global._moshionStarted) {
      global._moshionStarted = true;
      start();
    }
  }
  // Exposed because the sketch does not always arrive before these two
  // checks. runner.html now waits for the host to hand it the save store
  // before injecting, which is well past setTimeout(0) -- without a way to
  // re-check, every sketch came up as a black frame and an empty console,
  // no error anywhere. Measured 2026-08-25.
  global._moshionAutoBoot = _tryAutoBoot;
  _tryAutoBoot();
  setTimeout(_tryAutoBoot, 0);

  /* SCOPE — 2D only; 3D is out of scope by design.
   *   This engine is strictly 2D (Box2D is 2D-only; planck.js is a Box2D port).
   *   CSCI 4's Q2 game unit is a 2D course; 3D comes from JSCAD modeling (Q3–Q4),
   *   which uses its own geometry, not this engine.
   *   FUTURE EXTENSION (not today): if 3D is ever needed, build a separate
   *   sibling engine (Sprite3D, camera.eye) over a 3D physics backend rather
   *   than growing a z-axis into this 2D facade. Keep this file 2D-clean.
   */
})(window);
