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

  new Sprite(200, 100, 40, 40, DYNAMIC);           // falls
  new Sprite(200, 380, 400, 20, STATIC);           // static floor
  new Sprite(100, 260, 80, 10, STA);               // short for STATIC
  new Sprite(100, 100, 30, 30, DYN);               // short for DYNAMIC, lands on the platform

  elevator = new Sprite(320, 260, 60, 10, KINEMATIC);
  elevator.vel.y = -1;

  const slider = new Sprite(250, 330, 50, 10, KIN); // short for KINEMATIC
  slider.vel.x = 1;

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

.scale grows or shrinks how the sprite is drawn: sprite.scale = 2 doubles it both ways, and sprite.scale.x and sprite.scale.y stretch one way at a time. The physics body stays the size you created it at, so very large scale values can look strange when the sprite collides.

sprite.scaleBy(2) multiplies the scale you have now instead of replacing it, so calling it three times with 1.25 makes the sprite 1.25 × 1.25 × 1.25 times bigger. Like .scale it only changes how the sprite is drawn.

sprite.pos holds .x and .y together. Give it a pair like createVector(100, 220) to move the sprite there in one step. sprite.prevPos is where the sprite was at the end of the last frame, and sprite.prevRotation is its angle at the end of the last frame. They are read-only, and useful for working out how far something moved or turned.`,
      code: `let box, spinner;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  box = new Sprite(120, 200, 40, 60);
  box.rotation = 30;
  box.pos = createVector(100, 220);

  spinner = new Sprite(280, 200, 40, 40);
  spinner.collider = 'none';
  spinner.color = 'gold';
}

function update() {
  spinner.rotation += 3;
  spinner.scale.x = 1 + 0.3 * Math.sin(frameCount / 20);
  spinner.scale.y = spinner.scale.x;

  // scaleBy() multiplies the current scale; start over once the box gets big
  if (frameCount % 30 === 0) {
    box.scaleBy(1.25);
  }
  if (box.scale.x > 2) {
    box.scale = 1;
  }
}

function drawTop() {
  fill('white');
  textSize(13);
  text('box scale: ' + box.scale.x.toFixed(2), 14, 22);
  text('last frame rotation: ' + spinner.prevRotation.toFixed(0), 14, 42);
  text('last frame x: ' + spinner.prevPos.x.toFixed(0), 14, 62);
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
      code: `let ball;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  new Sprite(90, 120, 40, 60);

  ball = new Sprite(200, 120, 40);
  ball.color = 'tomato';

  new Sprite(200, 380, 400, 20, 'static');
}

function update() {
  // every 90 frames, switch between a circle and a rectangle
  if (frameCount % 90 === 0) {
    if (ball.shape === 'circle') {
      ball.shape = 'rect';
    } else {
      ball.shape = 'circle';
    }
  }
  ball.text = ball.shape;
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'size-names',
      title: "Size names: w, h, d, r and friends",
      body: `A sprite's size has several names, and they all change the same thing. Use whichever one reads best.

.w and .h are the width and height. .hw and .hh are half of them, and .halfWidth and .halfHeight are longer spellings of .hw and .hh. They are handy when you want the distance from the middle to an edge.

.d is the diameter of a circle, how far it is across. .r and .radius are half of that, the distance from the middle to the edge. Set any of them and the other two follow.

Setting a size changes the collider too, so the shape you see is the shape that bumps into things. The example prints one of each name, then grows the boxes every 60 frames.`,
      code: `let box, ball;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  box = new Sprite(100, 200, 60, 40);
  box.color = 'deepskyblue';

  ball = new Sprite(300, 200, 40);
  ball.color = 'tomato';
}

