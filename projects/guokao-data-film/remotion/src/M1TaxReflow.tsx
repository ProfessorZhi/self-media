import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, Easing} from 'remotion';
import {hash01, seatProgress, clamp01} from './seatModel.js';
import {C, FONT, H, W, fmt} from './theme';
import {useFilmData, type Model} from './useFilmData';

// Timeline (frames @30fps). Each beat is named so later shots can reuse the grammar.
// One continuous movement: no pauses, each beat begins while the last settles.
export const T = {
  appear: [0, 50],
  gather: [58, 150],
  reveal: [128, 160],
  dim: [196, 232],
  reflow: [222, 312],
  end: 372,
} as const;

const DOT = 3.5;
const ZOOM_DOT = 5.6;

type Frame = {taxArrived: number; otherArrived: number; visible: number};

/** Compute every seat's state for this frame and paint it. Returns live counts. */
function paint(ctx: CanvasRenderingContext2D, m: Model, frame: number): Frame {
  const {seats, layouts} = m;
  const {field, split, reflow, sweep} = layouts;
  const buckets = new Map<string, number[]>();
  let taxArrived = 0;
  let otherArrived = 0;
  let visible = 0;

  const dim = clamp01((frame - T.dim[0]) / (T.dim[1] - T.dim[0]));
  const dimE = Easing.inOut(Easing.cubic)(dim);

  for (let i = 0; i < seats.count; i++) {
    const tax = seats.tax[i] === 1;
    const j = hash01(i, 7);
    // 1) appear: each seat fades in at its own moment
    const a0 = clamp01((frame - hash01(i, 3) * 40) / 10);
    if (a0 >= 0.5) visible++;

    // 2) gather: field -> split, staggered by destination sweep
    const g = seatProgress(frame, T.gather[0], T.gather[1], sweep[i], j);
    let x = field[i * 2] + (split[i * 2] - field[i * 2]) * g;
    let y = field[i * 2 + 1] + (split[i * 2 + 1] - field[i * 2 + 1]) * g;
    // gentle arc so the flow reads as motion, not teleport
    const arc = Math.sin(Math.PI * g) * (j - 0.5) * 60;
    y += arc;
    if (g >= 1) tax ? taxArrived++ : otherArrived++;

    // 3) reflow: non-tax seats re-centre at display zoom
    let size = DOT;
    if (!tax) {
      const r = seatProgress(frame, T.reflow[0], T.reflow[1], 1 - sweep[i], j, 0.45);
      x += (reflow[i * 2] - split[i * 2]) * r;
      y += (reflow[i * 2 + 1] - split[i * 2 + 1]) * r + Math.sin(Math.PI * r) * (j - 0.5) * 40;
      size = DOT + (ZOOM_DOT - DOT) * r;
    }

    // colour: tax warms to coral while gathering; then dims as others take focus
    let rgb: readonly number[] = C.seat;
    let alpha = a0;
    if (tax) {
      rgb = mix(C.seat, C.coral, g);
      const fadeOut = clamp01((frame - T.reflow[0]) / 60);
      alpha *= 1 - dimE * 0.82 - fadeOut * 0.12;
    } else {
      rgb = mix(C.seat, C.focus, dimE);
    }
    if (alpha <= 0.01) continue;
    const key = `${q(rgb[0])},${q(rgb[1])},${q(rgb[2])},${(Math.round(alpha * 20) / 20).toFixed(2)}`;
    let list = buckets.get(key);
    if (!list) buckets.set(key, (list = []));
    list.push(x - size / 2, y - size / 2, size);
  }

  ctx.clearRect(0, 0, W, H);
  for (const [key, list] of buckets) {
    const [r, g, b, a] = key.split(',');
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    for (let k = 0; k < list.length; k += 3) ctx.fillRect(list[k], list[k + 1], list[k + 2], list[k + 2]);
  }
  return {taxArrived, otherArrived, visible};
}

const q = (v: number) => Math.round(v / 6) * 6;
const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((v, k) => v + (b[k] - v) * t);

