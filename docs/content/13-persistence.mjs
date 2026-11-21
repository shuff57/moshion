// moSHion docs: Saving. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#persistence/<id>); never rename one, add a new page instead.

export default {
  slug: 'persistence',
  title: "Saving",
  pages: [
    {
      id: 'saving',
      title: "Saving and loading data",
      body: `moSHion has three functions for keeping data in the browser, so it is still there the next time the game runs.

storeItem(name, value) saves a value under a name. Numbers, words, true/false, lists and objects all work.

getItem(name) gives back what was saved under that name, as the same kind of value. It gives null if nothing was saved under it.

removeItem(name) deletes a stored value.

This is how you save high scores, level progress, or player preferences between sessions. Data persists even after the browser is closed.

Every sketch on the same site shares ONE store, so a save called 'highScore' in your pong game and one in your maze game are the same save. Give your names a short prefix for the game, like storeItem('maze.highScore', 120), when two of your games should keep their own.

The example below follows its own advice. Its save is called 'demo.highScore', a name no real game of yours uses, so pressing r erases only the demo's save and never another game's. Press space to score, close and run it again, and the high score is still there.`,
      code: `let highScore = 0;
let score = 0;

function setup() {
  new Canvas(400, 400);
  highScore = getItem('demo.highScore');
  if (highScore === null) {
    highScore = 0;
  }
}

function update() {
  if (kb.presses(' ')) {
    score++;
    if (score > highScore) {
      highScore = score;
      storeItem('demo.highScore', highScore);
    }
  }
  if (kb.presses('r')) {
    score = 0;
    removeItem('demo.highScore');
    highScore = 0;
  }
}

function draw() {
  background('#222');
  fill('white');
  textSize(18);
  text('Score: ' + score, 14, 30);
  fill('gold');
  text('High: ' + highScore, 14, 54);
  fill('#888');
  textSize(12);
  text('space=score  r=reset', 14, 76);
}`,
    },
    {
      id: 'clear-load-json',
      title: "Erasing and loading files: clearStorage and loadJSON",
      body: `clearStorage() forgets everything stored with storeItem, by this sketch AND by every other sketch on the site, because they share one store. After it, getItem on any name you saved gives null. Saved pictures, sounds and fonts are kept: it only erases saves. For a Reset button, remove just your own names with removeItem('maze.highScore') instead.

loadJSON(path, callback) reads a JSON file and hands the data to your callback when it arrives: loadJSON('level1.json', (data) => { level = data; }). It also returns an object that fills in once the file has loaded. Outside preload() the callback form is the one to rely on, because a file takes a moment to arrive. Inside preload() ("Getting files ready: preload()" in Start here) the game waits for the file, so levels = loadJSON('levels.json') in preload() is filled in by setup(). A file that cannot load says so in the console.

The example below loads a small piece of JSON with loadJSON and shows what came back. Until the file arrives the screen says loading, and then the callback fills in the title, the start level and the number of lives. To keep the example in one piece, the "file" is the JSON text itself, written after data:application/json, in the address. A real game would give the path of a .json file instead, like 'level1.json'. (Saving a value with storeItem is on the page "Saving and loading data".)`,
      code: `let info = { title: 'loading...', level: 0, lives: 0 };
let status = 'waiting for the file';

function setup() {
  new Canvas(400, 200);

  // the JSON text, written out in one piece
  const jsonText = '{"title": "Cave Run", "level": 5, "lives": 3}';

  // loadJSON runs the callback once the data has arrived
  loadJSON('data:application/json,' + jsonText, (data) => {
    info = data;
    status = 'the file has loaded';
  });
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(18);
  text('Title: ' + info.title, 14, 40);
  text('Start level: ' + info.level, 14, 70);
  text('Lives: ' + info.lives, 14, 100);
  fill('#888');
  textSize(12);
  text(status, 14, 150);
}`,
    },
    {
      id: 'saved-textures',
      title: "Saving your own pictures: saveTexture and deleteTexture",
      body: `saveTexture(name, dataUrl) keeps a small picture in the browser under a name, and from then on sprite.texture = name finds it. A data URL is a picture written out as text, starting with data:image/png. hasTexture(name) says whether a name exists right now, and deleteTexture(name) forgets one you saved. Built-in names cannot be deleted.

The example first asks hasTexture('docsDemoSquares') whether that name is free. If it is, it saves a tiny four-colour picture under it and shows it on a sprite. After about a second it deletes the picture again and removes the sprite, so running it leaves nothing behind. hasTexture() is false before the save and true after it, then false again once deleteTexture() has run.

If the name is already taken, the example saves nothing and deletes nothing. It only says so on the screen. That is the rule for any demo: delete only a name you made yourself, because deleteTexture() cannot tell your demo's picture from a real one. Pick an odd name like this one. A saved name beats a built-in one, so saving 'coin' would replace the real coin.`,
      code: `let art;
let artName = 'docsDemoSquares';
let before;
let during = 'not saved';
let after = 'not deleted yet';

function setup() {
  new Canvas(400, 200);
  world.gravity.y = 0;

  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGO4o6GhseAOw68TcjYnogApvAYPvPI98QAAAABJRU5ErkJggg==';

  // only touch the name if nobody has used it yet
  before = hasTexture(artName);
  if (before === false) {
    saveTexture(artName, dataUrl);
    during = hasTexture(artName);

    art = new Sprite(200, 70, 80, 80);
    art.collider = 'none';
    art.texture = artName;
  }
}

function update() {
  // after about a second, clean up so nothing is left in your library
  // (only when this demo made the picture itself)
  if (frameCount === 55 && before === false) {
    art.remove();
    deleteTexture(artName);
    after = hasTexture(artName);
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(13);
  if (before === true) {
    text('The name ' + artName + ' is already taken.', 14, 150);
    text('So this demo saves and deletes nothing.', 14, 170);
  } else {
    text('before saving: ' + before, 14, 150);
    text('after saving: ' + during, 14, 170);
    text('after deleteTexture: ' + after, 14, 190);
  }
}`,
    },
    {
      id: 'smooth-textures',
      title: "Soft pictures: the smooth option",
      body: `Pixel art stays crisp when it is scaled up: every little square turns into a bigger square. Art drawn with curves looks wrong that way. saveTexture(name, dataUrl, { smooth: true }) keeps the picture soft when it is scaled, the way an ordinary image is.

The option belongs to the saved name, so every sprite that uses that name draws it softly, and so does a clone.

The example saves the same four-square picture twice: once as it is, once with smooth: true. Both are drawn 120 pixels wide. The left one is hard-edged squares, the right one blends from one colour into the next. It deletes both again after about a second, but only the names it saved itself.`,
      code: `let crisp;
let soft;
let crispName = 'docsDemoCrisp';
let softName = 'docsDemoSoft';
let madeCrisp = false;
let madeSoft = false;

function setup() {
  new Canvas(400, 200);
  world.gravity.y = 0;

  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGO4o6GhseAOw68TcjYnogApvAYPvPI98QAAAABJRU5ErkJggg==';

  if (hasTexture(crispName) === false) {
    saveTexture(crispName, dataUrl);
    madeCrisp = true;
    crisp = new Sprite(110, 100, 120, 120);
    crisp.collider = 'none';
    crisp.texture = crispName;
  }
  if (hasTexture(softName) === false) {
    saveTexture(softName, dataUrl, { smooth: true });
    madeSoft = true;
    soft = new Sprite(290, 100, 120, 120);
    soft.collider = 'none';
    soft.texture = softName;
  }
}

function update() {
  if (frameCount === 55) {
    if (madeCrisp === true) {
      crisp.remove();
      deleteTexture(crispName);
    }
    if (madeSoft === true) {
      soft.remove();
      deleteTexture(softName);
    }
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(13);
  text('as it is', 70, 28);
  text('smooth: true', 240, 28);
}`,
    },
  ],
};
