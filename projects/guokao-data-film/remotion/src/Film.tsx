import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Act1Crowded, T as T1} from './Act1Crowded';
import {Act2WhoHires, T as T2} from './Act2WhoHires';
import {Act3Change, T as T3} from './Act3Change';
import {Act4Profile, T as T4} from './Act4Profile';
import {Act5Scores, T as T5} from './Act5Scores';
import {Act6OneSeat, T as T6} from './Act6OneSeat';
import {C} from './theme';

// The full film: six acts back to back. Act I hands its seat field straight to Act II;
// the other joins dip through the background for a few frames.
const DIP = 16;
export const ACTS = [
  {C: Act1Crowded, len: T1.end, fadeIn: false, fadeOut: false},
  {C: Act2WhoHires, len: T2.end, fadeIn: false, fadeOut: true},
  {C: Act3Change, len: T3.end, fadeIn: true, fadeOut: true},
  {C: Act4Profile, len: T4.end, fadeIn: true, fadeOut: true},
  {C: Act5Scores, len: T5.end, fadeIn: true, fadeOut: true},
  {C: Act6OneSeat, len: T6.end, fadeIn: true, fadeOut: false},
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
          <a.C />
        </Fader>
      </Sequence>
    ))}
    <Audio src={staticFile('score.wav')} />
  </AbsoluteFill>
);
