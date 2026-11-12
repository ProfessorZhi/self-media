import React from 'react';
import {T} from '../theme';

type P = {x: number; y: number};

/** SVG glow filters shared by every stroke in a scene (render once per <svg>). */
export const GlowDefs: React.FC = () => (
  <defs>
    <filter id="glow" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2720" height="1880">
      <feGaussianBlur stdDeviation="6" result="b1" />
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b2" />
      <feMerge>
        <feMergeNode in="b1" />
        <feMergeNode in="b2" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="soft" filterUnits="userSpaceOnUse" x="-400" y="-400" width="2720" height="1880">
      <feGaussianBlur stdDeviation="14" />
    </filter>
  </defs>
);

/** A stroke that draws itself from start to end (p = 0→1) with a bright travelling head. */
export const DrawLine: React.FC<{
  a: P;
  b: P;
  p: number;
  color: string;
  width?: number;
  dash?: string;
  opacity?: number;
  head?: boolean;
  glow?: boolean;
  dashOffset?: number;
}> = ({a, b, p, color, width = 3, dash, opacity = 1, head = true, glow = true, dashOffset}) => {
  if (p <= 0) return null;
  const e = {x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p};
  return (
    <g opacity={opacity}>
      <line x1={a.x} y1={a.y} x2={e.x} y2={e.y} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={dashOffset} filter={glow ? 'url(#glow)' : undefined} />
      {head && p < 1 ? <circle cx={e.x} cy={e.y} r={width * 2.2} fill="#fff" filter="url(#glow)" opacity={0.9} /> : null}
    </g>
  );
};

/** Arrowhead at `tip` pointing along a→tip; scales in with s (0→1). */
export const ArrowHead: React.FC<{a: P; tip: P; s: number; color: string; size?: number}> = ({a, tip, s, color, size = 22}) => {
  if (s <= 0) return null;
  const ang = Math.atan2(tip.y - a.y, tip.x - a.x);
  const k = size * s;
  const p1 = {x: tip.x - k * Math.cos(ang - 0.42), y: tip.y - k * Math.sin(ang - 0.42)};
  const p2 = {x: tip.x - k * Math.cos(ang + 0.42), y: tip.y - k * Math.sin(ang + 0.42)};
  return <path d={`M${p1.x},${p1.y} L${tip.x},${tip.y} L${p2.x},${p2.y}`} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" filter="url(#glow)" />;
};

export const Dot: React.FC<{c: P; s: number; color?: string; r?: number}> = ({c, s, color = T.ink, r = 7}) =>
  s <= 0 ? null : (
    <g>
      <circle cx={c.x} cy={c.y} r={r * 3 * s} fill={color} opacity={0.18 * s} filter="url(#soft)" />
      <circle cx={c.x} cy={c.y} r={r * s} fill={color} filter="url(#glow)" />
    </g>
  );

/** Polyline path drawn progressively via pathLength. */
export const DrawPath: React.FC<{d: string; p: number; color: string; width?: number; opacity?: number; dash?: boolean}> = ({
  d,
  p,
  color,
  width = 3,
  opacity = 1,
  dash,
}) =>
  p <= 0 ? null : (
    <path
      d={d}
      pathLength={1}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dash ? undefined : '1 1'}
      strokeDashoffset={dash ? undefined : 1 - p}
      opacity={opacity * (dash ? p : 1)}
      filter="url(#glow)"
    />
  );
