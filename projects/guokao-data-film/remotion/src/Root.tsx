import React from 'react';
import {Composition} from 'remotion';
import {M1TaxReflow, T} from './M1TaxReflow';
import {S34Structure, T as T34} from './S34Structure';
import {FPS, H, W} from './theme';

export const Root: React.FC = () => (
  <>
    <Composition id="M1-TaxReflow" component={M1TaxReflow} durationInFrames={T.end} fps={FPS} width={W} height={H} />
    <Composition id="S34-Structure" component={S34Structure} durationInFrames={T34.end} fps={FPS} width={W} height={H} />
  </>
);
