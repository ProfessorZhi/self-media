import React from 'react';
import {AbsoluteFill, interpolateColors, useCurrentFrame} from 'remotion';
import {backOut, easeInOut, easeOut, prog} from '../lib/anim';
import {CFG, FPS} from '../lib/beats';
import {T} from '../theme';

// Bauhaus geometric-construction chapter card. The shapes quietly echo the problem:
// yellow right triangle = ABC, blue square = the right angle at A, red circle = the
// circle that will later solve it, black rule = its diameter BC.
// Exit: the red circle swells to fill the frame and cools into the line-art night (morph).

const TITLE = '把点积变成投影';
const CIRCLE = {x: 1385, y: 500, r: 235};

export const ChapterCard: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const {dur, overlap} = CFG.card;
  const exit0 = dur - overlap; // circle starts to swell
  const swell = prog(t, exit0, dur - 0.15, easeInOut);
  const fadeOut = 1 - prog(t, dur - 0.3, dur, easeInOut);

  const bar = prog(t, 0.1, 0.55, easeOut);
  const circ = prog(t, 0.2, 0.75, backOut);
  const tri = prog(t, 0.35, 0.85, easeOut);
  const sq = prog(t, 0.55, 0.85, backOut);
  const diam = prog(t, 0.75, 1.2, easeInOut);
  const num = prog(t, 0.3, 0.75, easeOut);
  const sub = prog(t, 1.0, 1.4, easeOut);
  const contentFade = 1 - prog(t, exit0, exit0 + 0.35, easeInOut);

  const r = CIRCLE.r * circ + swell * 2300;
  const circleColor = interpolateColors(swell, [0, 0.55, 1], [T.bRed, '#7a2a2a', T.bg]);
  const ang = (-60 * Math.PI) / 180;
  const dx = Math.cos(ang) * CIRCLE.r * 1.25;
  const dy = Math.sin(ang) * CIRCLE.r * 1.25;

  return (
    <AbsoluteFill style={{background: T.paper, opacity: fadeOut, fontFamily: T.font}}>
      {/* construction grid */}
      <svg width={1920} height={1080} style={{position: 'absolute', opacity: 0.5 * contentFade}}>
        {Array.from({length: 41}, (_, i) => (
          <line key={`v${i}`} x1={i * 48} y1={0} x2={i * 48} y2={1080} stroke="#d8cfbb" strokeWidth={1} />
        ))}
        {Array.from({length: 23}, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 48} x2={1920} y2={i * 48} stroke="#d8cfbb" strokeWidth={1} />
        ))}
      </svg>
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <g opacity={contentFade}>
          <rect x={120} y={140} width={880 * bar} height={22} fill={T.bBlack} />
          <polygon
            points="1080,900 1080,470 1560,900"
            fill={T.bYellow}
            transform={`translate(0 ${(1 - tri) * 420})`}
            opacity={tri}
          />
          <rect x={1080 - 0} y={900 - 96 * sq} width={96 * sq} height={96 * sq} fill={T.bBlue} />
        </g>
        <circle cx={CIRCLE.x} cy={CIRCLE.y} r={Math.max(0, r)} fill={circleColor} style={{mixBlendMode: swell > 0 ? 'normal' : 'multiply'}} />
        <g opacity={contentFade}>
          <line
            x1={CIRCLE.x - dx}
            y1={CIRCLE.y - dy}
            x2={CIRCLE.x - dx + 2 * dx * diam}
            y2={CIRCLE.y - dy + 2 * dy * diam}
            stroke={T.bBlack}
            strokeWidth={8}
          />
          <circle cx={CIRCLE.x} cy={CIRCLE.y} r={10 * diam} fill={T.paper} />
        </g>
      </svg>
      <div style={{position: 'absolute', left: 120, top: 230, opacity: contentFade}}>
        <div style={{fontSize: 260, fontWeight: 700, color: T.bBlack, lineHeight: 1, letterSpacing: -8, transform: `translateY(${(1 - num) * 60}px)`, opacity: num}}>01</div>
        <div style={{display: 'flex', marginTop: 28}}>
          {[...TITLE].map((ch, i) => {
            const p = prog(t, 0.5 + i * 0.06, 0.85 + i * 0.06, easeOut);
            return (
              <span key={i} style={{fontSize: 96, fontWeight: 700, color: T.bBlack, display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 40}px)`}}>
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{marginTop: 26, fontSize: 30, fontWeight: 500, color: '#3a3a3a', letterSpacing: 6, opacity: sub}}>
          DOT PRODUCT → PROJECTION
        </div>
      </div>
      <div style={{position: 'absolute', left: 120, bottom: 90, fontSize: 24, color: '#555', letterSpacing: 2, opacity: sub * contentFade}}>
        VIDEO-002 · 一道向量最值题，藏着多少种解法？
      </div>
    </AbsoluteFill>
  );
};
