// Pure, deterministic seat model shared by the film and by scripts/check_film_data.mjs.
// One seat = one planned hire. Seat i keeps the same identity across every layout.

/** Integer hash -> [0, 1). Stable across runs and machines. */
export function hash01(i, salt = 0) {
  let x = (i + 1) * 374761393 + salt * 668265263;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * Expand compact positions into seats.
 * Returns typed arrays indexed by seat: position index, tax flag, k within position.
 */
export function expandSeats(data) {
  const total = data.positions.reduce((t, r) => t + r[2], 0);
  const position = new Int32Array(total);
  const tax = new Uint8Array(total);
  const k = new Uint8Array(total);
  let s = 0;
  data.positions.forEach((r, p) => {
    for (let j = 0; j < r[2]; j++, s++) {
      position[s] = p;
      tax[s] = r[3];
      k[s] = j;
    }
  });
  return {count: total, position, tax, k};
}

/** Place `order` (seat indices) into a grid, column-major from the left. */
function placeGrid(xy, order, {left, top, rows, pitch}) {
  order.forEach((seat, n) => {
    const col = Math.floor(n / rows);
    const row = n % rows;
    xy[seat * 2] = left + col * pitch + pitch / 2;
    xy[seat * 2 + 1] = top + row * pitch + pitch / 2;
  });
  return Math.ceil(order.length / rows);
}

export const PITCH = 5;
export const ZOOM_PITCH = 8;

/**
 * All layouts for M1. Coordinates are in a 1920x1080 frame.
 * - field:   every seat mixed (hash order) in one rectangle
 * - split:   税务 left, 其他 right; same pitch and rows, so width ∝ seats
 * - reflow:  其他 re-centred at a larger pitch (display zoom, count unchanged)
 */
export function buildLayouts(seats, W = 1920, H = 1080) {
  const all = Array.from({length: seats.count}, (_, i) => i);

  const field = new Float32Array(seats.count * 2);
  const fieldRows = 107;
  const fieldCols = Math.ceil(seats.count / fieldRows);
  const shuffled = [...all].sort((a, b) => hash01(a, 1) - hash01(b, 1));
  const fieldBox = {left: (W - fieldCols * PITCH) / 2, top: 630 - (fieldRows * PITCH) / 2, rows: fieldRows, pitch: PITCH};
  placeGrid(field, shuffled, fieldBox);

  // Source order is department code, then position code: tax bureaus form bands.
  const taxOrder = all.filter(i => seats.tax[i]);
  const otherOrder = all.filter(i => !seats.tax[i]);
  const rows = 130;
  const gap = 90;
  const taxCols = Math.ceil(taxOrder.length / rows);
  const otherCols = Math.ceil(otherOrder.length / rows);
  const width = (taxCols + otherCols) * PITCH + gap;
  const left = (W - width) / 2;
  const top = 640 - (rows * PITCH) / 2;
  const split = new Float32Array(field);
  placeGrid(split, taxOrder, {left, top, rows, pitch: PITCH});
  const otherLeft = left + taxCols * PITCH + gap;
  placeGrid(split, otherOrder, {left: otherLeft, top, rows, pitch: PITCH});

  const reflow = new Float32Array(split);
  const zRows = 76;
  const zCols = Math.ceil(otherOrder.length / zRows);
  placeGrid(reflow, otherOrder, {left: (W - zCols * ZOOM_PITCH) / 2, top: 640 - (zRows * ZOOM_PITCH) / 2, rows: zRows, pitch: ZOOM_PITCH});

  return {
    field,
    split,
    reflow,
    boxes: {
      field: {...fieldBox, cols: fieldCols},
      tax: {left, top, rows, cols: taxCols, pitch: PITCH},
      other: {left: otherLeft, top, rows, cols: otherCols, pitch: PITCH},
      zoom: {left: (W - zCols * ZOOM_PITCH) / 2, top: 640 - (zRows * ZOOM_PITCH) / 2, rows: zRows, cols: zCols, pitch: ZOOM_PITCH},
    },
    // Normalised sweep key per seat for staggered motion (0 = moves first).
    sweep: Float32Array.from(all, i => {
      const x = split[i * 2];
      return Math.min(1, Math.max(0, (x - left) / width));
    }),
  };
}

export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Per-seat progress inside a transition window [start, end] (frames). */
export function seatProgress(frame, start, end, key, jitter, spread = 0.55) {
  const local = clamp01((frame - start) / (end - start));
  const delay = key * spread + jitter * 0.12;
  return easeInOutCubic(clamp01((local - delay) / (1 - spread - 0.12)));
}
