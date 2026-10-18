import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {clamp01, easeInOutCubic, hash01, seatProgress} from './seatModel.js';
import {bureauShort, buildStructure, CENTER} from './structureLayouts.js';
import {ChapterRail} from './ChapterRail';
import {C, FONT, H, W, fmt} from './theme';
import {useFilmData, type Model} from './useFilmData';

// Chapter 3 -> 4: particles spiral into a sunburst (机构层级), unroll into a
// department treemap, then the camera dives into the 38 tax bureaus.
export const T = {
  spiral: [18, 112],
  unroll: [176, 268],
  zoom: [318, 384],
  end: 470,
} as const;

type Structure = ReturnType<typeof buildStructure>;
type Cam = {S: number; fx: number; fy: number};

const BASE: [number, number] = [960, 600];
const camAt = (frame: number, st: Structure): Cam => {
  const z = easeInOutCubic(clamp01((frame - T.zoom[0]) / (T.zoom[1] - T.zoom[0])));
  const r = st.taxRect;
  const s = Math.min(1720 / r.w, 760 / r.h);
  return {S: 1 + (s - 1) * z, fx: BASE[0] + (r.x + r.w / 2 - BASE[0]) * z, fy: BASE[1] + (r.y + r.h / 2 + 18 - BASE[1]) * z};
};
const project = (cam: Cam, x: number, y: number): [number, number] => [BASE[0] + (x - cam.fx) * cam.S, BASE[1] + (y - cam.fy) * cam.S];
const rotation = (frame: number) => 0.0009 * frame;

const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, k) => v + (b[k] - v) * t);
const q = (v: number) => Math.round(v / 6) * 6;

