// moSHion docs: Sprites. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#sprite/<id>); never rename one, add a new page instead.

export default {
  slug: 'sprite',
  title: "Sprites",
  pages: [
    {
      id: 'first-sprite',
      title: "Your first sprite",
      body: `A Sprite is the basic building block of any moSHion game. Every sprite has a position, a size, and (usually) a physics body that moves and collides automatically.

new Sprite(x, y, width, height) creates a rectangular sprite centered on (x, y). With no extra argument it's dynamic, meaning gravity pulls it and it bumps into other sprites. Gravity starts at 0, so this one stays where you put it until you set world.gravity.y.

Store the sprite in a variable declared outside setup() so update() and draw() can reach it later. Without a reference, you can't move it or check its state.`,
      code: `let player;

function setup() {
  new Canvas(400, 400);
  player = new Sprite(200, 180, 40, 40);
  player.color = 'deepskyblue';
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'collider-types',
      title: "Collider types: dynamic, static, kinematic, none",
      body: `Every sprite has a physics type. You set it by passing a string as the last argument to new Sprite, or later with sprite.collider = '...'.

'dynamic' is the default — gravity pulls it, other sprites push it. Use it for players, enemies, projectiles.

'static' never moves and never reacts. Use it for floors, walls, and platforms. 'kinematic' moves only when you set its velocity — gravity ignores it. Use it for moving platforms and doors. 'none' turns physics off entirely — the sprite still draws, but nothing collides with it. Use it for cursors, UI, and decorations. A sprite with collider = 'none' is a sensor: you can still detect overlaps, but there's no physical pushback.

The type works on circles too: new Sprite(x, y, 30, 'static') is a static ball. Capital letters are fine ('Static'), and so is the first letter alone ('s'). A misspelt type such as 'statik' stops the sketch with an error that lists the four real ones, instead of quietly making a dynamic sprite. sprite.body and sprite.physicsType are older names for the same setting.

Instead of the words in quotes you can use constants: s.collider = STATIC is the same as s.collider = 'static'. DYNAMIC is 'dynamic' and KINEMATIC is 'kinematic'. STA, DYN and KIN are shorter spellings of the same three. They are only names for the same strings, so use whichever reads best to you.`,
      code: `let elevator;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  new Sprite(200, 100, 40, 40);                    // dynamic (default)
  new Sprite(200, 380, 400, 20, 'static');         // static floor
  new Sprite(100, 260, 80, 10, 'static');          // static platform

  elevator = new Sprite(320, 260, 60, 10, 'kinematic');
  elevator.vel.y = -1;

  const hint = new Sprite(200, 30, 10, 10);
  hint.collider = 'none';
  hint.color = 'gold';
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'position-rotation-scale',
      title: "Position, rotation, scale",
      body: `.x and .y are the center of the sprite, not the top-left corner. A sprite at (200, 200) has its middle at (200, 200).

.rotation is in degrees. 90 is a quarter turn, 180 is a half turn, 360 is a full turn.

.scale uniformly grows or shrinks how the sprite is drawn. The physics body stays the size you created it at, so very large scale values can look strange when the sprite collides.`,
      code: `let box, spinner;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  box = new Sprite(120, 200, 40, 60);
  box.rotation = 30;

  spinner = new Sprite(280, 200, 40, 40);
  spinner.collider = 'none';
  spinner.color = 'gold';
}

function update() {
  spinner.rotation += 3;
  spinner.scale.x = 1 + 0.3 * Math.sin(frameCount / 20);
  spinner.scale.y = spinner.scale.x;
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'color-visibility-layer',
      title: "Color, visibility, and layer",
      body: `.color sets the fill. You can use CSS names ('red'), hex ('#ff8800'), or rgb strings.

.stroke is the outline color and .strokeWeight is its thickness in pixels. Set strokeWeight to 0 for no outline.

.visible = false hides a sprite without removing it — physics still runs. .layer controls draw order — higher layer values draw on top.

.opacity fades a sprite from 0 (invisible) to 1 (fully solid, the default) — good for a hit-flash, a fade-out before delete(), or a ghosted preview. .debug = true draws the sprite's actual physics collider as a lime outline, which is the fastest way to check whether the shape you're seeing matches the shape you're colliding with.`,
      code: `function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  const back = new Sprite(180, 200, 120, 120);
  back.color = '#4455aa';
  back.layer = 0;

  const front = new Sprite(220, 200, 120, 120);
  front.color = 'gold';
  front.stroke = 'black';
  front.strokeWeight = 3;
  front.layer = 1;
  front.opacity = 0.6;

  const ball = new Sprite(340, 200, 40);
  ball.color = 'tomato';
  ball.debug = true; // outlines the real collider, useful while tuning shapes
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'shape-options',
      title: "Shape options",
      body: `moSHion picks the collider shape from the constructor arguments. Two numbers make a 50×50 square: new Sprite(x, y). Three numbers make a circle: new Sprite(x, y, diameter). Four numbers make a rectangle: new Sprite(x, y, w, h).

You can also pass a body type as the last argument: new Sprite(x, y, w, h, 'static').

new Sprite() with no numbers at all makes a 50×50 square in the middle of what the camera shows.

You can change the size later: .w and .h (or .width and .height, or .diameter for a circle) resize the sprite AND its collider, so what you see is what bumps into things. On a circle, setting either .w or .h sets both, because a circle has one size. .scale is different: it only changes how the sprite is drawn.

You can read .shape to check whether a sprite is 'circle' or 'rect', and set it to switch ('box' means the same as 'rect').`,
      code: `function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  new Sprite(90, 120, 40, 60);

  const ball = new Sprite(200, 120, 40);
  ball.color = 'tomato';

  new Sprite(200, 380, 400, 20, 'static');
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'speed-direction',
      title: "Speed, direction, and moveTowards",
      body: `.speed and .direction are another way to read and set .vel, in polar form instead of x/y. .speed is how fast the sprite is moving (pixels per frame, always 0 or positive — a negative speed just points direction the other way). .direction is the heading in degrees, where 0 points right, 90 points down, matching .rotation's convention.

Setting .speed keeps the current direction; setting .direction keeps the current speed. That makes "turn without slowing down" or "speed up without turning" a one-line change instead of redoing the vector math.

sprite.moveTowards(x, y, tracking) nudges a sprite toward a point without touching physics at all — each call moves it tracking (default 0.1, so 10%) of the remaining distance. Call it once per update() frame for a smooth chase that naturally slows down as it arrives.`,
      code: `let hunter, target;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  hunter = new Sprite(60, 200, 30);
  hunter.color = 'tomato';
  hunter.collider = 'none';

  target = new Sprite(340, 200, 16);
  target.color = 'gold';
  target.collider = 'none';
}

function update() {
  target.x = 200 + Math.cos(frameCount / 40) * 150;
  target.y = 200 + Math.sin(frameCount / 40) * 150;
  hunter.moveTowards(target.x, target.y, 0.05);
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'chasing',
      title: "Chasing, fleeing, and pulling",
      body: `Two questions come first: how far away is it, and which way is it? sprite.distanceTo(other) gives the straight-line distance in pixels, and sprite.angleTo(other) gives the direction in degrees, measured the same way as sprite.rotation. Both take a pair of numbers or anything with x and y — another sprite, or mouse.

moveTowards has three relatives that work the same way, and all four accept either a pair of numbers or a target with .x and .y — so enemy.moveTowards(player, 0.02) is a complete chase.

moveTowards(target, tracking) closes that fraction of the remaining gap each call. moveAway(target, repel) is its mirror: it opens the gap by the same fraction. Both set position directly, so they ignore physics — the sprite arrives no matter what is in the way.

attractTo(target, force) and repelFrom(target, force) work through physics instead, applying a real force in newtons toward or away from the point. The sprite accelerates, keeps its momentum, and bounces off whatever it hits on the way. Use these when the pull should feel like gravity or magnetism rather than a leash.

rotateTowards(target, tracking) turns to face a point over several frames by setting a spin speed — unlike rotateTo, which steps or snaps the angle directly. Like rotateTo, it always turns the short way round.

Passing mouse itself (not mouse.x and mouse.y) is worth doing: the sprite then ignores the cursor until it has actually moved over the canvas, instead of lunging at the top-left corner on the first frame.`,
      code: `let hunter, prey, magnet;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  prey = new Sprite(200, 120, 18);
  prey.color = 'gold';
  prey.collider = 'none';

  hunter = new Sprite(60, 120, 22);
  hunter.color = 'tomato';
  hunter.collider = 'none';

  magnet = new Sprite(200, 300, 20);
  magnet.color = 'deepskyblue';
}

function update() {
  // prey runs from the cursor, hunter chases the prey
  prey.moveAway(mouse, 0.04);
  hunter.moveTowards(prey, 0.03);
  hunter.rotateTowards(prey, 0.2);

  // the blue one is pulled by physics, so it overshoots and swings back
  magnet.attractTo(mouse, 30);
}

function draw() {
  background('#222');
  fill('white');
  textSize(13);
  text('move the mouse', 14, 22);
}`,
    },
    {
      id: 'angular-velocity',
      title: "Angular velocity",
      body: `sprite.angularVelocity is the rotation speed in degrees per frame. Positive spins clockwise, negative spins counter-clockwise.

You can read it to see how fast a sprite is spinning, or write it to give a sprite a spin kick — like a pendulum that gets pushed on a mouse click. The value is in degrees per frame, just as vel is in pixels per frame.`,
      code: `let rod, anchor;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  anchor = new Sprite(200, 80, 12, 12, 'static');
  rod = new Sprite(200, 180, 12, 160);
  rod.color = 'khaki';

  new HingeJoint(anchor, rod);
}

function update() {
  if (mouse.presses()) {
    rod.angularVelocity = 6;
  }
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'rotate-to',
      title: "rotateTo",
      body: `sprite.rotateTo(angle, speed) turns a sprite toward angle, in degrees, using the shorter direction. Pass speed to cap how many degrees it turns per call — call it every update() frame and it eases into the target angle instead of snapping. Leave speed out and it snaps immediately, same as setting .rotation directly.

It returns a Promise, so await sprite.rotateTo(90) works if you like that style — but the rotation itself already happened by the time you'd await it, so most lesson code just calls it and moves on.`,
      code: `let turret;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  turret = new Sprite(200, 200, 60, 16);
  turret.color = 'slategray';
}

function update() {
  const dx = mouseX - turret.x, dy = mouseY - turret.y;
  const angleToMouse = Math.atan2(dy, dx) * 180 / Math.PI;
  turret.rotateTo(angleToMouse, 4); // turns at most 4°/frame toward the mouse
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'removing',
      title: "Removing and cleaning up sprites",
      body: `sprite.delete() removes a sprite from the world. After deleting, it stops drawing, stops updating, and its physics body is gone. It also removes itself from every group it belongs to, including the implicit allSprites group. There is no undo — if you only want to hide a sprite, set .visible = false instead.

Watch out for group.remove(sprite): it only takes the sprite out of that group. coins.remove(c) leaves the coin on screen, still drawing and still bumping into things, and the console says so the first time. To get rid of a coin, call it on the coin itself: c.delete() (c.remove() is the same).

When you delete sprites while looping through a Group, iterate a copy with [...group]. Otherwise the array shrinks under your feet and you'll skip items.`,
      code: `let bullets;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;
  bullets = new Group();
  bullets.color = 'gold';
  bullets.diameter = 10;
  bullets.collider = 'none';
}

function update() {
  if (frameCount % 10 === 0) {
    const b = new bullets.Sprite(20, 200);
    b.vel.x = 4;
  }
  for (const b of [...bullets]) {
    if (b.x > 400) b.delete();
  }
}

function draw() {
  background('#222');
  fill('white');
  textSize(14);
  text('Live bullets: ' + bullets.length, 14, 24);
}`,
    },
  ],
};
