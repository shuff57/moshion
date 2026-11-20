// moSHion docs: Physics. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#physics/<id>); never rename one, add a new page instead.

export default {
  slug: 'physics',
  title: "Physics",
  pages: [
    {
      id: 'gravity-velocity',
      title: "Gravity and velocity",
      body: `world.gravity.y pulls every dynamic sprite downward. It starts at 0, so nothing falls until you set it. 10 feels roughly earth-like; leave it at 0 for top-down games, or try negative values for "upside-down" worlds.

Each sprite has a .vel vector with .x and .y components, measured in pixels per frame. At 60 fps, vel.x = 4 means the sprite moves 240 pixels per second. Reading .vel tells you how fast a sprite is moving; writing it overrides physics for that frame.

Assigning vel every frame is fine for player controls — you're telling the engine exactly what you want.

There's a top speed. No sprite moves faster than world.maxSpeed pixels per frame, which starts at 60. Set vel.x higher and the sprite settles to 60 on the next frame, and the console says so once. That's a safety limit so fast sprites can't skip through things in a single frame. The next page shows how to raise it, and what it costs.`,
      code: `let player, ground;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  player = new Sprite(200, 100, 40, 40);
  player.color = 'deepskyblue';
  ground = new Sprite(200, 380, 400, 20, 'static');
}

function update() {
  if (kb.pressing('left')) {
    player.vel.x = -5;
  } else if (kb.pressing('right')) {
    player.vel.x = 5;
  } else {
    player.vel.x = 0;
  }

  if (kb.presses(' ') && player.colliding(ground)) {
    player.vel.y = -8;
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'max-speed',
      title: "The speed cap: world.maxSpeed",
      body: `No sprite moves faster than world.maxSpeed pixels per frame. It starts at 60. Set vel.x = 150 and the sprite settles to 60 on the next frame, and the console says so once, naming world.maxSpeed.

The cap is there for a reason. A sprite that moves a long way in one frame can skip clean past a thin sprite between two frames without the two ever touching: a fast bullet can fly through an enemy. A moving solid (dynamic) sprite still stops at a static wall, because the physics engine checks that case between frames. A kinematic sprite, or one with collider = 'none', does not get that check.

To go faster, raise the cap in setup(), before you set the speed. Keep it as low as your game allows, and make thin targets a little thicker if a fast sprite misses them.`,
      code: `let ball;

function setup() {
  new Canvas(600, 200);
  world.maxSpeed = 120;   // pixels per frame; the default is 60
  ball = new Sprite(30, 100, 20);
  ball.vel.x = 100;       // over 60, allowed because of the line above
  new Sprite(590, 100, 20, 200, 'static');
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'bounce-friction',
      title: "Bounciness and friction",
      body: `.bounciness (also called restitution) is how much speed a sprite keeps after a collision. 0 means it sticks, 1 means it bounces back at full speed, values above 1 add energy (fun, but unstable).

.friction resists sliding along a surface. 0 is ice — sprites slide forever. Higher values drag motion to a stop quickly.

These are per-sprite properties. When two sprites touch, the physics combines their values: the bounce is the bouncier of the two, and the friction lands somewhere between the two.

In the example, all three boxes are dropped with the same sideways speed. The red one bounces, the grey one lands and drags to a stop, and the blue one has no friction so it slides on across the floor.`,
      code: `function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  new Walls();

  const floor = new Sprite(200, 380, 400, 20, 'static');
  floor.friction = 1;

  const dead = new Sprite(40, 250, 30, 30);
  dead.bounciness = 0;
  dead.friction = 1;
  dead.color = 'slategray';

  const bouncy = new Sprite(140, 250, 30, 30);
  bouncy.bounciness = 0.9;
  bouncy.friction = 1;
  bouncy.color = 'tomato';

  const slippery = new Sprite(240, 250, 30, 30);
  slippery.friction = 0;
  slippery.bounciness = 0.4;
  slippery.color = 'deepskyblue';

  // the same sideways speed for all three, and no spinning
  for (const box of [dead, bouncy, slippery]) {
    box.vel.x = 3;
    box.rotationLock = true;
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'walls',
      title: "Walls around the canvas",
      body: `new Walls() puts four static walls just outside the edges of the canvas, so sprites bounce off the edges of the screen instead of falling out of it. The walls sit off screen, so you don't see them, and the whole canvas stays playable. Make them in setup(), after new Canvas().

What you get back is a Group of the four walls, and each one also has a name: walls.top, walls.bottom, walls.left and walls.right. player.colliding(walls) asks "is the player touching any edge?" and player.colliding(walls.bottom) asks "is it on the floor?"

new Walls(100) makes them thicker (the default is 50), which helps if something fast keeps slipping through. The walls stay where the canvas was when you made them; they do not follow the camera.`,
      code: `let walls, balls;
let lastHit = 'nothing yet';

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;
  walls = new Walls();
  balls = new Group();

  for (let i = 0; i < 10; i++) {
    const ball = new balls.Sprite(40 + i * 35, 60 + (i % 3) * 40, 24);
    ball.bounciness = 0.8;
    if (i % 2 === 0) {
      ball.vel.x = 6;
      ball.color = 'tomato';
    } else {
      ball.vel.x = -6;
      ball.color = 'gold';
    }
  }
}

function update() {
  // each wall has its own name
  if (balls.collides(walls.top)) {
    lastHit = 'top';
  }
  if (balls.collides(walls.bottom)) {
    lastHit = 'bottom';
  }
  if (balls.collides(walls.left)) {
    lastHit = 'left';
  }
  if (balls.collides(walls.right)) {
    lastHit = 'right';
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(16);
  text('last wall hit: ' + lastHit, 10, 24);
}`,
    },
    {
      id: 'mass-density',
      title: "Mass and density",
      body: `.mass is how heavy a sprite is — read it to see how physics will treat the sprite (a heavier sprite reacts less to the same applyForce push, see below). Setting .mass adjusts the sprite's density so its actual mass matches what you asked for. Static and kinematic sprites always have 0 mass, since gravity and pushes don't affect them.

.density is the more direct knob underneath .mass — mass is density times the sprite's area, so a bigger sprite at the same density weighs more. New sprites default to a density of 1.

You'll reach for .mass far more often than .density — it's the number that actually means something ("this rock should be twice as heavy as that crate").

Gravity pulls every mass down equally, so a light sprite and a heavy one fall together. Mass shows when you push them. In the example, press the space bar to give both the same shove: the light feather shoots away and the heavy rock hardly moves.`,
      code: `let feather, rock;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  new Sprite(200, 380, 400, 20, 'static');

  feather = new Sprite(60, 355, 30);
  feather.color = 'lightyellow';
  feather.mass = 0.2;

  rock = new Sprite(60, 300, 30);
  rock.color = 'gray';
  rock.mass = 5;
}

function update() {
  if (kb.presses(' ')) {
    // the same push for both
    feather.applyForce(40, 0);
    rock.applyForce(40, 0);
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(14);
  text('space: push both', 10, 20);
  text('feather mass ' + feather.mass + ', rock mass ' + rock.mass, 10, 40);
}`,
    },
    {
      id: 'drag',
      title: "Drag (slowing down)",
      body: `.drag slows a sprite down on its own, with no wall or floor to rub against. It is the knob for a ball on a table seen from above, where gravity is 0 and nothing else would ever stop it. 0 means no slowing at all.

The number is a rate per SECOND, not per frame. At .drag = 1 a moving sprite keeps about a third of its speed after one second and nearly none after four. At .drag = 0.02 it keeps almost all of it: the sprite crosses the canvas and hits a wall long before it slows. A few landmarks: 0.02 is nearly frictionless, 1 is a pool table, 6 is sand or thick carpet.

.drag slows a sprite but never stops it exactly, because it only ever removes a share of what is left. To make a sprite really stop, check .speed each frame and set it to 0 once it is small enough.

.friction is a different knob: it only acts while two sprites touch. .drag works everywhere, all the time.`,
      code: `function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  const slick = new Sprite(40, 130, 24);
  slick.color = 'lightblue';
  slick.drag = 0.02;
  slick.vel.x = 6;

  const table = new Sprite(40, 200, 24);
  table.color = 'lightgreen';
  table.drag = 1;
  table.vel.x = 6;

  const sand = new Sprite(40, 270, 24);
  sand.color = 'khaki';
  sand.drag = 6;
  sand.vel.x = 6;
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'forces',
      title: "Applying forces",
      body: `sprite.applyForce(fx, fy) pushes a sprite with a force in newtons — the physics engine's own force unit, not pixels. Pass the x and y components as two separate numbers. Call it every frame for continuous thrust, or once for a shove.

Forces respect mass — heavier sprites react less to the same push than light ones do. This is different from setting .vel directly, which overrides physics entirely.

applyForce is good for rockets, wind, magnets, or any continuous push where you want the physics engine to handle the acceleration naturally.`,
      code: `let rocket;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  new Sprite(200, 380, 400, 20, 'static');

  rocket = new Sprite(200, 300, 20, 60);
  rocket.color = 'tomato';
}

function update() {
  if (kb.pressing('up')) {
    rocket.applyForce(0, -40);
  }
  if (kb.pressing('left')) {
    rocket.applyForce(-20, 0);
  }
  if (kb.pressing('right')) {
    rocket.applyForce(20, 0);
  }

  if (kb.presses(' ')) {
    rocket.applyForce(0, -200);
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'world-switches',
      title: "World switches and explosions",
      body: `world.explodeAt(x, y, radius, magnitude, falloff) pushes every sprite near a point away from it. The push is strongest in the middle and fades to falloff times as strong at the edge of the radius. Physics never lets anything go faster than world.maxSpeed, so a very big magnitude makes every sprite in range fly off at the same top speed.

world.bounceThreshold is the slowest hit, in pixels per frame, that still makes a sprite bounce. Slower hits just stop.

world.allowSleeping lets resting sprites go to sleep so the physics skips them. By default the world steps itself every frame. world.autoStep = false hands that job to you, and then you call world.physicsUpdate() when you want it to move forward by one step. Most sketches never need that.

In the example, hold nothing and the balls just sit. Click to set off an explosion with world.explodeAt(x, y, radius, magnitude, falloff). Press the space bar to pause the physics: world.autoStep is false, so the sketch only calls world.physicsUpdate() when it is not paused. While paused, press S to move the physics forward by exactly one step. world.bounceThreshold is set to 2, so slow little hits stop the balls instead of bouncing them forever.`,
      code: `let paused = false;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  world.bounceThreshold = 2;   // hits slower than this do not bounce
  world.allowSleeping = true;  // resting sprites may go to sleep
  world.autoStep = false;      // the sketch moves the physics itself
  new Walls();

  for (let i = 0; i < 8; i++) {
    const ball = new Sprite(110 + i * 25, 340, 24);
    ball.bounciness = 0.6;
    ball.color = 'gold';
  }
}

function update() {
  if (kb.presses(' ')) {
    paused = !paused;
  }

  if (mouse.presses()) {
    // x, y, radius, magnitude, falloff
    world.explodeAt(mouse.x, mouse.y, 150, 6, 0.2);
  }

  if (!paused) {
    world.physicsUpdate();
  } else if (kb.presses('s')) {
    world.physicsUpdate();   // one single step
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(14);
  if (paused) {
    text('paused: press S to step, space to go on', 10, 20);
  } else {
    text('click to explode, space to pause', 10, 20);
  }
}`,
    },
    {
      id: 'sprites-at-point',
      title: "Which sprites are at a point?",
      body: `world.getSpritesAt(x, y) gives back an array of every sprite that is at a point, with the one drawn on top first. It is the question "what is under my mouse?" when several sprites are stacked on top of each other. (world.getSpriteAt(x, y) gives back just the top one.) An empty array, [], means nothing is there.

You can add a radius as a third number, to ask about everything within that distance, and a group as a fourth argument to look only at that group's sprites.

In the example, the three overlapping boxes turn white while the mouse is over them, and the number tells you how many were found.`,
      code: `let boxes;
let found = [];

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 0;

  boxes = new Group();
  boxes.collider = 'static';
  boxes.w = 120;
  boxes.h = 120;
  new boxes.Sprite(150, 150);
  new boxes.Sprite(210, 170);
  new boxes.Sprite(260, 140);
}

function update() {
  boxes.color = 'slategray';
  found = world.getSpritesAt(mouse.x, mouse.y);
  for (const box of found) {
    box.color = 'white';
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(16);
  text('sprites under the mouse: ' + found.length, 10, 24);
}`,
    },
    {
      id: 'weight-and-spin',
      title: "Gravity scale, spin and scaled forces",
      body: `sprite.gravityScale is how much of the world's gravity one sprite feels. 1 is all of it, 0 is weightless, and 0.2 is a slow float. A negative number falls upward.

sprite.rotationDrag slows down spinning, the way .drag slows down moving. 0 means a spinning sprite never slows down on its own. sprite.applyTorque(t) gives a sprite a push around, to make it spin. A positive number turns it clockwise.

sprite.applyForceScaled(fx, fy) is applyForce with the sprite's mass already worked in, so a light sprite and a heavy sprite given the same push speed up by the same amount. Plain applyForce pushes the heavy one less.

In the example, the green ball floats down slowly because of its gravityScale. Press the left or right arrow to spin the wheel with applyTorque. Because of its rotationDrag the wheel slows down on its own after you let go. Press the space bar to push both boxes with applyForceScaled: they move together, even though one of them is five times heavier.`,
      code: `let floaty, wheel, light, heavy;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  new Sprite(200, 390, 400, 20, 'static');

  floaty = new Sprite(60, 40, 30);
  floaty.color = 'lightgreen';
  floaty.gravityScale = 0.1;     // feels only a tenth of gravity

  wheel = new Sprite(200, 150, 80, 80);
  wheel.color = 'khaki';
  wheel.gravityScale = 0;        // stays where it is
  wheel.rotationDrag = 2;        // spinning slows down

  light = new Sprite(80, 350, 30, 30);
  light.color = 'lightyellow';
  heavy = new Sprite(140, 350, 30, 30);
  heavy.color = 'gray';
  heavy.mass = 5 * light.mass;
}

function update() {
  if (kb.pressing('left')) {
    wheel.applyTorque(-20);
  }
  if (kb.pressing('right')) {
    wheel.applyTorque(20);
  }

  if (kb.presses(' ')) {
    light.applyForceScaled(200, 0);
    heavy.applyForceScaled(200, 0);
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'mass-and-sleep',
      title: "Density, sleeping and the centre of mass",
      body: `sprite.density is how much a sprite weighs for its size. A big sprite and a small one with the same density differ only by area. sprite.resetMass() works the mass out again from the size and the density; call it after you change density or size and want the mass to match.

sprite.centerOfMass is the world position of the sprite's centre, as a vector with .x and .y in pixels. It is the point physics pushes and turns the sprite around. For these round and square sprites it is the middle.

Resting sprites go to sleep to save work. sprite.sleeping is true while a sprite is asleep. sprite.allowSleeping = false keeps one awake all the time.

In the example, the heavy ball has a high density and the light one a low one, and their masses are written on screen. A red dot is drawn at the heavy ball's centerOfMass. The crate settles and falls asleep, and the blue box never does because of allowSleeping = false.`,
      code: `let heavy, light, crate, awake;

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;
  new Sprite(200, 290, 400, 20, 'static');

  heavy = new Sprite(80, 100, 50);
  heavy.color = 'dimgray';
  heavy.density = 5;
  heavy.resetMass();           // work the mass out again

  light = new Sprite(160, 100, 50);
  light.color = 'lightyellow';
  light.density = 0.2;
  light.resetMass();

  crate = new Sprite(250, 100, 30, 30);
  crate.color = 'orange';

  awake = new Sprite(330, 100, 30, 30);
  awake.color = 'deepskyblue';
  awake.allowSleeping = false; // never falls asleep
}

function draw() {
  background('#222');
  // a dot at the heavy ball's centre of mass
  noStroke();
  fill('red');
  circle(heavy.centerOfMass.x, heavy.centerOfMass.y, 8);
}

function drawTop() {
  fill('white');
  textSize(13);
  text('heavy mass ' + round(heavy.mass) + ', light mass ' + round(light.mass), 10, 20);
  text('crate asleep: ' + crate.sleeping, 10, 40);
  text('blue box asleep: ' + awake.sleeping, 10, 60);
}`,
    },
    {
      id: 'fast-and-moving-ground',
      title: "Very fast sprites and moving ground",
      body: `sprite.isSuperFast = true makes a fast sprite check its path between frames so it cannot skip through a thin wall. Switch it on for bullets.

sprite.surfaceSpeed turns a static sprite into a conveyor belt: things standing on it are carried along at that many pixels per frame. The belt only grips what has friction, so give both the belt and the thing on it a friction above 0.

sprite.physicsEnabled = false leaves a sprite drawn but out of the physics: nothing pushes it, gravity does not pull it and it pushes nothing. Set it back to true to bring it back.

In the example, the red bullet is super fast and stops at the thin wall. The orange crate is carried right by the belt. The grey ball hangs in the air because its physicsEnabled is false: press P to switch it on and it drops, press P again to freeze it where it is.`,
      code: `let bullet, crate, ghost;

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;
  new Sprite(200, 290, 400, 20, 'static');

  bullet = new Sprite(20, 60, 8);
  bullet.color = 'tomato';
  bullet.isSuperFast = true;   // never skips through thin walls
  bullet.gravityScale = 0;
  bullet.vel.x = 30;
  new Sprite(380, 60, 4, 100, 'static');

  crate = new Sprite(60, 240, 30, 30);
  crate.color = 'orange';
  crate.friction = 1;

  const belt = new Sprite(120, 272, 160, 16, 'static');
  belt.color = 'slategray';
  belt.surfaceSpeed = 2;       // carries things to the right
  belt.friction = 1;           // the belt needs grip to carry anything

  ghost = new Sprite(300, 150, 30);
  ghost.color = 'gray';
  ghost.physicsEnabled = false; // hangs in the air until P is pressed
}

function update() {
  if (kb.presses('p')) {
    ghost.physicsEnabled = !ghost.physicsEnabled;
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(13);
  text('p: grey ball physics on/off', 10, 20);
  text('ghost physics: ' + ghost.physicsEnabled, 10, 40);
}`,
    },
  ],
};