function paint(ctx: CanvasRenderingContext2D, m: Model, st: Structure, frame: number) {
  const {seats, layouts} = m;
  const field = layouts.field;
  const {polar, treemap, pitch} = st;
  const rot = rotation(frame);
  const cam = camAt(frame, st);
  const zoomT = clamp01((frame - T.zoom[0]) / (T.zoom[1] - T.zoom[0]));
  const buckets = new Map<string, number[]>();
  const [cx, cy] = CENTER;

  for (let i = 0; i < seats.count; i++) {
    const tax = seats.tax[i] === 1;
    const j = hash01(i, 7);
    const theta = polar[i * 2] + rot;
    const sx = cx + polar[i * 2 + 1] * Math.sin(theta);
    const sy = cy - polar[i * 2 + 1] * Math.cos(theta);

    // field -> sunburst, with a swirl that is zero at both ends
    const d = Math.hypot(field[i * 2] - cx, field[i * 2 + 1] - cy) / 900;
    const g1 = seatProgress(frame, T.spiral[0], T.spiral[1], clamp01(1 - d), j, 0.5);
    let x = field[i * 2] + (sx - field[i * 2]) * g1;
    let y = field[i * 2 + 1] + (sy - field[i * 2 + 1]) * g1;
    const sw = Math.sin(Math.PI * g1) * 0.7;
    const dx = x - cx;
    const dy = y - cy;
    x = cx + dx * Math.cos(sw) - dy * Math.sin(sw);
    y = cy + dx * Math.sin(sw) + dy * Math.cos(sw);

    // sunburst -> treemap, unwinding in angular order
    const key = (polar[i * 2] % (Math.PI * 2)) / (Math.PI * 2);
    const g2 = seatProgress(frame, T.unroll[0], T.unroll[1], key, j, 0.6);
    x += (treemap[i * 2] - x) * g2;
    y += (treemap[i * 2 + 1] - y) * g2 - Math.sin(Math.PI * g2) * 30 * (j - 0.3);

    const [px, py] = project(cam, x, y);
    let size = 3.5 + (2.3 - 3.5) * g1 + (pitch * 0.7 - 2.3) * g2;
    size *= tax ? cam.S : 1 + (cam.S - 1) * 0.6;
    if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;

    const rgb = tax ? mix(C.seat, C.coral, Math.max(g1, g2)) : C.seat;
    const alpha = tax ? 1 : 1 - zoomT * 0.8;
    const k = `${q(rgb[0])},${q(rgb[1])},${q(rgb[2])},${(Math.round(alpha * 20) / 20).toFixed(2)}`;
    let list = buckets.get(k);
    if (!list) buckets.set(k, (list = []));
    list.push(px - size / 2, py - size / 2, size);
  }

  ctx.clearRect(0, 0, W, H);

  // level ring under the sunburst
  const ringA = clamp01((frame - T.spiral[1] + 30) / 20) * (1 - clamp01((frame - T.unroll[0]) / 18));
  if (ringA > 0) {
    st.levelArcs.forEach((a: {a0: number; a1: number}, li: number) => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(236,232,225,${ringA * (0.25 + li * 0.17)})`;
      ctx.lineWidth = 12;
      ctx.arc(cx, cy, 168, a.a0 + rot - Math.PI / 2 + 0.004, a.a1 + rot - Math.PI / 2 - 0.004);
      ctx.stroke();
    });
  }

  for (const [key, list] of buckets) {
    const [r, g, b, a] = key.split(',');
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    for (let k = 0; k < list.length; k += 3) ctx.fillRect(list[k], list[k + 1], list[k + 2], list[k + 2]);
  }

  // treemap outlines
  const lineA = clamp01((frame - T.unroll[1] + 20) / 24);
  if (lineA > 0) {
    ctx.lineWidth = 1;
    for (const r of st.rects) {
      if (r.w * r.h < 400 && !r.tax) continue;
      const [x0, y0] = project(cam, r.x, r.y);
      ctx.strokeStyle = r.tax ? `rgba(13,16,21,${lineA * 0.9})` : `rgba(13,16,21,${lineA * 0.85})`;
      ctx.lineWidth = r.tax ? 1 + cam.S * 0.6 : 1.5;
      ctx.strokeRect(x0, y0, r.w * cam.S, r.h * cam.S);
    }
  }
}

const fade = (frame: number, a: number, b: number, c?: number, d?: number) =>
  c === undefined
    ? interpolate(frame, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : interpolate(frame, [a, b, c, d!], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
const rise = (o: number) => ({opacity: o, transform: `translateY(${(1 - o) * 14}px)`});

const offscreen: {c?: HTMLCanvasElement} = {};

export const S34Structure: React.FC = () => {
  const frame = useCurrentFrame();
  const model = useFilmData();
  const canvas = useRef<HTMLCanvasElement>(null);
  const st = useMemo(() => (model ? buildStructure(model.data, model.seats) : null), [model]);

  useLayoutEffect(() => {
    if (!model || !st || !canvas.current) return;
    const off = (offscreen.c ??= document.createElement('canvas'));
    off.width = W;
    off.height = H;
    paint(off.getContext('2d')!, model, st, frame);
    const ctx = canvas.current.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0);
  }, [model, st, frame]);

  if (!model || !st) return <AbsoluteFill style={{background: C.bg}} />;
  const f = model.data.facts;
  const total = f.seats.value;
  const rot = rotation(frame);
  const cam = camAt(frame, st);
  const [cx, cy] = CENTER;

  const sun = fade(frame, T.spiral[1] - 16, T.spiral[1] + 6, T.unroll[0] - 4, T.unroll[0] + 12);
  const tree = fade(frame, T.unroll[1] - 6, T.unroll[1] + 14, T.zoom[0] - 6, T.zoom[0] + 8);
  const zoomIn = fade(frame, T.zoom[1] - 14, T.zoom[1] + 10);
  const intro = fade(frame, 0, 1, T.spiral[0] + 30, T.spiral[0] + 50);
  const taxRect = st.taxRect;
  const [tx, ty] = project(cam, taxRect.x, taxRect.y);

  const bigOthers = st.rects.filter(r => !r.tax && r.w > 100 && r.h > 40).slice(0, 6);
  const bureaus = st.rects.filter(r => r.tax);

  return (
    <AbsoluteFill style={{background: C.bg, fontFamily: FONT, color: C.ink, fontVariantNumeric: 'tabular-nums'}}>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 55%, rgba(40,48,60,0.35), rgba(0,0,0,0) 60%)'}} />
      <canvas ref={canvas} width={W} height={H} style={{position: 'absolute', inset: 0}} />

      {/* opening line */}
      <div style={{position: 'absolute', left: 125, top: 100, ...rise(intro)}}>
        <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>03 · 结构</div>
        <div style={{fontSize: 46, fontWeight: 700, marginTop: 8}}>这 {fmt(total)} 个名额，招到哪一级？</div>
      </div>

      {/* sunburst centre + level labels */}
      <div style={{position: 'absolute', left: cx - 160, top: cy - 64, width: 320, textAlign: 'center', opacity: sun}}>
        <div style={{fontSize: 64, fontWeight: 700, lineHeight: 1}}>{fmt(total)}</div>
        <div style={{fontSize: 20, color: C.muted, marginTop: 10}}>按机构层级</div>
      </div>
      {st.levelArcs.map((a: {name: string; seats: number; a0: number; a1: number}, li: number) => {
        const mid = (a.a0 + a.a1) / 2 + rot;
        const r = 470;
        const x = cx + r * Math.sin(mid);
        const y = cy - r * Math.cos(mid);
        const right = Math.sin(mid) >= 0;
        const small = a.seats / total < 0.04;
        return (
          <div
            key={a.name}
            style={{
              position: 'absolute',
              left: right ? x : undefined,
              right: right ? undefined : W - x,
              top: y - 26 + (small ? (li === 0 ? -34 : 6) : 0),
              textAlign: right ? 'left' : 'right',
              opacity: sun,
            }}
          >
            <div style={{fontSize: small ? 26 : 40, fontWeight: 700}}>{((a.seats / total) * 100).toFixed(1)}%</div>
            <div style={{fontSize: 18, color: C.muted}}>
              {a.name} · {fmt(a.seats)}
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 125, top: 100, ...rise(sun)}}>
        <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>03 · 结构</div>
        <div style={{fontSize: 40, fontWeight: 700, marginTop: 8}}>四分之三在县区一线</div>
        <div style={{fontSize: 20, color: C.muted, marginTop: 10}}>
          <span style={{color: C.coralCss}}>■</span> 税务名额
        </div>
      </div>

      {/* treemap */}
      <div style={{position: 'absolute', left: 125, top: 72, ...rise(tree)}}>
        <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>04 · 部门</div>
        <div style={{fontSize: 40, fontWeight: 700, marginTop: 8}}>
          {f.departments.value} 个招录部门，面积 = 名额
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: tx,
          top: ty,
          width: taxRect.w * cam.S,
          height: taxRect.h * cam.S,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: tree,
        }}
      >
        <div style={{padding: '18px 40px 22px', borderRadius: 14, background: 'rgba(13,16,21,0.78)', textAlign: 'center'}}>
          <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>税务 · {f.taxBureaus.value} 个税务局</div>
          <div style={{fontSize: 110, fontWeight: 700, lineHeight: 1.05, color: C.coralCss}}>{f.taxSharePct.value.toFixed(1)}%</div>
          <div style={{fontSize: 24, marginTop: 4}}>{fmt(f.taxSeats.value)} 个名额</div>
        </div>
      </div>
      {/* bracket over the long tail of other departments */}
      {(() => {
        const others = st.rects.filter(r => !r.tax);
        const x0 = Math.min(...others.map(r => r.x));
        const x1 = Math.max(...others.map(r => r.x + r.w));
        const [px0, py] = project(cam, x0, st.taxRect.y);
        const [px1] = project(cam, x1, st.taxRect.y);
        return (
          <div style={{position: 'absolute', left: px0, width: px1 - px0, top: py - 46, opacity: tree, textAlign: 'center', fontSize: 20}}>
            <span style={{color: C.muted}}>其余 {f.departments.value - f.taxBureaus.value} 个部门 · </span>
            {fmt(f.otherSeats.value)}
            <div style={{height: 8, borderTop: '1.5px solid rgba(139,148,161,0.6)', borderLeft: '1.5px solid rgba(139,148,161,0.6)', borderRight: '1.5px solid rgba(139,148,161,0.6)', marginTop: 6}} />
          </div>
        );
      })()}
      {bigOthers.map(r => {
        const [x, y] = project(cam, r.x, r.y);
        return (
          <div key={r.d} style={{position: 'absolute', left: x + 6, top: y + 4, width: r.w - 12, fontSize: 13, lineHeight: 1.25, opacity: tree, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textShadow: '0 1px 6px rgba(13,16,21,1)'}}>
            {r.name}
            <div style={{color: C.muted}}>{fmt(r.value)}</div>
          </div>
        );
      })}

      {/* tax zoom */}
      <div style={{position: 'absolute', left: 125, top: 72, ...rise(zoomIn)}}>
        <div style={{fontSize: 22, color: C.coralCss, letterSpacing: 4}}>04 · 部门 · 税务</div>
        <div style={{fontSize: 40, fontWeight: 700, marginTop: 8}}>
          {f.taxBureaus.value} 个税务局，合计 {fmt(f.taxSeats.value)} 个名额
        </div>
      </div>
      {bureaus.map(r => {
        const [x, y] = project(cam, r.x, r.y);
        const w = r.w * cam.S;
        const h = r.h * cam.S;
        if (w < 70 || h < 44) return null;
        return (
          <div key={r.d} style={{position: 'absolute', left: x + 8, top: y + 6, width: w - 16, opacity: zoomIn, textShadow: '0 1px 8px rgba(13,16,21,1)', overflow: 'hidden', whiteSpace: 'nowrap'}}>
            <div style={{fontSize: w > 160 ? 24 : 18, fontWeight: 700}}>{bureauShort(r.name)}</div>
            <div style={{fontSize: w > 160 ? 18 : 15}}>{fmt(r.value)}</div>
          </div>
        );
      })}

      <ChapterRail active={frame < T.unroll[0] + 40 ? 2 : 3} />
      <div style={{position: 'absolute', right: 40, bottom: 30, fontSize: 15, color: C.faint, textAlign: 'right', lineHeight: 1.6}}>
        数据：2027 国考职位表 {fmt(f.positions.value)} 岗逐岗加总
        <br />
        层级取「机构层级」字段 · 税务口径：{f.taxSeats.source.rule}
      </div>
    </AbsoluteFill>
  );
};
