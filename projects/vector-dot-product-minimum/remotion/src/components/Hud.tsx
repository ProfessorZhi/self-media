import React from 'react';
import {T} from '../theme';

export const Hud: React.FC<{label: string}> = ({label}) => (
  <>
    <div style={{position: 'absolute', left: 120, top: 70, fontSize: 22, letterSpacing: 4, color: T.muted, fontFamily: T.font}}>{label}</div>
    <div style={{position: 'absolute', right: 120, top: 70, fontSize: 22, letterSpacing: 4, color: T.muted, fontFamily: T.font}}>VIDEO-002</div>
  </>
);

/** Dark stage background shared by all line-art shots. */
export const Stage: React.FC<{children: React.ReactNode; fade?: number}> = ({children, fade = 1}) => (
  <div style={{position: 'absolute', inset: 0, background: `radial-gradient(1200px 800px at 55% 55%, ${T.bgLift} 0%, ${T.bg} 70%)`, opacity: fade, fontFamily: T.font}}>
    <svg width={1920} height={1080} style={{position: 'absolute', opacity: 0.55}}>
      {Array.from({length: 24 * 14}, (_, i) => (
        <circle key={i} cx={(i % 24) * 84 + 18} cy={Math.floor(i / 24) * 80 + 20} r={1.3} fill={T.faint} />
      ))}
    </svg>
    {children}
  </div>
);
