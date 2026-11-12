import React from 'react';
import {backOut, easeInOut, easeOut, prog} from '../lib/anim';
import {useScene} from '../lib/timeline';
import {dOnArc, dotADAB} from '../lib/geometry';
import {Figure} from '../components/Figure';
import {Hud, Stage} from '../components/Hud';
import {Steps} from '../components/Steps';
import {Tex} from '../components/Tex';
import {T} from '../theme';

// Solution 1: cosine law + AM-GM bound ab ≤ 4, area twice → h = ab/4 ≤ 1, so AD·AB ≥ -2.
export const Method1Area: React.FC = () => {
  const {t, dur, B, w} = useScene('c2');
  const fade = prog(t, 0, 0.5);
  const sweep = w('sweep');
  const deg = 215 + (180 - 215) * sweep; // to the equality point D* = (-1, √3)
  const D = dOnArc(Math.min(239.9, Math.max(120.1, deg)));
  const value = dotADAB(D);
  const eq = w('eq', easeOut);
  const cam = 1 + 0.05 * prog(t, 0, dur, easeInOut);
  const base = prog(t, 0, 0.5);
  const c1 = B('clear1').t0;

  return (
    <Stage fade={fade}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${cam})`, transformOrigin: '900px 620px'}}>
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
          tri={w('tri') * (1 - 0.5 * w('sweep'))}
          aLabel={w('aLab', easeOut)}
          bLabel={w('bLab', easeOut)}
          abValue={eq > 0.5 ? '2' : undefined}
          dist={w('h')}
          hLabel={w('h', easeOut)}
          acPulse={w('base') * (1 - prog(t, B('base').t1 + 0.6, B('base').t1 + 1.0))}
          axis={w('proj')}
          drop={w('proj')}
          proj={w('proj')}
          xLabel={w('proj', easeOut)}
          glowD={eq}
        />
      </div>
      <Steps
        t={t}
        items={[
          {at: B('fcos').t0, tex: 'AC^2=a^2+b^2-2ab\\cos120^\\circ', size: 46, dimAt: B('feq').t0, hideAt: c1},
          {at: B('feq').t0, tex: `a^2+b^2+ab=\\textcolor{${T.gold}}{12}`, dimAt: B('fam').t0, hideAt: c1},
          {at: B('fam').t0, tex: 'a^2+b^2\\ge 2ab\\ \\Rightarrow\\ 12\\ge 3ab', size: 46, dimAt: B('fab').t0, hideAt: c1},
          {at: B('fab').t0, tex: `\\textcolor{${T.gold}}{ab\\le 4}`, size: 62, boxAt: B('fabBox').t0, hideAt: c1},
          {at: c1 + 0.2, tex: `ab\\le 4`, size: 38, color: T.muted},
          {at: B('fs1').t0, tex: 'S_{\\triangle ADC}=\\tfrac12ab\\sin120^\\circ=\\tfrac{\\sqrt3}{4}ab', size: 46, gap: 30},
          {at: B('fs2').t0, tex: `S_{\\triangle ADC}=\\tfrac12\\,AC\\cdot \\textcolor{${T.red}}{h}=\\sqrt3\\,\\textcolor{${T.red}}{h}`, size: 46},
          {at: B('fh').t0, tex: `\\textcolor{${T.red}}{h}=\\dfrac{ab}{4}\\le 1`, size: 62, boxAt: B('fhBox').t0, dimAt: B('res').t0},
          {at: B('res').t0, tex: `\\overrightarrow{AD}\\cdot\\overrightarrow{AB}\\ge 2\\times(-1)=\\textcolor{${T.gold}}{-2}`, size: 54, boxAt: B('resBox').t0, gap: 30},
        ]}
      />
      {/* live readout during the slide to the equality point */}
      {sweep > 0 ? (
        <div style={{position: 'absolute', left: 1330, top: 220, opacity: prog(t, B('sweep').t0, B('sweep').t0 + 0.4), color: T.muted}}>
          <Tex tex={`2\\textcolor{${T.red}}{x_D}=${value.toFixed(2).replace('-', '-\\,')}`} size={46} />
        </div>
      ) : null}
      {eq > 0 ? (
        <div style={{position: 'absolute', left: 1330, top: 300, opacity: eq, transform: `scale(${0.8 + 0.2 * prog(t, B('eq').t0, B('eq').t1, backOut)})`, transformOrigin: 'left center', color: T.gold}}>
          <Tex tex="a=b=2\ \checkmark" size={46} />
        </div>
      ) : null}
      <Hud label="02 · 解法一 · 面积" />
    </Stage>
  );
};
