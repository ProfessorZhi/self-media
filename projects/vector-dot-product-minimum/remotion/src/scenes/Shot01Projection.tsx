import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ArrowHead, Dot, DrawLine, DrawPath, GlowDefs} from '../components/Draw';
import {Subtitles} from '../components/Subtitles';
import {Tex} from '../components/Tex';
import {backOut, easeInOut, easeOut, prog} from '../lib/anim';
import {beat, CFG, FPS, SHOT_DUR} from '../lib/beats';
import {A, B, C, dOnArc, dotADAB, O, R} from '../lib/geometry';
import {T, W2S} from '../theme';

// Shot 01 (storyboard 00:20–00:45): turn the dot product into a projection.
// Every animation window is anchored to a voice line via src/beats.json.

const fmt = (v: number) => (v < 0 ? '-' : '') + Math.abs(v).toFixed(2);

const Label: React.FC<{at: {x: number; y: number}; dx?: number; dy?: number; s: number; tex: string; color?: string; size?: number}> = ({
  at,
  dx = 0,
  dy = 0,
  s,
  tex,
  color = T.ink,
  size = 46,
}) =>
  s <= 0 ? null : (
    <div style={{position: 'absolute', left: at.x + dx, top: at.y + dy, transform: `translate(-50%,-50%) translateY(${(1 - s) * 14}px)`, opacity: s, color, textShadow: `0 0 18px ${color}55`}}>
      <Tex tex={tex} size={size} />
    </div>
  );

