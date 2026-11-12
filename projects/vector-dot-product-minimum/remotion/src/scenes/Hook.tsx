import React from 'react';
import {backOut, easeInOut, easeOut, prog} from '../lib/anim';
import {useScene} from '../lib/timeline';
import {Figure} from '../components/Figure';
import {Hud, Stage} from '../components/Hud';
import {Steps} from '../components/Steps';
import {Tex} from '../components/Tex';
import {T} from '../theme';

// Cold open: the problem builds itself, brute force gets crossed out, six methods count up,
// and they collapse into one word — 投影.

const BRUTE = [
  {tex: '\\overrightarrow{AD}=(x,\\,y)', x: 560, y: 300, r: -6},
  {tex: '\\cos120^\\circ=\\dfrac{\\overrightarrow{DA}\\cdot\\overrightarrow{DC}}{|DA|\\,|DC|}', x: 980, y: 250, r: 4},
  {tex: 'x^2+y^2+\\sqrt{(x^2+(y-2\\sqrt3)^2)}\\cdots', x: 700, y: 470, r: -3},
  {tex: '-\\tfrac12=\\dfrac{x^2+y^2-2\\sqrt3\\,y}{\\sqrt{\\cdots}\\sqrt{\\cdots}}', x: 1250, y: 430, r: 5},
  {tex: '(x^2+y^2-2\\sqrt3y)^2=\\tfrac14(\\cdots)(\\cdots)', x: 900, y: 610, r: -2},
];
const SIX = ['面积', '直径圆', '外接圆', '三角', '坐标', '向量'];

