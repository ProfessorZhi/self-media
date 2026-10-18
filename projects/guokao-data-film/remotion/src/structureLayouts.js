// Layouts for the structure chapter: particle sunburst -> treemap -> tax zoom.
// Pure functions of the film data; every seat keeps its identity.
import {hash01} from './seatModel.js';

export const CENTER = [960, 590];
const R0 = 196;
const R1 = 416;
const ROWS = 40;
const LEVEL_GAP_COLS = 10;

/** Short display name for a tax bureau: 国家税务总局云南省税务局 -> 云南 */
export const bureauShort = name =>
  name.replace(/^国家税务总局/, '').replace(/税务局$/, '').replace(/(省|市|自治区|壮族自治区|回族自治区|维吾尔自治区|特别行政区)$/, '') || '总局';

/** Squarified treemap. items: [{value}], sorted desc. Returns [{x,y,w,h}] in item order. */
export function squarify(items, rect) {
  const out = new Array(items.length);
  const total = items.reduce((t, it) => t + it.value, 0);
  const scale = (rect.w * rect.h) / total;
  let {x, y, w, h} = rect;
  let i = 0;
  while (i < items.length) {
    const side = Math.min(w, h);
    const row = [];
    let rowSum = 0;
    let best = Infinity;
    while (i + row.length < items.length) {
      const v = items[i + row.length].value * scale;
      const sum = rowSum + v;
      const max = Math.max(v, ...row);
      const min = Math.min(v, ...row);
      const worst = Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
      if (worst > best) break;
      best = worst;
      row.push(v);
      rowSum = sum;
    }
    const thick = rowSum / side;
    let offset = 0;
    row.forEach((v, k) => {
      const len = v / thick;
      out[i + k] = w >= h ? {x, y: y + offset, w: thick, h: len} : {x: x + offset, y, w: len, h: thick};
      offset += len;
    });
    if (w >= h) {
      x += thick;
      w -= thick;
    } else {
      y += thick;
      h -= thick;
    }
    i += row.length;
  }
  return out;
}

/** Fill a rectangle with n seats on an even grid (row-major), inset for breathing room. */
function fillRect(xy, seatsInRect, r, inset) {
  const x = r.x + inset;
  const y = r.y + inset;
  const w = Math.max(1, r.w - inset * 2);
  const h = Math.max(1, r.h - inset * 2);
  const n = seatsInRect.length;
  // Pick the column count that wastes the fewest cells while keeping cells near-square.
  const ideal = Math.sqrt((n * w) / h);
  let cols = 1;
  let best = Infinity;
  for (let c = Math.max(1, Math.floor(ideal * 0.75)); c <= Math.ceil(ideal * 1.3); c++) {
    const r = Math.ceil(n / c);
    const cost = (c * r - n) / n + Math.abs(Math.log(w / c / (h / r))) * 0.35;
    if (cost < best) {
      best = cost;
      cols = c;
    }
  }
  const rows = Math.ceil(n / cols);
  const lastStart = (rows - 1) * cols;
  const lastShift = (cols - (n - lastStart)) / 2; // centre the final row
  seatsInRect.forEach((s, k) => {
    const c = (k % cols) + (k >= lastStart ? lastShift : 0);
    const rr = Math.floor(k / cols);
    xy[s * 2] = x + ((c + 0.5) * w) / cols;
    xy[s * 2 + 1] = y + ((rr + 0.5) * h) / rows;
  });
}

export function buildStructure(data, seats) {
  const P = data.positions; // [deptIdx, levelIdx, hires, isTax]
  const deptSeats = new Map();
  for (const r of P) deptSeats.set(r[0], (deptSeats.get(r[0]) ?? 0) + r[2]);

  // ---- Sunburst: angle ordered by level (中央 at 12 o'clock, clockwise), then dept size, then source order
  const seatPos = seats.position;
  const order = Array.from({length: seats.count}, (_, i) => i).sort((a, b) => {
    const A = P[seatPos[a]];
    const B = P[seatPos[b]];
    return A[1] - B[1] || deptSeats.get(B[0]) - deptSeats.get(A[0]) || A[0] - B[0] || a - b;
  });
  const levelCount = data.levels.map(() => 0);
  for (const r of P) levelCount[r[1]] += r[2];
  const cols = Math.ceil(seats.count / ROWS) + LEVEL_GAP_COLS * data.levels.length;
  const polar = new Float32Array(seats.count * 2); // [theta, radius]
  const levelArcs = [];
  let col = LEVEL_GAP_COLS / 2;
  let n = 0;
  data.levels.forEach((name, li) => {
    const startCol = col;
    for (let k = 0; k < levelCount[li]; k++, n++) {
      const s = order[n];
      const c = col + Math.floor(k / ROWS);
      const row = k % ROWS;
      polar[s * 2] = ((c + 0.5) / cols) * Math.PI * 2;
      polar[s * 2 + 1] = R0 + ((row + 0.5) * (R1 - R0)) / ROWS + (hash01(s, 11) - 0.5) * 1.2;
    }
    col += Math.ceil(levelCount[li] / ROWS);
    levelArcs.push({name, seats: levelCount[li], a0: (startCol / cols) * Math.PI * 2, a1: (col / cols) * Math.PI * 2});
    col += LEVEL_GAP_COLS;
  });

  // ---- Treemap: root = [税务 group] + 551 other departments; tax group subdivided into 38 bureaus
  const W = 1700;
  const H = 800;
  const area = {x: (1920 - W) / 2, y: 200, w: W, h: H};
  const deptTax = new Map(P.map(r => [r[0], r[3] === 1]));
  const depts = [...deptSeats.entries()].map(([d, v]) => ({d, value: v, tax: deptTax.get(d)}));
  const taxDepts = depts.filter(x => x.tax).sort((a, b) => b.value - a.value);
  const others = depts.filter(x => !x.tax).sort((a, b) => b.value - a.value);
  const taxTotal = taxDepts.reduce((t, x) => t + x.value, 0);
  const top = [{value: taxTotal, group: 'tax'}, ...others].sort((a, b) => b.value - a.value);
  const topRects = squarify(top, area);
  const rectOf = new Map();
  let taxRect = area; // replaced by the tax group rect below
  top.forEach((it, k) => {
    if (it.group === 'tax') taxRect = topRects[k];
    else rectOf.set(it.d, topRects[k]);
  });
  const PAD = 3;
  const inner = {x: taxRect.x + PAD, y: taxRect.y + PAD, w: taxRect.w - PAD * 2, h: taxRect.h - PAD * 2};
  squarify(taxDepts, inner).forEach((r, k) => rectOf.set(taxDepts[k].d, r));

  const bySeatDept = new Map();
  for (let s = 0; s < seats.count; s++) {
    const d = P[seatPos[s]][0];
    if (!bySeatDept.has(d)) bySeatDept.set(d, []);
    bySeatDept.get(d).push(s);
  }
  const treemap = new Float32Array(seats.count * 2);
  for (const [d, list] of bySeatDept) {
    const r = rectOf.get(d);
    const inset = Math.min(1.5, r.w / 6, r.h / 6);
    fillRect(treemap, list, r, inset);
  }

  const name = d => data.departments[d][1];
  return {
    polar,
    levelArcs,
    treemap,
    taxRect,
    rects: [...rectOf.entries()].map(([d, r]) => ({d, name: name(d), value: deptSeats.get(d), tax: taxDepts.some(t => t.d === d), ...r})),
    pitch: Math.sqrt((W * H) / seats.count),
    radii: [R0, R1],
    deptCount: depts.length,
    concentration: {top10: others.slice(0, 10)},
  };
}
