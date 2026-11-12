import React from 'react';
import {AbsoluteFill, interpolateColors, useCurrentFrame} from 'remotion';
import cards from '../cards.json';
import {backOut, easeInOut, easeOut, prog} from '../lib/anim';
import {FPS, TIMING} from '../lib/timeline';
import {T} from '../theme';

// Data-driven Bauhaus chapter card (src/cards.json). Each card's shapes echo its chapter.
// Entry: a cream panel wipes in behind a black leading edge. Exit: the red circle swells to
// fill the frame and cools into the line-art night (morph); the final card fades to black.

type Shape = {
  type: string;
  at: number;
  color: string;
  multiply?: boolean;
  x?: number;
  y?: number;
  r?: number;
  w?: number;
  h?: number;
  pts?: number[][];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  amp?: number;
  cycles?: number;
  stroke?: number;
  step?: number;
};
type Card = {num: string; title: string[]; sub: string; swell: {x: number; y: number; r: number} | null; final?: boolean; shapes: Shape[]};

const col = (c: string) => (T as Record<string, string>)[c] ?? c;

const ShapeEl: React.FC<{s: Shape; t: number}> = ({s, t}) => {
  const fill = col(s.color);
  const blend = s.multiply ? {mixBlendMode: 'multiply' as const} : undefined;
  switch (s.type) {
    case 'circle': {
      const p = prog(t, s.at, s.at + 0.5, backOut);
      return <circle cx={s.x} cy={s.y} r={Math.max(0, (s.r ?? 0) * p)} fill={fill} style={blend} />;
    }
    case 'ring': {
      const p = prog(t, s.at, s.at + 0.8, easeInOut);
      return <circle cx={s.x} cy={s.y} r={s.r} fill="none" stroke={fill} strokeWidth={s.w} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} transform={`rotate(-90 ${s.x} ${s.y})`} style={blend} />;
    }
    case 'rect': {
      const p = prog(t, s.at, s.at + 0.4, backOut);
      const w = (s.w ?? 0) * p;
      const h = (s.h ?? 0) * p;
      return <rect x={(s.x ?? 0) + ((s.w ?? 0) - w) / 2} y={(s.y ?? 0) + ((s.h ?? 0) - h) / 2} width={Math.max(0, w)} height={Math.max(0, h)} fill={fill} style={blend} />;
    }
    case 'tri': {
      const p = prog(t, s.at, s.at + 0.5, easeOut);
      return <polygon points={(s.pts ?? []).map((q) => q.join(',')).join(' ')} fill={fill} opacity={p} transform={`translate(0 ${(1 - p) * 380})`} style={blend} />;
    }
    case 'line':
    case 'arrow': {
      const p = prog(t, s.at, s.at + 0.45, easeInOut);
      const x2 = (s.x1 ?? 0) + ((s.x2 ?? 0) - (s.x1 ?? 0)) * p;
      const y2 = (s.y1 ?? 0) + ((s.y2 ?? 0) - (s.y1 ?? 0)) * p;
      const ang = Math.atan2((s.y2 ?? 0) - (s.y1 ?? 0), (s.x2 ?? 0) - (s.x1 ?? 0));
      const k = 34;
      return (
        <g>
          <line x1={s.x1} y1={s.y1} x2={x2} y2={y2} stroke={fill} strokeWidth={s.w} />
          {s.type === 'arrow' && p > 0.9 ? (
            <polygon points={`${x2},${y2} ${x2 - k * Math.cos(ang - 0.45)},${y2 - k * Math.sin(ang - 0.45)} ${x2 - k * Math.cos(ang + 0.45)},${y2 - k * Math.sin(ang + 0.45)}`} fill={fill} />
          ) : null}
        </g>
      );
    }
    case 'wave': {
      const p = prog(t, s.at, s.at + 0.8, easeInOut);
      const n = 80;
      const pts = Array.from({length: n + 1}, (_, i) => {
        const u = i / n;
        return `${(s.x ?? 0) + u * (s.w ?? 0)},${(s.y ?? 0) - (s.amp ?? 0) * Math.cos(2 * Math.PI * (s.cycles ?? 1) * u)}`;
      });
      return <polyline points={pts.join(' ')} fill="none" stroke={fill} strokeWidth={s.stroke} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} strokeLinecap="square" />;
    }
    case 'grid': {
      const p = prog(t, s.at, s.at + 0.6, easeOut);
      const lines = [];
      for (let x = s.x ?? 0; x <= (s.x ?? 0) + (s.w ?? 0) + 0.1; x += s.step ?? 80) lines.push(<line key={`x${x}`} x1={x} y1={s.y} x2={x} y2={(s.y ?? 0) + (s.h ?? 0) * p} stroke={fill} strokeWidth={2} opacity={0.35} />);
      for (let y = s.y ?? 0; y <= (s.y ?? 0) + (s.h ?? 0) + 0.1; y += s.step ?? 80) lines.push(<line key={`y${y}`} x1={s.x} y1={y} x2={(s.x ?? 0) + (s.w ?? 0) * p} y2={y} stroke={fill} strokeWidth={2} opacity={0.35} />);
      return <g>{lines}</g>;
    }
    default:
      return null;
  }
};

