// moSHion docs: Collisions & overlaps. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#collisions/<id>); never rename one, add a new page instead.

export default {
  slug: 'collisions',
  title: "Collisions & overlaps",
  pages: [
    {
      id: 'colliding-vs-overlapping',
      title: "colliding vs overlapping",
      body: `There are two ways sprites can interact. Colliding is physical contact — the sprites push each other and bounce. Overlapping is just bounding-box intersection — the sprites pass through each other but you can still detect the touch.

Dynamic and static sprites collide by default. To let one sprite pass through another without stopping, set its .collider to 'none' — the sprite still draws and you can still test for overlap, but there's no physical pushback.

Use colliding for ground checks, walls, and enemies that block the player. Use overlapping for coins, goal zones, power-ups, and other triggers that shouldn't shove the player.

overlaps() is a question you ask, not a setting you turn on. a.overlaps(b) answers "are these touching right now?" and changes nothing, so calling it once in setup() does not make a and b pass through each other (in p5play it does). To let a coin, a pickup or a bullet pass through, set its collider to 'none'; then ask overlaps() or overlapping() every frame in update() to find out when something reaches it.

The six questions follow one pattern. The -s word is the first frame, the -ing word counts frames while it lasts, and the -ed word is the frame it ends:

collides(b), colliding(b), collided(b) — the physical bodies touching.
overlaps(b), overlapping(b), overlapped(b) — the shapes overlapping, whatever the colliders.

overlaps() is the one exception: it is true on every frame the two overlap, not only the first. For the first frame only, ask overlapping(b) === 1.`,
      code: `let player, wall, zone;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  player = new Sprite(80, 200, 30, 30);
  player.color = 'deepskyblue';

  wall = new Sprite(220, 200, 20, 200, 'static');
  wall.color = 'slategray';

  zone = new Sprite(340, 200, 60, 60);
  zone.collider = 'none';
  zone.color = 'gold';
}

function update() {
  if (kb.pressing('left')) {
    player.vel.x = -4;
  } else if (kb.pressing('right')) {
    player.vel.x = 4;
  } else {
    player.vel.x = 0;
  }

  if (player.overlapping(zone)) {
    zone.color = 'lime';
  } else {
    zone.color = 'gold';
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'overlap-callbacks',
      title: "Overlap callbacks",
      body: `sprite.overlaps(other) returns true if the two sprites intersect (bounding-box math for rectangles, real circle-distance math for two circles). Pass a Group and it returns true if any member overlaps.

You can also pass a callback as the second argument: sprite.overlaps(group, (self, other) => { ... }). The callback fires once per overlapping pair, while the group is being checked. The check goes through a copy of the group, so it's safe to delete() sprites inside the callback.

This is the cleanest way to collect pickups: player.overlaps(coins, (p, coin) => { score++; coin.delete(); }).`,
      code: `let player, coins;
let score = 0;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  player = new Sprite(200, 200, 30, 30);
  player.color = 'deepskyblue';

  coins = new Group();
  coins.diameter = 18;
  coins.color = 'gold';
  coins.collider = 'none';
  new coins.Sprite(120, 120);
  new coins.Sprite(300, 260);
  new coins.Sprite(260, 320);
}

function update() {
  if (kb.pressing('left')) {
    player.vel.x = -4;
  } else if (kb.pressing('right')) {
    player.vel.x = 4;
  } else {
    player.vel.x = 0;
  }
  if (kb.pressing('up')) {
    player.vel.y = -4;
  } else if (kb.pressing('down')) {
    player.vel.y = 4;
  } else {
    player.vel.y = 0;
  }

  player.overlaps(coins, (p, coin) => {
    score++;
    coin.delete();
  });
}

function draw() {
  background('#222');
  fill('white');
  textSize(16);
  text('Score: ' + score, 10, 24);
}`,
    },
    {
      id: 'groups',
      title: "Collisions with groups",
      body: `The collision functions work against a single sprite or a whole Group. player.colliding(enemies) returns a truthy number (a running frame count) while the player touches any sprite in the enemies group.

colliding() reads the physics engine's own record of what is touching, so it is true only when two solid sprites really push on each other. Use colliding(ground) before a jump to confirm the player is standing on something solid.

If you need to know which sprite was hit, pass a callback, which works on all six questions: player.collides(enemies, (p, e) => { e.delete(); }). Or iterate the group yourself and test one-by-one. When you delete sprites in response to a hit, loop over [...group] (a copy) so the shrinking group doesn't skip items.`,
      code: `let player, enemies;
let hp = 3;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  player = new Sprite(60, 200, 30, 30);
  player.color = 'deepskyblue';

  enemies = new Group();
  enemies.diameter = 24;
  enemies.color = 'tomato';
  enemies.collider = 'none';
  new enemies.Sprite(220, 140);
  new enemies.Sprite(260, 220);
  new enemies.Sprite(320, 300);
}

function update() {
  if (kb.pressing('left')) {
    player.vel.x = -3;
  } else if (kb.pressing('right')) {
    player.vel.x = 3;
  }
  if (kb.pressing('up')) {
    player.vel.y = -3;
  } else if (kb.pressing('down')) {
    player.vel.y = 3;
  }

  for (const e of [...enemies]) {
    if (player.overlapping(e)) {
      hp--;
      e.delete();
    }
  }
}

function draw() {
  background('#222');
  fill('white');
  textSize(16);
  text('HP: ' + hp, 14, 24);
}`,
    },
    {
      id: 'ground-sensors',
      title: "Ground sensors",
      body: `player.colliding(ground) is true whenever the player touches the ground anywhere: standing on it, but also pressed against it from the side or bumping it from below. If the floor, the walls and the ceiling are all one group, a jump check written with colliding() lets the player climb a wall by jumping against it.

A sensor fixes that. sprite.addSensor(offsetX, offsetY, w, h) adds a box that rides on the sprite and only detects: it pushes nothing and weighs nothing. Put a thin one just under the player's feet, and feet.overlaps(walls) is true only when something is under them.

The offsets are measured from the sprite's centre. For a player 40 tall, the feet are 20 below the centre, so a strip 4 tall at offset 21 sits just under them. Make it a little narrower than the player so it doesn't touch a wall beside them.

A sensor has three questions: feet.overlaps(walls) (true or false), feet.overlapping(walls) (how many frames it has been touching) and feet.overlapped(walls) (true on the frame it stops touching: the moment the player leaves the ground). Each takes a callback too, like a sprite's: feet.overlaps(walls, (sensor, wall) => { ... }). feet.remove() takes it off again; deleting the sprite does that too.

Another way to ask "is something under me?" is a ray: world.rayCast(player.x, player.y + 21, player.x, player.y + 27) looks along that short line and gives back what it hits first, or null if nothing is there. It looks straight through sensors and collider 'none' sprites, so a coin under your feet does not count as ground.`,
      code: `let player, walls, feet;

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;

  walls = new Group();
  walls.collider = 'static';
  walls.color = 'slategray';
  new walls.Sprite(200, 290, 400, 20);
  new walls.Sprite(300, 200, 20, 160);
  new walls.Sprite(120, 150, 120, 16);

  player = new Sprite(100, 240, 30, 40);
  player.color = 'deepskyblue';
  player.rotationLock = true;
  feet = player.addSensor(0, 21, 26, 4);
}

function update() {
  if (kb.pressing('left')) {
    player.vel.x = -4;
  } else if (kb.pressing('right')) {
    player.vel.x = 4;
  } else {
    player.vel.x = 0;
  }

  if (kb.presses('up') && feet.overlaps(walls)) {
    player.vel.y = -8;
  }
  if (feet.overlaps(walls)) {
    player.color = 'deepskyblue';
  } else {
    player.color = 'orange';
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'ray-casting',
      title: "Ray casting",
      body: `world.rayCast(x1, y1, x2, y2, callback) casts a ray from one point to another and calls your callback for every physics shape the ray touches. The callback receives (sprite, point, normal, fraction): sprite is the Sprite that was hit (or null), point is the hit position in world pixels, normal is the surface normal (a unit vector pointing away from the surface), and fraction is how far along the ray the hit happened, from 0 to 1.

What you return from the callback controls how the ray continues. Return the fraction you were handed (or a smaller number) to clip the ray there — the standard pattern for finding the single closest hit. Return 0 to stop at the first hit. Return 1 to keep going past every hit (all objects on the line). Return -1 to ignore a fixture — useful for skipping sensor sprites, which rayCast does report: filter them with if (sprite && sprite.collider === "none") { return -1; }.

Ray casting is how you build hitscan weapons, line-of-sight checks, aim previews, and anchor-point picking: cast a ray toward a target and read where and what it first touches.

world.rayCast with no callback returns a hit or null. A hit has four things on it: hit.sprite is what the ray touched, hit.point is where, hit.normal is the direction the surface faces at that spot, and hit.fraction is how far along the ray it was, from 0 at the start to 1 at the end.

A Sensor, from addSensor(), has a sprite property too: sensor.sprite is the sprite it rides on. So when a sensor answers true, sensor.sprite tells you whose it is.`,
      code: `let player, target, wall;

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;

  new Sprite(200, 290, 400, 20, "static");   // floor

  player = new Sprite(50, 200, 20, 20, "static");
  player.color = "#5baafd";

  // A barrier with a gap under it: aim through the gap to reach the target,
  // aim straight at the barrier and the ray stops here instead.
  wall = new Sprite(200, 170, 20, 110, "static");
  wall.color = "#333844";

  target = new Sprite(320, 250, 30, 30);
  target.color = "tomato";
}

function update() {
  if (mouse.presses()) {
    let hit;
    world.rayCast(player.x, player.y, mouse.x, mouse.y, function (sprite, point, normal, fraction) {
      if (sprite && sprite.collider === "none") {
        return -1; // skip sensors
      }
      hit = { sprite, point, normal, fraction };
      return fraction; // clip at each hit to find the closest
    });
    if (hit && hit.sprite === target) {
      hit.sprite.color = "gold";
    }
  }
}

function draw() {
  background("#222");
  // mouse.x/y read (0, 0) until the cursor has been over the canvas once.
  if (!mouse.isActive) {
    return;
  }
  stroke("#5baafd");
  strokeWeight(2);
  line(player.x, player.y, mouse.x, mouse.y);
}`,
    },
    {
      id: 'ray-hit',
      title: "Reading a ray's hit",
      body: `The easy way to cast a ray is to leave the callback out: const hit = world.rayCast(x1, y1, x2, y2). You get back null when the ray touches nothing, or a hit with these parts:

hit.sprite is the sprite the ray touched first. hit.point is where it touched, with hit.point.x and hit.point.y in world pixels. hit.normal is the direction the surface faces at that spot, as a vector of length 1: a flat floor gives (0, -1), pointing up. hit.fraction is how far along the ray the hit was, from 0 at the start to 1 at the end.

Always check for null first: if (hit) { ... }.

In the example, the ray is aimed at the mouse. A red dot shows hit.point, a short yellow line shows hit.normal, and the number shows hit.fraction.`,
      code: `let shooter;

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 0;

  shooter = new Sprite(40, 150, 20, 20, 'static');
  shooter.color = 'deepskyblue';

  const block = new Sprite(250, 150, 60, 100, 'static');
  block.color = 'slategray';
  const ball = new Sprite(330, 80, 50);
  ball.collider = 'static';
  ball.color = 'tomato';
}

