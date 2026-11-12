// Verifies the mathematics the film draws and the integrity of the timeline:
// - every D shown on the legal arc satisfies ∠ADC = 120° and sits on the far side of AC;
// - the trig parametrisation agrees with the arc, and 2 − 4cos(2θ − 60°) = −8 sinθ sin(60° − θ) = AD·AB;
// - the equality configuration gives −2; the shot-01 readout never reveals −2;
// - every beat in src/beats/*.json is anchored to an existing line and lies inside its shot.
import {readFileSync, readdirSync} from 'node:fs';
import {A, C, O, R, angleADCdeg, dFromTheta, dOnArc, dotADAB, trigDot} from '../src/lib/geometry.js';

const timing = JSON.parse(readFileSync(new URL('../src/timing.json', import.meta.url)));
let fail = 0;
const ok = (cond, msg) => {
  if (!cond || process.env.VERBOSE) console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) fail++;
};

let worst = 0;
for (let i = 1; i < 2000; i++) {
  const deg = 120 + (120 * i) / 2000;
  const D = dOnArc(deg);
  worst = Math.max(worst, Math.abs(angleADCdeg(D) - 120));
  ok(D.x < 0, `D far side of AC at ${deg.toFixed(2)}°`);
  ok(dotADAB(D) >= -2 - 1e-12, `AD·AB ≥ -2 at ${deg.toFixed(2)}°`);
}
console.log(`PASS  ∠ADC = 120° on the whole legal arc (max error ${worst.toExponential(2)}°)`);
if (worst > 1e-9) fail++;

let tw = 0;
for (let i = 1; i < 600; i++) {
  const th = (60 * i) / 600;
  const D = dFromTheta(th);
  tw = Math.max(tw, Math.abs(Math.hypot(D.x - O.x, D.y - O.y) - R), Math.abs(dotADAB(D) - trigDot(th)));
  const r = (th * Math.PI) / 180;
  tw = Math.max(tw, Math.abs(trigDot(th) + 8 * Math.sin(r) * Math.sin(Math.PI / 3 - r)));
}
console.log(`PASS  trig parametrisation on the circle and identities hold (max error ${tw.toExponential(2)})`);
if (tw > 1e-9) fail++;

const Ds = dOnArc(180);
ok(Math.abs(Ds.x + 1) < 1e-12 && Math.abs(Ds.y - Math.sqrt(3)) < 1e-12, 'equality point is (-1, √3)');
ok(Math.abs(dotADAB(Ds) + 2) < 1e-12 && Math.abs(trigDot(30) + 2) < 1e-12, 'minimum value -2 (θ = 30°)');
ok(Math.abs(Math.hypot(Ds.x - A.x, Ds.y - A.y) - 2) < 1e-12 && Math.abs(Math.hypot(Ds.x - C.x, Ds.y - C.y) - 2) < 1e-12, 'a = b = 2 at equality');
ok(dotADAB(dOnArc(195)) > -2 + 0.05, 'shot 01 readout withholds the answer');
console.log('PASS  equality point, minimum and shot-01 withholding checked');

const lines = Object.fromEntries(timing.segments.flatMap((s) => (s.lines ?? []).map((l) => [l.id, {...l, seg: s}])));
let nb = 0;
for (const file of readdirSync(new URL('../src/beats/', import.meta.url))) {
  const id = file.replace('.json', '');
  const seg = timing.segments.find((s) => s.id === id);
  ok(!!seg, `beats file ${file} has a segment`);
  const beats = JSON.parse(readFileSync(new URL(`../src/beats/${file}`, import.meta.url)));
  for (const [name, b] of Object.entries(beats)) {
    const l = lines[b.ref];
    ok(l && l.seg.id === id, `${id}.${name} anchored to a line of its own shot`);
    if (!l) continue;
    const t0 = l[b.edge] + b.off;
    ok(t0 >= seg.start && t0 + b.dur <= seg.end, `${id}.${name} inside its shot`);
    nb++;
  }
}
console.log(`PASS  ${nb} beats anchored inside their shots`);
process.exit(fail ? 1 : 0);
