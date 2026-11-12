import React from 'react';
import {backOut, easeInOut, easeOut, prog} from '../lib/anim';
import {useScene} from '../lib/timeline';
import {dOnArc, dotADAB} from '../lib/geometry';
import {Figure} from '../components/Figure';
import {Hud, Stage} from '../components/Hud';
import {Steps} from '../components/Steps';
import {Tex} from '../components/Tex';
import {T} from '../theme';

// Solution 2: only the opposite-side case can give a negative dot product; there
// 60° + 120° = 180° ⇒ A, B, C, D concyclic; ∠A = 90° ⇒ BC is a diameter, R = 2, O = (1, √3),
// leftmost x = 1 − 2 = −1 ⇒ AD·AB = 2x_D ≥ −2.
export const Method2Circle: React.FC = () => {
  const {t, dur, B, w} = useScene('c3');
  const fade = prog(t, 0, 0.5);
  const base = prog(t, 0, 0.5);
  const slide = w('slide');
  const deg = 205 + (180 - 205) * slide;
  const D = dOnArc(deg);
  const pulse = Math.max(0, Math.sin(Math.min(1, w('pulse')) * Math.PI * 3)) * (w('pulse') < 1 ? 1 : 0);
  const cam = 1 + 0.05 * prog(t, 0, dur, easeInOut);
  const side = w('side');
  const sideOut = 1 - prog(t, B('circle').t0, B('circle').t0 + 0.6);

  return (
    <Stage fade={fade}>
      <div style={{position: 'absolute', inset: 0, transform: `translateX(120px) scale(${cam})`, transformOrigin: '900px 600px'}}>
        <Figure
          deg={deg}
          base={base}
          ab={base}
          ac={base}
          right={base}
          d={base}
          ad={base}
          cd={base}
          ang120={base}
          angPulse={pulse}
          abLen={base}
          bc={base}
          bcSolid={w('bc')}
          bcLen={w('bcLen', easeOut)}
          ang60={w('ang60', easeOut)}
          acPulse={side * sideOut}
          sideTint={side * sideOut}
          circle={w('circle')}
          circleStart={0}
          bcGold={w('diam')}
          center={w('center', backOut)}
          radiusB={w('radB') * (1 - slide)}
          radius={slide}
          tangent={w('tangent')}
          axis={w('proj')}
          drop={w('proj')}
          proj={w('proj')}
          xLabel={w('proj', easeOut)}
          glowD={w('resBox')}
        />
        {side * sideOut > 0 ? (
          <>
            <div style={{position: 'absolute', left: 700, top: 230, color: T.gold, fontSize: 30, opacity: side * sideOut}}>D 侧</div>
            <div style={{position: 'absolute', left: 1180, top: 230, color: T.blue, fontSize: 30, opacity: side * sideOut}}>B 侧</div>
          </>
        ) : null}
        {w('center') > 0 ? (
          <div style={{position: 'absolute', left: 1322, top: 462, color: T.gold, opacity: w('f7', easeOut)}}>
            <Tex tex="(1,\sqrt3)" size={36} />
          </div>
        ) : null}
        {w('radB') > 0 && slide < 1 ? (
          <div style={{position: 'absolute', left: 1300, top: 640, color: T.gold, opacity: w('radB', easeOut) * (1 - slide)}}>
            <Tex tex="R=2" size={38} />
          </div>
        ) : null}
      </div>
      <Steps
        t={t}
        items={[
          {at: B('f1').t0, tex: 'BC=4,\\ \\ \\angle ABC=60^\\circ', size: 46, dimAt: B('f3').t0, hideAt: B('f5').t0},
          {at: B('neg').t0, text: '只看点积 < 0 的情形', color: T.gold, size: 50, dimAt: B('f3').t0, hideAt: B('f5').t0},
          {at: B('f2').t0, text: '⇒ D、B 分居 AC 两侧', color: T.gold, size: 50, dimAt: B('f3').t0, hideAt: B('f5').t0},
          {at: B('f3').t0, tex: `\\textcolor{${T.gold}}{60^\\circ+120^\\circ=180^\\circ}`, size: 56, gap: 30, dimAt: B('f5').t0},
          {at: B('f4').t0, text: '对角互补 ⇒ 四点共圆', size: 52, dimAt: B('f5').t0},
          {at: B('f5').t0, tex: '\\angle A=90^\\circ\\Rightarrow BC\\ \\text{为直径},\\ R=2', size: 46, dimAt: B('f8').t0},
          {at: B('f6').t0, tex: `O=\\text{BC 中点}=(1,\\sqrt3)`, size: 46, dimAt: B('f8').t0},
          {at: B('f8').t0, tex: `x_D\\ge 1-R=-1`, size: 56, gap: 30},
          {at: B('res').t0, tex: `\\overrightarrow{AD}\\cdot\\overrightarrow{AB}=2x_D\\ge\\textcolor{${T.gold}}{-2}`, size: 54, boxAt: B('resBox').t0},
        ]}
      />
      {slide > 0 ? (
        <div style={{position: 'absolute', left: 1500, top: 150, color: T.muted, opacity: prog(t, B('slide').t0, B('slide').t0 + 0.4)}}>
          <Tex tex={`2\\textcolor{${T.red}}{x_D}=${dotADAB(D).toFixed(2).replace('-', '-\\,')}`} size={42} />
        </div>
      ) : null}
      <Hud label="03 · 解法二 · 直径圆" />
    </Stage>
  );
};
