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
 *   sprite.image = url        (still image / <img> / <canvas>; a string with no '.' is an
 *                             emoji placeholder instead of a URL, e.g. '🧍'; group.image = x
 *                             sets it on every member and on new groupName.Sprite()s)
 *   sprite.pattern = url      (repeats at natural size inside the shape instead of stretching,
 *                             for ground/walls; also a group default)
 *   sprite.texture = 'coin'   (a NAMED pixel-art picture from textures/, or one saved with
 *                             saveTexture(); textureNames() lists them; also a group default)
 *   new HingeJoint(a,b,opt)   new DistanceJoint(a,b,opt)   joint.delete()
 *   new SliderJoint(a,b,opt)  new WheelJoint(a,b,opt)  new GrabberJoint(a,b,opt)
 *   new GlueJoint(a,b)        joint.length (DistanceJoint, settable post-construction)
 *   world.origin = 'math'     opt-in coordinate mode: origin at the canvas CENTRE, y UP,
 *                             angles counter-clockwise (default 'screen': top-left, y down)
 *   showGrid(step) showMouse() draw-time helpers that label the active coordinates
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
    // Boolean, matching the course (5.1.5/6.3.3: "returns true every frame
    // the key is held down") — not the raw frame count. Use holding(key) if
    // you need the count; nothing in the curriculum reads pressing() as a
    // number, and this is now the documented public contract.
    pressing: (k) => { const v = KEYS_[_key(k)] || 0; return v === -3 || v > 0; },
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
    get canvasPos() { const o = _frameOrigin(); return { x: MOUSE.x - o.x, y: MOUSE.y - o.y }; },
    // Boolean, matching mouse.pressing() as taught in 6.7.3/6.7.8 (used as
    // `if (!mouse.pressing())` in the drag-and-drop lesson).
    pressing: () => { const v = MOUSE._c; return v === -3 || v > 0; },
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
  // when the key comes back up. Ours returns what kb.pressing() returns: a
  // plain boolean, true only while actually held. A deliberate divergence.
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
  // `world.gravity.y = 10` is ~1g; `= 0` is zero-G. In 'math' mode (y up) the
  // same raw number points the other way on screen: a falling world there is
  // `world.gravity.y = -10`, exactly as a physics class writes it. The world STARTS at 0, as
  // the reference API's does: a plain `new Sprite()` stays where it was put
  // until a sketch turns gravity on (see _world()). The px/frame² facade
  // unit was 60x too strong (10 px/frame² = 1200 m/s² = 122g), which crushed
  // wheel-joint suspensions and sent pong balls flying. Live proxy vector so
  // `world.gravity.y = 0` sticks (a plain getter returning a fresh object
  // made gravity writes silent no-ops).
  const world = {};

  // ---- coordinate mode: world.origin = 'screen' | 'math' ------------------
  //
  // 'screen' (the default, and what every existing sketch runs on): (0, 0) is
  // the canvas's top-left corner, x grows right, y grows DOWN, and a positive
  // rotation turns clockwise -- the browser canvas's own convention, p5play's
  // too. 'math' is the opt-in mode for a module that wants the grid students
  // know from math class: (0, 0) is the CENTRE of the canvas, y grows UP, and
  // a positive rotation turns counter-clockwise from the +x axis.
  //
  // How it works, and why this way: the physics world is left entirely alone.
  // Box2D's own frame IS the math one (y up, angles counter-clockwise), and in
  // 'screen' mode this engine has always drawn that frame onto a y-down canvas
  // without ever flipping anything, which is why `vel.y = 5` moves a sprite
  // down the screen and gravity is `+10`. So 'math' mode changes ONE thing:
  // the canvas transform every draw goes through (`_applyFrame()`) becomes
  // "centre the origin, flip y", and text and pictures are flipped back so
  // they read upright. Every number a sketch reads or writes -- sprite.x/y,
  // vel, rotation, direction, gravity, forces, joint anchors, ray casts,
  // the mouse -- is then a Box2D number shown the Box2D way round. Nothing is
  // converted at the API boundary, so there is no sign to get wrong twice.
  // The places that DO have an opinion about which way is up are each
  // branched on `ORIGIN_` and listed here so the audit is one grep:
  //   _applyFrame (the transform), background, text, Sprite._draw (pictures,
  //   emoji, patterns and labels flipped back), _cullView, _frameOrigin
  //   (canvasPos / screen-space hit-tests), _pointerTo (the mouse), Canvas
  //   and the origin setter (camera start), Tiles (row direction),
  //   Walls, Group.cull (which edge is "top"), _drawGrid / _drawMouse.
  //
  // The rule for when it may be set: at the top of setup(), before any sprite
  // exists, before gravity is set and before the first frame. Nothing already
  // in the world is converted (a sprite made at y = 50 in screen mode would
  // jump to a different place on the canvas), so the setter refuses with a
  // plain message rather than move things. It also parks the camera on the
  // mode's own origin, the same place `new Canvas()` would have put it.
  let ORIGIN_ = 'screen';
  const ORIGIN_CHOICES_ = "'screen' (top-left corner, y grows down -- the default) or 'math' (canvas centre, y grows up)";
  Object.defineProperty(world, 'origin', {
    enumerable: true,
    get() { return ORIGIN_; },
    set(v) {
      if (v !== 'screen' && v !== 'math') {
        throw new TypeError(`world.origin must be ${ORIGIN_CHOICES_}, not ${JSON.stringify(v)}`);
      }
      if (v === ORIGIN_) return;
      if (ALL_.length || FRAME_ > 0) {
        throw new Error(`world.origin = '${v}' must come before any sprite is made and before the first frame -- put it at the top of setup()`);
      }
      if (WORLD_) {
        const g = WORLD_.getGravity();
        if (g.x !== 0 || g.y !== 0) {
          throw new Error(`world.origin = '${v}' must come before world.gravity is set -- in 'math' mode a falling world is world.gravity.y = -10`);
        }
      }
      ORIGIN_ = v;
      if (CANVAS_) _parkCamera();
    },
  });

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

  // The transform for one drawing pass. `withCamera` false is the fixed frame
  // a HUD draws in (drawTop(), camera.off(), screenSpace sprites). In 'screen'
  // mode that frame is the raw canvas, so nothing happens; in 'math' mode it
  // is still centred and y-up -- "the camera is off" means "the camera is
  // back at (0, 0)", not "fall back to top-left pixels".
  function _applyFrame(withCamera) {
    if (ORIGIN_ === 'math') {
      CTX_.translate(W_ / 2, H_ / 2);
      CTX_.scale(1, -1);
      if (withCamera) CTX_.translate(-camera.x, -camera.y);
      return;
    }
    if (withCamera) CTX_.translate(-_camLeft(), -_camTop());
  }
  function _applyCamera() { _applyFrame(camera._active); }

  // The world point that sits at the fixed frame's origin: subtracting it
  // from a world coordinate gives canvasPos. 'screen': the viewport's top-left
  // corner; 'math': the point the camera is centred on.
  function _frameOrigin() {
    if (ORIGIN_ === 'math') return { x: camera.x, y: camera.y };
    return { x: _camLeft(), y: _camTop() };
  }

  // World -> canvas pixel (top-left origin, y down), camera included. Used by
  // the overlays that paint in pixel space so their text stays upright.
  function _toPixel(wx, wy) {
    if (ORIGIN_ === 'math') return { x: wx - camera.x + W_ / 2, y: H_ / 2 - (wy - camera.y) };
    return { x: wx - _camLeft(), y: wy - _camTop() };
  }

  // Where an untouched camera rests: the canvas centre, in the mode's own
  // numbers. 'screen' calls the centre (w/2, h/2); 'math' calls it (0, 0).
  function _parkCamera() {
    if (ORIGIN_ === 'math') { camera.x = 0; camera.y = 0; return; }
    camera.x = W_ / 2;
    camera.y = H_ / 2;
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
      // canvas rather than at the world origin (in 'math' mode the centre IS
      // the origin, so it starts at (0, 0) -- see _parkCamera).
      _parkCamera();
      document.body.appendChild(CANVAS_);
    }
  }

  function background(color) {
    CTX_.save();
    if (ORIGIN_ === 'math') {
      // The whole canvas, whatever the camera is doing: the same answer the
      // branch below gives, without a flipped rect to reason about.
      CTX_.resetTransform();
      CTX_.fillStyle = color;
      CTX_.fillRect(0, 0, W_, H_);
      CTX_.restore();
      return;
    }
    _applyCamera();
    CTX_.fillStyle = color;
    CTX_.fillRect(_camLeft(), _camTop(), W_, H_);
    CTX_.restore();
  }

  // Default gravity is 0, matching p5play: a sketch that never mentions
  // world.gravity gets sprites that stay put. It was 9.8 until 2026-11-01,
  // which made a plain `new Sprite()` fall off the canvas in sketches that
  // never asked for gravity. Turn it on with `world.gravity.y = 10`.
  function _world() {
    if (!WORLD_) WORLD_ = pl.World({ gravity: pl.Vec2(0, 0) });
    return WORLD_;
  }

  // ---- art loading --------------------------------------------------------
  // One <img> per URL, shared by every sprite that asks for it: a bullet group
  // spawning 200 sprites with the same picture decodes it once, not 200 times.
  const ART_CACHE_ = new Map();
  function isUrl_(s) { return /[./]/.test(s) || /^(data|blob):/.test(s); }
  function loadArt_(art) {
    if (typeof art !== 'string') return art; // <img>, <canvas>, ImageBitmap: use as given
    let img = ART_CACHE_.get(art);
    if (!img) {
      img = new Image();
      img.addEventListener('error', () => { img._failed = true; });
      img.src = art;
      ART_CACHE_.set(art, img);
    }
    return img;
  }
  // canvas / ImageBitmap have no `complete`; they are ready the moment they exist.
  function artReady_(a) { return !a._failed && (a.complete === undefined || (a.complete && a.naturalWidth > 0)); }
  function artFailed_(a) { return !!a._failed || (a.complete === true && a.naturalWidth === 0); }

  // ---- textures ---------------------------------------------------------

  // `sprite.texture = 'crate'` names a picture instead of pointing at one.
  //
  // Two catalogs, checked in this order:
  //
  //   saved     art the student made, kept in the moSHion store under
  //             'texture:<name>' as a data: URL
  //   built-in  window.MOSHION_TEXTURES -- generated by
  //             scripts/make-textures.py, loaded by runner.html as a
  //             <script> BEFORE this file
  //
  // Saved wins, so a student who draws their own `coin` gets theirs and not
  // Kenney's. Both lookups are synchronous on purpose: `.texture` is a plain
  // property setter, and a fetch() would resolve after the first draw had
  // already missed.
  const TEX_PREFIX_ = 'texture:';
  // A saved ANIMATION is one wide strip under 'texture:<name>' plus its frame
  // count under 'texmeta:<name>'. Two keys rather than one JSON blob because
  // the image half then stays byte-identical to a still texture -- a still and
  // an animation load through exactly the same path, and dropping the meta
  // turns an animation back into a (first-frame-wide) still rather than
  // breaking it. Note 'texmeta:' does not start with 'texture:', so meta keys
  // never show up in textureNames().
  const TEXMETA_PREFIX_ = 'texmeta:';

  function _textureCatalog() {
    const cat = global.MOSHION_TEXTURES;
    if (cat && cat.textures) return cat;
    // No catalog script: saved textures still work, built-ins just aren't
    // there. Better than throwing -- a sketch using only saved art is fine.
    return { base: 'textures/', textures: {} };
  }

  function _savedTextureSrc(name) {
    // Through getItem(), not the raw store: storeItem() JSON-stringifies, and
    // depending on the host this lives in real localStorage or the bridge.
    const raw = getItem(TEX_PREFIX_ + name);
    return (typeof raw === 'string' && raw.slice(0, 5) === 'data:') ? raw : null;
  }

  // `loadSound('myZap')` resolves a sound saved under `sound:<name>`, the same
  // way a saved texture resolves. Only a code-safe NAME is looked up: a path or
  // a data: URI is left alone, so `/assets/coin.wav` and a pasted data URI
  // behave exactly as before. A host page saves the data: URI through the same
  // store (storeItem / the preview bridge); no upload or API is involved.
  const SOUND_PREFIX_ = 'sound:';
  function _savedSoundSrc(name) {
    if (typeof name !== 'string') return null;
    const explicit = name.slice(0, SOUND_PREFIX_.length) === SOUND_PREFIX_;
    if (!explicit && !/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return null;
    const raw = getItem(explicit ? name : SOUND_PREFIX_ + name);
    return (typeof raw === 'string' && raw.slice(0, 11) === 'data:audio/') ? raw : null;
  }

  function _textureSrc(name) {
    const saved = _savedTextureSrc(name);
    if (saved) return saved;
    const cat = _textureCatalog();
    const entry = cat.textures[name];
    return entry ? cat.base + entry.file : null;
  }

  // { frames, frameDelay, delays } for a saved animation, or null for a still.
  function _textureMeta(name) {
    // A built-in animation is a catalog entry with `frames`. Art the student
    // saved under the same name replaces it, still or not, so only fall to the
    // catalog when nothing is saved.
    if (!_savedTextureSrc(name)) {
      const e = _textureCatalog().textures[name];
      if (e && e.frames > 1) return { frames: e.frames, frameDelay: Math.max(1, e.frameDelay | 0 || 4), delays: null };
      return null;
    }
    const m = getItem(TEXMETA_PREFIX_ + name);
    if (!m || typeof m !== 'object') return null;
    const frames = Math.floor(m.frames);
    if (!(frames > 1)) return null;
    // A delays array is only honoured when it matches the frame count. A
    // mismatched one is a half-written save, and silently using it would hold
    // the wrong frames -- fall back to the uniform delay instead.
    const delays = Array.isArray(m.delays) && m.delays.length === frames ? m.delays : null;
    return {
      frames: frames,
      frameDelay: Math.max(1, Math.floor(m.frameDelay) || 4),
      delays: delays,
    };
  }

  function _storeKeys() {
    const ls = _ls();
    // A real localStorage enumerates through .length/.key(i); the sandboxed
    // iframe has no localStorage at all and uses the host bridge instead.
    // An implementation with neither would make every saved texture vanish
    // from textureNames() while getItem() still found it by name -- so fall
    // through to the bridge rather than returning an empty list.
    if (ls && typeof ls.length === 'number' && typeof ls.key === 'function') {
      const out = [];
      for (let i = 0; i < ls.length; i++) out.push(ls.key(i));
      return out;
    }
    return Object.keys(_bridge());
  }

  /** Every texture name a sketch can use right now, saved ones included. */
  function textureNames() {
    const names = Object.keys(_textureCatalog().textures);
    const keys = _storeKeys();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].slice(0, TEX_PREFIX_.length) === TEX_PREFIX_) {
        const n = keys[i].slice(TEX_PREFIX_.length);
        if (names.indexOf(n) === -1) names.push(n);
      }
    }
    return names.sort();
  }

  function hasTexture(name) { return _textureSrc(name) !== null; }

  /**
   * Save art under a name, so `sprite.texture = name` finds it next run.
   *
   * The host bridge caps a value at 64 KB and the store at 512 KB, which is
   * why this is for small pixel art rather than photographs. A 32x32 PNG
   * data URL is about 1-2 KB.
   */
  function saveTexture(name, dataUrl, opts) {
    if (typeof name !== 'string' || !name) {
      throw new Error('saveTexture(name, dataUrl): name must be a non-empty string');
    }
    if (typeof dataUrl !== 'string' || dataUrl.slice(0, 5) !== 'data:') {
      throw new Error("saveTexture(name, dataUrl): dataUrl must be a 'data:' URL");
    }
    storeItem(TEX_PREFIX_ + name, dataUrl);

    // frames > 1 means dataUrl is a horizontal strip of that many frames.
    const frames = opts ? Math.floor(opts.frames) : 1;
    if (frames > 1) {
      const delays = Array.isArray(opts.delays) && opts.delays.length === frames
        ? opts.delays.map(function (d) { return Math.max(1, Math.floor(d) || 1); })
        : null;
      storeItem(TEXMETA_PREFIX_ + name, {
        frames: frames,
        frameDelay: Math.max(1, Math.floor(opts.frameDelay) || 4),
        delays: delays,
      });
    } else {
      // Saving a still OVER an animation must drop the old frame count, or
      // the still gets sliced into N pieces and only a sliver ever draws.
      removeItem(TEXMETA_PREFIX_ + name);
    }
    ART_CACHE_.delete(dataUrl);   // redrawn under the same name: decode again
  }

  function deleteTexture(name) {
    removeItem(TEX_PREFIX_ + name);
    removeItem(TEXMETA_PREFIX_ + name);
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
      this._texture = null;  // the NAME, when the art came from `.texture`
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
      // thin wall between physics steps. At PXM=30 that's a ceiling of
      // 60 px/frame: setting vel.x = 900 settles to 60 by the next step.
      // The ceiling is `world.maxSpeed` (one global, default 60, opt-in to
      // raise -- see its definition for the cost); setting a speed past it
      // warns once per run, naming that knob, instead of failing silently.
      this.vel = liveVec(
        () => { const v = this._body.getLinearVelocity(); return { x: v.x * PXM / FPS, y: v.y * PXM / FPS }; },
        (x, y) => { noteSpeed_(x, y); this._body.setLinearVelocity(pl.Vec2(x * FPS / PXM, y * FPS / PXM)); },
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
    // "On screen" is the fixed frame drawTop() draws in: raw pixels in
    // 'screen' mode, the centred y-up frame with the camera removed in 'math'.
    get canvasPos() {
      if (this.screenSpace) return { x: this.x, y: this.y };
      const o = _frameOrigin();
      return { x: this.x - o.x, y: this.y - o.y };
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
    // Accepts: an emoji / short text (a string that is not a URL), an image URL,
    // a data:/blob: URL, or a ready-made <img> / <canvas> / ImageBitmap (e.g.
    // from createImg or a canvas you drew on). null or '' goes back to the
    // plain colored shape. A string with no '.', no '/' and no data:/blob:
    // prefix is an emoji/text placeholder, matching the reference API's `img`
    // setter heuristic (exercised by lesson code, e.g. `player.image = '🧍'`).
    get image() { return this._img || this._emoji; }
    set image(art) {
      this.ani = null;
      this._img = null;
      this._emoji = null;
      this._texture = null;   // a raw URL is not a named texture any more
      if (art == null || art === '') return;
      if (typeof art === 'string' && !isUrl_(art)) this._emoji = art;
      else this._img = loadArt_(art);
    }

    // Named art, resolved through the texture catalog above. Mutually
    // exclusive with `.image` and an active `.ani`, the same way those two
    // already exclude each other.
    //
    // The getter hands back the NAME, not the Image -- `if (s.texture ===
    // 'coin')` is the question students actually ask.
    get texture() { return this._texture; }
    set texture(name) {
      if (name === null || name === undefined || name === '') {
        // Only undo art that CAME from a texture; an addAni()/image the sketch
        // set itself is not ours to clear.
        if (this._texture) { this._img = null; this.ani = null; }
        this._texture = null;
        return;
      }
      const src = _textureSrc(name);
      if (!src) {
        // Loudly. A silent miss here looks exactly like a sprite drawn at the
        // wrong size or behind something, and costs an afternoon to find.
        const all = textureNames();
        const near = all.filter(function (n) {
          return n.toLowerCase().indexOf(String(name).toLowerCase()) !== -1;
        }).slice(0, 5);
        console.warn(
          'No texture named "' + name + '". ' +
          (near.length ? 'Did you mean: ' + near.join(', ') + '?'
                       : 'There are ' + all.length + ' textures -- call textureNames() to list them.')
        );
        return;
      }
      this._texture = String(name);
      this._emoji = null;

      const meta = _textureMeta(name);
      if (meta) {
        // The strip is exactly what Ani already slices -- width / frameCount
        // per frame, one row. So an animated texture needs no new draw path:
        // it IS an animation, reached by the friendlier name.
        const ani = new Ani(name, src, meta.frames, meta.delays);
        ani.frameDelay = meta.frameDelay;
        if (!this._anis) this._anis = new Anis();
        this._anis[name] = ani;
        this.ani = ani;
        this._img = null;
      } else {
        this._img = loadArt_(src);
        this.ani = null;
      }
    }

    // pattern: a picture that REPEATS inside the sprite's shape at its natural
    // size, anchored to the sprite's top-left, instead of stretching like
    // `image` does. For big surfaces (ground, walls, platforms) where a stretched
    // picture would smear. Takes a URL, data:/blob: URL, <img> or <canvas>;
    // null clears it. Any `image` / `texture` / `ani` draws instead of the tile.
    get pattern() { return this._pattern || null; }
    set pattern(art) {
      this._patternPat = null;
      this._pattern = art == null || art === '' ? null : loadArt_(art);
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
      this._texture = null;
      return ani;
    }

    changeAni(name) {
      const ani = this._anis && this._anis[name];
      if (!ani) return; // unregistered name — silent no-op, matches the reference API
      this.ani = ani;
    }

    // clone(): a new sprite that looks and behaves like this one, in the same
    // spot, in the same groups (shCode issue #87). It copies the size, shape,
    // rotation, colour and outline, text, art (image, texture, pattern and
    // every addAni animation, each with its own frame counter), layer and
    // visibility, and the physics knobs: collider, bounciness, friction,
    // density, drag, rotation drag and lock, gravity scale. It does NOT copy
    // motion (it starts still), life, joints, or properties the sketch made
    // up itself (hp, points): set those on the copy. Joining the same groups
    // is what lets `player.colliding(pipes)` see the copy too.
    clone() {
      const c = new Sprite(this.x, this.y, this.w, this.h);
      // physics: the raw knobs, then one fixture rebuild with all of them
      c._shape = this._shape;
      c._bodyType = this._bodyType;
      c._sensor = this._sensor;
      c._bounciness = this._bounciness;
      c._friction = this._friction;
      c._density = this._density;
      c._buildFixture();
      c._body.setGravityScale(this._body.getGravityScale());
      c._gravityBeforeNone = this._gravityBeforeNone;
      c.drag = this.drag;
      c.rotationDrag = this.rotationDrag;
      c.rotationLock = this.rotationLock;
      c.rotation = this.rotation;
      // looks
      for (const k of ['color', 'layer', 'visible', 'stroke', 'strokeWeight', 'opacity', 'text', 'textColor',
        'textSize', '_textStroke', '_textStrokeWeight', 'screenSpace', 'debug', 'autoDraw', 'autoUpdate']) {
        c[k] = this[k];
      }
      c._scale = { x: this._scale.x, y: this._scale.y };
      if (this._visualOnly) c.visualOnly = true;
      // art: pictures are shared (they never change); animations are copied
      // so the clone keeps its own frame instead of flipping in step
      c._img = this._img;
      c._emoji = this._emoji;
      c._texture = this._texture;
      c._pattern = this._pattern || null;
      if (this._anis) {
        c._anis = new Anis();
        for (const name of Object.keys(this._anis)) {
          const a = this._anis[name];
          c._anis[name] = Object.assign(Object.create(Ani.prototype), a, { frame: a.frame, _tick: a._tick });
        }
      }
      if (this.ani) {
        const own = this._anis && Object.keys(this._anis).find((n) => this._anis[n] === this.ani);
        c.ani = own ? c._anis[own] : Object.assign(Object.create(Ani.prototype), this.ani);
      }
      // groups (the constructor already put it in allSprites)
      for (const g of this._groups) if (g !== allSprites) g.push(c);
      return c;
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

    // addSensor(offsetX, offsetY, w, h): a box riding on this sprite that
    // only DETECTS. It is an extra planck fixture marked as a sensor with no
    // density, so it pushes nothing, weighs nothing and does not change how
    // the sprite moves; `colliding()` never counts it. Ask it directly:
    //
    //   feet = player.addSensor(0, 21, 26, 4); // a strip under a 30x40 player
    //   if (kb.presses('space') && feet.overlaps(ground)) player.vel.y = -9;
    //
    // which is true on the floor and false against a wall or a ceiling, where
    // `player.colliding(ground)` is true in all three. Offsets are from the
    // sprite's centre and turn with it, in the active coordinates: +offsetY is
    // below the sprite in 'screen' mode and ABOVE it in 'math' mode, where the
    // same foot sensor is addSensor(0, -21, 26, 4). Defaults: no offset, the
    // sprite's size.
    // Box2D only reports contacts that involve a moving (dynamic) body, so a
    // sensor on a static or kinematic sprite sees only dynamic ones. Like
    // colliding(), the answer is from this frame's physics step. world.rayCast
    // reports a sensor's box as part of its sprite.
    addSensor(offsetX = 0, offsetY = 0, w = this.w, h = this.h) {
      for (const [k, v] of [['offsetX', offsetX], ['offsetY', offsetY], ['w', w], ['h', h]]) {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          throw new TypeError(`sprite.addSensor(offsetX, offsetY, w, h): ${k} must be a number`);
        }
      }
      const fixture = this._body.createFixture({
        shape: pl.Box(Math.abs(w) / 2 / PXM, Math.abs(h) / 2 / PXM, pl.Vec2(offsetX / PXM, offsetY / PXM), 0),
        density: 0,
        isSensor: true,
      });
      const sensor = new Sensor(this, fixture);
      fixture.setUserData(sensor);
      SENSORS_.push(sensor);
      return sensor;
    }

    _draw() {
      if (!this.visible) return;
      CTX_.save();
      CTX_.globalAlpha = this.opacity;
      CTX_.translate(this.x, this.y);
      CTX_.rotate((this.rotation * Math.PI) / 180);
      CTX_.scale(this.scale.x, this.scale.y);
      // 'math' mode draws through a y-flipped canvas (see _applyFrame). The
      // coloured rect and circle are symmetric about the centre, so flipping
      // back here changes nothing for them, and it is what turns a picture, an
      // emoji or a tiling pattern the right way up again.
      if (ORIGIN_ === 'math') CTX_.scale(1, -1);
      // Art that is still loading draws nothing (no flash of the colored block
      // before the picture pops in); art that FAILED to load falls back to the
      // colored shape, so a typo in a URL shows a block, not an invisible sprite.
      const sheet = this.ani && this.ani.spriteSheet;
      if (sheet && artReady_(sheet)) {
        const fw = sheet.naturalWidth / this.ani.frameCount;
        // Named textures are pixel art: smoothing off, so a 21x21 tile stretched
        // across a 50x50 sprite stays blocky instead of blurring. A plain
        // .image / addAni still smooths.
        const smoothA = CTX_.imageSmoothingEnabled;
        if (this._texture) CTX_.imageSmoothingEnabled = false;
        CTX_.drawImage(sheet, this.ani.frame * fw, 0, fw, sheet.naturalHeight, -this.w / 2, -this.h / 2, this.w, this.h);
        CTX_.imageSmoothingEnabled = smoothA;
      } else if (this._img && artReady_(this._img)) {
        const smooth = CTX_.imageSmoothingEnabled;
        if (this._texture) CTX_.imageSmoothingEnabled = false;
        CTX_.drawImage(this._img, -this.w / 2, -this.h / 2, this.w, this.h);
        CTX_.imageSmoothingEnabled = smooth;
      } else if (this._emoji) {
        // Sized to the smaller side so a tall, thin sprite's emoji stays inside
        // its collider instead of overflowing it.
        CTX_.font = `${Math.min(this.w, this.h)}px sans-serif`;
        CTX_.fillStyle = this.color;
        CTX_.textAlign = 'center';
        CTX_.textBaseline = 'middle';
        CTX_.fillText(this._emoji, 0, 0);
      } else if (!(sheet && !artFailed_(sheet)) && !(this._img && !artFailed_(this._img))
                 && !(this._pattern && !artReady_(this._pattern) && !artFailed_(this._pattern))) {
        // A texture that is ready fills the shape with its tiling pattern; one
        // still loading skips the frame, one that failed uses the plain color.
        if (this._pattern && artReady_(this._pattern)) {
          if (!this._patternPat) this._patternPat = CTX_.createPattern(this._pattern, 'repeat');
          // A pattern is anchored where the canvas origin is at FILL time, so shift
          // it to the sprite's top-left (re-set each frame: w/h can change).
          this._patternPat.setTransform(new DOMMatrix().translate(-this.w / 2, -this.h / 2));
          CTX_.fillStyle = this._patternPat;
        } else {
          CTX_.fillStyle = this.color;
        }
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
        if (ORIGIN_ === 'math') CTX_.scale(1, -1); // read upright through the flipped frame
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

  // What sprite.addSensor() returns. Its overlap ledger is its own (keyed by
  // the other sprite), filled once per frame by _updateContacts() from
  // planck's contact list, using the same signed counter as colliding().
  const SENSORS_ = [];
  class Sensor {
    constructor(sprite, fixture) {
      this.sprite = sprite;
      this._fixture = fixture;
      this._hits = new Map();
      this._removed = false;
    }
    // Frames this sensor has been touching `other` (a Sprite, or for a Group
    // the longest-touching member); 0 when it is not.
    overlapping(other) {
      if (other instanceof Group) {
        let n = 0;
        for (const s of other) n = Math.max(n, this._count(s));
        return n;
      }
      return this._count(other);
    }
    // True while this sensor touches `other` (a Sprite, or any member of a Group).
    overlaps(other) { return this.overlapping(other) > 0; }
    _count(other) {
      const v = this._hits.get(other) || 0;
      return v > 0 ? v : 0;
    }
    // Takes the sensor off its sprite. Deleting the sprite does this too.
    remove() {
      if (this._removed) return;
      this._removed = true;
      if (!this.sprite._dead) this.sprite._body.destroyFixture(this._fixture);
      this._hits.clear();
      const i = SENSORS_.indexOf(this);
      if (i >= 0) SENSORS_.splice(i, 1);
    }
  }

  // ---- animation (2.4.x) --------------------------------------------------
  // Minimal sprite-sheet animation: a named horizontal frame-strip, advanced
  // on a fixed delay. Not the reference API's full texture-atlas system (no multi-row
  // atlases, no addAnis) — real lesson code only ever calls addAni/changeAni.

  class Ani {
    constructor(name, sheetUrl, frameCount, frameDelays) {
      this.name = name;
      this.frameCount = frameCount || 1;
      this.frameDelay = 4; // game frames per animation frame (the reference API default)
      // OPTIONAL per-frame holds, one entry per frame. Null for everything
      // addAni() builds, so the uniform-delay path below is what it has always
      // been -- this exists for textures drawn in an editor, where a pose can
      // be held longer than the frames around it.
      this.frameDelays = Array.isArray(frameDelays) && frameDelays.length === this.frameCount
        ? frameDelays.map(function (d) { return Math.max(1, Math.floor(d) || 1); })
        : null;
      this.frame = 0;
      this._tick = 0;
      this.spriteSheet = loadArt_(sheetUrl);
    }
    /** How long the frame showing right now is held, in game frames. */
    holdOf(frame) {
      if (this.frameDelays) return this.frameDelays[frame];
      return this.frameDelay;
    }
    _advance() {
      if (this.frameCount <= 1) return;
      if (++this._tick < this.holdOf(this.frame)) return;
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
          if (group._groupImage != null) this.image = group._groupImage;
          if (group._groupTexture != null) this.texture = group._groupTexture;
          if (group._groupPattern != null) this.pattern = group._groupPattern;
          group.push(this);
        }
      }
      Object.defineProperty(this, 'Sprite', { value: GroupSprite, enumerable: false });
    }
    newSprite(x, y, w, h) { const s = new Sprite(x, y, w, h); this.push(s); return s; }

    // texture: same cascade-and-remember behaviour as `image`, by catalog name.
    get texture() { return this._groupTexture == null ? null : this._groupTexture; }
    set texture(name) {
      Object.defineProperty(this, '_groupTexture', { value: name, writable: true, configurable: true, enumerable: false });
      for (const s of this) s.texture = name;
    }

    // pattern: same cascade-and-remember behaviour as `image` above, for repeating fills.
    get pattern() { return this._groupPattern == null ? null : this._groupPattern; }
    set pattern(art) {
      Object.defineProperty(this, '_groupPattern', { value: art, writable: true, configurable: true, enumerable: false });
      for (const s of this) s.pattern = art;
    }

    // image: art for every member, current and future — `coins.image = '🪙'`.
    // Cascades like autoDraw below AND is remembered as the default for the
    // `new coins.Sprite()` factory (which copies enumerable props, so this
    // accessor on the prototype is applied separately in GroupSprite).
    get image() { return this._groupImage == null ? null : this._groupImage; }
    set image(art) {
      Object.defineProperty(this, '_groupImage', { value: art, writable: true, configurable: true, enumerable: false });
      for (const s of this) s.image = art;
    }

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
      // actually on screen rather than against the origin. `top` is always the
      // margin past the top EDGE of the screen: the larger y in 'math' mode.
      let minX, minY, maxX, maxY;
      if (ORIGIN_ === 'math') {
        minX = camera.x - W_ / 2 - left; maxX = camera.x + W_ / 2 + right;
        minY = camera.y - H_ / 2 - bottom; maxY = camera.y + H_ / 2 + top;
      } else {
        minX = _camLeft() - left; minY = _camTop() - top;
        maxX = _camLeft() + W_ + right; maxY = _camTop() + H_ + bottom;
      }
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

  // ---- tile maps and walls ------------------------------------------------

  // new Tiles(map, x, y, w, h, legend): builds a level out of rows of text.
  //
  //   walls = new Group(); walls.collider = 'static'; walls.color = 'gray';
  //   coins = new Group(); coins.collider = 'none';  coins.diameter = 14;
  //   level = new Tiles([
  //     '##########',
  //     '#  c   c #',
  //     '##########',
  //   ], 20, 20, 40, 40, { '#': walls, 'c': coins });
  //
  // Each character that the legend names becomes one `new group.Sprite()`
  // from that group, so the group's defaults (collider, color, diameter,
  // texture, custom fields) apply exactly as they would by hand. Any other
  // character (a space, '.') is an empty cell. Column c of row r is centred
  // at (x + c * w, y + r * h), so x, y is the CENTRE of the top-left tile,
  // the same way a sprite's x, y is its centre; a group default size (e.g.
  // coins.diameter) wins over the tile size. `h` defaults to `w`. Rows go
  // DOWN the screen in both coordinate modes -- the first string is the top
  // row -- so in 'math' mode (y up) row r is centred at y - r * h.
  //
  // The Tiles object is itself a Group holding every sprite it made, in
  // reading order, so `level.delete()` clears the level. Legend keys may be
  // any single character, emoji included.
  //
  // p5play builds tiles from groups that carry a `.tile` letter instead of
  // a legend; this takes the legend, so the map and what it means sit side
  // by side in the sketch. (p5play's form is recalled, not verified.)
  class Tiles extends Group {
    // tiles.filter(...) and friends hand back a plain Group, not a new map.
    static get [Symbol.species]() { return Group; }
    constructor(map, x, y, w, h, legend) {
      super();
      const sig = 'new Tiles(map, x, y, w, h, legend)';
      if (!Array.isArray(map) || map.some((row) => typeof row !== 'string')) {
        throw new TypeError(`${sig}: map must be an array of strings, one string per row`);
      }
      if (typeof x !== 'number' || typeof y !== 'number') {
        throw new TypeError(`${sig}: x and y must be numbers (the centre of the top-left tile)`);
      }
      if (typeof w !== 'number' || !(w > 0)) {
        throw new TypeError(`${sig}: w must be a number above 0 (the width of one tile)`);
      }
      if (h === undefined || h === null) h = w;
      if (typeof h !== 'number' || !(h > 0)) {
        throw new TypeError(`${sig}: h must be a number above 0 (the height of one tile)`);
      }
      if (!legend || typeof legend !== 'object') {
        throw new TypeError(`${sig}: legend must be an object naming the Group each character builds, like { '#': walls }`);
      }
      for (const key of Object.keys(legend)) {
        if (!(legend[key] instanceof Group)) {
          throw new TypeError(`${sig}: legend['${key}'] must be a Group (made with new Group())`);
        }
      }
      const rowStep = ORIGIN_ === 'math' ? -h : h; // the next row is further down the screen
      for (let r = 0; r < map.length; r++) {
        const cells = Array.from(map[r]); // by character, so an emoji is one cell
        for (let c = 0; c < cells.length; c++) {
          const ch = cells[c];
          if (!Object.prototype.hasOwnProperty.call(legend, ch)) continue;
          this.push(new legend[ch].Sprite(x + c * w, y + r * rowStep, w, h));
        }
      }
    }
  }

  // new Walls(thickness = 50): four static walls just OUTSIDE the edges of
  // what the canvas shows, so sprites bounce off the edges of the screen
  // and the whole canvas stays playable. Off screen, so not seen. Call it
  // after new Canvas(). It is a Group of the four walls, which are also
  // walls.top / .bottom / .left / .right, so `player.colliding(walls)` asks
  // "touching any edge" and `player.colliding(walls.bottom)` asks "on the floor".
  // The walls are placed where the camera is looking when it is called and
  // stay there; they do not follow the camera.
  class Walls extends Group {
    static get [Symbol.species]() { return Group; }
    constructor(thickness = 50) {
      super();
      if (!CANVAS_) throw new Error('new Walls() must come after new Canvas(w, h)');
      if (typeof thickness !== 'number' || !(thickness > 0)) {
        throw new TypeError('new Walls(thickness): thickness must be a number above 0');
      }
      const t = thickness, w = W_, h = H_;
      const make = (name, cx, cy, ww, hh) => {
        const s = new Sprite(cx, cy, ww, hh, 'static');
        s.color = 'gray';
        this.push(s);
        Object.defineProperty(this, name, { value: s, enumerable: false });
      };
      if (ORIGIN_ === 'math') {
        // Same four walls, with "top" the larger y. walls.top is still the
        // one above the screen and walls.bottom the floor.
        const cx = camera.x, cy = camera.y;
        make('top', cx, cy + h / 2 + t / 2, w + 2 * t, t);
        make('bottom', cx, cy - h / 2 - t / 2, w + 2 * t, t);
        make('left', cx - w / 2 - t / 2, cy, t, h);
        make('right', cx + w / 2 + t / 2, cy, t, h);
        return;
      }
      const l = _camLeft(), top = _camTop();
      make('top', l + w / 2, top - t / 2, w + 2 * t, t);
      make('bottom', l + w / 2, top + h + t / 2, w + 2 * t, t);
      make('left', l - t / 2, top + h / 2, t, h);
      make('right', l + w + t / 2, top + h / 2, t, h);
    }
  }

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
        const o = _frameOrigin();
        const sx = x - o.x, sy = y - o.y;
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

  // world.maxSpeed (px/frame): the fastest any body may move in one step.
  // planck clamps every body's per-step translation to Settings.maxTranslation
  // (2 m), which at PXM=30 is 60 px/frame -- its anti-tunnelling guard. Like
  // velocityThreshold above it is one global, not per-World or per-body.
  // The default stays 60 so no sketch changes; a sketch that needs more opts
  // in with `world.maxSpeed = 200`. The cost, said in the docs: between two
  // frames a body that fast can skip clean past a thin sprite (a bullet past
  // an enemy) without the two ever touching. A dynamic body still meets a
  // static wall (planck's time-of-impact pass); a kinematic or 'none' one
  // does not. (shCode issue #84.)
  const DEFAULT_MAX_SPEED_ = 2 * PXM;
  pl.Settings.maxTranslation = DEFAULT_MAX_SPEED_ / PXM;
  Object.defineProperty(world, 'maxSpeed', {
    get() { return pl.Settings.maxTranslation * PXM; },
    set(v) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
        throw new TypeError(`world.maxSpeed must be a number above 0 (pixels per frame; the default is ${DEFAULT_MAX_SPEED_}), not ${JSON.stringify(v)}`);
      }
      pl.Settings.maxTranslation = v / PXM;
    },
  });
  // A speed set past the cap silently settles to it by the next step, which
  // reads as "my number is ignored". Say so once per run, naming the knob.
  let speedCapWarned_ = false;
  function noteSpeed_(vx, vy) {
    if (speedCapWarned_) return;
    const cap = world.maxSpeed;
    const sp = Math.hypot(vx, vy);
    if (!(sp > cap + 1e-9)) return;
    speedCapWarned_ = true;
    console.warn(
      `A speed of ${Math.round(sp)} pixels per frame is over the speed cap of ${Math.round(cap)}, ` +
      `so the sprite moves at ${Math.round(cap)}. To go faster, raise the cap first: ` +
      `world.maxSpeed = ${Math.ceil(sp)}; (very fast sprites can skip past thin ones between frames).`
    );
  }

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

  // rayCast: cast a ray through the physics world and call callback for each
  // fixture hit. Matches planck.js/Box2D signature:
  //   world.rayCast(x1, y1, x2, y2, callback)
  //   world.rayCast({x, y}, {x, y}, callback)
  // callback(fixture, point, normal, fraction) → return:
  //   fraction (0..1): clip ray at hit, continue → finds CLOSEST
  //   0: stop at first hit → finds ANY
  //   1: continue without clipping → finds ALL
  //  -1: ignore this fixture, continue
  // point/normal are in PIXELS (world coords), fraction is 0..1
  world.rayCast = function (x1, y1, x2, y2, callback) {
    // Support object form: world.rayCast({x, y}, {x, y}, callback)
    if (x1 !== null && typeof x1 === 'object') {
    [x1, y1, x2, y2, callback] = [x1.x, x1.y, y1.x, y1.y, x2];
    }
    if (typeof callback !== 'function') return;
    const p1 = pl.Vec2(x1 / PXM, y1 / PXM);
    const p2 = pl.Vec2(x2 / PXM, y2 / PXM);
    _world().rayCast(p1, p2, function (fixture, point, normal, fraction) {
      // Convert hit point and normal back to pixels
      const hitPoint = { x: point.x * PXM, y: point.y * PXM };
      const hitNormal = { x: normal.x, y: normal.y }; // already unit vector
      // Find the sprite owning this fixture
      const body = fixture.getBody();
      const sprite = body.getUserData();
      // Call user callback with sprite (or null), point, normal, fraction
      const result = callback(sprite instanceof Sprite ? sprite : null, hitPoint, hitNormal, fraction);
      // Return value controls raycast continuation (Box2D convention)
      if (result === 0) return 0;       // stop
      if (result === 1) return 1;       // continue, don't clip
      if (result === -1) return -1;     // filter fixture
      if (typeof result === 'number' && result >= 0 && result <= 1) return result; // clip at fraction
      return fraction; // default: clip at hit, continue (closest)
    });
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
    const sensed = SENSORS_.length ? new Map() : null; // Sensor -> Set(sprites), addSensor() only
    for (let c = _world().getContactList(); c; c = c.getNext()) {
      if (!c.isTouching()) continue;
      // Sensor fixtures (collider = 'none') still show up as "touching" in
      // planck's contact list (only the solver skips their impulse) — but
      // colliding() is documented as solid-body contact only (2.3.17), so
      // a sensor pair must never count here even though overlaps() sees it.
      if (c.getFixtureA().isSensor() || c.getFixtureB().isSensor()) {
        // ...but a sensor made by addSensor() is listening for exactly this.
        if (sensed) _noteSensed(sensed, c.getFixtureA(), c.getFixtureB());
        continue;
      }
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
      // Same short cut as in _updateOverlaps(): no keys to visit at all.
      if (!cur && s._touch.size === 0) continue;
      const keys = new Set(s._touch.keys());
      if (cur) for (const o of cur) keys.add(o);
      for (const other of keys) {
        const next = _advanceContact(s._touch.get(other) || 0, !!(cur && cur.has(other)));
        if (next === 0) s._touch.delete(other); else s._touch.set(other, next);
      }
    }
    if (sensed) _advanceSensors(sensed);
  }

  // addSensor() bookkeeping for _updateContacts(). A fixture whose user data
  // is a Sensor belongs to addSensor(); every other fixture (the sprite's own,
  // including a collider = 'none' one) has none, so nothing here touches a
  // sketch that never called addSensor().
  function _noteSensed(sensed, fa, fb) {
    for (const [mine, theirs] of [[fa, fb], [fb, fa]]) {
      const sensor = mine.getUserData();
      if (!(sensor instanceof Sensor)) continue;
      const other = theirs.getBody().getUserData();
      if (!(other instanceof Sprite) || other === sensor.sprite) continue;
      if (!sensed.has(sensor)) sensed.set(sensor, new Set());
      sensed.get(sensor).add(other);
    }
  }
  function _advanceSensors(sensed) {
    for (const sensor of SENSORS_.slice()) {
      if (sensor.sprite._dead) { sensor.remove(); continue; }
      const cur = sensed.get(sensor);
      if (!cur && sensor._hits.size === 0) continue;
      const keys = new Set(sensor._hits.keys());
      if (cur) for (const o of cur) keys.add(o);
      for (const other of keys) {
        const next = _advanceContact(sensor._hits.get(other) || 0, !!(cur && cur.has(other)));
        if (next === 0) sensor._hits.delete(other); else sensor._hits.set(other, next);
      }
    }
  }

  // sprite.overlapping()/overlapped() need a persistent per-pair counter too
  // (overlaps() itself stays a live geometry query — see the comment on
  // Sprite.overlaps()). Unlike _updateContacts() this isn't backed by
  // planck at all — it's the same manual bounding-box/circle test
  // _overlapsOne() uses, just run for every live pair once per frame so a
  // signed counter can be kept.
  //
  // Every pair used to be tested every frame: 600 sprites is ~180,000
  // _overlapsOne() calls, each reading both positions back out of planck, and
  // a 40x30 tile map (1,200 sprites) ran at about 6 fps. _overlapCandidates()
  // below is a sort-and-sweep broadphase that only hands on pairs whose boxes
  // could touch. It is EXACT, not an approximation: the same _overlapsOne()
  // still decides every pair it hands on, the pairs it drops are ones that
  // test could never pass, and they are visited in the same (i, j) order the
  // old double loop used. No sketch can tell the difference except by speed.
  function _updateOverlaps() {
    const alive = ALL_.filter((s) => !s._dead);
    const now = new Map();
    const mark = (a, b) => {
      if (!now.has(a)) now.set(a, new Set());
      if (!now.has(b)) now.set(b, new Set());
      now.get(a).add(b);
      now.get(b).add(a);
    };
    const n = alive.length;
    const pairs = _overlapCandidates(alive);
    if (pairs === null) {
      for (let i = 0; i < n; i++) {
        const a = alive[i];
        for (let j = i + 1; j < n; j++) {
          const b = alive[j];
          if (a._overlapsOne(b)) mark(a, b);
        }
      }
    } else {
      for (let k = 0; k < pairs.length; k++) {
        const i = Math.floor(pairs[k] / n), j = pairs[k] - i * n;
        if (alive[i]._overlapsOne(alive[j])) mark(alive[i], alive[j]);
      }
    }
    for (const s of alive) {
      s._overlap ??= new Map();
      const cur = now.get(s);
      // Nothing touching now and nothing remembered: the loop below would
      // visit no keys at all, so skip building an empty Set per sprite.
      if (!cur && s._overlap.size === 0) continue;
      const keys = new Set(s._overlap.keys());
      if (cur) for (const o of cur) keys.add(o);
      for (const other of keys) {
        const next = _advanceContact(s._overlap.get(other) || 0, !!(cur && cur.has(other)));
        if (next === 0) s._overlap.delete(other); else s._overlap.set(other, next);
      }
    }
  }

  // Broadphase for _updateOverlaps(). Returns the pairs that COULD overlap as
  // sorted numbers i * n + j (i < j, indices into `list`), or null to mean
  // "test every pair the old way". It answers null whenever it cannot be sure
  // of being exact:
  //   - a small world, where the double loop is already cheap;
  //   - a sprite whose _overlapsOne/_bounds is not the stock one (a subclass
  //     or an instance overriding it could define overlap however it likes);
  //   - a NaN or infinite edge anywhere (it cannot be sorted safely);
  //   - so many candidates that the sweep saves nothing.
  // A box here is _bounds() made inclusive and padded a hair, so it is a
  // superset of both narrow tests: the strict rect test (a.l < b.r) and the
  // circle test, which counts exactly-touching circles (<=). A circle's
  // _bounds() is x/y +- w/2 on both axes, the same radius its test uses, and
  // min/max straightens out a negative width.
  const OVERLAP_SWEEP_MIN_ = 32;
  function _overlapCandidates(list) {
    const n = list.length;
    if (n < OVERLAP_SWEEP_MIN_) return null;
    const x0 = new Float64Array(n), x1 = new Float64Array(n);
    const y0 = new Float64Array(n), y1 = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const s = list[i];
      if (s._overlapsOne !== Sprite.prototype._overlapsOne || s._bounds !== Sprite.prototype._bounds) return null;
      const b = s._bounds();
      const l = Math.min(b.l, b.r), r = Math.max(b.l, b.r);
      const t = Math.min(b.t, b.b), bt = Math.max(b.t, b.b);
      // NaN never sorts; an infinite edge makes the sort's subtraction NaN.
      if (!Number.isFinite(l) || !Number.isFinite(r) || !Number.isFinite(t) || !Number.isFinite(bt)) return null;
      const px = 1e-6 + 1e-9 * (Math.abs(l) + Math.abs(r));
      const py = 1e-6 + 1e-9 * (Math.abs(t) + Math.abs(bt));
      x0[i] = l - px; x1[i] = r + px; y0[i] = t - py; y1[i] = bt + py;
    }
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => x0[a] - x0[b]);
    const cap = (n * (n - 1)) / 4; // past half of all pairs, just test them all
    const out = [];
    for (let k = 0; k < n; k++) {
      const i = order[k];
      for (let m = k + 1; m < n; m++) {
        const j = order[m];
        if (x0[j] > x1[i]) break; // sorted by left edge: nothing further reaches i
        if (y0[j] > y1[i] || y0[i] > y1[j]) continue;
        out.push(i < j ? i * n + j : j * n + i);
      }
      if (out.length > cap) return null;
    }
    return Float64Array.from(out).sort();
  }

  // ---- render -----------------------------------------------------------

  // `texts` is what text() queued during draw() under textLayer(n) (see
  // textLayer). Each one is slotted into the world pass after every sprite
  // whose layer is its layer or lower, so ties go to the text.
  function _withTexts(sprites, texts) {
    const ts = texts.slice().sort((a, b) => a.layer - b.layer); // stable: written order on a tie
    const out = [];
    let j = 0;
    for (const s of sprites) {
      while (j < ts.length && ts[j].layer < s.layer) out.push(ts[j++]);
      out.push(s);
    }
    while (j < ts.length) out.push(ts[j++]);
    return out;
  }

  function render(texts) {
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
      const view = _cullView(useCamera);
      CTX_.save();
      _applyFrame(useCamera && camera._active);
      for (const s of list) {
        if (s._queuedText) {
          // _paintText applies its own frame from an untransformed context,
          // with the camera as it was when text() was called.
          CTX_.restore();
          _paintText(s.str, s.x, s.y, s.size, s.color, s.align, s.cam);
          CTX_.save();
          _applyFrame(useCamera && camera._active);
          continue;
        }
        if (!s.autoDraw) continue; // Sprite, SPEC-surface #3: false skips this sprite entirely
        if (s.ani) s.ani._advance(); // advances on or off screen, so culling never freezes it
        // A sketch-assigned sprite.draw REPLACES the default rendering for
        // that sprite (Sprite, SPEC-surface #3) — everything else (layer
        // order, ani advance, autoDraw gating above) still applies around it.
        // It is never culled: it may do more than draw.
        if (typeof s.draw === 'function') s.draw();
        else if (!view || !_offView(s, view)) s._draw();
      }
      CTX_.restore();
    };

    const world = ordered.filter((s) => !s.screenSpace);
    drawPass(texts && texts.length ? _withTexts(world, texts) : world, true);
    drawPass(ordered.filter((s) => s.screenSpace), false);
  }

  // Off-screen culling for render(). A sprite whose whole picture lies outside
  // the visible canvas skips its default _draw(), which is pure painting: no
  // state changes, so skipping an invisible one changes nothing on screen.
  // Measured 2026-10-31, headless Chromium: drawing 1,200 tile sprites costs
  // about 1.7 ms a frame, so a long scrolling level pays for every tile it
  // is not showing. The guards are what keep this safe:
  //   - only the stock _draw() is ever skipped; a sketch's own sprite.draw
  //     (which may count, move or spawn) always runs, and ani still advances;
  //   - the context must be untransformed when render() starts (a sketch
  //     that grabbed the canvas and transformed it itself is never culled),
  //     and a context with no getTransform() is never culled at all;
  //   - the reach is generous: the larger of w/h times the larger scale
  //     (at least 1), which covers the art rotated any way, plus the stroke,
  //     and for a text label (drawn unscaled) its character count + 2 times
  //     textSize. A NaN anywhere compares false and the sprite draws.
  // Returns {l, t, r, b} in the space the pass draws in, or null for "draw all".
  function _cullView(useCamera) {
    if (!CTX_ || typeof CTX_.getTransform !== 'function') return null;
    const m = CTX_.getTransform();
    if (!m || m.a !== 1 || m.b !== 0 || m.c !== 0 || m.d !== 1 || m.e !== 0 || m.f !== 0) return null;
    const w = CANVAS_ ? CANVAS_.width : W_, h = CANVAS_ ? CANVAS_.height : H_;
    const cam = useCamera && camera._active;
    if (ORIGIN_ === 'math') {
      // Centred frame: t/b are just the smaller and larger y, which is all
      // _offView() needs.
      const cx = cam ? camera.x : 0, cy = cam ? camera.y : 0;
      return { l: cx - w / 2, t: cy - h / 2, r: cx + w / 2, b: cy + h / 2 };
    }
    const l = cam ? _camLeft() : 0, t = cam ? _camTop() : 0;
    return { l, t, r: l + w, b: t + h };
  }
  function _offView(s, v) {
    if (s._draw !== Sprite.prototype._draw) return false;
    const k = Math.max(Math.abs(s._scale.x), Math.abs(s._scale.y), 1);
    let reach = Math.max(Math.abs(s.w), Math.abs(s.h)) * k + 2;
    if (s.stroke) reach += Math.abs(s.strokeWeight) || 0;
    if (s.text) {
      const tw = (String(s.text).length + 2) * (Math.abs(s.textSize) || 16) + (Math.abs(s._textStrokeWeight) || 0);
      if (tw > reach) reach = tw;
    }
    const x = s.x, y = s.y;
    return x + reach < v.l || x - reach > v.r || y + reach < v.t || y - reach > v.b;
  }

  // text styling state (fill/textSize/textAlign) — q5.js-style globals that
  // real lesson code sets before every text() call (HUD scores, title
  // screens, game-over messages — 27 real script.js/solution.js files).
  let TEXT_COLOR = 'white', TEXT_SIZE = 14, TEXT_ALIGN = 'left';
  const CENTER = 'center', LEFT = 'left', RIGHT = 'right';
  function fill(c) { TEXT_COLOR = typeof c === 'number' ? `rgb(${c},${c},${c})` : c; HAS_FILL = true; }
  function textSize(px) { TEXT_SIZE = px; }
  function textAlign(mode) { TEXT_ALIGN = mode; }

  // textLayer(n): put text() among the sprites (shCode #101, 2026-11-11).
  // Text drawn in draw() is painted BEFORE render(), so it sits under every
  // sprite, and drawTop() puts it over all of them; nothing went in between.
  // After textLayer(n), each text() called from draw() is remembered with
  // everything it needs (words, place, size, colour, alignment, camera on or
  // off) and painted by render() among the world's sprites: over every sprite
  // whose .layer is n or lower, under every sprite whose .layer is higher.
  // Texts on the same layer keep the order they were written in.
  // screenSpace sprites and drawTop() still go over it. textLayer() with
  // nothing (or null) goes back to the old way, painted at once. Like
  // textSize(), the setting lasts until it is changed.
  //
  // It only queues while draw() runs. Called from drawTop(), a sprite's own
  // .draw or setup(), text() still paints at once (render() is not coming, or
  // is running now). A sketch that never calls textLayer() draws exactly what
  // it drew before: same canvas calls, same order.
  let TEXT_LAYER_ = null;
  let TEXT_QUEUE_ = null; // an array only while draw() runs
  function textLayer(n) {
    if (n === undefined || n === null) { TEXT_LAYER_ = null; return; }
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new TypeError(`textLayer(n): n must be a number, the layer the text goes on (like sprite.layer), or nothing to put text back under every sprite -- got ${String(n)}`);
    }
    TEXT_LAYER_ = n;
  }

  function text(str, x, y, size, color) {
    if (TEXT_LAYER_ !== null && TEXT_QUEUE_) {
      TEXT_QUEUE_.push({
        _queuedText: true, layer: TEXT_LAYER_, str, x, y,
        size: size || TEXT_SIZE, color: color || TEXT_COLOR, align: TEXT_ALIGN, cam: camera._active,
      });
      return;
    }
    _paintText(str, x, y, size || TEXT_SIZE, color || TEXT_COLOR, TEXT_ALIGN, camera._active);
  }

  // Assumes an untransformed context, like text() always has.
  function _paintText(str, x, y, size, color, align, withCamera) {
    CTX_.save();
    _applyFrame(withCamera);
    CTX_.fillStyle = color;
    CTX_.font = size + 'px monospace';
    CTX_.textAlign = align;
    if (ORIGIN_ === 'math') {
      // Flip back at the anchor so the text reads upright. The baseline still
      // sits on y; the letters rise above it, which in this mode is +y.
      CTX_.translate(x, y);
      CTX_.scale(1, -1);
      CTX_.fillText(str, 0, 0);
    } else {
      CTX_.fillText(str, x, y);
    }
    CTX_.restore();
  }

  // ---- coordinate overlays: showGrid(step), showMouse() --------------------
  //
  // Both are called from draw() and remembered for the frame; loop() paints
  // them right after the sprites and before drawTop(), so they sit over the
  // world and under a HUD. They paint in canvas pixels (text stays upright in
  // either mode) and touch nothing but the canvas: no sprite, no physics.
  let GRID_STEP_ = null, SHOW_MOUSE_ = false;

  // A light grid every `step` world units with the axes drawn heavier and
  // labelled in the ACTIVE coordinates: 'math' puts the origin at the centre
  // with y labels growing upward; 'screen' puts 0,0 at the top-left with y
  // labels growing downward. The grid is in world space, so it scrolls with
  // the camera and its labels keep telling the truth about sprite.x/y.
  function showGrid(step) {
    if (step === undefined) step = 50;
    if (typeof step !== 'number' || !(step > 0)) {
      throw new TypeError(`showGrid(step): step must be a number above 0 -- the distance between grid lines (default 50), got ${String(step)}`);
    }
    GRID_STEP_ = step;
  }
  function showMouse() { SHOW_MOUSE_ = true; }

  function _drawOverlays() {
    if (GRID_STEP_ !== null) { _drawGrid(GRID_STEP_); GRID_STEP_ = null; }
    if (SHOW_MOUSE_) { _drawMouse(); SHOW_MOUSE_ = false; }
  }

  function _drawGrid(step) {
    // World coordinates of the visible edges, as the smaller/larger value on
    // each axis so the loops below do not care which way is up.
    const math = ORIGIN_ === 'math';
    const l = math ? camera.x - W_ / 2 : _camLeft();
    const yLo = math ? camera.y - H_ / 2 : _camTop();
    const r = l + W_, yHi = yLo + H_;
    // Many hundreds of lines a frame would stall the sketch; coarsen quietly.
    while (Math.max(W_, H_) / step > 200) step *= 2;
    CTX_.save();
    CTX_.resetTransform();
    CTX_.lineWidth = 1;
    CTX_.font = '11px monospace';
    CTX_.textAlign = 'left';
    CTX_.textBaseline = 'alphabetic';
    const axis = _toPixel(0, 0);
    // Labels hug the axes while they are on screen and the nearest edge once
    // they have scrolled off, so a label is always readable.
    const ax = Math.min(Math.max(axis.x, 0), W_ - 36);
    const ay = Math.min(Math.max(axis.y, 14), H_ - 4);
    const line = (x1, y1, x2, y2) => { CTX_.beginPath(); CTX_.moveTo(x1, y1); CTX_.lineTo(x2, y2); CTX_.stroke(); };
    const px = (v) => Math.round(v) + 0.5;
    CTX_.strokeStyle = 'rgba(136, 136, 136, 0.4)';
    for (let x = Math.ceil(l / step) * step; x <= r; x += step) {
      if (x !== 0) line(px(_toPixel(x, 0).x), 0, px(_toPixel(x, 0).x), H_);
    }
    for (let y = Math.ceil(yLo / step) * step; y <= yHi; y += step) {
      if (y !== 0) line(0, px(_toPixel(0, y).y), W_, px(_toPixel(0, y).y));
    }
    CTX_.strokeStyle = 'rgba(136, 136, 136, 0.95)';
    CTX_.lineWidth = 1.5;
    if (axis.x >= 0 && axis.x <= W_) line(px(axis.x), 0, px(axis.x), H_);
    if (axis.y >= 0 && axis.y <= H_) line(0, px(axis.y), W_, px(axis.y));
    CTX_.fillStyle = '#9aa0ad';
    for (let x = Math.ceil(l / step) * step; x <= r; x += step) {
      if (x !== 0) CTX_.fillText(String(x), _toPixel(x, 0).x + 3, ay);
    }
    for (let y = Math.ceil(yLo / step) * step; y <= yHi; y += step) {
      if (y !== 0) CTX_.fillText(String(y), ax + 4, _toPixel(0, y).y - 3);
    }
    if (axis.x >= 0 && axis.x <= W_ && axis.y >= 0 && axis.y <= H_) CTX_.fillText('0', axis.x + 4, axis.y + 12);
    CTX_.restore();
  }

  // The pointer's position in the active coordinates, printed beside it.
  function _drawMouse() {
    if (!MOUSE._seen) return;
    const p = _toPixel(MOUSE.x, MOUSE.y);
    const label = `(${Math.round(MOUSE.x)}, ${Math.round(MOUSE.y)})`;
    CTX_.save();
    CTX_.resetTransform();
    CTX_.font = '12px monospace';
    CTX_.textAlign = 'left';
    CTX_.textBaseline = 'alphabetic';
    CTX_.lineWidth = 3;
    CTX_.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    CTX_.strokeText(label, p.x + 12, p.y - 8);
    CTX_.fillStyle = 'white';
    CTX_.fillText(label, p.x + 12, p.y - 8);
    CTX_.restore();
  }

  // ---- q5.js drawing primitives (used by real lesson code) ---------------

  // square(x, y, s) is rect(x, y, s, s), as in p5: it uses fill(), stroke(),
  // noFill() and noStroke() like every other shape. It used to call fillRect
  // without ever setting a colour, so every square came out black whatever
  // fill() said -- shCode's labs 5.6.9-5.6.11 promise "a blue square" and drew
  // a black one.
  // `function` declarations hoist, so rect() below is in scope here.
  function square(x, y, s, r) {
    rect(x, y, s, s, r);
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

  // ---- frame timers -------------------------------------------------------
  // every(frames, fn) calls fn every `frames` frames; after(frames, fn) calls
  // it once, `frames` frames from now. Both count FRAMES, not seconds, so they
  // pause with noLoop() and stay in step with frameCount: every(60, fn) made
  // in setup() fires on the same frames as `if (frameCount % 60 === 0)`.
  // They run each frame after update() and before the physics step, so a
  // sprite a timer spawns is in that frame's physics. Each returns a handle
  // whose stop() cancels it. A timer never fires in the frame that made it.
  let TIMERS_ = [];
  function _timer(name, frames, fn, repeat) {
    if (typeof frames !== 'number' || !(frames >= 1)) {
      throw new TypeError(`${name}(frames, fn): frames must be a number, 1 or more (got ${String(frames)})`);
    }
    if (typeof fn !== 'function') throw new TypeError(`${name}(frames, fn): fn must be a function`);
    const n = Math.floor(frames);
    const t = {
      _due: FRAME_ + n, _every: repeat ? n : 0, _fn: fn, _on: true,
      get active() { return t._on; },
      stop() { t._on = false; },
    };
    TIMERS_.push(t);
    return t;
  }
  function every(frames, fn) { return _timer('every', frames, fn, true); }
  function after(frames, fn) { return _timer('after', frames, fn, false); }
  function _runTimers() {
    if (!TIMERS_.length) return;
    for (const t of TIMERS_.slice()) { // a timer may start another
      if (!t._on || FRAME_ < t._due) continue;
      if (t._every) t._due += t._every; else t._on = false;
      t._fn();
    }
    TIMERS_ = TIMERS_.filter((t) => t._on);
  }

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
        // A saved sound is a data: URI under `sound:<name>`; a path or a
        // pasted data: URI passes through untouched.
        const res = await fetch(_savedSoundSrc(this.url) || this.url);
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
    // Optional fourth lifecycle hook — see the call site in loop() for why a
    // HUD needs one. Resolved here with the other three so the same rule
    // applies: the sketch defines it before start() runs.
    const drawTopFn = window.drawTop || (() => {});

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
    // Canvas-relative pointer position, in sketch pixels. A host is free to
    // display the canvas at a size other than its backing store — runner.html
    // scales it to fit a narrow frame rather than cropping it. Divide the
    // offset by the displayed scale so mouse.x/y stay in sketch pixels; at 1:1
    // (r.width === CANVAS_.width) this is a no-op. Shared by the mouse and
    // touch handlers below so the two can never drift apart.
    const _pointerTo = (clientX, clientY) => {
      const r = CANVAS_.getBoundingClientRect();
      const sx = r.width ? CANVAS_.width / r.width : 1;
      const sy = r.height ? CANVAS_.height / r.height : 1;
      if (ORIGIN_ === 'math') {
        // Pixel -> centred, y-up world point (the inverse of _toPixel).
        MOUSE.x = (clientX - r.left) * sx - W_ / 2 + camera.x;
        MOUSE.y = H_ / 2 - (clientY - r.top) * sy + camera.y;
      } else {
        MOUSE.x = (clientX - r.left) * sx + _camLeft();
        MOUSE.y = (clientY - r.top) * sy + _camTop();
      }
      MOUSE._seen = true;
    };
    CANVAS_.addEventListener('mousemove', (e) => {
      _pointerTo(e.clientX, e.clientY);
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
    // A key or button still down when the sketch loses focus (a click on the
    // editor, Alt-Tab) sends its keyup/mouseup to another window, never here,
    // so it stayed "held" for good: kb.pressing('a') true forever, the player
    // sliding, and an if/else-if chain stuck on that branch so no other key
    // seemed to work (shCode issue #78). Losing focus releases everything,
    // through the same release states a real keyup/mouseup gives.
    window.addEventListener('blur', () => {
      for (const k in KEYS_) if (KEYS_[k] > 0) _releaseKey(k);
      for (const slot of ['_c', '_bl', '_bc', '_br']) {
        const v = MOUSE[slot];
        if (v > 0) MOUSE[slot] = v >= mouse.holdThreshold ? -2 : v > 1 ? -1 : -3;
      }
      for (const slot of ['_dl', '_dc', '_dr']) if (MOUSE[slot] > 0) MOUSE[slot] = -1;
    });

    // ---- touch ----------------------------------------------------------
    //
    // The engine used to listen for mouse events only, so on a phone every
    // sketch was dead: mouse.x/y stayed at their initial (0, 0) and
    // mouse.presses() never once fired. A single touch drives the same
    // counters as the left mouse button, which is what sketches already read —
    // no new API, and `mouse` keeps its name because that is what the
    // curriculum teaches.
    //
    // Multi-touch is deliberately not mapped. A second finger has no mouse
    // button to be, and every gesture that could stand in for a right-click
    // (two-finger tap, long press) needs a timing state machine that guesses
    // wrong often enough to be worse than not offering it.
    const _touchAt = (e) => (e.changedTouches && e.changedTouches[0]) || null;

    CANVAS_.addEventListener('touchstart', (e) => {
      const t = _touchAt(e);
      if (!t) return;
      _unlockAudio(); // same reason as keydown/mousedown above
      // Position BEFORE the press counter, and not optional: a tap carries
      // its position and its press in the same event — there is no hover
      // first — so a sketch reading mouse.x on the frame it sees presses()
      // would otherwise get the previous touch's spot, or (0, 0) on the very
      // first tap of the session.
      _pointerTo(t.clientX, t.clientY);
      MOUSE._onCanvas = true;
      if (!MOUSE._c || MOUSE._c < 0) MOUSE._c = 1;
      if (!MOUSE._bl || MOUSE._bl < 0) MOUSE._bl = 1;
      // Without this the browser replays the whole gesture as synthetic
      // mousedown/mouseup about 300ms later — pressing everything a second
      // time — and scrolls or zooms the page out from under the sketch.
      // Needs the explicit passive:false to be allowed to.
      e.preventDefault();
    }, { passive: false });

    CANVAS_.addEventListener('touchmove', (e) => {
      const t = _touchAt(e);
      if (!t) return;
      _pointerTo(t.clientX, t.clientY);
      MOUSE._onCanvas = true;
      if (MOUSE._bl > 0) MOUSE._mvl = true; // drag tracking, as for the mouse
      e.preventDefault();
    }, { passive: false });

    // On window, matching mouseup: a finger that slides off the canvas before
    // it lifts still has to end the press, or the sketch is left holding it
    // forever. touchcancel is the same event as far as a sketch is concerned
    // (the OS took the gesture away — a call came in, the gesture became a
    // system swipe); not handling it was the other way to get stuck holding.
    const _endTouch = (e) => {
      // A lift with fingers still down is not the end of the gesture.
      if (e && e.touches && e.touches.length) return;
      MOUSE._c = MOUSE._c >= mouse.holdThreshold ? -2 : MOUSE._c > 1 ? -1 : -3;
      MOUSE._bl = MOUSE._bl >= mouse.holdThreshold ? -2 : MOUSE._bl > 1 ? -1 : -3;
      if (MOUSE._dl > 0) MOUSE._dl = -1; // flat -1, as in the mouseup handler
    };
    window.addEventListener('touchend', _endTouch);
    window.addEventListener('touchcancel', _endTouch);

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
      _runTimers(); // every()/after(): after update, before physics
      // world.autoStep (World, SPEC-surface #5): false means the sketch
      // calls world.physicsUpdate() itself instead of this automatic step.
      if (AUTO_STEP_) {
        stepPhysics();
        _updateContacts();
        _updateOverlaps();
      }
      TEXT_QUEUE_ = []; // text() under textLayer(n) waits for render()
      let queuedTexts;
      try { drawFn(); } finally { queuedTexts = TEXT_QUEUE_; TEXT_QUEUE_ = null; }
      render(queuedTexts);
      _drawOverlays(); // showGrid()/showMouse(): over the world, under the HUD
      // drawTop(): the HUD hook. render() paints sprites AFTER the sketch's
      // draw(), so anything draw() puts on the canvas with primitives ends up
      // UNDERNEATH every sprite — a score at the top-left vanishes behind
      // whatever wall happens to be there, which is not a bug a beginner can
      // diagnose. drawTop() runs after the world is on the canvas.
      //
      // It also runs in SCREEN space: the camera is off for its duration, so
      // text('SCORE ' + score, 14, 20) means 14px from the canvas's left edge
      // no matter where the camera has scrolled to. The sketch's own camera
      // state is saved and restored around it, so a sketch that drew with the
      // camera off in draw() is not handed a surprise.
      const camWasActive = camera._active;
      camera._active = false;
      drawTopFn();
      camera._active = camWasActive;

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
  global.Tiles = Tiles;
  global.Walls = Walls;
  global.every = every;
  global.after = after;
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
  global.textLayer = textLayer;
  global.square = square;
  global.CENTER = CENTER;
  global.LEFT = LEFT;
  global.RIGHT = RIGHT;
  global.storeItem = storeItem;
  global.getItem = getItem;
  global.removeItem = removeItem;
  global.textureNames = textureNames;
  global.hasTexture = hasTexture;
  global.saveTexture = saveTexture;
  global.deleteTexture = deleteTexture;
  global.clearStorage = clearStorage;
  global.noLoop = noLoop;
  global.start = start;
  global.circle = circle;
  global.ellipse = ellipse;
  global.rect = rect;
  global.line = line;
  global.clear = clear;
  global.showGrid = showGrid;
  global.showMouse = showMouse;
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
