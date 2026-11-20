// moSHion docs: Saving. Built into docs/data/moshion-docs.js by scripts/build-docs.mjs.
// A page's id is its permanent address (#persistence/<id>); never rename one, add a new page instead.

export default {
  slug: 'persistence',
  title: "Saving",
  pages: [
    {
      id: 'saving',
      title: "Saving and loading data",
      body: `moSHion provides three functions for storing data in the browser's localStorage.

storeItem(name, value) saves a value under a key. The value is automatically JSON-stringified, so you can store numbers, strings, arrays, and objects.

getItem(name) retrieves a previously stored value, parsing it back from JSON. Returns null if the key doesn't exist.

removeItem(name) deletes a stored value.

This is how you save high scores, level progress, or player preferences between sessions. Data persists even after the browser is closed.`,
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
      body: `clearStorage() forgets everything your sketch stored with storeItem. After it, getItem on any name gives null. It clears the whole store at once, not just one name, so for a Reset button on a single high score use removeItem('highScore') instead.

loadJSON(path, callback) reads a JSON file and hands the data to your callback when it arrives: loadJSON('level1.json', (data) => { level = data; }). It also returns an object that fills in once the file has loaded. Outside preload() the callback form is the one to rely on, because a file takes a moment to arrive. Inside preload() ("Getting files ready: preload()" in Start here) the game waits for the file, so levels = loadJSON('levels.json') in preload() is filled in by setup(). A file that cannot load says so in the console.`,
    },
  ],
};
