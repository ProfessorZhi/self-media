import React from 'react';
import {Composition} from 'remotion';
import {Act1Crowded, T as T1} from './Act1Crowded';
import {Act2WhoHires, T as T2} from './Act2WhoHires';
import {Act3Change, T as T3} from './Act3Change';
import {Act4Profile, T as T4} from './Act4Profile';
import {Act5Scores, T as T5} from './Act5Scores';
import {Act6OneSeat, T as T6} from './Act6OneSeat';
import {Act7Thinking, T as T7} from './Act7Thinking';
import {Epilogue, EPILOGUE, Prologue, PROLOGUE} from './Bookends';
import {FILM_LENGTH, Film} from './Film';
import {FPS, H, W} from './theme';

export const Root: React.FC = () => (
  <>
    <Composition id="GuokaoUniverse" component={Film} durationInFrames={FILM_LENGTH} fps={FPS} width={W} height={H} />
    <Composition id="Act1-Crowded" component={Act1Crowded} durationInFrames={T1.end} fps={FPS} width={W} height={H} />
    <Composition id="Act2-WhoHires" component={Act2WhoHires} durationInFrames={T2.end} fps={FPS} width={W} height={H} />
    <Composition id="Act3-Change" component={Act3Change} durationInFrames={T3.end} fps={FPS} width={W} height={H} />
    <Composition id="Act4-Profile" component={Act4Profile} durationInFrames={T4.end} fps={FPS} width={W} height={H} />
    <Composition id="Act5-Scores" component={Act5Scores} durationInFrames={T5.end} fps={FPS} width={W} height={H} />
    <Composition id="Act6-OneSeat" component={Act6OneSeat} durationInFrames={T6.end} fps={FPS} width={W} height={H} />
    <Composition id="Act7-Thinking" component={Act7Thinking} durationInFrames={T7.end} fps={FPS} width={W} height={H} />
    <Composition id="Prologue" component={Prologue} durationInFrames={PROLOGUE} fps={FPS} width={W} height={H} />
    <Composition id="Epilogue" component={Epilogue} durationInFrames={EPILOGUE} fps={FPS} width={W} height={H} />
  </>
);
