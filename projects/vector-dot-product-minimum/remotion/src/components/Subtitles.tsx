import React from 'react';
import {T} from '../theme';
import {ALL_LINES} from '../lib/timeline';

/** Plain follow-along subtitles on the global clock: whole line, hard cut, no punctuation. */
export const Subtitles: React.FC<{t: number}> = ({t}) => {
  const line = ALL_LINES.find((l) => t >= l.start - 0.05 && t < l.end + 0.12);
  if (!line) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 56, textAlign: 'center', fontFamily: T.font, fontWeight: 500, fontSize: 44, color: T.ink, letterSpacing: 1, textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9)'}}>
      {line.sub}
    </div>
  );
};
