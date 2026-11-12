import React from 'react';
import {Tex} from './Tex';
import {ArrowHead, Dot, DrawLine, DrawPath, GlowDefs} from './Draw';
import {A, B, C, dOnArc, O, R} from '../lib/geometry';
import {T, W2S} from '../theme';

type P = {x: number; y: number};

/**
 * The problem's figure in the shared world frame. Every element is a progress value
 * (0 = hidden, 1 = fully drawn). D is either a point on the legal arc (deg) or an
 * explicit point (D) computed by the caller from exact geometry.
 */
export type FigProps = {
  deg?: number;
  D?: P;
  base?: number; // A, B, C points + labels
  ab?: number;
  ac?: number;
  bc?: number;
  bcSolid?: number; // 0 ghost dashed → 1 solid ink
  bcGold?: number; // diameter highlight
  right?: number;
  d?: number;
  ad?: number;
  cd?: number;
  ang120?: number;
  ang60?: number;
  tri?: number;
  axis?: number;
  drop?: number;
  proj?: number;
  dist?: number;
  hLabel?: number;
  xLabel?: number;
  abLen?: number;
  bcLen?: number;
  aLabel?: number;
  bLabel?: number;
  abValue?: string; // text for the a / b labels (default "a", "b")
  circle?: number;
  circleStart?: number; // degrees around O where the stroke starts
  circleDim?: number; // 0..1, fades the drawn circle
  center?: number;
  radius?: number; // O → D
  radiusB?: number; // O → B (shows R before D moves)
  tangent?: number;
  mid?: number; // M on AC and OM
  grid?: number;
  theta?: number;
  vecZ?: number;
  acPulse?: number;
  sideTint?: number;
  ghostD?: number; // same-side counterexample D'
  angPulse?: number;
  glowD?: number;
};

const pathCircle = (start: number) => {
  const n = 120;
  const pts = Array.from({length: n + 1}, (_, i) => {
    const a = ((start + (360 * i) / n) * Math.PI) / 180;
    return W2S({x: O.x + R * Math.cos(a), y: O.y + R * Math.sin(a)});
  });
  return 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
};

const Lbl: React.FC<{at: P; dx?: number; dy?: number; s?: number; tex: string; color?: string; size?: number}> = ({at, dx = 0, dy = 0, s = 1, tex, color = T.ink, size = 46}) =>
  s <= 0 ? null : (
    <div style={{position: 'absolute', left: at.x + dx, top: at.y + dy, transform: `translate(-50%,-50%) translateY(${(1 - s) * 12}px)`, opacity: s, color, textShadow: `0 0 18px ${color}55`}}>
      <Tex tex={tex} size={size} />
    </div>
  );

const angleArc = (at: P, toA: P, toB: P, r: number) => {
  const u1 = Math.atan2(toA.y - at.y, toA.x - at.x);
  const u2 = Math.atan2(toB.y - at.y, toB.x - at.x);
  let d = u2 - u1;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  const p1 = {x: at.x + r * Math.cos(u1), y: at.y + r * Math.sin(u1)};
  const p2 = {x: at.x + r * Math.cos(u1 + d), y: at.y + r * Math.sin(u1 + d)};
  return {d: `M${p1.x},${p1.y} A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${p2.x},${p2.y}`, mid: u1 + d / 2};
};

