// The order of the moSHion docs. Each file is one section; scripts/build-docs.mjs
// adds the generated API reference after them and writes docs/data/moshion-docs.js.

import s0 from './01-overview.mjs';
import s1 from './02-canvas.mjs';
import s2 from './03-sprite.mjs';
import s3 from './04-animation.mjs';
import s4 from './05-physics.mjs';
import s5 from './06-collisions.mjs';
import s6 from './07-groups.mjs';
import s7 from './08-input.mjs';
import s8 from './09-sound.mjs';
import s9 from './10-text.mjs';
import s10 from './11-camera.mjs';
import s11 from './12-joints.mjs';
import s12 from './13-persistence.mjs';
import s13 from './14-patterns.mjs';
import s14 from './15-coordinates.mjs';

export const sections = [s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14];
