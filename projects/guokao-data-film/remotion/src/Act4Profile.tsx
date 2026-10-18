import React, {useMemo} from 'react';
import {clamp01, easeInOutCubic, hash01, seatProgress} from './seatModel.js';
import {Heading, Painter, Stage, fade, lerp, pct, rise, useCanvas, useActFrame} from './common';
import {C, FONT, FAMILY_RGB, H, W, fmt} from './theme';
import {useFilmData, type Model} from './useFilmData';

// Act IV "门槛与画像": particle Sankey (学历 -> 政治面貌 -> 基层经历), seats grouped by
// how many a position hires, then seats spelling the most frequent words in 专业.
export const T = {
  enter: [0, 70],
  flow1: [80, 210],
  flow2: [220, 350],
  size: [440, 560],
  words: [700, 840],
  end: 1050,
} as const;

const COLS = [420, 960, 1500];
const COL_W = 120;
const TOP = 300;
const SPAN = 600;
const GAP = 18;
const EDU_RGB = [
  [120, 197, 224],
  [125, 191, 122],
  [168, 139, 219],
  [176, 184, 196],
];
const WORD_RGB = [FAMILY_RGB[2], FAMILY_RGB[0], FAMILY_RGB[1], FAMILY_RGB[7], FAMILY_RGB[3], FAMILY_RGB[4]];
const WORD_ROWS = [
  ['经济', '审计', '金融'],
  ['计算机', '统计', '法学'],
];

type Seg = {name: string; seats: number; y: number; h: number};

function stackSegments(counts: {name: string; seats: number}[], total: number): Seg[] {
  const usable = SPAN - GAP * (counts.length - 1);
  let y = TOP;
  return counts.map(c => {
    const h = (c.seats / total) * usable;
    const seg = {name: c.name, seats: c.seats, y, h};
    y += h + GAP;
    return seg;
  });
}

/** Place seats of each segment row-major inside the column, in the given order. */
function placeColumn(xy: Float32Array, segs: Seg[], groups: number[][], cx: number) {
  groups.forEach((list, si) => {
    const s = segs[si];
    const n = list.length;
    const cols = Math.max(1, Math.round(Math.sqrt((n * COL_W) / Math.max(1, s.h))));
    const rows = Math.ceil(n / cols);
    list.forEach((seat, k) => {
      xy[seat * 2] = cx - COL_W / 2 + (((k % cols) + 0.5) * COL_W) / cols;
      xy[seat * 2 + 1] = s.y + ((Math.floor(k / cols) + 0.5) * s.h) / rows;
    });
  });
}

function buildProfile(m: Model) {
  const P = m.data.positions; // [dept, level, hires, tax, family, edu, pol, grass, word, law]
  const pos = m.seats.position;
  const n = m.seats.count;
  const attr = (s: number, k: number) => P[pos[s]][k];
  const all = Array.from({length: n}, (_, i) => i);
  const cond = m.data.conditions;
  const total = m.data.facts.seats.value;
  const segs = [stackSegments(cond.edu, total), stackSegments(cond.pol, total), stackSegments(cond.grass, total)];
  const keys: number[][] = [
    [5, 6, 7],
    [6, 5, 7],
    [7, 6, 5],
  ];
  const cols = keys.map((ks, ci) => {
    const xy = new Float32Array(n * 2);
    const sorted = [...all].sort((a, b) => attr(a, ks[1]) - attr(b, ks[1]) || attr(a, ks[2]) - attr(b, ks[2]) || a - b);
    const groups = segs[ci].map((_, si) => sorted.filter(s => attr(s, ks[0]) === si));
    placeColumn(xy, segs[ci], groups, COLS[ci]);
    return xy;
  });
  // ribbons: joint counts in the same order the seats were stacked
  const ribbons = (from: number, to: number, ci: number) => {
    const out: {a0: number; a1: number; b0: number; b1: number; edu: number}[] = [];
    const offA = segs[ci].map(s => s.y);
    const offB = segs[ci + 1].map(s => s.y);
    segs[ci].forEach((sa, i) => {
      segs[ci + 1].forEach((sb, j) => {
        const c = all.filter(s => attr(s, from) === i && attr(s, to) === j).reduce((t, s) => t + 1, 0);
        if (!c) return;
        const ha = (c / sa.seats) * sa.h;
        const hb = (c / sb.seats) * sb.h;
        out.push({a0: offA[i], a1: offA[i] + ha, b0: offB[j], b1: offB[j] + hb, edu: from === 5 ? i : -1});
        offA[i] += ha;
        offB[j] += hb;
      });
    });
    return out;
  };
  // seats grouped by position size
  const sizeKey = (s: number) => Math.min(5, P[pos[s]][2]) - 1;
  const sizeXY = new Float32Array(n * 2);
  const blocks = cond.bySize.map((b, k) => ({...b, seats: all.filter(s => sizeKey(s) === k).length, x: 0, w: 0}));
  const pitch = 4.3;
  const rows = 120;
  let x = (W - (blocks.reduce((t, b) => t + Math.ceil(b.seats / rows), 0) * pitch + 60 * (blocks.length - 1))) / 2;
  blocks.forEach((b, k) => {
    const list = all.filter(s => sizeKey(s) === k);
    list.forEach((s, i) => {
      sizeXY[s * 2] = x + Math.floor(i / rows) * pitch + pitch / 2;
      sizeXY[s * 2 + 1] = 390 + (i % rows) * pitch + pitch / 2;
    });
    b.x = x;
    b.w = Math.ceil(list.length / rows) * pitch;
    x += b.w + 60;
  });
  return {segs, cols, ribbons: [ribbons(5, 6, 0), ribbons(6, 7, 1)], sizeXY, sizeKey, blocks, sizeTop: 390, sizeH: rows * pitch};
}

