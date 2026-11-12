import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Subtitles} from './components/Subtitles';
import {ensureFonts} from './lib/fonts';
import {FPS, SEGS, TIMING} from './lib/timeline';
import {BauhausCard} from './scenes/BauhausCard';
import {Hook} from './scenes/Hook';
import {Method1Area} from './scenes/Method1Area';
import {Method2Circle} from './scenes/Method2Circle';
import {Method3Circum} from './scenes/Method3Circum';
import {Method4Trig} from './scenes/Method4Trig';
import {Method56} from './scenes/Method56';
import {Shot01Projection} from './scenes/Shot01Projection';
import {Wrap} from './scenes/Wrap';
import {T} from './theme';

ensureFonts();

const SHOTS: Record<string, React.FC> = {
  hook: Hook,
  c1: Shot01Projection,
  c2: Method1Area,
  c3: Method2Circle,
  c4: Method3Circum,
  c5: Method4Trig,
  c6: Method56,
  c7: Wrap,
};

const f = (s: number) => Math.round(s * FPS);

const GlobalSubs: React.FC = () => <Subtitles t={useCurrentFrame() / FPS} />;

export const Film: React.FC<{withAudio?: boolean}> = ({withAudio = true}) => (
  <AbsoluteFill style={{background: T.bg}}>
    {/* shots run on under the next card's entry wipe */}
    {SEGS.filter((s) => s.kind === 'shot').map((s) => {
      const Comp = SHOTS[s.id];
      return (
        <Sequence key={s.id} from={f(s.start)} durationInFrames={f(s.end - s.start + TIMING.card.wipe + 0.1)} name={s.id}>
          <Comp />
        </Sequence>
      );
    })}
    {SEGS.filter((s) => s.kind === 'card').map((s) => (
      <Sequence key={s.id} from={f(s.start)} durationInFrames={f((s as {dur: number}).dur)} name={`card ${s.id}`}>
        <BauhausCard id={s.id} />
      </Sequence>
    ))}
    <GlobalSubs />
    {withAudio ? (
      <>
        <Audio src={staticFile('voice/film.mp3')} />
        <Audio src={staticFile('audio/bed.wav')} />
      </>
    ) : null}
  </AbsoluteFill>
);
