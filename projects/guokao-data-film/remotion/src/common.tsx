import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {ChapterRail} from './ChapterRail';
import {C, DPR, FONT, H, W} from './theme';

export const fade = (frame: number, a: number, b: number, c?: number, d?: number) =>
  c === undefined
    ? interpolate(frame, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : interpolate(frame, [a, b, c, d!], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
export const rise = (o: number) => ({opacity: o, transform: `translateY(${(1 - o) * 14}px)`});
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const pct = (v: number, total: number, digits = 1) => `${((v / total) * 100).toFixed(digits)}%`;
export const signedPct = (p: number) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p * 100).toFixed(Math.abs(p) >= 1 ? 0 : 1)}%`;

/** Batches square particles by colour so 35k fillRects stay cheap. */
export class Painter {
  buckets = new Map<string, number[]>();
  add(x: number, y: number, size: number, r: number, g: number, b: number, a: number) {
    if (a < 0.005 || x < -40 || x > W + 40 || y < -40 || y > H + 40) return;
    const k = `${Math.round(r / 6) * 6},${Math.round(g / 6) * 6},${Math.round(b / 6) * 6},${(Math.round(a * 100) / 100).toFixed(2)}`;
    let list = this.buckets.get(k);
    if (!list) this.buckets.set(k, (list = []));
    list.push(x - size / 2, y - size / 2, size);
  }
  flush(ctx: CanvasRenderingContext2D) {
    for (const [key, list] of this.buckets) {
      const [r, g, b, a] = key.split(',');
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      for (let k = 0; k < list.length; k += 3) ctx.fillRect(list[k], list[k + 1], list[k + 2], list[k + 2]);
    }
    this.buckets.clear();
  }
}

/** Standard stage: background, vignette, canvas slot, act rail and provenance line. */
export const Stage: React.FC<{
  act: number;
  canvas?: React.RefObject<HTMLCanvasElement>;
  source: React.ReactNode;
  children?: React.ReactNode;
}> = ({act, canvas, source, children}) => (
  <AbsoluteFill style={{background: C.bg, fontFamily: FONT, color: C.ink, fontVariantNumeric: 'tabular-nums'}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 55%, rgba(40,48,60,0.35), rgba(0,0,0,0) 60%)'}} />
    {canvas ? <canvas ref={canvas} width={W * DPR} height={H * DPR} style={{position: 'absolute', inset: 0, width: W, height: H}} /> : null}
    {children}
    <ChapterRail active={act} />
    <div style={{position: 'absolute', right: 40, bottom: 30, fontSize: 15, color: C.faint, textAlign: 'right', lineHeight: 1.6, maxWidth: 900}}>{source}</div>
  </AbsoluteFill>
);

/** Act heading: small kicker + headline (+ optional sub line). */
export const Heading: React.FC<{o: number; kicker: string; title: React.ReactNode; sub?: React.ReactNode; top?: number; kickerColor?: string}> = ({
  o,
  kicker,
  title,
  sub,
  top = 72,
  kickerColor = C.muted,
}) =>
  o <= 0 ? null : (
    <div style={{position: 'absolute', left: 125, top, ...rise(o)}}>
      <div style={{fontSize: 22, color: kickerColor, letterSpacing: 4}}>{kicker}</div>
      <div style={{fontSize: 42, fontWeight: 700, marginTop: 8}}>{title}</div>
      {sub ? <div style={{fontSize: 22, color: C.muted, marginTop: 10}}>{sub}</div> : null}
    </div>
  );

/** Canvas redrawn on every render (one per frame); draw must be deterministic. */
export function useCanvas(draw: ((ctx: CanvasRenderingContext2D) => void) | null) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !draw) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    draw(ctx);
  });
  return ref;
}

/** Time stretch for acts inside the full film: an act reads frame / k, so k > 1 slows it down. */
export const SlowContext = React.createContext(1);
export const useActFrame = () => useCurrentFrame() / React.useContext(SlowContext);
