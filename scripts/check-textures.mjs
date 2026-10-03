#!/usr/bin/env node
// Every texture in the manifest must be a real file, and the manifest must
// actually REACH a running sketch.
//
// A texture catalog is a pipeline with a seam at the top: 40 PNGs, a generated
// manifest and a `.texture` setter can all be perfect while runner.html never
// loads the manifest, in which case every name silently warns "no texture
// named ..." and the whole feature is decorative.
//
// So this checks four seams, not just the files:
//
//   1. manifest entry  ->  a PNG that exists, at the declared size
//   2. PNG on disk     ->  an entry in the manifest (no orphans)
//   3. textures.js and textures.json agree
//   4. runner.html loads textures.js BEFORE moshion.js, and moshion.js
//      actually reads window.MOSHION_TEXTURES
//
// It is a tripwire, not a proof: it cannot tell a correct crop from a wrong
// one. `make-textures.py` covers that end by refusing to write a
// fully transparent tile, which is what an off-by-one index produces.
//
// Run:  node scripts/check-textures.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

const DIR = 'textures';
const RUNNER = 'runner.html';
const ENGINE = 'moshion.js';

const fail = [];
const note = (m) => fail.push(m);

// ---- the manifest exists at all ------------------------------------------

if (!existsSync(path.join(root, DIR, 'textures.json'))) {
  console.error(`\nFAIL  ${DIR}/textures.json is missing.`);
  console.error('      Run: python scripts/make-textures.py\n');
  process.exit(1);
}

const manifest = JSON.parse(read(`${DIR}/textures.json`));
const names = Object.keys(manifest.textures || {});

// A census that found nothing is a census that is not looking.
if (names.length < 10) {
  console.error(`\nFAIL  only ${names.length} textures in the manifest -- expected the full catalog.`);
  process.exit(1);
}

// ---- 1. every manifest entry has a real PNG ------------------------------

// PNG header: 8-byte signature, then IHDR with width/height as big-endian
// uint32 at offsets 16 and 20. Reading it here rather than trusting the
// manifest's own w/h, because the manifest is generated from the same table
// that names the files -- it would happily agree with itself.
function pngSize(file) {
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

for (const name of names) {
  const entry = manifest.textures[name];
  const file = path.join(root, DIR, entry.file);
  if (!existsSync(file)) {
    note(`manifest lists "${name}" but ${entry.file} does not exist`);
    continue;
  }
  const size = pngSize(file);
  if (!size) {
    note(`${entry.file} is not a PNG`);
  } else if (size.w !== entry.w || size.h !== entry.h) {
    note(`${entry.file} is ${size.w}x${size.h}, manifest says ${entry.w}x${entry.h}`);
  }
}

// ---- 2. no orphan PNGs ---------------------------------------------------

const onDisk = readdirSync(path.join(root, DIR)).filter((f) => f.endsWith('.png'));
for (const file of onDisk) {
  if (!names.some((n) => manifest.textures[n].file === file)) {
    note(`${file} is on disk but not in the manifest -- a sketch cannot name it`);
  }
}

// ---- 3. the two manifest shapes agree ------------------------------------

const jsText = read(`${DIR}/textures.js`);
const jsBody = jsText.match(/window\.MOSHION_TEXTURES\s*=\s*([\s\S]*);\s*$/m);
if (!jsBody) {
  note('textures.js does not assign window.MOSHION_TEXTURES');
} else {
  let parsed = null;
  try { parsed = JSON.parse(jsBody[1]); } catch { /* reported below */ }
  if (!parsed) {
    note('textures.js payload is not valid JSON');
  } else if (JSON.stringify(parsed) !== JSON.stringify(manifest)) {
    note('textures.js and textures.json disagree -- re-run make-textures.py');
  }
}

// ---- 4. the seams: does any of this reach a sketch? ----------------------

const runner = read(RUNNER);
const iTex = runner.indexOf('textures/textures.js');
const iEngine = runner.indexOf('moshion.js"');
if (iTex === -1) {
  note(`${RUNNER} never loads textures/textures.js -- every .texture name would warn and draw nothing`);
} else if (iEngine !== -1 && iTex > iEngine) {
  note(`${RUNNER} loads textures.js AFTER moshion.js; the catalog must exist before a sketch runs`);
}

// Comments are not code. A why-comment naming the global would otherwise
// count as reading it -- the exact false pass this file exists to catch.
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const engine = stripComments(read(ENGINE));
if (!/MOSHION_TEXTURES/.test(engine)) {
  note(`${ENGINE} never reads window.MOSHION_TEXTURES outside comments`);
}
for (const sym of ['textureNames', 'hasTexture', 'saveTexture', 'deleteTexture']) {
  if (!new RegExp(`global\\.${sym}\\s*=`).test(engine)) {
    note(`${ENGINE} defines ${sym} but never exposes it as a global`);
  }
}

// ---- report --------------------------------------------------------------

if (fail.length) {
  console.error(`\nFAIL  ${fail.length} problem${fail.length === 1 ? '' : 's'} in the moSHion texture catalog:\n`);
  for (const m of fail) console.error(`  - ${m}`);
  console.error('');
  process.exit(1);
}

const groups = Object.entries(manifest.groups || {})
  .map(([g, list]) => `${g} ${list.length}`)
  .join(', ');
console.log(`moshion textures: ${names.length} named textures (${groups}) -- manifest, files and both load seams agree`);
