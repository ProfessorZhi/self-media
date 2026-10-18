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

// The full film: six acts back to back. Act I hands its seat field straight to Act II;
// the other joins dip through the background for a few frames.
const DIP = 16;
// Acts are slowed by K (they read frame / K); bookends run in real time.
export const K = timeline.slow;
// The score (scripts/compose_score.py) reads timeline.json; keep the acts in sync with it.
const check: [string, number][] = [['act1', T1.end], ['act2', T2.end], ['act3', T3.end], ['act4', T4.end], ['act5', T5.end], ['act7', T7.end], ['act6', T6.end]];
check.forEach(([k, v]) => {
  if ((timeline.actLocal as Record<string, number>)[k] !== v) throw new Error(`timeline.json ${k}=${(timeline.actLocal as Record<string, number>)[k]} but act is ${v}`);
});
if (timeline.prologue !== PROLOGUE || timeline.epilogue !== EPILOGUE) throw new Error('timeline.json bookends out of sync');
export const ACTS = [
  {C: Prologue, len: PROLOGUE, k: 1, fadeIn: false, fadeOut: true},
  {C: Act1Crowded, len: Math.round(T1.end * K), k: K, fadeIn: true, fadeOut: false},
  {C: Act2WhoHires, len: Math.round(T2.end * K), k: K, fadeIn: false, fadeOut: true},
  {C: Act3Change, len: Math.round(T3.end * K), k: K, fadeIn: true, fadeOut: true},
  {C: Act4Profile, len: Math.round(T4.end * K), k: K, fadeIn: true, fadeOut: true},
  {C: Act5Scores, len: Math.round(T5.end * K), k: K, fadeIn: true, fadeOut: true},
  {C: Act7Thinking, len: Math.round(T7.end * K), k: K, fadeIn: true, fadeOut: true},
  {C: Act6OneSeat, len: Math.round(T6.end * K), k: K, fadeIn: true, fadeOut: true},
  {C: Epilogue, len: EPILOGUE, k: 1, fadeIn: true, fadeOut: false},
];
export const OFFSETS = ACTS.reduce<number[]>((o, a, i) => [...o, i ? o[i - 1] + ACTS[i - 1].len : 0], []);
export const FILM_LENGTH = ACTS.reduce((t, a) => t + a.len, 0);

const Fader: React.FC<{len: number; fadeIn: boolean; fadeOut: boolean; children: React.ReactNode}> = ({len, fadeIn, fadeOut, children}) => {
  const f = useCurrentFrame();
  const a = Math.min(fadeIn ? interpolate(f, [0, DIP], [0, 1], {extrapolateRight: 'clamp'}) : 1, fadeOut ? interpolate(f, [len - DIP, len], [1, 0], {extrapolateLeft: 'clamp'}) : 1);
  return <AbsoluteFill style={{opacity: a}}>{children}</AbsoluteFill>;
};

export const Film: React.FC = () => (
  <AbsoluteFill style={{background: C.bg}}>
    {ACTS.map((a, i) => (
      <Sequence key={i} from={OFFSETS[i]} durationInFrames={a.len}>
        <Fader len={a.len} fadeIn={a.fadeIn} fadeOut={a.fadeOut}>
          <SlowContext.Provider value={a.k}>
            <a.C />
          </SlowContext.Provider>
        </Fader>
      </Sequence>
    ))}
    <Audio src={staticFile('score.wav')} />
  </AbsoluteFill>
);
