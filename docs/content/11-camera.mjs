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
  if (kb.pressing('left'))       player.vel.x = -5;
  else if (kb.pressing('right')) player.vel.x = 5;
  else                           player.vel.x = 0;
  if (kb.presses(' ')) player.jump(); // jumps only when standing on something

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
      body: `camera.off() makes everything you draw after it ignore the camera, so it stays put on the screen. camera.on() puts the camera back, and the world scrolls again. Use off() before drawing a score or a health bar and on() when you are done. A sprite with screenSpace = true does the same thing for itself.`,
    },
  ],
};
