import React from 'react';
import {easeInOut, easeOut, prog} from '../lib/anim';
import {useScene} from '../lib/timeline';
import {Figure} from '../components/Figure';
import {Hud, Stage} from '../components/Hud';
import {Steps} from '../components/Steps';
import {Tex} from '../components/Tex';
import {T, W2S} from '../theme';

// Solution 3: circumcircle of △ADC. R = AC / (2 sin 120°) = 2, OM = √(R² − AM²) = 1,
// so on the far side of AC, D is at most R − OM = 1 from AC.
export const Method3Circum: React.FC = () => {
  const {t, dur, B, w} = useScene('c4');
  const fade = prog(t, 0, 0.5);
  const base = prog(t, 0, 0.5);
  const slide = w('slide');
  const deg = 205 + (180 - 205) * slide;
  const glow = w('glow');
  const cam = 1 + 0.04 * prog(t, 0, dur, easeInOut);
  const H = W2S({x: 0, y: Math.sqrt(3)});
  const Ds = W2S({x: -1, y: Math.sqrt(3)});

  return (
    <Stage fade={fade}>
      <div style={{position: 'absolute', inset: 0, transform: `translateX(130px) scale(${cam})`, transformOrigin: '900px 600px'}}>
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
          abLen={base}
          bc={base}
          circle={base}
          circleDim={0.6 * (1 - glow)}
          circleStart={180}
          tri={w('tri') * 1.4}
          center={glow}
          radius={w('radius')}
          mid={w('mid')}
          dist={w('dist')}
          glowD={w('resBox')}
        />
        {w('mid') > 0 ? (
          <div style={{position: 'absolute', left: (W2S({x: 1, y: 0}).x + H.x) / 2 - 20, top: H.y - 62, color: T.red, opacity: w('mid', easeOut)}}>
            <Tex tex="1" size={38} />
          </div>
        ) : null}
        {w('dist') > 0 ? (
          <div style={{position: 'absolute', left: (Ds.x + H.x) / 2 - 70, top: H.y + 18, color: T.red, opacity: w('dist', easeOut)}}>
            <Tex tex="R-OM=1" size={34} />
          </div>
        ) : null}
        {w('radius') > 0 ? (
          <div style={{position: 'absolute', left: 860, top: 600, color: T.gold, opacity: w('radius', easeOut) * (1 - slide)}}>
            <Tex tex="R=2" size={38} />
          </div>
        ) : null}
      </div>
      <Steps
        t={t}
        items={[
          {at: B('glow').t0, text: '△ADC 的外接圆', color: T.gold, size: 52},
          {at: B('f1').t0, tex: 'R=\\dfrac{AC}{2\\sin120^\\circ}=\\dfrac{2\\sqrt3}{\\sqrt3}=2', size: 48, boxAt: B('f1Box').t0, dimAt: B('f3').t0, gap: 30},
          {at: B('f2').t0, tex: 'OM=\\sqrt{R^2-AM^2}=\\sqrt{4-3}=1', size: 48, dimAt: B('f3').t0},
          {at: B('f3').t0, tex: `\\textcolor{${T.red}}{h}_{\\max}=R-OM=1`, size: 56, gap: 30},
          {at: B('res').t0, tex: `\\overrightarrow{AD}\\cdot\\overrightarrow{AB}\\ge -2\\cdot 1=\\textcolor{${T.gold}}{-2}`, size: 54, boxAt: B('resBox').t0},
        ]}
      />
      <Hud label="04 · 解法三 · 外接圆" />
    </Stage>
  );
};
