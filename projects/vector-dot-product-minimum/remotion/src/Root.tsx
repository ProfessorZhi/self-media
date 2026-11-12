import React from 'react';
import {Composition} from 'remotion';
import {CFG, FPS, TRIAL_DUR} from './lib/beats';
import {Shot01Trial} from './Trial';

export const Root: React.FC = () => (
  <>
    <Composition id="Shot01Trial" component={Shot01Trial} durationInFrames={Math.ceil(TRIAL_DUR * FPS)} fps={FPS} width={CFG.width} height={CFG.height} defaultProps={{withAudio: true}} />
  </>
);
