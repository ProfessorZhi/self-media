import React from 'react';
import {easeOut, prog} from '../lib/anim';
import {T} from '../theme';
import {Tex} from './Tex';

export type Step = {
  at: number; // local seconds when the line appears
  tex?: string;
  text?: string;
  size?: number;
  color?: string;
  dimAt?: number;
  boxAt?: number;
  hideAt?: number;
  gap?: number;
};

/** Left formula column: lines appear in order, older lines dim, key results get a gold box. */
export const Steps: React.FC<{t: number; items: Step[]; left?: number; top?: number}> = ({t, items, left = 120, top = 150}) => (
  <div style={{position: 'absolute', left, top, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', color: T.ink, fontFamily: T.font}}>
    {items.map((it, i) => {
      const a = prog(t, it.at, it.at + 0.45, easeOut);
      const hide = it.hideAt !== undefined ? prog(t, it.hideAt, it.hideAt + 0.35) : 0;
      // collapse hidden lines so the column reflows upward
      const visible = a > 0 && hide < 1;
      if (!visible && (it.hideAt !== undefined ? t > it.hideAt : true)) return null;
      const dim = it.dimAt !== undefined ? prog(t, it.dimAt, it.dimAt + 0.4) : 0;
      const box = it.boxAt !== undefined ? prog(t, it.boxAt, it.boxAt + 0.35, easeOut) : 0;
      const size = it.size ?? 54;
      return (
        <div
          key={i}
          style={{
            marginTop: i === 0 ? 0 : it.gap ?? 22,
            opacity: a * (1 - hide) * (1 - 0.55 * dim),
            transform: `translateY(${(1 - a) * 18}px)`,
            filter: hide > 0 ? `blur(${hide * 6}px)` : undefined,
            position: 'relative',
            padding: '6px 14px',
            marginLeft: -14,
            borderRadius: 6,
            border: `2px solid rgba(232,193,112,${0.9 * box})`,
            boxShadow: box > 0 ? `0 0 ${28 * box}px rgba(232,193,112,${0.25 * box})` : undefined,
            color: it.color ?? T.ink,
          }}
        >
          {it.tex ? <Tex tex={it.tex} size={size} /> : <span style={{fontSize: size * 0.68, fontWeight: 500, letterSpacing: 1}}>{it.text}</span>}
        </div>
      );
    })}
  </div>
);
