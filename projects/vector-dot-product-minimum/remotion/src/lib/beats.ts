import cfg from '../beats.json';
import timing from '../timing.json';

type Beat = {ref: string; edge: 'start' | 'end'; off: number; dur: number};
export const CFG = cfg;
export const FPS = cfg.fps;
export const LINES = timing.lines;

const lineById = Object.fromEntries(timing.lines.map((l) => [l.id, l]));

/** Shot-local [start, end] seconds of a named beat (anchored to a voice line). */
export function beat(name: keyof typeof cfg.beats): {t0: number; t1: number} {
  const b = cfg.beats[name] as Beat;
  const line = lineById[b.ref];
  if (!line) throw new Error(`beat ${name}: unknown line ${b.ref}`);
  const t0 = line[b.edge] + b.off;
  return {t0, t1: t0 + b.dur};
}

export const SHOT_DUR = timing.duration + cfg.shotTail;
export const SHOT_START = cfg.card.dur - cfg.card.overlap; // global seconds
export const TRIAL_DUR = SHOT_START + SHOT_DUR;