function draw() {
  background('#222');
  if (!mouse.isActive) {
    return;
  }

  const hit = world.rayCast(shooter.x, shooter.y, mouse.x, mouse.y);

  stroke('white');
  strokeWeight(1);
  line(shooter.x, shooter.y, mouse.x, mouse.y);

  if (hit) {
    // a red dot where the ray touched
    noStroke();
    fill('red');
    circle(hit.point.x, hit.point.y, 10);

    // a yellow line sticking out of the surface
    stroke('yellow');
    strokeWeight(3);
    line(hit.point.x, hit.point.y, hit.point.x + hit.normal.x * 30, hit.point.y + hit.normal.y * 30);

    noStroke();
    fill('white');
    textSize(14);
    text('fraction: ' + hit.fraction.toFixed(2), 10, 20);
  } else {
    noStroke();
    fill('white');
    textSize(14);
    text('the ray hit nothing', 10, 20);
  }
}`,
    },
    {
      id: 'touch-start-end',
      title: "collides, collided and overlapped",
      body: `colliding() and overlapping() count how long two sprites have been touching. Two of the other questions tell you about one single moment.

a.collides(b) is true on the first frame two solid sprites touch, and false after that. Use it for a sound, a score point or a spark when a hit happens. a.collided(b) is true on the one frame the two stop touching: the moment a ball leaves the floor.

