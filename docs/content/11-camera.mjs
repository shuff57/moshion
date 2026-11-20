// moSHion docs: Camera. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#camera/<id>); never rename one, add a new page instead.

export default {
  slug: 'camera',
  title: "Camera",
  pages: [
    {
      id: 'following',
      title: "Following a target",
      body: `The camera controls which part of the world is visible. camera.x and camera.y are the viewport's center in world coordinates.

The simplest follow is to snap the camera to the player each frame: camera.x = player.x. It works, but the view jitters on every tiny movement.

A soft follow eases the camera toward the player with a catch-up factor: camera.x += (player.x - camera.x) * 0.1. Smaller factors feel floaty; larger factors feel snappy. 0.1 is a good starting point.`,
      code: `let player;

function setup() {
  new Canvas(400, 400);
  world.gravity.y = 10;
  new Sprite(1000, 390, 2000, 20, 'static');
  for (let x = 200; x < 2000; x += 300) {
    new Sprite(x, 300, 60, 10, 'static');
  }
  player = new Sprite(200, 250, 30, 30); // above the first platform, not inside it
  player.color = 'deepskyblue';
}

function update() {
  if (kb.pressing('left')) {
    player.vel.x = -5;
  } else if (kb.pressing('right')) {
    player.vel.x = 5;
  } else {
    player.vel.x = 0;
  }
  if (kb.presses(' ')) {
    player.jump(); // jumps only when standing on something
  }

  camera.x += (player.x - camera.x) * 0.1;
  camera.y += (player.y - camera.y) * 0.1;
}

function draw() {
  background('#222');
}`,
    },
    {
      id: 'camera-off',
      title: "camera.off() and camera.on()",
      body: `camera.off() makes everything you draw after it ignore the camera, so it stays put on the screen. camera.on() puts the camera back, and the world scrolls again. Use off() before drawing a score or a health bar and on() when you are done. A sprite with screenSpace = true does the same thing for itself.

camera.isActive tells you which way it is set right now: true while the camera is on (the default), false between camera.off() and camera.on().

In the example the camera follows the player along a row of posts. The grey bar is drawn between camera.off() and camera.on(), so it stays in the corner. The row of gold dots is drawn after camera.on(), so it scrolls past as the player moves. The two lines under the bar print camera.isActive as it was read while drawing the bar and while drawing the dots.`,
      code: `let player;
let hudActive = true;
let worldActive = false;

function setup() {
  new Canvas(400, 300);
  player = new Sprite(200, 150, 30, 30);
  player.collider = 'none';
  player.color = 'deepskyblue';
  for (let x = 0; x < 2000; x += 100) {
    let post = new Sprite(x, 200, 10, 60);
    post.collider = 'none';
    post.color = 'gray';
  }
}

function update() {
  if (kb.pressing('left')) {
    player.x -= 4;
  }
  if (kb.pressing('right')) {
    player.x += 4;
  }
  camera.x = player.x;
}

function draw() {
  background('#222');

  camera.off();
  fill('rgba(255, 255, 255, 0.3)');
  rect(10, 10, 120, 24);
  fill('white');
  textSize(14);
  text('x: ' + Math.round(player.x), 20, 28);
  hudActive = camera.isActive; // false: the camera is off here
  camera.on();
  worldActive = camera.isActive; // true: the camera is back on

  fill('gold');
  for (let x = 0; x < 2000; x += 100) {
    circle(x, 60, 12);
  }
}

function drawTop() {
  fill('white');
  textSize(13);
  text('camera.isActive while drawing the bar: ' + hudActive, 10, 106);
  text('camera.isActive while drawing the dots: ' + worldActive, 10, 126);
}`,
    },
  ],
};
