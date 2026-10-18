// Cheap source-level contract for VIDEO-001's public-facing title and act numbering.
// This validates source wiring, NOT a rendered MP4 or visual/audio quality.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const bookends = read('../src/Bookends.tsx');
const act6 = read('../src/Act6OneSeat.tsx');
const act7 = read('../src/Act7Thinking.tsx');
const rail = read('../src/ChapterRail.tsx');
const root = read('../src/Root.tsx');
const timeline = JSON.parse(read('../src/timeline.json'));
const pkg = JSON.parse(read('../package.json'));

assert.match(bookends, /席位之间 · 35,691/, 'epilogue must use the current public title');
assert.doesNotMatch(bookends, /国考宇宙 · 2027/, 'old working title cannot be the current epilogue');
assert.match(act7, /06 · 冷思考/, 'Act 7 in source files is chapter 06 in the film order');
assert.match(act6, /07 · 一个座位/, 'the last act is chapter 07, not chapter 06');
assert.doesNotMatch(act6, /06 · 一个座位/, 'duplicated chapter number regression');

assert.deepEqual(
  timeline.order,
  ['prologue', 'act1', 'act2', 'act3', 'act4', 'act5', 'act7', 'act6', 'epilogue'],
  'the displayed act numbering follows the actual timeline',
);
assert.match(rail, /'冷思考', '一个座位'/, 'chapter navigation must put chapter 06 before chapter 07');

assert.match(root, /id="GuokaoUniverse"/, 'keep the legacy Remotion Composition API stable');
assert.match(pkg.scripts.render, /between_seats_2027\.mp4$/, 'default new export should use the new brand');
console.log('VIDEO-001 branding and chapter numbering: source assertions PASS (render not checked)');
