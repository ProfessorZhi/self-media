import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Act1Crowded, T as T1} from './Act1Crowded';
import {Act2WhoHires, T as T2} from './Act2WhoHires';
import {Act3Change, T as T3} from './Act3Change';
import {Act4Profile, T as T4} from './Act4Profile';
import {Act5Scores, T as T5} from './Act5Scores';
import {Act6OneSeat, T as T6} from './Act6OneSeat';
import {Act7Thinking, T as T7} from './Act7Thinking';
import {Epilogue, EPILOGUE, Prologue, PROLOGUE} from './Bookends';
import {SlowContext} from './common';
import {C} from './theme';
import timeline from './timeline.json';

// Full film: prologue + seven story acts + epilogue. Act I hands its seat field straight to Act II;
// the other joins dip through the background for a few frames.
// Acts are slowed by K (they read frame / K); bookends run in real time.
export const K = timeline.slow;
// The score (scripts/compose_score.py) reads timeline.json; keep the acts in sync with it.
const check: [string, number][] = [['act1', T1.end], ['act2', T2.end], ['act3', T3.end], ['act4', T4.end], ['act5', T5.end], ['act7', T7.end], ['act6', T6.end]];
check.forEach(([k, v]) => {
  if ((timeline.actLocal as Record<string, number>)[k] !== v) throw new Error(`timeline.json ${k}=${(timeline.actLocal as Record<string, number>)[k]} but act is ${v}`);
});
if (timeline.prologue !== PROLOGUE || timeline.epilogue !== EPILOGUE) throw new Error('timeline.json bookends out of sync');
// Joins cross-dissolve: the incoming block fades in on top of the outgoing one over XF frames.
// Act I hands its seat field straight to Act II, so that join is a hard, seamless cut.
const XF = timeline.crossfade;
const blocks: Record<string, {C: React.FC; len: number; k: number}> = {
  prologue: {C: Prologue, len: PROLOGUE, k: 1},
  act1: {C: Act1Crowded, len: Math.round(T1.end * K), k: K},
  act2: {C: Act2WhoHires, len: Math.round(T2.end * K), k: K},
  act3: {C: Act3Change, len: Math.round(T3.end * K), k: K},
  act4: {C: Act4Profile, len: Math.round(T4.end * K), k: K},
  act5: {C: Act5Scores, len: Math.round(T5.end * K), k: K},
  act7: {C: Act7Thinking, len: Math.round(T7.end * K), k: K},
  act6: {C: Act6OneSeat, len: Math.round(T6.end * K), k: K},
  epilogue: {C: Epilogue, len: EPILOGUE, k: 1},
};
export const ACTS = timeline.order.map((name, i) => ({
  name,
  ...blocks[name],
  fadeIn: i > 0 && !timeline.seamless.includes(name),
}));
export const OFFSETS = ACTS.reduce<number[]>((o, a, i) => [...o, i ? o[i - 1] + ACTS[i - 1].len - (a.fadeIn ? XF : 0) : 0], []);
export const FILM_LENGTH = OFFSETS[OFFSETS.length - 1] + ACTS[ACTS.length - 1].len;

const Fader: React.FC<{fadeIn: boolean; children: React.ReactNode}> = ({fadeIn, children}) => {
  const f = useCurrentFrame();
  const a = fadeIn ? interpolate(f, [0, XF], [0, 1], {extrapolateRight: 'clamp', easing: (x: number) => x * x * (3 - 2 * x)}) : 1;
  return <AbsoluteFill style={{opacity: a}}>{children}</AbsoluteFill>;
};

export const Film: React.FC = () => (
  <AbsoluteFill style={{background: C.bg}}>
    {ACTS.map((a, i) => (
      <Sequence key={a.name} from={OFFSETS[i]} durationInFrames={a.len}>
        <Fader fadeIn={a.fadeIn}>
          <SlowContext.Provider value={a.k}>
            <a.C />
          </SlowContext.Provider>
        </Fader>
      </Sequence>
    ))}
    <Audio src={staticFile('score.wav')} />
  </AbsoluteFill>
);