export const Figure: React.FC<FigProps & {style?: React.CSSProperties}> = (p) => {
  const g = (k: keyof FigProps) => (typeof p[k] === 'number' ? (p[k] as number) : 0);
  const Dw = p.D ?? dOnArc(p.deg ?? 215);
  const sA = W2S(A);
  const sB = W2S(B);
  const sC = W2S(C);
  const sD = W2S(Dw);
  const sO = W2S(O);
  const sP = W2S({x: Dw.x, y: 0});
  const sH = W2S({x: 0, y: Dw.y});
  const sM = W2S({x: 0, y: C.y / 2});
  const a120 = angleArc(sD, sA, sC, 48);
  const a60 = angleArc(sB, sC, sA, 58);
  const th = angleArc(sA, sC, sD, 74);
  const base = g('base');
  const pulse = g('angPulse');

  return (
    <div style={{position: 'absolute', inset: 0, ...p.style}}>
      <svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible'}}>
        <GlowDefs />
        {g('grid') > 0 ? (
          <g opacity={g('grid') * 0.5}>
            {[-2, -1, 0, 1, 2, 3].map((x) => (
              <line key={`gx${x}`} x1={W2S({x, y: 0}).x} y1={W2S({x: 0, y: -0.6}).y} x2={W2S({x, y: 0}).x} y2={W2S({x: 0, y: 4}).y} stroke={T.muted} strokeWidth={1} strokeDasharray="2 8" />
            ))}
            {[0, 1, 2, 3].map((y) => (
              <line key={`gy${y}`} x1={W2S({x: -2.3, y}).x} y1={W2S({x: 0, y}).y} x2={W2S({x: 3, y}).x} y2={W2S({x: 0, y}).y} stroke={T.muted} strokeWidth={1} strokeDasharray="2 8" />
            ))}
          </g>
        ) : null}
        {g('sideTint') > 0 ? (
          <g opacity={g('sideTint')}>
            <rect x={W2S({x: -2.4, y: 0}).x} y={W2S({x: 0, y: 4}).y} width={sA.x - W2S({x: -2.4, y: 0}).x} height={W2S({x: 0, y: -0.4}).y - W2S({x: 0, y: 4}).y} fill={T.gold} opacity={0.06} />
            <rect x={sA.x} y={W2S({x: 0, y: 4}).y} width={W2S({x: 2.6, y: 0}).x - sA.x} height={W2S({x: 0, y: -0.4}).y - W2S({x: 0, y: 4}).y} fill={T.blue} opacity={0.05} />
          </g>
        ) : null}
        {g('tri') > 0 ? <polygon points={`${sA.x},${sA.y} ${sD.x},${sD.y} ${sC.x},${sC.y}`} fill={T.gold} opacity={0.1 * g('tri')} /> : null}
        <DrawLine a={sA} b={W2S({x: -1.75, y: 0})} p={g('axis')} color={T.muted} width={1.6} dash="6 10" head={false} glow={false} />
        {g('circle') > 0 ? (
          <g opacity={1 - 0.6 * g('circleDim')}>
            <DrawPath d={pathCircle(p.circleStart ?? 0)} p={g('circle')} color={T.gold} width={2.6} />
          </g>
        ) : null}
        <DrawLine a={sB} b={sC} p={Math.max(g('bc'), 0)} color={T.muted} width={1.6} dash="4 9" head={false} glow={false} opacity={0.7 * (1 - g('bcSolid'))} />
        {g('bcSolid') > 0 ? <DrawLine a={sB} b={sC} p={g('bcSolid')} color={T.ink} width={2.4} opacity={0.85} /> : null}
        {g('bcGold') > 0 ? <DrawLine a={sB} b={sC} p={g('bcGold')} color={T.gold} width={4.5} /> : null}
        <DrawLine a={sA} b={W2S({x: 0, y: 4.1})} p={g('acPulse')} color={T.ink} width={1.4} dash="3 7" head={false} glow={false} opacity={0.6} />
        <DrawLine a={sA} b={sC} p={g('ac')} color={T.ink} width={3} />
        {g('right') > 0 ? <path d={`M${sA.x + 30 * g('right')},${sA.y} L${sA.x + 30 * g('right')},${sA.y - 30 * g('right')} L${sA.x},${sA.y - 30 * g('right')}`} fill="none" stroke={T.ink} strokeWidth={2.4} filter="url(#glow)" /> : null}
        <DrawLine a={sA} b={sB} p={g('ab')} color={T.blue} width={4.5} />
        <ArrowHead a={sA} tip={sB} s={g('ab') >= 1 ? 1 : 0} color={T.blue} />
        {g('mid') > 0 ? <DrawLine a={sO} b={sM} p={g('mid')} color={T.red} width={4} /> : null}
        {g('radiusB') > 0 ? <DrawLine a={sO} b={sB} p={g('radiusB')} color={T.gold} width={2.4} dash="8 8" head={false} /> : null}
        {g('radius') > 0 ? <DrawLine a={sO} b={sD} p={g('radius')} color={T.gold} width={3} /> : null}
        {g('tangent') > 0 ? <DrawLine a={W2S({x: -1, y: -0.35})} b={W2S({x: -1, y: 3.9})} p={g('tangent')} color={T.gold} width={1.8} dash="5 9" head={false} glow={false} /> : null}
        {g('ghostD') > 0 ? (
          <g opacity={g('ghostD') * 0.75}>
            {(() => {
              const G = W2S({x: -Dw.x, y: Dw.y}); // mirror of D across AC: same-side D' (∠ADC = 120° still)
              return (
                <>
                  <DrawLine a={sA} b={G} p={1} color={T.muted} width={2} dash="6 8" head={false} glow={false} />
                  <DrawLine a={sC} b={G} p={1} color={T.muted} width={2} dash="6 8" head={false} glow={false} />
                  <circle cx={G.x} cy={G.y} r={8} fill="none" stroke={T.muted} strokeWidth={2} />
                </>
              );
            })()}
          </g>
        ) : null}
        <DrawLine a={sC} b={sD} p={g('cd')} color={T.ink} width={2.2} opacity={0.75} />
        <DrawLine a={sA} b={sD} p={g('ad')} color={T.ink} width={3.4} />
        <ArrowHead a={sA} tip={sD} s={g('ad') >= 1 ? 1 : 0} color={T.ink} size={20} />
        {g('ang120') > 0 ? <path d={a120.d} fill="none" stroke={T.gold} strokeWidth={2.4 + 2 * pulse} opacity={g('ang120')} filter="url(#glow)" /> : null}
        {g('ang60') > 0 ? <path d={a60.d} fill="none" stroke={T.gold} strokeWidth={2.4 + 2 * pulse} opacity={g('ang60')} filter="url(#glow)" /> : null}
        {g('theta') > 0 ? <path d={th.d} fill="none" stroke={T.red} strokeWidth={2.6} opacity={g('theta')} filter="url(#glow)" /> : null}
        <DrawLine a={sD} b={sP} p={g('drop')} color={T.ink} width={1.6} dash="5 8" head={false} glow={false} opacity={0.8} />
        <DrawLine a={sA} b={sP} p={g('proj')} color={T.red} width={7} />
        <DrawLine a={sD} b={sH} p={g('dist')} color={T.red} width={4} />
        {g('vecZ') > 0 ? (
          <>
            <DrawLine a={sO} b={sD} p={g('vecZ')} color={T.gold} width={4} />
            <ArrowHead a={sO} tip={sD} s={g('vecZ') >= 1 ? 1 : 0} color={T.gold} />
          </>
        ) : null}
        <Dot c={sA} s={base} />
        <Dot c={sB} s={base} color={T.blue} r={6} />
        <Dot c={sC} s={base} r={6} />
        <Dot c={sD} s={g('d')} color={T.gold} r={8 + 3 * g('glowD')} />
        <Dot c={sO} s={g('center')} color={T.gold} r={6} />
        <Dot c={sM} s={g('mid')} color={T.red} r={5} />
        <Dot c={sP} s={g('drop') >= 1 ? 1 : 0} color={T.red} r={5} />
      </svg>
      <Lbl at={sA} dx={26} dy={34} s={base} tex="A" />
      <Lbl at={sB} dx={6} dy={42} s={base} tex="B" color={T.blue} />
      <Lbl at={sC} dx={34} dy={-10} s={base} tex="C" />
      <Lbl at={sD} dx={-40} dy={-30} s={g('d')} tex="D" color={T.gold} />
      <Lbl at={sO} dx={34} dy={-22} s={g('center')} tex="O" color={T.gold} size={40} />
      <Lbl at={sM} dx={-30} dy={-16} s={g('mid')} tex="M" color={T.red} size={36} />
      <Lbl at={sD} dx={92 * Math.cos(a120.mid - 0.45)} dy={92 * Math.sin(a120.mid - 0.45)} s={g('ang120')} tex="120^\circ" color={T.gold} size={30} />
      <Lbl at={sB} dx={84 * Math.cos(a60.mid)} dy={84 * Math.sin(a60.mid)} s={g('ang60')} tex="60^\circ" color={T.gold} size={30} />
      <Lbl at={sA} dx={104 * Math.cos(th.mid)} dy={104 * Math.sin(th.mid)} s={g('theta')} tex="\theta" color={T.red} size={40} />
      <Lbl at={{x: (sA.x + sP.x) / 2, y: sA.y}} dy={40} s={g('xLabel')} tex="x_D" color={T.red} size={44} />
      <Lbl at={{x: (sD.x + sH.x) / 2, y: sD.y}} dy={34} s={g('hLabel')} tex="h" color={T.red} size={44} />
      <Lbl at={{x: (sB.x + sA.x) / 2, y: sA.y}} dy={40} s={g('abLen')} tex="2" color={T.blue} size={34} />
      <Lbl at={{x: (sB.x + sC.x) / 2, y: (sB.y + sC.y) / 2}} dx={34} dy={10} s={g('bcLen')} tex="4" color={T.ink} size={38} />
      <Lbl at={{x: (sA.x + sD.x) / 2, y: (sA.y + sD.y) / 2}} dx={26} dy={18} s={g('aLabel')} tex={p.abValue ?? 'a'} color={T.ink} size={40} />
      <Lbl at={{x: (sC.x + sD.x) / 2, y: (sC.y + sD.y) / 2}} dx={-34} dy={0} s={g('bLabel')} tex={p.abValue ?? 'b'} color={T.ink} size={40} />
    </div>
  );
};

