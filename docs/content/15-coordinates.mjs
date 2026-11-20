// moSHion docs: Coordinates & math mode. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#coordinates/<id>); never rename one, add a new page instead.

export default {
  slug: 'coordinates',
  title: "Coordinates & math mode",
  pages: [
    {
      id: 'origin',
      title: "Where is (0, 0)?",
      body: `By default, (0, 0) is the top-left corner of the canvas. x counts to the right and y counts DOWN, so a bigger y is lower on the screen. The browser's own canvas works this way, and so does p5play. These are called screen coordinates, and every sketch uses them unless you ask for something else.

If you are used to graphs from math class, where y goes up, this can feel upside down. Two helpers show you what is going on. showGrid(50) draws a light grid with a line every 50 pixels and the axes labelled, so you can see exactly where (0, 0) is and which way y grows. showMouse() writes the pointer's (x, y) right next to it. Call both from draw(), every frame. They only draw: nothing collides with the grid.

Move the mouse over the canvas and read the numbers: y gets bigger as you move down.`,
      code: `let box;

function setup() {
  new Canvas(400, 300);
  box = new Sprite(100, 50, 40, 40, 'static');
  box.color = 'deepskyblue';
}

function draw() {
  background('#222');
  showGrid(50);
  showMouse();
}`,
    },
    {
      id: 'math-mode',
      title: "Math mode: centre, y up",
      body: `Put world.origin = 'math' on the line right after new Canvas() and the canvas becomes the graph from math class. (0, 0) is the CENTRE of the canvas, x grows to the right and y grows UP. A positive rotation turns counter-clockwise, the way math measures angles from the +x axis.

Every number keeps its meaning but points the math way. vel.y = 5 moves a sprite up. direction = 90 points up. Gravity pulls toward smaller y, so a falling world is world.gravity.y = -10, with a minus sign, because down is negative now. The camera starts at (0, 0). Text and pictures still read the right way up, and showGrid() and showMouse() label the math numbers.

Set it first: before you make any sprite and before you set gravity. The engine will not move things that already exist, so setting it too late stops the sketch with an error that tells you to move the line up. Any value other than 'math' or 'screen' is an error too. 'screen' is the default, so you never need to write it.

In this example the ball starts 100 above the centre and falls onto the floor at y = -120.`,
      code: `let ball, floor;

function setup() {
  new Canvas(400, 300);
  world.origin = 'math';
  world.gravity.y = -10;

  ball = new Sprite(0, 100, 30);
  ball.color = 'tomato';
  ball.bounciness = 0.6;

  floor = new Sprite(0, -120, 300, 20, 'static');
  floor.color = 'gray';
}

function draw() {
  background('#222');
  showGrid(50);
  showMouse();
}`,
    },
    {
      id: 'math-mode-more',
      title: "Math mode: what else changes",
      body: `A tile map still reads top to bottom: the first string is the top row, and each row below it has a smaller y. new Walls() still calls the wall above the screen walls.top (its y is the bigger one) and the wall below it walls.bottom. A ground sensor under a player 40 tall is addSensor(0, -21, 26, 4), because down is negative now.

rect(x, y, w, h) covers x to x + w and y to y + h, so from its corner it grows right and UP. text(str, x, y) puts the bottom of the letters on y, and the letters sit above it, still the right way up.

drawTop() and camera.off() still draw in a frame that ignores the camera, but that frame is centred and y-up too: on a 400 by 300 canvas, text('Score', -190, 130) sits near the top-left corner. mouse.x and mouse.y are math numbers as well, so the mouse and the grid always agree.

Drive the player with the arrow keys and watch the camera follow. The grid moves with the world, so its labels always say where the player really is.`,
      code: `let walls, level, player;

function setup() {
  new Canvas(400, 300);
  world.origin = 'math';

  walls = new Group();
  walls.collider = 'static';
  walls.color = 'gray';

  level = new Tiles([
    '#########',
    '#       #',
    '#   #   #',
    '#       #',
    '#########',
  ], -160, 80, 40, 40, { '#': walls });

  player = new Sprite(-80, 0, 24, 24);
  player.color = 'gold';
}

function update() {
  if (kb.pressing('right'))     player.vel.x = 3;
  else if (kb.pressing('left')) player.vel.x = -3;
  else                          player.vel.x = 0;

  if (kb.pressing('up'))        player.vel.y = 3;
  else if (kb.pressing('down')) player.vel.y = -3;
  else                          player.vel.y = 0;

  camera.x = player.x;
  camera.y = player.y;
}

function draw() {
  background('#222');
  showGrid(40);
}

function drawTop() {
  fill('white');
  textSize(14);
  text('x: ' + round(player.x) + '  y: ' + round(player.y), -190, 135);
}`,
    },
  ],
};
