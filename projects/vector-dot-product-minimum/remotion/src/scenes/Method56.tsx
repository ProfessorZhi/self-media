import React from 'react';
import {backOut, easeInOut, easeOut, prog} from '../lib/anim';
import {useScene} from '../lib/timeline';
import {A, B as PB, C, dOnArc, O} from '../lib/geometry';
import {Figure} from '../components/Figure';
import {Hud, Stage} from '../components/Hud';
import {Steps} from '../components/Steps';
import {Tex} from '../components/Tex';
import {T, W2S} from '../theme';

// Solution 5 (coordinates): area −√3x = (√3/4)·AD·CD and the cosine law give
// (x − 1)² + (y − √3)² = 4, so x ≥ −1.
// Solution 6 (vectors): |w − (u+v)/2| = 2, w·u = 2 + z·u ≥ 2 − |z||u| = −2.
export const Method56: React.FC = () => {
  const {t, dur, B, w} = useScene('c6');
  const fade = prog(t, 0, 0.5);
  const base = prog(t, 0, 0.5);
  const clear = w('clear');
  const part6 = clear >= 1;

  // part 6: z = D − O rotates; w·u = 2 + z·u
  const sp = B('spin');
  const u = prog(t, sp.t0, sp.t1, (x) => x);
  const keys = [210, 236, 140, 180];
  const k = Math.min(2, Math.floor(u * 3));
  const lu = easeInOut(Math.min(1, u * 3 - k));
  const deg = u <= 0 ? 210 : keys[k] + (keys[k + 1] - keys[k]) * lu;
  const D = dOnArc(deg);
  const zu = 2 * (D.x - O.x);
  const fmt = (v: number) => v.toFixed(2).replace('-', '-\\,');

  const lbl = (p: {x: number; y: number}, dx: number, dy: number, tex: string, color: string, s: number) =>
    s > 0 ? (
      <div style={{position: 'absolute', left: W2S(p).x + dx, top: W2S(p).y + dy, transform: 'translate(-50%,-50%)', color, opacity: s}}>
        <Tex tex={tex} size={40} />
      </div>
    ) : null;
  const vecLbl = w('f5', easeOut) * (part6 ? 1 : 0);

  return (
    <Stage fade={fade}>
      <div style={{position: 'absolute', inset: 0, transform: 'translateX(120px)'}}>
      <Figure
        deg={deg}
        base={base}
        ab={base}
        ac={base}
        right={base}
        d={base}
        ad={base}
        cd={base * (1 - 0.6 * clear)}
        ang120={base * (1 - clear)}
        abLen={base * (1 - clear)}
        grid={w('grid') * (1 - clear)}
        circle={w('circle')}
        circleStart={0}
        circleDim={clear * 0.5}
        tangent={w('tangent') * (1 - clear)}
        center={w('center', backOut)}
        vecZ={w('z')}
        bc={part6 ? 1 : 0}
      />
      {/* coordinate labels (part 5) */}
      {lbl({x: 3.05, y: 0}, 0, 30, 'x', T.muted, w('grid') * (1 - clear))}
      {lbl({x: 0, y: 4.05}, 26, 0, 'y', T.muted, w('grid') * (1 - clear))}
      {lbl(D, -70, 34, 'D(x,y)', T.gold, w('f1', easeOut) * (1 - clear))}
      {lbl({x: -1, y: 3.9}, 0, -24, 'x=-1', T.gold, w('tangent', easeOut) * (1 - clear))}
      {/* vector names (part 6) */}
      {lbl({x: (A.x + PB.x) / 2, y: 0}, 0, 44, '\\mathbf u', T.blue, vecLbl)}
      {lbl({x: 0, y: C.y * 0.62}, 30, 0, '\\mathbf v', T.ink, vecLbl)}
      {lbl({x: D.x / 2, y: D.y / 2}, 30, 20, '\\mathbf w', T.ink, vecLbl)}
      {lbl({x: (O.x + D.x) / 2, y: (O.y + D.y) / 2}, 0, -30, '\\mathbf z', T.gold, w('z', easeOut))}
      </div>
      <Steps
        t={t}
        items={[
          {at: B('f1').t0, tex: '-\\sqrt3\\,x=S=\\tfrac{\\sqrt3}{4}AD\\cdot CD', size: 46, dimAt: B('f3').t0, hideAt: B('clear').t0},
          {at: B('f2').t0, tex: 'AD^2+CD^2+AD\\cdot CD=12', size: 46, dimAt: B('f3').t0, hideAt: B('clear').t0},
          {at: B('f3').t0, tex: `\\textcolor{${T.gold}}{(x-1)^2+(y-\\sqrt3)^2=4}`, size: 54, boxAt: B('f3Box').t0, hideAt: B('clear').t0, gap: 30},
          {at: B('f4').t0, tex: `x\\ge -1\\ \\Rightarrow\\ 2x\\ge\\textcolor{${T.gold}}{-2}`, size: 54, hideAt: B('clear').t0},
          {at: B('f5').t0, tex: `\\textcolor{${T.blue}}{\\mathbf u}=\\overrightarrow{AB},\\ \\mathbf v=\\overrightarrow{AC},\\ \\mathbf w=\\overrightarrow{AD}`, size: 44, dimAt: B('f7').t0},
          {at: B('f6').t0, tex: `\\Big|\\mathbf w-\\tfrac{\\mathbf u+\\mathbf v}{2}\\Big|=|\\textcolor{${T.gold}}{\\mathbf z}|=2`, size: 50, dimAt: B('f8').t0},
          {at: B('f7').t0, tex: `\\mathbf w\\cdot\\mathbf u=2+\\textcolor{${T.gold}}{\\mathbf z}\\cdot\\mathbf u`, size: 54, gap: 30},
          {at: B('f8').t0, tex: `\\ge 2-|\\mathbf z|\\,|\\mathbf u|=2-4=\\textcolor{${T.gold}}{-2}`, size: 50, boxAt: B('resBox').t0},
        ]}
      />
      {u > 0 ? (
        <div style={{position: 'absolute', left: 1440, top: 150, color: T.muted, opacity: prog(t, sp.t0, sp.t0 + 0.4)}}>
          <Tex tex={`\\mathbf z\\cdot\\mathbf u=${fmt(zu)}`} size={40} />
          <div style={{height: 10}} />
          <Tex tex={`\\mathbf w\\cdot\\mathbf u=${fmt(2 + zu)}`} size={40} />
        </div>
      ) : null}
      <Hud label={part6 ? '06 · 解法六 · 向量配方' : '06 · 解法五 · 坐标法'} />
    </Stage>
  );
};