export const Hook: React.FC = () => {
  const {t, dur, B, w} = useScene('hook');
  const fade = prog(t, 0, 0.6);
  const dim = w('dim');
  const brute = w('brute', easeOut);
  const cross = w('cross', easeOut);
  const bruteOut = prog(t, B('six').t0 - 0.4, B('six').t0);
  const six = B('six');
  const proj = w('proj', easeInOut);
  const opts = B('opts');

  return (
    <Stage fade={fade}>
      <div style={{position: 'absolute', inset: 0, opacity: 1 - 0.85 * dim}}>
        {/* question frame */}
        <svg width={1920} height={1080} style={{position: 'absolute'}}>
          <rect x={90} y={150} width={720} height={720} rx={10} fill="none" stroke={T.faint} strokeWidth={2} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - w('frame')} />
        </svg>
        <div style={{position: 'absolute', left: 120, top: 120, padding: '6px 18px', background: T.bg, color: T.gold, fontSize: 28, letterSpacing: 6, opacity: w('tag', easeOut)}}>题 目</div>
        <Steps
          t={t}
          top={210}
          items={[
            {at: B('cond1').t0, tex: `\\textcolor{${T.blue}}{AB}=2`},
            {at: B('cond2').t0, tex: 'AC=2\\sqrt3'},
            {at: B('cond3').t0, tex: `AC\\perp \\textcolor{${T.blue}}{AB}`},
            {at: B('cond4').t0, tex: `\\angle ADC=\\textcolor{${T.gold}}{120^\\circ}`},
            {at: B('ask').t0, tex: `\\min\\ \\overrightarrow{AD}\\cdot\\textcolor{${T.blue}}{\\overrightarrow{AB}}=\\ ?`, gap: 40, size: 58},
          ]}
          left={130}
        />
        <div style={{position: 'absolute', left: 130, top: 775, display: 'flex', gap: 22}}>
          {['A.\\ -\\sqrt3', 'B.\\ -2\\sqrt3', 'C.\\ -4', 'D.\\ -2'].map((o, i) => {
            const s = prog(t, opts.t0 + i * 0.18, opts.t0 + i * 0.18 + 0.35, backOut);
            return (
              <div key={i} style={{opacity: s, transform: `scale(${0.8 + 0.2 * s})`, border: `1.5px solid ${T.faint}`, borderRadius: 6, padding: '8px 16px', color: T.ink}}>
                <Tex tex={o} size={34} />
              </div>
            );
          })}
        </div>
        <Figure
          deg={210}
          base={prog(t, B('ab').t0 - 0.2, B('ab').t0 + 0.2)}
          ab={w('ab')}
          abLen={prog(t, B('ab').t1, B('ab').t1 + 0.3)}
          ac={w('ac')}
          right={w('right', backOut)}
          d={w('d', backOut)}
          ad={w('adcd')}
          cd={w('adcd')}
          ang120={w('ang', easeOut)}
          axis={proj}
          drop={proj}
          proj={proj}
        />
      </div>

      {/* brute force gets crossed out */}
      {brute > 0 && bruteOut < 1 ? (
        <div style={{position: 'absolute', inset: 0, opacity: 1 - bruteOut}}>
          {BRUTE.map((b, i) => {
            const s = prog(t, B('brute').t0 + i * 0.12, B('brute').t0 + i * 0.12 + 0.4, easeOut);
            return (
              <div key={i} style={{position: 'absolute', left: b.x, top: b.y, transform: `translate(-50%,-50%) rotate(${b.r}deg) scale(${0.85 + 0.15 * s})`, opacity: 0.55 * s, color: T.muted}}>
                <Tex tex={b.tex} size={40} />
              </div>
            );
          })}
          <svg width={1920} height={1080} style={{position: 'absolute'}}>
            <g filter="url(#glow)">
              <line x1={560} y1={220} x2={560 + 820 * cross} y2={220 + 460 * cross} stroke={T.red} strokeWidth={10} strokeLinecap="round" />
              <line x1={1380} y1={220} x2={1380 - 820 * prog(t, B('cross').t0 + 0.12, B('cross').t1 + 0.12, easeOut)} y2={220 + 460 * prog(t, B('cross').t0 + 0.12, B('cross').t1 + 0.12, easeOut)} stroke={T.red} strokeWidth={10} strokeLinecap="round" />
            </g>
          </svg>
        </div>
      ) : null}

      {/* six ways → one word */}
      {t > six.t0 - 0.1 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 330, display: 'flex', justifyContent: 'center', gap: 34}}>
          {SIX.map((name, i) => {
            const s = prog(t, six.t0 + i * 0.22, six.t0 + i * 0.22 + 0.4, backOut);
            const gather = proj;
            const dx = (2.5 - i) * 214 * gather;
            return (
              <div key={i} style={{width: 180, height: 180, borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? 4 : 0, border: `2px solid ${[T.gold, T.blue, T.red][i % 3]}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: s * (1 - gather), transform: `translateX(${dx}px) scale(${(0.6 + 0.4 * s) * (1 - 0.5 * gather)})`, color: T.ink, boxShadow: `0 0 24px ${[T.gold, T.blue, T.red][i % 3]}33`}}>
                <div style={{fontSize: 64, fontWeight: 700, lineHeight: 1}}>{i + 1}</div>
                <div style={{fontSize: 26, marginTop: 10, color: T.muted}}>{name}</div>
              </div>
            );
          })}
        </div>
      ) : null}
      {proj > 0 ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', opacity: proj}}>
          <div style={{fontSize: 190, fontWeight: 700, color: T.ink, letterSpacing: 40, transform: `scale(${1.3 - 0.3 * proj})`, textShadow: `0 0 40px ${T.red}55`}}>投影</div>
          <svg width={900} height={40} style={{marginTop: 4}}>
            <line x1={450 - 330 * proj} y1={20} x2={450 + 330 * proj} y2={20} stroke={T.red} strokeWidth={8} strokeLinecap="round" filter="url(#glow)" />
            <defs>
              <filter id="glow" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1100" height="240">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>
        </div>
      ) : null}
      <Hud label="00 · 题目" />
    </Stage>
  );
};
