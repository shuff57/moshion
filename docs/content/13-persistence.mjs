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

Every sketch on the same site shares ONE store, so a save called 'highScore' in your pong game and one in your maze game are the same save. Give your names a short prefix for the game, like storeItem('maze.highScore', 120), when two of your games should keep their own.`,
      code: `let highScore = 0;
let score = 0;

function setup() {
  new Canvas(400, 400);
  highScore = getItem('highScore') || 0;
}

function update() {
  if (kb.presses(' ')) {
    score++;
    if (score > highScore) {
      highScore = score;
      storeItem('highScore', highScore);
    }
  }
  if (kb.presses('r')) {
    score = 0;
    removeItem('highScore');
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
      body: `clearStorage() forgets everything stored with storeItem, by this sketch AND by every other sketch on the site, because they share one store. After it, getItem on any name you saved gives null. Saved pictures, sounds and fonts are kept: it only erases saves. For a Reset button, remove just your own names with removeItem('highScore') instead.

loadJSON(path, callback) reads a JSON file and hands the data to your callback when it arrives: loadJSON('level1.json', (data) => { level = data; }). It also returns an object that fills in once the file has loaded. Outside preload() the callback form is the one to rely on, because a file takes a moment to arrive. Inside preload() ("Getting files ready: preload()" in Start here) the game waits for the file, so levels = loadJSON('levels.json') in preload() is filled in by setup(). A file that cannot load says so in the console.

The example below loads a small JSON text with loadJSON and keeps one save with storeItem. Press space to count up, and press r to erase just that one save with removeItem, which leaves every other save alone. (To keep the example in one piece, the "file" is a short piece of JSON written inside the address. A real game would give the path of a .json file instead.)`,
      code: `let info = { title: 'loading...', start: 0 };
let clicks = 0;

function setup() {
  new Canvas(400, 200);

  // the JSON text is written inside the address, instead of a file path
  const json = encodeURIComponent(JSON.stringify({ title: 'Cave Run', start: 5 }));
  loadJSON('data:application/json,' + json, (data) => {
    info = data;
    clicks = getItem('demoClicks');
    if (clicks === null) {
      clicks = info.start;
    }
  });
}

function update() {
  if (kb.presses(' ')) {
    clicks++;
    storeItem('demoClicks', clicks);
  }
  if (kb.presses('r')) {
    removeItem('demoClicks');
    clicks = info.start;
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(18);
  text('Level file: ' + info.title, 14, 40);
  text('Clicks: ' + clicks, 14, 70);
  fill('#888');
  textSize(12);
  text('space = count    r = erase this save', 14, 110);
}`,
    },
    {
      id: 'saved-textures',
      title: "Saving your own pictures: saveTexture and deleteTexture",
      body: `saveTexture(name, dataUrl) keeps a small picture in the browser under a name, and from then on sprite.texture = name finds it. A data URL is a picture written out as text, starting with data:image/png. hasTexture(name) says whether a name exists right now, and deleteTexture(name) forgets one you saved. Built-in names cannot be deleted.

The example saves a tiny four-colour picture as 'demoSquares' and shows it on a sprite. After about a second it deletes the picture again and removes the sprite, so running it leaves nothing behind. hasTexture() is false before the save and true after it, then false again once deleteTexture() has run. Pick an odd name like this for a demo: a saved name beats a built-in one, so saving 'coin' would replace the real coin.`,
      code: `let art;
let before;
let during;
let after = 'waiting...';

function setup() {
  new Canvas(400, 200);
  world.gravity.y = 0;

  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGO4o6GhseAOw68TcjYnogApvAYPvPI98QAAAABJRU5ErkJggg==';

  before = hasTexture('demoSquares');
  saveTexture('demoSquares', dataUrl);
  during = hasTexture('demoSquares');

  art = new Sprite(200, 70, 80, 80);
  art.collider = 'none';
  art.texture = 'demoSquares';
}

function update() {
  // after about a second, clean up so nothing is left in your library
  if (frameCount === 55) {
    art.remove();
    deleteTexture('demoSquares');
    after = hasTexture('demoSquares');
  }
}

function draw() {
  background('#222');
}

function drawTop() {
  fill('white');
  textSize(13);
  text('before saving: ' + before, 14, 150);
  text('after saving: ' + during, 14, 170);
  text('after deleteTexture: ' + after, 14, 190);
}`,
    },
  ],
};
