import {useCurrentFrame} from 'remotion';
import timing from '../timing.json';
import {easeInOut, prog} from './anim';
import c1 from '../beats/c1.json';
import c2 from '../beats/c2.json';
import c3 from '../beats/c3.json';
import c4 from '../beats/c4.json';
import c5 from '../beats/c5.json';
import c6 from '../beats/c6.json';
import c7 from '../beats/c7.json';
import hook from '../beats/hook.json';

export const FPS = 30;
export type Seg = (typeof timing.segments)[number];
export type Line = {id: string; sub: string; start: number; end: number};
export type Beat = {ref: string; edge: 'start' | 'end'; off: number; dur: number; sfx?: string};

export const TIMING = timing;
export const SEGS = timing.segments as Seg[];
export const ALL_LINES: Line[] = SEGS.flatMap((s) => ((s as {lines?: Line[]}).lines ?? []));
export const BEATS: Record<string, Record<string, Beat>> = {hook, c1, c2, c3, c4, c5, c6, c7} as never;

export const seg = (id: string): Seg => {
  const s = SEGS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown segment ${id}`);
  return s;
};
const lineById = Object.fromEntries(ALL_LINES.map((l) => [l.id, l]));

/** Scene clock: local time plus helpers anchored to the voice lines of this segment. */
export function useScene(id: string) {
  const t = useCurrentFrame() / FPS;
  const s = seg(id);
  const beats = BEATS[id] ?? {};
  const L = (lineId: string) => {
    const l = lineById[lineId];
    if (!l) throw new Error(`unknown line ${lineId}`);
    return {start: l.start - s.start, end: l.end - s.start};
  };
  const B = (name: string) => {
    const b = beats[name];
    if (!b) throw new Error(`${id}: unknown beat ${name}`);
    const t0 = L(b.ref)[b.edge] + b.off;
    return {t0, t1: t0 + b.dur};
  };
  const w = (name: string, ease = easeInOut) => {
    const b = B(name);
    return prog(t, b.t0, b.t1, ease);
  };
  return {t, dur: s.end - s.start, B, w, L};
}
