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
  if (kb.pressing('left'))       player.vel.x = -5;
  else if (kb.pressing('right')) player.vel.x = 5;
  else                           player.vel.x = 0;

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

These are per-sprite properties. When two sprites touch, Box2D combines their values — bounciness uses the higher of the two, friction uses a geometric mean.`,
      code: `function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  const floor = new Sprite(200, 380, 400, 20, 'static');
  floor.friction = 0.3;

  const bouncy = new Sprite(120, 80, 30);
  bouncy.bounciness = 0.9;
  bouncy.color = 'tomato';

  const dead = new Sprite(200, 80, 30);
  dead.bounciness = 0;
  dead.color = 'slategray';

  const slippery = new Sprite(280, 80, 30);
  slippery.friction = 0;
  slippery.bounciness = 0.4;
  slippery.color = 'deepskyblue';
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
      code: `let walls;

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;
  walls = new Walls();

  for (let i = 0; i < 10; i++) {
    const ball = new Sprite(40 + i * 35, 60 + (i % 3) * 40, 24);
    ball.bounciness = 0.8;
    ball.vel.x = i % 2 === 0 ? 6 : -6;
    ball.color = i % 2 === 0 ? 'tomato' : 'gold';
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'mass-density',
      title: "Mass and density",
      body: `.mass is how heavy a sprite is — read it to see how physics will treat the sprite (a heavier sprite reacts less to the same applyForce push, see below). Setting .mass adjusts the sprite's density so its actual mass matches what you asked for. Static and kinematic sprites always have 0 mass, since gravity and pushes don't affect them.

.density is the more direct knob underneath .mass — mass is density times the sprite's area, so a bigger sprite at the same density weighs more. New sprites default to a density of 1.

You'll reach for .mass far more often than .density — it's the number that actually means something ("this rock should be twice as heavy as that crate").`,
      code: `function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  new Sprite(200, 380, 400, 20, 'static');

  const feather = new Sprite(120, 80, 30);
  feather.color = 'lightyellow';
  feather.mass = 0.2;

  const rock = new Sprite(280, 80, 30);
  rock.color = 'gray';
  rock.mass = 5;
}

function draw() {
  background('#222');
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
  if (kb.pressing('up'))    rocket.applyForce(0, -40);
  if (kb.pressing('left'))  rocket.applyForce(-20, 0);
  if (kb.pressing('right')) rocket.applyForce(20, 0);

  if (kb.presses(' ')) rocket.applyForce(0, -200);
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

world.allowSleeping lets resting sprites go to sleep so the physics skips them. By default the world steps itself every frame. world.autoStep = false hands that job to you, and then you call world.physicsUpdate() when you want it to move forward by one step. Most sketches never need that.`,
    },
  ],
};
