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
      body: `clearStorage() forgets everything stored with storeItem, by this sketch AND by every other sketch on the site, because they share one store. After it, getItem on any name gives null. Saved pictures, sounds and fonts are kept: it only erases saves. For a Reset button, remove just your own names with removeItem('highScore') instead.

loadJSON(path, callback) reads a JSON file and hands the data to your callback when it arrives: loadJSON('level1.json', (data) => { level = data; }). It also returns an object that fills in once the file has loaded. Outside preload() the callback form is the one to rely on, because a file takes a moment to arrive. Inside preload() ("Getting files ready: preload()" in Start here) the game waits for the file, so levels = loadJSON('levels.json') in preload() is filled in by setup(). A file that cannot load says so in the console.`,
    },
  ],
};