a.overlapped(b) is true on the frame two overlapping sprites stop overlapping: the moment a player walks out of a zone. It works with a collider of 'none' too.

In the example, press the arrow keys to move the blue box. The count at the top goes up when the box lands on the ball (collides) and when it walks out of the gold zone (overlapped). The ball changes colour while the box is leaving it (collided).`,
      code: `let player, ball, zone;
let landings = 0;
let exits = 0;

function setup() {
  new Canvas(400, 300);
  world.gravity.y = 10;
  new Sprite(200, 290, 400, 20, 'static');

  ball = new Sprite(120, 260, 40, 40, 'static');
  ball.color = 'tomato';

  zone = new Sprite(300, 200, 100, 160);
  zone.collider = 'none';
  zone.color = 'gold';

  player = new Sprite(120, 100, 30, 30);
  player.color = 'deepskyblue';
  player.rotationLock = true;
}

function update() {
  if (kb.pressing('left')) {
    player.vel.x = -4;
  } else if (kb.pressing('right')) {
    player.vel.x = 4;
  } else {
    player.vel.x = 0;
  }
  if (kb.presses('up')) {
    player.vel.y = -8;
  }

  if (player.collides(ball)) {
    landings++;
  }
  if (player.collided(ball)) {
    ball.color = 'white';
  }
  if (player.colliding(ball)) {
    ball.color = 'tomato';
  }
  if (player.overlapped(zone)) {
    exits++;
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(14);
  text('landed on the ball: ' + landings + '   left the zone: ' + exits, 10, 20);
}`,
    },
  ],
};
