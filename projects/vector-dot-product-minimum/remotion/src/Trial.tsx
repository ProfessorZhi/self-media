import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {CFG, FPS, SHOT_DUR, SHOT_START} from './lib/beats';
import {ensureFonts} from './lib/fonts';
import {ChapterCard} from './scenes/ChapterCard';
import {Shot01Projection} from './scenes/Shot01Projection';
import {T} from './theme';

ensureFonts();

export const Shot01Trial: React.FC<{withAudio?: boolean}> = ({withAudio = true}) => {
  const shotFrom = Math.round(SHOT_START * FPS);
  return (
    <AbsoluteFill style={{background: T.bg}}>
      <Sequence from={shotFrom} durationInFrames={Math.round(SHOT_DUR * FPS)} name="Shot01 · 点积→投影">
        <Shot01Projection />
        {withAudio ? <Audio src={staticFile('voice/shot01.mp3')} /> : null}
      </Sequence>
      <Sequence from={0} durationInFrames={Math.round(CFG.card.dur * FPS)} name="Chapter card · Bauhaus">
        <ChapterCard />
      </Sequence>
      {withAudio ? <Audio src={staticFile('audio/bed.wav')} /> : null}
    </AbsoluteFill>
  );
};
