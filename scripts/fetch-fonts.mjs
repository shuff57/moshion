#!/usr/bin/env node
// The built-in fonts for moSHion's textFont('name'): downloads each font's
// latin WOFF2 files from Google Fonts and its licence from the google/fonts
// repo, and writes fonts/ (the files, LICENSES/, and the catalog fonts.js
// that runner.html loads before moshion.js). Kept in step with shCode's
// scripts/fetch-moshion-fonts.mjs, which writes the same files for the site.
//
// Run once by a maintainer, never by the build: the output is committed, so
// the site serves its own copies and a student's browser never contacts
// Google. Every font here is free to redistribute (SIL OFL 1.1, or Apache 2.0
// for Roboto Slab); the licence travels beside it as the licences require.
//
// Only the latin subset (Basic Latin + Latin-1 + common punctuation) is
// fetched: English text, at a fraction of the size. Variable fonts keep their
// whole weight range, so textWeight(100..900) really changes the letters.
//
// Names in code are the keys of FONTS. They are never renamed once shipped:
// a student's sketch says textFont('rounded').
//
// Run: node scripts/fetch-fonts.mjs

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'fonts');
// Google serves WOFF2 only to a browser that says it reads WOFF2.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// key: name in code. css2: the Google Fonts family query. licence: path in github.com/google/fonts.
const FONTS = {
  sans:        { family: 'Inter',          css2: 'Inter:ital,wght@0,100..900;1,100..900',          licence: 'ofl/inter/OFL.txt',          look: 'clean and plain' },
  serif:       { family: 'Source Serif 4', css2: 'Source+Serif+4:ital,wght@0,200..900;1,200..900', licence: 'ofl/sourceserif4/OFL.txt',   look: 'like a book' },
  code:        { family: 'JetBrains Mono', css2: 'JetBrains+Mono:ital,wght@0,100..800;1,100..800', licence: 'ofl/jetbrainsmono/OFL.txt',  look: 'code, every letter the same width' },
  rounded:     { family: 'Nunito',         css2: 'Nunito:ital,wght@0,200..1000;1,200..1000',       licence: 'ofl/nunito/OFL.txt',         look: 'soft round ends' },
  pixel:       { family: 'Pixelify Sans',  css2: 'Pixelify+Sans:wght@400..700',                    licence: 'ofl/pixelifysans/OFL.txt',   look: 'pixel art' },
  arcade:      { family: 'Press Start 2P', css2: 'Press+Start+2P',                                 licence: 'ofl/pressstart2p/OFL.txt',   look: 'old arcade screens' },
  handwriting: { family: 'Caveat',         css2: 'Caveat:wght@400..700',                           licence: 'ofl/caveat/OFL.txt',         look: 'written with a marker' },
  comic:       { family: 'Comic Neue',     css2: 'Comic+Neue:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700', licence: 'ofl/comicneue/OFL.txt', look: 'comic book' },
  bubbly:      { family: 'Fredoka',        css2: 'Fredoka:wght@300..700',                          licence: 'ofl/fredoka/OFL.txt',        look: 'round and bubbly' },
  space:       { family: 'Orbitron',       css2: 'Orbitron:wght@400..900',                         licence: 'ofl/orbitron/OFL.txt',       look: 'sci-fi' },
  spooky:      { family: 'Creepster',      css2: 'Creepster',                                      licence: 'ofl/creepster/OFL.txt',      look: 'dripping horror' },
  slab:        { family: 'Roboto Slab',    css2: 'Roboto+Slab:wght@100..900',                      licence: 'apache/robotoslab/LICENSE.txt', look: 'thick square feet' },
  blocky:      { family: 'Bungee',         css2: 'Bungee',                                         licence: 'ofl/bungee/OFL.txt',         look: 'big blocky signs' },
  script:      { family: 'Dancing Script', css2: 'Dancing+Script:wght@400..700',                   licence: 'ofl/dancingscript/OFL.txt',  look: 'joined-up handwriting' },
  tall:        { family: 'Oswald',         css2: 'Oswald:wght@200..700',                           licence: 'ofl/oswald/OFL.txt',         look: 'tall and narrow' },
};

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return as === 'bytes' ? new Uint8Array(await res.arrayBuffer()) : res.text();
}

/** The latin @font-face blocks of a css2 answer: [{ style, weight, url }]. */
function latinFaces(css) {
  const out = [];
  const re = /\/\* latin \*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const block = m[1];
    const style = /font-style:\s*(\w+)/.exec(block)?.[1];
    const weight = /font-weight:\s*([\d ]+);/.exec(block)?.[1]?.trim();
    const url = /src:\s*url\(([^)]+\.woff2)\)/.exec(block)?.[1];
    if (!style || !weight || !url) throw new Error('could not read a latin @font-face block');
    out.push({ style, weight, url });
  }
  return out;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(path.join(OUT, 'LICENSES'), { recursive: true });

const catalog = {};
let total = 0;
for (const [name, f] of Object.entries(FONTS)) {
  const css = await get(`https://fonts.googleapis.com/css2?family=${f.css2}&display=swap`);
  const faces = latinFaces(css);
  if (!faces.length) throw new Error(`${name}: no latin faces in the Google Fonts answer`);
  const entry = { family: f.family, look: f.look, faces: [] };
  for (const face of faces) {
    const file = `${name}${face.style === 'italic' ? '-italic' : ''}${face.weight.includes(' ') ? '' : '-' + face.weight}.woff2`;
    const bytes = await get(face.url, 'bytes');
    if (String.fromCharCode(...bytes.slice(0, 4)) !== 'wOF2') throw new Error(`${name}: ${face.url} is not WOFF2`);
    writeFileSync(path.join(OUT, file), bytes);
    total += bytes.length;
    entry.faces.push({ file, weight: face.weight, style: face.style });
  }
  const licence = await get(`https://raw.githubusercontent.com/google/fonts/main/${f.licence}`);
  const licenceFile = `LICENSES/${name}.txt`;
  writeFileSync(path.join(OUT, licenceFile), `${f.family} (moSHion name: '${name}')\nFrom Google Fonts; licence from github.com/google/fonts/${f.licence}\n\n${licence}`);
  entry.licence = f.licence.startsWith('apache/') ? 'Apache-2.0' : 'OFL-1.1';
  entry.licenceFile = licenceFile;
  catalog[name] = entry;
  console.log(`[fonts] ${name.padEnd(12)} ${f.family.padEnd(16)} ${entry.faces.map((x) => `${x.style} ${x.weight}`).join(', ')}`);
}

const js = `/* GENERATED by scripts/fetch-moshion-fonts.mjs -- do not edit.
 * Loaded by runner.html before moshion.js so textFont('name') knows the
 * built-in fonts. Each font's licence is in LICENSES/. */
window.MOSHION_FONTS = ${JSON.stringify({ base: 'fonts/', fonts: catalog }, null, 2)};
`;
writeFileSync(path.join(OUT, 'fonts.js'), js);
console.log(`[fonts] ${Object.keys(catalog).length} fonts, ${(total / 1024).toFixed(0)} KB of WOFF2 -> fonts/`);