export const Shot01Projection: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const w = (name: Parameters<typeof beat>[0], ease = easeInOut) => {
    const b = beat(name);
    return prog(t, b.t0, b.t1, ease);
  };

  // --- live point D, constrained to the legal arc (∠ADC = 120°) ---
  const [deg0, deg1] = CFG.sweepDeg;
  const sweep = w('sweep', easeInOut);
  const deg = deg0 + (deg1 - deg0) * sweep;
  const Dw = dOnArc(deg);
  const value = dotADAB(Dw); // = 2 x_D, always ≥ -2 on this window

  const sA = W2S(A);
  const sB = W2S(B);
  const sC = W2S(C);
  const sD = W2S(Dw);
  const sP = W2S({x: Dw.x, y: 0}); // projection of D on line AB
  const sH = W2S({x: 0, y: Dw.y}); // foot of D on line AC

  // trail of D along its locus (gold, foreshadows the circle of shot 02)
  const trail = (() => {
    if (sweep <= 0) return '';
    const n = 40;
    const pts = Array.from({length: n + 1}, (_, i) => {
      const d = deg0 + ((deg - deg0) * i) / n;
      const r = (d * Math.PI) / 180;
      return W2S({x: O.x + R * Math.cos(r), y: O.y + R * Math.sin(r)});
    });
    return 'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
  })();

  // 120° arc at D between DA and DC
  const a120 = w('angle120', easeOut);
  const arc120 = (() => {
    const r = 48;
    const u1 = Math.atan2(sA.y - sD.y, sA.x - sD.x);
    const u2 = Math.atan2(sC.y - sD.y, sC.x - sD.x);
    const p1 = {x: sD.x + r * Math.cos(u1), y: sD.y + r * Math.sin(u1)};
    const p2 = {x: sD.x + r * Math.cos(u2), y: sD.y + r * Math.sin(u2)};
    return {d: `M${p1.x},${p1.y} A${r},${r} 0 0 0 ${p2.x},${p2.y}`, mid: Math.atan2(Math.sin(u1) + Math.sin(u2), Math.cos(u1) + Math.cos(u2))};
  })();

  // camera: one very slow push, biased toward the left (where the answer lives)
  const cam = 1 + 0.06 * prog(t, 0, SHOT_DUR, easeInOut);
  const fadeIn = prog(t, 0, 0.5);
  const morph = w('formula_morph');
  const formula = w('formula', easeOut);
  const q = w('question', easeOut);
  const ruleLeft = w('proj_drop');

  return (
    <AbsoluteFill style={{background: `radial-gradient(1200px 800px at 55% 55%, ${T.bgLift} 0%, ${T.bg} 70%)`, fontFamily: T.font, opacity: fadeIn}}>
      {/* dot field */}
      <svg width={1920} height={1080} style={{position: 'absolute', opacity: 0.55}}>
        {Array.from({length: 24 * 14}, (_, i) => {
          const x = (i % 24) * 84 + 18;
          const y = Math.floor(i / 24) * 80 + 20;
          return <circle key={i} cx={x} cy={y} r={1.3} fill={T.faint} />;
        })}
      </svg>

      <AbsoluteFill style={{transform: `scale(${cam})`, transformOrigin: '820px 640px'}}>
        <svg width={1920} height={1080} style={{position: 'absolute', overflow: 'visible'}}>
          <GlowDefs />
          {/* x-axis extension to the left of A: where negative projections land */}
          <DrawLine a={sA} b={W2S({x: -1.75, y: 0})} p={ruleLeft} color={T.muted} width={1.6} dash="6 10" head={false} glow={false} />
          {/* BC hint */}
          <DrawLine a={sB} b={sC} p={w('BC_ghost')} color={T.muted} width={1.6} dash="4 9" head={false} glow={false} opacity={0.7} />
          {/* AC (vertical) */}
          <DrawLine a={sA} b={sC} p={w('AC_draw')} color={T.ink} width={3} />
          {/* right angle at A */}
          {(() => {
            const s = w('right_angle', backOut);
            const k = 30 * s;
            return s > 0 ? <path d={`M${sA.x + k},${sA.y} L${sA.x + k},${sA.y - k} L${sA.x},${sA.y - k}`} fill="none" stroke={T.ink} strokeWidth={2.4} filter="url(#glow)" /> : null;
          })()}
          {/* AB (blue vector) */}
          <DrawLine a={sA} b={sB} p={w('AB_draw')} color={T.blue} width={4.5} />
          <ArrowHead a={sA} tip={sB} s={prog(t, beat('AB_draw').t1 - 0.12, beat('AB_draw').t1 + 0.2, backOut)} color={T.blue} />

          {/* locus trail */}
          {trail ? <DrawPath d={trail} p={1} color={T.gold} width={2} opacity={0.55} /> : null}

          {/* CD and AD */}
          <DrawLine a={sC} b={sD} p={w('CD_draw')} color={T.ink} width={2.2} opacity={0.75} />
          <DrawLine a={sA} b={sD} p={w('AD_draw')} color={T.ink} width={3.4} />
          <ArrowHead a={sA} tip={sD} s={prog(t, beat('AD_draw').t1 - 0.1, beat('AD_draw').t1 + 0.2, backOut)} color={T.ink} size={20} />
          {a120 > 0 ? <path d={arc120.d} fill="none" stroke={T.gold} strokeWidth={2.4} opacity={a120} filter="url(#glow)" /> : null}

          {/* projection: drop from D to the AB line, then the red shadow A→P */}
          <DrawLine a={sD} b={sP} p={w('proj_drop')} color={T.ink} width={1.6} dash="5 8" head={false} glow={false} opacity={0.8} />
          <DrawLine a={sA} b={sP} p={w('proj_shadow')} color={T.red} width={7} />
          {/* directed distance D→AC (same length, same sign) */}
          <DrawLine a={sD} b={sH} p={w('dist_draw')} color={T.red} width={4} />

          {/* question: how far left can D go? */}
          {q > 0 ? (
            <g opacity={q}>
              <DrawLine a={{x: sD.x - 40, y: sD.y}} b={{x: W2S({x: -1.7, y: 0}).x, y: sD.y}} p={q} color={T.gold} width={2} dash="3 10" dashOffset={t * 26} head={false} glow={false} />
              <ArrowHead a={{x: sD.x, y: sD.y}} tip={{x: W2S({x: -1.7, y: 0}).x, y: sD.y}} s={q} color={T.gold} size={18} />
            </g>
          ) : null}

          <Dot c={sA} s={w('A_pop', backOut)} />
          <Dot c={sB} s={prog(t, beat('AB_draw').t1 - 0.1, beat('AB_draw').t1 + 0.25, backOut)} color={T.blue} r={6} />
          <Dot c={sC} s={prog(t, beat('AC_draw').t1 - 0.1, beat('AC_draw').t1 + 0.25, backOut)} r={6} />
          <Dot c={sD} s={w('D_pop', backOut)} color={T.gold} r={8} />
          <Dot c={sP} s={prog(t, beat('proj_drop').t1 - 0.1, beat('proj_drop').t1 + 0.2, backOut)} color={T.red} r={5} />
        </svg>

        <Label at={sA} dx={26} dy={34} s={w('A_pop', easeOut)} tex="A" />
        <Label at={sB} dx={6} dy={42} s={prog(t, beat('AB_draw').t1 - 0.2, beat('AB_draw').t1 + 0.3, easeOut)} tex="B" color={T.blue} />
        <Label at={sC} dx={34} dy={-10} s={prog(t, beat('AC_draw').t1 - 0.2, beat('AC_draw').t1 + 0.3, easeOut)} tex="C" />
        <Label at={sD} dx={-40} dy={-30} s={w('D_pop', easeOut)} tex="D" color={T.gold} />
        <Label at={sD} dx={92 * Math.cos(arc120.mid - 0.45)} dy={92 * Math.sin(arc120.mid - 0.45)} s={a120} tex="120^\circ" color={T.gold} size={30} />
        <Label at={{x: (sA.x + sP.x) / 2, y: sA.y}} dy={40} s={w('xD_label', easeOut)} tex="x_D" color={T.red} size={44} />
        <Label at={{x: (sB.x + sA.x) / 2, y: sA.y}} dy={40} s={prog(t, beat('AB_draw').t1, beat('AB_draw').t1 + 0.4, easeOut)} tex="2" color={T.blue} size={34} />
        {q > 0 ? (
          <div style={{position: 'absolute', left: W2S({x: -1.7, y: 0}).x - 70, top: sD.y - 60, fontSize: 96, fontWeight: 700, color: T.gold, opacity: q, transform: `scale(${(0.6 + 0.4 * q) * (1 + 0.06 * Math.sin(Math.max(0, t - beat('question').t1) * 3.2))})`, textShadow: `0 0 30px ${T.gold}88`}}>
            ?
          </div>
        ) : null}
      </AbsoluteFill>

      {/* formula column (outside the camera so it stays crisp and steady) */}
      <div style={{position: 'absolute', left: 120, top: 150, color: T.ink}}>
        <div style={{opacity: w('perp_tag', easeOut) * (1 - 0.55 * formula), transform: `translateY(${(1 - w('perp_tag', easeOut)) * 16}px)`}}>
          <Tex tex={`\\textcolor{${T.blue}}{AB}\\perp AC`} size={40} />
        </div>
        <div style={{marginTop: 34, display: 'flex', alignItems: 'center', gap: 14, opacity: formula, transform: `translateY(${(1 - formula) * 22}px)`}}>
          <Tex tex={`\\overrightarrow{AD}\\cdot\\textcolor{${T.blue}}{\\overrightarrow{AB}}`} size={62} />
          <Tex tex="=" size={62} />
          <span style={{display: 'grid', justifyItems: 'start'}}>
            <span style={{gridArea: '1/1', opacity: 1 - morph, filter: `blur(${morph * 8}px)`, transform: `translateY(${-morph * 24}px)`}}>
              <Tex tex={`\\textcolor{${T.blue}}{|\\overrightarrow{AB}|}\\cdot\\textcolor{${T.red}}{x_D}`} size={62} />
            </span>
            <span style={{gridArea: '1/1', opacity: morph, filter: `blur(${(1 - morph) * 8}px)`, transform: `translateY(${(1 - morph) * 24}px)`}}>
              <Tex tex={`\\textcolor{${T.blue}}{2}\\,\\textcolor{${T.red}}{x_D}`} size={62} />
            </span>
          </span>
        </div>
        {/* min ⇔ leftmost */}
        <div style={{marginTop: 30, display: 'flex', alignItems: 'center', gap: 18, opacity: w('min_mark', easeOut), transform: `translateX(${(1 - w('min_mark', easeOut)) * -20}px)`}}>
          <span style={{fontSize: 36, fontWeight: 500, color: T.gold}}>点积最小</span>
          <Tex tex="\Longleftrightarrow" size={40} color={T.muted} />
          <span style={{fontSize: 36, fontWeight: 500, color: T.gold}}>D 最靠左</span>
        </div>
        {/* live readout during the sweep: always above -2, the answer is withheld */}
        <div style={{marginTop: 34, opacity: prog(t, beat('sweep').t0, beat('sweep').t0 + 0.4), fontVariantNumeric: 'tabular-nums'}}>
          <Tex tex={`2\\textcolor{${T.red}}{x_D} = ${fmt(value)}`} size={44} color={T.muted} />
        </div>
      </div>

      {/* HUD */}
      <div style={{position: 'absolute', left: 120, top: 70, fontSize: 22, letterSpacing: 4, color: T.muted}}>01 · 点积 → 投影</div>
      <div style={{position: 'absolute', right: 120, top: 70, fontSize: 22, letterSpacing: 4, color: T.muted}}>VIDEO-002</div>

      <Subtitles t={t} />
    </AbsoluteFill>
  );
};