/** Sample glyph pixels for each word (browser only, after fonts are loaded). */
function buildWords(m: Model) {
  const words = m.data.conditions.words;
  const max = Math.max(...words.map(w => w.positions));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', {willReadFrequently: true})!;
  const boxes: {word: string; x: number; y: number; size: number; w: number}[] = [];
  const rowY = [420, 760];
  WORD_ROWS.forEach((row, ri) => {
    const sizes = row.map(wd => 90 + 150 * Math.sqrt(words.find(w => w.word === wd)!.positions / max));
    const widths = row.map((wd, i) => {
      ctx.font = `700 ${sizes[i]}px ${FONT}`;
      return ctx.measureText(wd).width;
    });
    const gap = 90;
    let x = (W - widths.reduce((t, v) => t + v, 0) - gap * (row.length - 1)) / 2;
    row.forEach((wd, i) => {
      boxes.push({word: wd, x, y: rowY[ri], size: sizes[i], w: widths[i]});
      x += widths[i] + gap;
    });
  });
  const points: Record<string, [number, number][]> = {};
  boxes.forEach(b => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${b.size}px ${FONT}`;
    ctx.fillText(b.word, b.x, b.y);
    const img = ctx.getImageData(0, 0, W, H).data;
    const pts: [number, number][] = [];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (img[(y * W + x) * 4 + 3] > 140) pts.push([x, y]);
    points[b.word] = pts;
  });
  const P = m.data.positions;
  const xy = new Float32Array(m.seats.count * 2);
  const wordOfSeat = new Int8Array(m.seats.count);
  const bySeat: number[][] = words.map(() => []);
  for (let s = 0; s < m.seats.count; s++) {
    const wi = P[m.seats.position[s]][8];
    wordOfSeat[s] = wi;
    if (wi >= 0) bySeat[wi].push(s);
    else {
      xy[s * 2] = hash01(s, 31) * W;
      xy[s * 2 + 1] = 230 + hash01(s, 32) * 720;
    }
  }
  words.forEach((w, wi) => {
    const pts = points[w.word];
    const list = bySeat[wi];
    list.forEach((s, k) => {
      const p = pts[Math.floor((k * pts.length) / list.length)];
      xy[s * 2] = p[0] + (hash01(s, 33) - 0.5) * 1.6;
      xy[s * 2 + 1] = p[1] + (hash01(s, 34) - 0.5) * 1.6;
    });
  });
  return {xy, wordOfSeat, boxes};
}

const bez = (x0: number, y0: number, x1: number, y1: number, t: number): [number, number] => {
  const mx = (x0 + x1) / 2;
  const u = 1 - t;
  const x = u * u * u * x0 + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * x1;
  const y = u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t * t * t * y1;
  return [x, y];
};

export const Act4Profile: React.FC = () => {
  const frame = useActFrame();
  const model = useFilmData();
  const prof = useMemo(() => (model ? buildProfile(model) : null), [model]);
  const words = useMemo(() => (model && typeof document !== 'undefined' ? buildWords(model) : null), [model]);

  const canvas = useCanvas(
    model && prof && words
      ? ctx => {
          const {field} = model.layouts;
          const P = model.data.positions;
          const pos = model.seats.position;
          const sankeyA = 1 - clamp01((frame - T.size[0]) / 20);
          // ribbons
          const ribA = [fade(frame, T.flow1[1] - 30, T.flow1[1] + 10), fade(frame, T.flow2[1] - 30, T.flow2[1] + 10)];
          prof.ribbons.forEach((rs, ri) => {
            const a = ribA[ri] * sankeyA;
            if (a <= 0) return;
            const x0 = COLS[ri] + COL_W / 2 + 6;
            const x1 = COLS[ri + 1] - COL_W / 2 - 6;
            const mx = (x0 + x1) / 2;
            rs.forEach(r => {
              const rgb = r.edu >= 0 ? EDU_RGB[r.edu] : [236, 232, 225];
              ctx.fillStyle = `rgba(${rgb.join(',')},${0.2 * a})`;
              ctx.beginPath();
              ctx.moveTo(x0, r.a0);
              ctx.bezierCurveTo(mx, r.a0, mx, r.b0, x1, r.b0);
              ctx.lineTo(x1, r.b1);
              ctx.bezierCurveTo(mx, r.b1, mx, r.a1, x0, r.a1);
              ctx.closePath();
              ctx.fill();
            });
          });

          // ghost bars stay behind once the particles have flowed on
          const ghost = [fade(frame, T.flow1[0] + 20, T.flow1[1]), fade(frame, T.flow2[0] + 20, T.flow2[1])];
          [0, 1].forEach(ci => {
            const a = ghost[ci] * sankeyA;
            if (a <= 0) return;
            prof.segs[ci].forEach((sg, si) => {
              const rgb = ci === 0 ? EDU_RGB[si] : [200, 206, 214];
              ctx.fillStyle = `rgba(${rgb.join(',')},${0.55 * a})`;
              ctx.fillRect(COLS[ci] - COL_W / 2, sg.y, COL_W, Math.max(2, sg.h));
            });
          });

          const p = new Painter();
          const [c0, c1, c2] = prof.cols;
          for (let s = 0; s < model.seats.count; s++) {
            const j = hash01(s, 7);
            const row = P[pos[s]];
            const enterA = clamp01((frame - j * 20) / 14);
            const e = seatProgress(frame, T.enter[0], T.enter[1], clamp01(field[s * 2] / W), j, 0.5);
            let x = lerp(field[s * 2], c0[s * 2], e);
            let y = lerp(field[s * 2 + 1], c0[s * 2 + 1], e);
            const f1 = seatProgress(frame, T.flow1[0], T.flow1[1], clamp01((c0[s * 2 + 1] - TOP) / SPAN), j, 0.55);
            if (f1 > 0) [x, y] = bez(c0[s * 2], c0[s * 2 + 1], c1[s * 2], c1[s * 2 + 1], f1);
            const f2 = seatProgress(frame, T.flow2[0], T.flow2[1], clamp01((c1[s * 2 + 1] - TOP) / SPAN), j, 0.55);
            if (f2 > 0) [x, y] = bez(c1[s * 2], c1[s * 2 + 1], c2[s * 2], c2[s * 2 + 1], f2);
            const g = seatProgress(frame, T.size[0], T.size[1], clamp01(prof.sizeXY[s * 2] / W), j, 0.5);
            x = lerp(x, prof.sizeXY[s * 2], g);
            y = lerp(y, prof.sizeXY[s * 2 + 1], g);
            const w = seatProgress(frame, T.words[0], T.words[1], hash01(s, 9), j, 0.6);
            x = lerp(x, words.xy[s * 2], w);
            y = lerp(y, words.xy[s * 2 + 1], w);

            const edu = EDU_RGB[row[5]];
            const single = prof.sizeKey(s) === 0;
            const sizeRgb = single ? [236, 120, 92] : C.seat;
            const wi = words.wordOfSeat[s];
            const wordRgb = wi >= 0 ? WORD_RGB[wi] : [90, 98, 110];
            let rgb = edu.map((v, k) => lerp(v, sizeRgb[k], g));
            rgb = rgb.map((v, k) => lerp(v, wordRgb[k], w));
            const alpha = enterA * (wi < 0 ? lerp(1, 0.22, w) : 1);
            const size = lerp(lerp(lerp(3.5, 1.6, e), 3.4, g), wi >= 0 ? 2.2 : 1.6, w);
            p.add(x, y, size, rgb[0], rgb[1], rgb[2], alpha);
          }
          p.flush(ctx);
        }
      : null,
  );

  if (!model || !prof || !words) return <Stage act={3} source="" />;
  const cond = model.data.conditions;
  const total = model.data.facts.seats.value;
  const sankey = fade(frame, 30, 50, T.size[0] - 10, T.size[0] + 10);
  const sizeA = fade(frame, T.size[1] - 30, T.size[1], T.words[0] - 10, T.words[0] + 10);
  const wordsA = fade(frame, T.words[1] - 40, T.words[1]);
  const labelA = [fade(frame, 60, 80), fade(frame, T.flow1[1] - 20, T.flow1[1]), fade(frame, T.flow2[1] - 20, T.flow2[1])];

  return (
    <Stage act={3} canvas={canvas} source="数据：2027 国考职位表原字段（学历、政治面貌、基层工作最低年限、招考人数、专业、备注）逐岗统计">
      <Heading
        o={sankey}
        kicker="04 · 门槛与画像"
        title="学历 → 政治面貌 → 基层经历"
        sub={`${pct(cond.edu[0].seats, total)} 只要求本科及以上 · ${pct(cond.pol[0].seats, total)} 不限政治面貌 · ${pct(cond.grass[0].seats, total)} 不要求基层工作年限`}
      />
      {sankey > 0 &&
        prof.segs.map((segs, ci) =>
          segs.map((s, si) => {
            const left = ci === 0;
            const right = ci === 2;
            const small = s.h < 40;
            return (
              <div
                key={`${ci}-${s.name}`}
                style={{
                  position: 'absolute',
                  top: s.y + s.h / 2 - (small ? 13 : 22),
                  left: left ? undefined : right ? COLS[ci] + COL_W / 2 + 18 : COLS[ci] + COL_W / 2 + 14,
                  right: left ? W - (COLS[ci] - COL_W / 2 - 18) : undefined,
                  textAlign: left ? 'right' : 'left',
                  opacity: labelA[ci] * sankey,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.15,
                }}
              >
                <span style={{fontSize: small ? 17 : 24, fontWeight: 700, color: ci === 0 ? `rgb(${EDU_RGB[si].join(',')})` : C.ink}}>{s.name}</span>
                <span style={{fontSize: small ? 15 : 19, color: C.muted, marginLeft: 10}}>{pct(s.seats, total)}</span>
              </div>
            );
          }),
        )}
      {sankey > 0 &&
        ['学历', '政治面貌', '基层经历'].map((t, ci) => (
          <div key={t} style={{position: 'absolute', left: COLS[ci] - 100, width: 200, top: TOP + SPAN + 26, textAlign: 'center', fontSize: 20, color: C.muted, opacity: labelA[ci] * sankey, letterSpacing: 4}}>
            {t}
          </div>
        ))}

      <Heading o={sizeA} kicker="04 · 门槛与画像 · 岗位大小" title={`近一半岗位，只招 1 个人`} sub={`单个岗位最多招 ${cond.maxHires} 人 · 每个点仍是 1 个名额`} />
      {sizeA > 0 &&
        prof.blocks.map((b, k) => (
          <div key={b.k} style={{position: 'absolute', left: b.x, width: Math.max(b.w, 150), top: prof.sizeTop - 92, opacity: sizeA, whiteSpace: 'nowrap'}}>
            <div style={{fontSize: k === 0 ? 30 : 22, fontWeight: 700, color: k === 0 ? C.coralCss : C.ink}}>招 {b.k} 人</div>
            <div style={{fontSize: k === 0 ? 22 : 17, color: C.muted}}>
              {fmt(b.positions)} 岗 · {pct(b.positions, model.data.facts.positions.value)}
            </div>
          </div>
        ))}

      <Heading o={wordsA} kicker="04 · 门槛与画像 · 专业" title="专业栏里出现最多的词" sub="点 = 专业栏提到该词的岗位名额；文字匹配，提到 ≠ 可报" />
      {wordsA > 0 &&
        words.boxes.map(b => {
          const w = cond.words.find(x => x.word === b.word)!;
          return (
            <div key={b.word} style={{position: 'absolute', left: b.x, width: b.w, top: b.y + 18, textAlign: 'center', fontSize: 20, color: C.muted, opacity: wordsA}}>
              <span style={{color: C.ink, fontWeight: 700}}>{fmt(w.positions)}</span> 个岗位
            </div>
          );
        })}
      <div style={{position: 'absolute', left: 125, top: 960, fontSize: 20, color: C.muted, ...rise(fade(frame, T.words[1] + 40, T.words[1] + 60))}}>
        另：{fmt(cond.cet6.positions)} 个岗位的备注提到「英语六级」
      </div>
    </Stage>
  );
};
