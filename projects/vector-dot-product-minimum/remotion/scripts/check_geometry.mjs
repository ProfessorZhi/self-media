// Verifies the geometry the shot draws: every D shown satisfies ∠ADC = 120°, lies on the
// opposite side of AC from B, and the live readout 2·x_D never reaches the withheld answer -2.
// Also checks the equality configuration and that every beat sits inside the shot.
import {readFileSync} from 'node:fs';
import {A, C, angleADCdeg, dOnArc, dotADAB} from '../src/lib/geometry.js';

const cfg = JSON.parse(readFileSync(new URL('../src/beats.json', import.meta.url)));
const timing = JSON.parse(readFileSync(new URL('../src/timing.json', import.meta.url)));
let fail = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) fail++;
};

const [d0, d1] = cfg.sweepDeg;
let worst = 0;
let minVal = Infinity;
for (let i = 0; i <= 1000; i++) {
  const D = dOnArc(d0 + ((d1 - d0) * i) / 1000);
  worst = Math.max(worst, Math.abs(angleADCdeg(D) - 120));
  minVal = Math.min(minVal, dotADAB(D));
  if (D.x >= 0) ok(false, `D on B side at sample ${i}`);
}
ok(worst < 1e-9, `∠ADC = 120° along the sweep (max error ${worst.toExponential(2)}°)`);
ok(minVal > -2 + 0.05, `readout stays above -2 (min shown ${minVal.toFixed(3)})`);

const Dstar = dOnArc(180);
ok(Math.abs(Dstar.x + 1) < 1e-12 && Math.abs(Dstar.y - Math.sqrt(3)) < 1e-12, 'leftmost point is (-1, √3)');
ok(Math.abs(dotADAB(Dstar) + 2) < 1e-12, 'AD·AB = -2 at the equality point');
ok(Math.abs(angleADCdeg(Dstar) - 120) < 1e-9, '∠ADC = 120° at the equality point');
ok(Math.hypot(C.x - A.x, C.y - A.y) - 2 * Math.sqrt(3) < 1e-12, 'AC = 2√3');

const lines = Object.fromEntries(timing.lines.map((l) => [l.id, l]));
const shotDur = timing.duration + cfg.shotTail;
for (const [name, b] of Object.entries(cfg.beats)) {
  const line = lines[b.ref];
  const t0 = line ? line[b.edge] + b.off : NaN;
  ok(line && t0 >= 0 && t0 + b.dur <= shotDur, `beat ${name} inside shot (${t0.toFixed(2)}–${(t0 + b.dur).toFixed(2)}s)`);
}
process.exit(fail ? 1 : 0);
