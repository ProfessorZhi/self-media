import React from 'react';
import {C} from './theme';

export const ACTS = ['越来越挤', '谁在招', '一年巨变', '门槛与画像', '分数', '一个座位'];

/** Thin act rail along the bottom: where we are in the film. */
export const ChapterRail: React.FC<{active: number; opacity?: number}> = ({active, opacity = 1}) => (
  <div style={{position: 'absolute', left: 125, bottom: 34, display: 'flex', gap: 26, fontSize: 15, opacity}}>
    {ACTS.map((name, i) => (
      <div key={name} style={{color: i === active ? C.ink : C.faint, display: 'flex', alignItems: 'center', gap: 8}}>
        <span style={{width: 18, height: 2, background: i === active ? C.coralCss : C.faint, display: 'inline-block'}} />
        {name}
      </div>
    ))}
  </div>
);
