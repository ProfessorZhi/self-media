import React from 'react';
import {Composition} from 'remotion';
import {M1TaxReflow, T} from './M1TaxReflow';
import {FPS, H, W} from './theme';

export const Root: React.FC = () => (
  <Composition id="M1-TaxReflow" component={M1TaxReflow} durationInFrames={T.end} fps={FPS} width={W} height={H} />
);
