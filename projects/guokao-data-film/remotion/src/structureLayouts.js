// Layouts for Act II "谁在招": particle sunburst -> system treemap -> system tour -> Pareto.
// Pure functions of the film data; every seat keeps its identity.
import {hash01} from './seatModel.js';

export const CENTER = [960, 590];
const R0 = 196;
const R1 = 416;
const ROWS = 40;
const LEVEL_GAP_COLS = 10;

/** Short display names inside a system. */
export function shortName(name) {
  return name
    .replace(/^国家金融监督管理总局(.+)监管局$/, '$1监管局')
    .replace(/^中国证券监督管理委员会(.+)监管局$/, '证监会$1局')
    .replace(/^中国人民银行(.+)分行$/, '人行$1分行')
    .replace(/^(.+)出入境边防检查总站$/, '$1边检总站')
    .replace(/^国家税务总局(.+)税务局$/, '$1')
    .replace(/^国家统计局(.+)调查总队$/, '$1调查总队')
    .replace(/^国家矿山安全监察局(.+)局$/, '矿山安监$1局');
}

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

/** Fill a rectangle with seats on a near-square grid; centre the last row. */
function fillRect(xy, list, r, inset) {
  const x = r.x + inset;
  const y = r.y + inset;
  const w = Math.max(1, r.w - inset * 2);
  const h = Math.max(1, r.h - inset * 2);
  const n = list.length;
  const ideal = Math.sqrt((n * w) / h);
  let cols = 1;
  let best = Infinity;
  for (let c = Math.max(1, Math.floor(ideal * 0.75)); c <= Math.ceil(ideal * 1.3); c++) {
    const rr = Math.ceil(n / c);
    const cost = (c * rr - n) / n + Math.abs(Math.log(w / c / (h / rr))) * 0.35;
    if (cost < best) {
      best = cost;
      cols = c;
    }
  }
  const rows = Math.ceil(n / cols);
  const lastStart = (rows - 1) * cols;
  const lastShift = (cols - (n - lastStart)) / 2;
  list.forEach((s, k) => {
    const c = (k % cols) + (k >= lastStart ? lastShift : 0);
    xy[s * 2] = x + ((c + 0.5) * w) / cols;
    xy[s * 2 + 1] = y + ((Math.floor(k / cols) + 0.5) * h) / rows;
  });
}

export function buildStructure(data, seats) {
  const P = data.positions; // [deptIdx, levelIdx, hires, isTax, familyIdx]
  const seatPos = seats.position;
  const deptSeats = new Map();
  const deptFamily = new Map();
  for (const r of P) {
    deptSeats.set(r[0], (deptSeats.get(r[0]) ?? 0) + r[2]);
    deptFamily.set(r[0], r[4]);
  }
  const family = new Uint8Array(seats.count);
  for (let s = 0; s < seats.count; s++) family[s] = P[seatPos[s]][4];

  // ---- Sunburst: angle by level (中央 at 12 o'clock), then system, then department size
  const order = Array.from({length: seats.count}, (_, i) => i).sort((a, b) => {
    const A = P[seatPos[a]];
    const B = P[seatPos[b]];
    return A[1] - B[1] || A[4] - B[4] || deptSeats.get(B[0]) - deptSeats.get(A[0]) || A[0] - B[0] || a - b;
  });
  const levelCount = data.levels.map(() => 0);
  for (const r of P) levelCount[r[1]] += r[2];
  const cols = Math.ceil(seats.count / ROWS) + LEVEL_GAP_COLS * data.levels.length;
  const polar = new Float32Array(seats.count * 2);
  const levelArcs = [];
  let col = LEVEL_GAP_COLS / 2;
  let n = 0;
  data.levels.forEach((name, li) => {
    const startCol = col;
    for (let k = 0; k < levelCount[li]; k++, n++) {
      const s = order[n];
      polar[s * 2] = ((col + Math.floor(k / ROWS) + 0.5) / cols) * Math.PI * 2;
      polar[s * 2 + 1] = R0 + (((k % ROWS) + 0.5) * (R1 - R0)) / ROWS + (hash01(s, 11) - 0.5) * 1.2;
    }
    col += Math.ceil(levelCount[li] / ROWS);
    levelArcs.push({name, seats: levelCount[li], a0: (startCol / cols) * Math.PI * 2, a1: (col / cols) * Math.PI * 2});
    col += LEVEL_GAP_COLS;
  });

  // ---- Treemap: systems first, then departments inside each system
  const W = 1700;
  const H = 780;
  const area = {x: (1920 - W) / 2, y: 210, w: W, h: H};
  const fams = data.families.map((f, fi) => ({fi, value: f.seats})).sort((a, b) => b.value - a.value);
  const famRects = new Array(data.families.length);
  squarify(fams, area).forEach((r, k) => (famRects[fams[k].fi] = r));
  const rectOf = new Map();
  const GAP = 3;
  data.families.forEach((_, fi) => {
    const fr = famRects[fi];
    const inner = {x: fr.x + GAP, y: fr.y + GAP, w: fr.w - GAP * 2, h: fr.h - GAP * 2};
    const ds = [...deptSeats.entries()].filter(([d]) => deptFamily.get(d) === fi).map(([d, value]) => ({d, value})).sort((a, b) => b.value - a.value || a.d - b.d);
    squarify(ds, inner).forEach((r, k) => rectOf.set(ds[k].d, r));
  });
  const bySeatDept = new Map();
  for (let s = 0; s < seats.count; s++) {
    const d = P[seatPos[s]][0];
    if (!bySeatDept.has(d)) bySeatDept.set(d, []);
    bySeatDept.get(d).push(s);
  }
  const treemap = new Float32Array(seats.count * 2);
  for (const [d, list] of bySeatDept) {
    const r = rectOf.get(d);
    fillRect(treemap, list, r, Math.min(1.2, r.w / 6, r.h / 6));
  }

  // ---- Pareto: departments ranked by seats; each seat sits on the cumulative-share curve
  const ranked = [...deptSeats.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const plot = {x: 200, y: 250, w: 1540, h: 640};
  const rankOf = new Map(ranked.map(([d], i) => [d, i]));
  const cumBefore = new Map();
  let acc = 0;
  for (const [d, v] of ranked) {
    cumBefore.set(d, acc);
    acc += v;
  }
  const pareto = new Float32Array(seats.count * 2);
  for (const [d, list] of bySeatDept) {
    const rank = rankOf.get(d);
    const x0 = plot.x + (rank / ranked.length) * plot.w;
    const dw = plot.w / ranked.length;
    list.forEach((s, k) => {
      const share = (cumBefore.get(d) + k + 0.5) / seats.count;
      pareto[s * 2] = x0 + dw * (0.15 + 0.7 * hash01(s, 5));
      pareto[s * 2 + 1] = plot.y + plot.h - share * plot.h + (hash01(s, 6) - 0.5) * 9;
    });
  }

  // cumulative curve vertices for the area fill
  const curve = [[plot.x, plot.y + plot.h]];
  acc = 0;
  ranked.forEach(([, v], i) => {
    acc += v;
    curve.push([plot.x + ((i + 1) / ranked.length) * plot.w, plot.y + plot.h - (acc / seats.count) * plot.h]);
  });

  return {
    curve,
    family,
    polar,
    levelArcs,
    treemap,
    famRects,
    rects: [...rectOf.entries()].map(([d, r]) => ({d, name: data.departments[d][1], value: deptSeats.get(d), fam: deptFamily.get(d), ...r})),
    pitch: Math.sqrt((W * H) / seats.count),
    pareto,
    plot,
    deptTotal: ranked.length,
  };
}
