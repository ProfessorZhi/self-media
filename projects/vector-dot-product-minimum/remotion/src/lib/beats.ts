// Shot 01 adapter: the approved shot keeps its original API on top of the global timeline.
import {BEATS, FPS as F, seg} from './timeline';

export const FPS = F;
export const CFG = {sweepDeg: [215, 195] as [number, number]};
const S = seg('c1') as {start: number; end: number; lines: {id: string; start: number; end: number}[]};
export const SHOT_DUR = S.end - S.start;

export function beat(name: string): {t0: number; t1: number} {
  const b = BEATS.c1[name];
  const line = S.lines.find((l) => l.id === b.ref);
  if (!line) throw new Error(`beat ${name}: unknown line ${b.ref}`);
  const t0 = line[b.edge] - S.start + b.off;
  return {t0, t1: t0 + b.dur};
}
