import React from 'react';
import {Composition} from 'remotion';
import {Film} from './Film';
import {FPS, TIMING} from './lib/timeline';

export const Root: React.FC = () => (
  <Composition id="Film" component={Film} durationInFrames={Math.ceil(TIMING.duration * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{withAudio: true}} />
);