export const BauhausCard: React.FC<{id: string}> = ({id}) => {
  const t = useCurrentFrame() / FPS;
  const card = (cards as Record<string, Card>)[id];
  const {dur: dflt, overlap, wipe} = TIMING.card;
  const dur = (TIMING.segments.find((s) => s.id === id) as {dur?: number}).dur ?? dflt;
  const exit0 = dur - overlap;
  const swell = card.swell ? prog(t, exit0, dur - 0.15, easeInOut) : 0;
  const contentFade = card.swell ? 1 - prog(t, exit0, exit0 + 0.35, easeInOut) : 1;
  const finalFade = card.final ? 1 - prog(t, dur - 1.1, dur, easeInOut) : 1;
  const fadeOut = card.swell ? 1 - prog(t, dur - 0.3, dur, easeInOut) : 1;
  const wp = prog(t, 0, wipe, easeInOut);
  const edge = 1920 * wp;
  const sub = prog(t, 1.0, 1.4, easeOut);
  const num = prog(t, 0.3, 0.75, easeOut);
  const big = card.title.length > 1 || !card.num;
  const sw = card.swell;
  const circ = sw ? prog(t, 0.2, 0.75, backOut) : 0;
  const swellColor = interpolateColors(swell, [0, 0.55, 1], [T.bRed, '#7a2a2a', T.bg]);

  return (
    <AbsoluteFill style={{opacity: fadeOut * finalFade, clipPath: wp < 1 ? `inset(0 ${1920 - edge}px 0 0)` : undefined}}>
      <AbsoluteFill style={{background: T.paper, fontFamily: T.font}}>
        <svg width={1920} height={1080} style={{position: 'absolute', opacity: 0.5 * contentFade}}>
          {Array.from({length: 41}, (_, i) => (
            <line key={`v${i}`} x1={i * 48} y1={0} x2={i * 48} y2={1080} stroke="#d8cfbb" strokeWidth={1} />
          ))}
          {Array.from({length: 23}, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 48} x2={1920} y2={i * 48} stroke="#d8cfbb" strokeWidth={1} />
          ))}
        </svg>
        <svg width={1920} height={1080} style={{position: 'absolute'}}>
          {sw && swell === 0 ? <circle cx={sw.x} cy={sw.y} r={sw.r * circ} fill={T.bRed} /> : null}
          <g opacity={contentFade}>
            <rect x={120} y={140} width={880 * prog(t, 0.1, 0.55, easeOut)} height={22} fill={T.bBlack} />
            {card.shapes.map((s, i) => (
              <ShapeEl key={i} s={s} t={t} />
            ))}
          </g>
          {sw && swell > 0 ? <circle cx={sw.x} cy={sw.y} r={sw.r + swell * 2300} fill={swellColor} /> : null}
        </svg>
        <div style={{position: 'absolute', left: 120, top: big ? 250 : 230, opacity: contentFade}}>
          {card.num ? (
            <div style={{fontSize: 260, fontWeight: 700, color: T.bBlack, lineHeight: 1, letterSpacing: -8, transform: `translateY(${(1 - num) * 60}px)`, opacity: num}}>{card.num}</div>
          ) : null}
          {card.title.map((line, li) => (
            <div key={li} style={{display: 'flex', marginTop: card.num ? 28 : li === 0 ? 0 : 10}}>
              {[...line].map((ch, i) => {
                const k = li * 8 + i;
                const p = prog(t, 0.5 + k * 0.05, 0.85 + k * 0.05, easeOut);
                return (
                  <span key={i} style={{fontSize: big ? 112 : card.title[0].length > 9 ? 80 : 96, fontWeight: 700, color: card.final && li === 0 ? T.bRed : T.bBlack, display: 'inline-block', whiteSpace: 'pre', opacity: p, transform: `translateY(${(1 - p) * 40}px)`}}>
                    {ch}
                  </span>
                );
              })}
            </div>
          ))}
          <div style={{marginTop: 26, fontSize: 30, fontWeight: 500, color: '#3a3a3a', letterSpacing: 6, opacity: sub}}>{card.sub}</div>
        </div>
        <div style={{position: 'absolute', left: 120, bottom: 90, fontSize: 24, color: '#555', letterSpacing: 2, opacity: sub * contentFade}}>
          VIDEO-002 · 一道向量最值题，藏着多少种解法？
        </div>
      </AbsoluteFill>
      {wp < 1 ? <div style={{position: 'absolute', left: edge - 22, top: 0, width: 22, height: 1080, background: T.bBlack}} /> : null}
    </AbsoluteFill>
  );
};