const fade = (frame: number, a: number, b: number, c?: number, d?: number) =>
  c === undefined
    ? interpolate(frame, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : interpolate(frame, [a, b, c, d!], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

const rise = (o: number) => ({opacity: o, transform: `translateY(${(1 - o) * 14}px)`});

export const M1TaxReflow: React.FC = () => {
  const frame = useCurrentFrame();
  const model = useFilmData();
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useMemo<Frame | null>(() => {
    if (!model || typeof document === 'undefined') return null;
    const off = (paint as any).off ?? ((paint as any).off = document.createElement('canvas'));
    off.width = W;
    off.height = H;
    return paint(off.getContext('2d')!, model, frame);
  }, [model, frame]);

  useLayoutEffect(() => {
    const off = (paint as any).off as HTMLCanvasElement | undefined;
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !off || !live) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0);
  }, [live]);

  if (!model) return <AbsoluteFill style={{background: C.bg}} />;
  const f = model.data.facts;
  const b = model.layouts.boxes;

  const intro = fade(frame, 6, 24, T.gather[0] + 14, T.gather[0] + 30);
  const reveal = fade(frame, T.reveal[0], T.reveal[0] + 16);
  const labels = fade(frame, T.gather[0] + 40, T.gather[0] + 58, T.reflow[0], T.reflow[0] + 14);
  const taxLabel = fade(frame, T.gather[0] + 40, T.gather[0] + 58, T.dim[0], T.dim[0] + 12);
  const share = reveal * (1 - fade(frame, T.dim[0], T.dim[0] + 12));
  const dimCap = fade(frame, T.dim[0], T.dim[0] + 16, T.reflow[0] + 34, T.reflow[0] + 50);
  const end = fade(frame, T.reflow[1] - 24, T.reflow[1]);

  const visibleNow = live?.visible ?? 0;

  return (
    <AbsoluteFill style={{background: C.bg, fontFamily: FONT, color: C.ink, fontVariantNumeric: 'tabular-nums'}}>
      {/* subtle vignette for depth */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 55%, rgba(40,48,60,0.35), rgba(0,0,0,0) 60%)'}} />
      <canvas ref={canvas} width={W} height={H} style={{position: 'absolute', inset: 0}} />

      {/* Beat 1 — the field */}
      <div style={{position: 'absolute', left: 125, top: 108, ...rise(intro)}}>
        <div style={{fontSize: 24, color: C.muted, letterSpacing: 4}}>2027 国考 · 计划招录名额</div>
        <div style={{fontSize: 112, fontWeight: 700, lineHeight: 1.05, marginTop: 6}}>{fmt(visibleNow)}</div>
        <div style={{fontSize: 22, color: C.muted, marginTop: 8}}>每个点 = 1 个名额 · 共 {fmt(f.positions.value)} 个岗位</div>
      </div>


      {/* Beat 2 — the answer, counted from arrived seats */}
      <div style={{position: 'absolute', left: b.tax.left, top: b.tax.top - 74, ...rise(taxLabel)}}>
        <span style={{fontSize: 22, color: C.coralCss, marginRight: 14}}>税务</span>
        <span style={{fontSize: 44, fontWeight: 700}}>{fmt(live?.taxArrived ?? 0)}</span>
      </div>
      <div style={{position: 'absolute', left: b.other.left, top: b.other.top - 74, ...rise(labels)}}>
        <span style={{fontSize: 22, color: C.muted, marginRight: 14}}>其他</span>
        <span style={{fontSize: 44, fontWeight: 700}}>{fmt(live?.otherArrived ?? 0)}</span>
      </div>
      {/* the share sits inside the tax block it describes */}
      <div
        style={{
          position: 'absolute',
          left: b.tax.left,
          width: b.tax.cols * b.tax.pitch,
          top: b.tax.top + (b.tax.rows * b.tax.pitch) / 2 - 110,
          textAlign: 'center',
          textShadow: '0 2px 30px rgba(13,16,21,0.9)',
          ...rise(share),
        }}
      >
        <div style={{display: 'inline-block', padding: '18px 44px 22px', borderRadius: 14, background: 'rgba(13,16,21,0.72)'}}>
          <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>税务名额占比</div>
          <div style={{fontSize: 128, fontWeight: 700, lineHeight: 1.05, color: C.coralCss}}>{f.taxSharePct.value.toFixed(1)}%</div>
          <div style={{fontSize: 22, color: C.muted, marginTop: 6}}>
            {f.taxBureaus.value} 个税务局 · {fmt(f.taxPositions.value)} 个岗位
          </div>
        </div>
      </div>

      {/* Beat 3 — set tax aside */}
      <div style={{position: 'absolute', left: 125, top: 128, ...rise(dimCap)}}>
        <div style={{fontSize: 46, fontWeight: 700}}>先把税务放到一边</div>
        <div style={{fontSize: 24, color: C.muted, marginTop: 10}}>剩下的名额，分布在另外 {f.departments.value - f.taxBureaus.value} 个招录部门</div>
      </div>

      {/* Beat 4 — the rest, re-centred */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 104, textAlign: 'center', ...rise(end)}}>
        <div style={{fontSize: 24, color: C.muted, letterSpacing: 4}}>税务之外</div>
        <div style={{fontSize: 96, fontWeight: 700, lineHeight: 1.1}}>{fmt(f.otherSeats.value)}</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: b.zoom.top + b.zoom.rows * b.zoom.pitch + 26, textAlign: 'center', fontSize: 22, color: C.muted, opacity: end}}>
        放大显示，名额没有增加 · {fmt(f.otherSeats.value)} = {fmt(f.seats.value)} − {fmt(f.taxSeats.value)}
      </div>

      {/* Provenance tag, always on */}
      <div style={{position: 'absolute', right: 40, bottom: 30, fontSize: 15, color: C.faint, textAlign: 'right', lineHeight: 1.6}}>
        数据：2027 国考职位表 {fmt(f.positions.value)} 岗逐岗加总
        <br />
        税务口径：{f.taxSeats.source.rule}
      </div>
    </AbsoluteFill>
  );
};