function update() {
  if (frameCount % 60 === 0) {
    box.w += 10;
    box.hh += 5;
    ball.r += 5;
  }
  if (frameCount % 120 === 0) {
    box.halfWidth = 30;
    box.halfHeight = 20;
    ball.radius = 20;
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(13);
  text('w ' + box.w + '   h ' + box.h, 14, 22);
  text('hw ' + box.hw + '   hh ' + box.hh, 14, 42);
  text('halfWidth ' + box.halfWidth + '   halfHeight ' + box.halfHeight, 14, 62);
  text('d ' + ball.d + '   r ' + ball.r + '   radius ' + ball.radius, 14, 82);
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
      id: 'speed-and-direction-together',
      title: "Setting speed and direction together",
      body: `sprite.setSpeedAndDirection(speed, direction) sets both at once: speed in pixels per frame, direction in degrees (0 points right, 90 points down). It is the same as setting .speed and .direction one after the other, in one line.

sprite.isMoving is true while the sprite has any speed at all and false once it stands still. It is read-only. Use it to switch a walking picture on and off, or to wait until something has stopped.

sprite.speed and sprite.direction can also be read at any time. The example launches a ball, lets drag slow it down, and prints what these say.`,
      code: `let ball;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 0;

  ball = new Sprite(60, 200, 30);
  ball.color = 'tomato';
  ball.drag = 1;
  ball.setSpeedAndDirection(6, 20);
}

function update() {
  // click to launch again, a little differently each time
  if (mouse.presses()) {
    ball.x = 60;
    ball.y = 200;
    ball.setSpeedAndDirection(6, random(-40, 40));
  }
  if (ball.isMoving === false) {
    ball.color = 'gold';
  } else {
    ball.color = 'tomato';
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(13);
  text('speed: ' + ball.speed.toFixed(2), 14, 22);
  text('direction: ' + ball.direction.toFixed(0), 14, 42);
  text('isMoving: ' + ball.isMoving, 14, 62);
  text('click to launch again', 14, 382);
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

Passing mouse itself (not mouse.x and mouse.y) is worth doing: the sprite then ignores the cursor until it has actually moved over the canvas, instead of lunging at the top-left corner on the first frame.

Two more helpers answer "how far must I turn?". sprite.angleToFace(target) is the turn needed to face the target, in degrees, positive or negative, the short way round. sprite.rotationToFace(target) is the absolute rotation that would face it, ready to assign to .rotation. The example prints distanceTo and angleTo, and the red arrow-shaped sprite faces the yellow one with rotationToFace.`,
      code: `let hunter, prey, magnet, pusher, pointer;

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

  pusher = new Sprite(340, 300, 20);
  pusher.color = 'orchid';
  pusher.drag = 2;

  pointer = new Sprite(60, 300, 50, 16);
  pointer.color = 'tomato';
  pointer.collider = 'none';
}

function update() {
  // prey runs from the cursor, hunter chases the prey
  prey.moveAway(mouse, 0.04);
  hunter.moveTowards(prey, 0.03);
  hunter.rotateTowards(prey, 0.2);

  // the blue one is pulled by physics, so it overshoots and swings back
  magnet.attractTo(mouse, 30);

  // the purple one is pushed away from the cursor by physics
  pusher.repelFrom(mouse, 10);

  // the arrow turns to face the prey
  pointer.rotation = pointer.rotationToFace(prey);
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(13);
  text('move the mouse', 14, 22);
  text('distance to prey: ' + hunter.distanceTo(prey).toFixed(0), 14, 42);
  text('angle to prey: ' + hunter.angleTo(prey).toFixed(0), 14, 62);
  text('turn still needed: ' + pointer.angleToFace(prey).toFixed(0), 14, 82);
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
      body: `sprite.delete() removes a sprite from the world. After deleting, it stops drawing, stops updating, and its physics body is gone. It also removes itself from every group it belongs to, including allSprites, the group every sprite is in. There is no undo — if you only want to hide a sprite, set .visible = false instead.

Watch out for group.remove(sprite): it only takes the sprite out of that group. coins.remove(c) leaves the coin on screen, still drawing and still bumping into things, and the console says so the first time. To get rid of a coin, call it on the coin itself: c.delete() (c.remove() is the same).

When you delete sprites while looping through a Group, iterate a copy with [...group]. Otherwise the array shrinks under your feet and you'll skip items.

Three read-only helpers describe a sprite's place in the game. sprite.removed is true once the sprite has been deleted, so code that still holds on to it can check before using it. sprite.groups is a list of every group the sprite is in (allSprites is always one of them). sprite.joints is a list of every joint attached to it. Both lists are copies, so changing them does nothing to the sprite. The example prints all three for the newest bullet.`,
      code: `let bullets, newest, oldest;

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
    if (oldest === undefined) {
      oldest = b;
    }
    newest = b;
  }
  for (const b of [...bullets]) {
    if (b.x > 400) {
      b.delete();
    }
  }
}

function draw() {
  background('#222');
  fill('white');
  textSize(14);
  text('Live bullets: ' + bullets.length, 14, 24);
  if (newest !== undefined) {
    text('newest is in ' + newest.groups.length + ' groups', 14, 44);
    text('newest has ' + newest.joints.length + ' joints', 14, 64);
  }
  if (oldest !== undefined) {
    text('first bullet removed: ' + oldest.removed, 14, 84);
  }
}`,
    },
    {
      id: 'sprite-switches',
      title: "Sprite switches: screenSpace, visualOnly, autoUpdate",
      body: `Some sprite settings are on/off switches for how a sprite takes part in the game.

sprite.screenSpace = true pins a sprite to the screen instead of the world. It ignores the camera and draws after everything else, which is what you want for a score badge or a health bar. sprite.canvasPos is the sprite's position in screen pixels with the camera taken out, so you can see where it really is on the canvas. It is read-only.

sprite.visualOnly = true leaves the sprite drawn but takes it out of the physics. Nothing bumps into it, and gravity does not pull it. Set it back to false and it returns to the simulation.

sprite.autoUpdate = false stops that sprite's own update() function from running each frame. The sprite still draws and still moves with whatever speed it has.

The example uses all three. Press the mouse to flip each switch and read the labels.`,
      code: `let badge, ghost, worker;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;

  badge = new Sprite(340, 30, 80, 30, 'static');
  badge.color = 'gold';
  badge.screenSpace = true;

  new Sprite(200, 390, 400, 20, 'static');

  ghost = new Sprite(120, 100, 40, 40);
  ghost.color = 'orchid';
  ghost.visualOnly = true;

  worker = new Sprite(280, 200, 30, 30, 'kinematic');
  worker.color = 'tomato';
  worker.vel.x = 1;
  worker.update = function () {
    this.rotation += 5;
  };
}

function update() {
  if (mouse.presses()) {
    ghost.visualOnly = !ghost.visualOnly;
    if (worker.autoUpdate === true) {
      worker.autoUpdate = false;
    } else {
      worker.autoUpdate = true;
    }
  }
  if (worker.x > 360 || worker.x < 40) {
    worker.vel.x = -worker.vel.x;
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(13);
  text('ghost.visualOnly: ' + ghost.visualOnly, 14, 22);
  text('worker.autoUpdate: ' + worker.autoUpdate, 14, 42);
  text('badge canvasPos: ' + badge.canvasPos.x + ', ' + badge.canvasPos.y, 14, 62);
  text('click to flip the switches', 14, 382);
}`,
    },
  ],
};
