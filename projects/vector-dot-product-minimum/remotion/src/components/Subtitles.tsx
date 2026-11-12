import React from 'react';
import {T} from '../theme';
import {LINES} from '../lib/beats';

/** Plain follow-along subtitles: whole line appears hard, no punctuation, no motion. */
export const Subtitles: React.FC<{t: number}> = ({t}) => {
  const line = LINES.find((l) => t >= l.start - 0.05 && t < l.end + 0.12);
  if (!line) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 64, textAlign: 'center', fontFamily: T.font, fontWeight: 500, fontSize: 44, color: T.ink, letterSpacing: 1, textShadow: '0 2px 12px rgba(0,0,0,0.85)'}}>
      {line.sub}
    </div>
  );
};
