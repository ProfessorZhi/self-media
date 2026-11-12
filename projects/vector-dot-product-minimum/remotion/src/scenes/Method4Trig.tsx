import React from 'react';
import {backOut, easeInOut, easeOut, prog} from '../lib/anim';
import {useScene} from '../lib/timeline';
import {dFromTheta, trigDot} from '../lib/geometry';
import {Figure} from '../components/Figure';
import {GlowDefs} from '../components/Draw';
import {Hud, Stage} from '../components/Hud';
import {Steps} from '../components/Steps';
import {Tex} from '../components/Tex';
import {T} from '../theme';

// Solution 4: θ = ∠DAC, AD = 4 sin(60° − θ), AD·AB = −8 sin θ sin(60° − θ) = 2 − 4 cos(2θ − 60°) ≥ −2.
// The figure (top right) and the graph (bottom right) are driven by the same θ.

const GX = 1080;
const GY = 650;
const GW = 680;
const GH = 280;
const gx = (th: number) => GX + (th / 60) * GW;
const gy = (v: number) => GY + ((0.4 - v) / 2.8) * GH; // v ∈ [-2.4, 0.4]

export const Method4Trig: React.FC = () => {
  const {t, dur, B, w} = useScene('c5');
  const fade = prog(t, 0, 0.5);
  const base = prog(t, 0, 0.5);

  // θ choreography: rest at 45°, sweep 45 → 12 → 52 → 30, lock at 30°.
  const sw = B('sweep');
  const u = prog(t, sw.t0, sw.t1, (x) => x);
  const keys = [45, 12, 52, 30];
  const seg = Math.min(2, Math.floor(u * 3));
  const lu = easeInOut(Math.min(1, u * 3 - seg));
  const theta = u <= 0 ? 45 : keys[seg] + (keys[seg + 1] - keys[seg]) * lu;
  const D = dFromTheta(theta);
  const val = trigDot(theta);

  const axes = w('axes');
  const curve = w('curve');
  const lock = w('lock', backOut);
  const curvePts = Array.from({length: 121}, (_, i) => {
    const th = (60 * i) / 120;
    return `${gx(th).toFixed(1)},${gy(trigDot(th)).toFixed(1)}`;
  });
  const cut = Math.max(1, Math.round(120 * curve));

  return (
    <Stage fade={fade}>
      <Figure
        D={D}
        style={{transform: 'translate(330px, -360px) scale(0.62)', transformOrigin: '1060px 850px'}}
        base={base}
        ab={base}
        ac={base}
        right={base}
        d={base}
        ad={base}
        cd={base}
        ang120={base}
        abLen={base}
        theta={w('theta', easeOut)}
        axis={base}
        drop={base}
        proj={base}
        glowD={lock}
      />
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <GlowDefs />
        <g opacity={axes}>
          <line x1={GX} y1={gy(0)} x2={GX + GW * axes} y2={gy(0)} stroke={T.muted} strokeWidth={1.6} />
          <line x1={GX} y1={gy(0.4)} x2={GX} y2={gy(0.4) + GH * axes} stroke={T.muted} strokeWidth={1.6} />
          <line x1={GX} y1={gy(-2)} x2={GX + GW} y2={gy(-2)} stroke={T.gold} strokeWidth={1.2} strokeDasharray="4 8" opacity={0.7} />
          {[0, 30, 60].map((th) => (
            <line key={th} x1={gx(th)} y1={gy(0) - 6} x2={gx(th)} y2={gy(0) + 6} stroke={T.muted} strokeWidth={1.6} />
          ))}
        </g>
        {curve > 0 ? <polyline points={curvePts.slice(0, cut + 1).join(' ')} fill="none" stroke={T.red} strokeWidth={3.2} filter="url(#glow)" /> : null}
        {u > 0 ? (
          <g>
            <line x1={gx(theta)} y1={gy(0)} x2={gx(theta)} y2={gy(val)} stroke={T.ink} strokeWidth={1.2} strokeDasharray="3 6" opacity={0.6} />
            <circle cx={gx(theta)} cy={gy(val)} r={9 + 4 * lock} fill={T.gold} filter="url(#glow)" />
          </g>
        ) : null}
      </svg>
      <div style={{position: 'absolute', left: GX + GW - 10, top: gy(0) - 46, color: T.muted, opacity: axes}}>
        <Tex tex="\theta" size={34} />
      </div>
      {[0, 30, 60].map((th) => (
        <div key={th} style={{position: 'absolute', left: gx(th) - 20, top: gy(0) - 46, color: T.muted, opacity: axes}}>
          <Tex tex={`${th}^\\circ`} size={26} />
        </div>
      ))}
      <div style={{position: 'absolute', left: GX - 74, top: gy(-2) - 18, color: T.gold, opacity: axes}}>
        <Tex tex="-2" size={30} />
      </div>
      {u > 0 ? (
        <div style={{position: 'absolute', left: GX + 20, top: GY - 64, color: T.muted, opacity: prog(t, sw.t0, sw.t0 + 0.4)}}>
          <Tex tex={`\\theta=${theta.toFixed(0)}^\\circ\\quad \\overrightarrow{AD}\\cdot\\overrightarrow{AB}=${val.toFixed(2).replace('-', '-\\,')}`} size={40} />
        </div>
      ) : null}
      <Steps
        t={t}
        items={[
          {at: B('theta').t0, tex: `\\textcolor{${T.red}}{\\theta}=\\angle DAC\\in(0^\\circ,60^\\circ)`, size: 44, dimAt: B('f2').t0},
          {at: B('f1').t0, tex: 'AD=4\\sin(60^\\circ-\\theta)', size: 48, dimAt: B('f2').t0},
          {at: B('f2').t0, tex: '\\overrightarrow{AD}\\cdot\\overrightarrow{AB}=2AD\\cos(90^\\circ+\\theta)', size: 42, dimAt: B('f3').t0, gap: 30},
          {at: B('f2').t0 + 0.6, tex: '=-8\\sin\\theta\\,\\sin(60^\\circ-\\theta)', size: 48, dimAt: B('f3').t0},
          {at: B('f3').t0, tex: `=2-4\\cos(2\\theta-60^\\circ)`, size: 54, color: T.ink},
          {at: B('f4').t0, tex: `\\ge 2-4=\\textcolor{${T.gold}}{-2}`, size: 54, boxAt: B('lock').t0},
          {at: B('f5').t0, tex: `\\theta=30^\\circ\\ \\text{时取等号}`, size: 46, color: T.gold, gap: 30},
        ]}
      />
      <Hud label="05 · 解法四 · 三角函数" />
    </Stage>
  );
};
