import React from 'react';
import {Composition} from 'remotion';
import {Act2WhoHires, T as T2} from './Act2WhoHires';
import {FPS, H, W} from './theme';

export const Root: React.FC = () => (
  <>
    <Composition id="Act2-WhoHires" component={Act2WhoHires} durationInFrames={T2.end} fps={FPS} width={W} height={H} />
  </>
);
