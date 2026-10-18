import React, {useMemo} from 'react';
import {clamp01, easeInOutCubic, hash01} from './seatModel.js';
import {Painter, Stage, fade, lerp, rise, useCanvas, useActFrame} from './common';
import {C, H, W, fmt} from './theme';
import {useFilmData} from './useFilmData';

// Act VI "一个座位": type a major code, a signal ripples across the 2027 field and lights
// every seat whose 专业 text mentions it; the camera dives into one seat and opens its row.
export const T = {
  appear: [0, 40],
  type: [50, 130],
  ripple: [140, 300],
  dive: [330, 450],
  card: [440, 600],
  close: [600, 720],
  end: 720,
} as const;

const ORIGIN: [number, number] = [960, 630];

export const Act6OneSeat: React.FC = () => {
  const frame = useActFrame();
  const model = useFilmData();
  const info = useMemo(() => {
    if (!model) return null;
    const P = model.data.positions;
    const law = new Uint8Array(model.seats.count);
    let featuredSeat = -1;
    for (let s = 0; s < model.seats.count; s++) {
      law[s] = P[model.seats.position[s]][9];
      if (featuredSeat < 0 && model.seats.position[s] === model.data.query.featured.index) featuredSeat = s;
    }
    const {field} = model.layouts;
    const maxD = Math.hypot(W, H) * 0.62;
    const lawSeats: {d: number; pos: number}[] = [];
    for (let s = 0; s < model.seats.count; s++) {
      if (law[s]) lawSeats.push({d: Math.hypot(field[s * 2] - ORIGIN[0], field[s * 2 + 1] - ORIGIN[1] + 70), pos: model.seats.position[s]});
    }
    return {law, lawSeats, featuredSeat, fx: field[featuredSeat * 2], fy: field[featuredSeat * 2 + 1], maxD};
  }, [model]);

  const radius = info ? lerp(0, info.maxD, easeInOutCubic(clamp01((frame - T.ripple[0]) / (T.ripple[1] - T.ripple[0])))) : 0;
  const dive = easeInOutCubic(clamp01((frame - T.dive[0]) / (T.dive[1] - T.dive[0])));
  const S = Math.exp(lerp(0, Math.log(16), dive));
  const cam = info ? {fx: lerp(960, info.fx, dive), fy: lerp(630, info.fy, dive)} : {fx: 960, fy: 630};
  const proj = (x: number, y: number): [number, number] => [960 + (x - cam.fx) * S, 560 + (y - cam.fy) * S + (1 - dive) * 70];
  // live counts: seats inside the ripple, and the distinct positions they belong to
  const litList = info ? info.lawSeats.filter(l => l.d < radius) : [];
  const lit = litList.length;
  const litPositions = new Set(litList.map(l => l.pos)).size;

  const canvas = useCanvas(
    model && info
      ? ctx => {
          const {field} = model.layouts;
          const p = new Painter();
          const closeT = fade(frame, T.close[0], T.close[0] + 50);
          const cardA = fade(frame, T.card[0], T.card[0] + 30, T.close[0], T.close[0] + 30);
          for (let s = 0; s < model.seats.count; s++) {
            const x0 = field[s * 2];
            const y0 = field[s * 2 + 1];
            const appear = clamp01((frame - hash01(s, 3) * 26) / 12);
            const d = Math.hypot(x0 - ORIGIN[0], y0 - ORIGIN[1] + 70);
            const hit = d < radius;
            const isLaw = info.law[s] === 1;
            const after = clamp01((radius - d) / 120);
            const featured = s === info.featuredSeat;
            const [x, y] = closeT > 0 ? [x0, y0 + 70 * 0] : proj(x0, y0);
            let r: number = C.seat[0];
            let g: number = C.seat[1];
            let b: number = C.seat[2];
            let a = appear * (frame >= T.ripple[0] ? lerp(1, isLaw ? 1 : 0.28, after) : 1);
            let size = 3.5 * (closeT > 0 ? 1 : S);
            if (isLaw && hit) {
              r = lerp(r, 236, after);
              g = lerp(g, 120, after);
              b = lerp(b, 92, after);
              size *= 1 + 0.9 * after * (1 - dive * 0.5);
            }
            if (!featured) a *= 1 - dive * 0.75 - cardA * 0.2;
            if (featured) {
              r = lerp(r, 255, dive);
              g = lerp(g, 255, dive);
              b = lerp(b, 255, dive);
            }
            if (closeT > 0) {
              // closing: whole field returns, gently lit
              a = appear * lerp(0.15, 0.42, closeT) * (isLaw ? 1.6 : 1);
              size = 3.5;
            }
            p.add(x, y, size, r, g, b, a);
          }
          p.flush(ctx);
          // ripple ring
          const ringA = fade(frame, T.ripple[0], T.ripple[0] + 10, T.ripple[1] - 30, T.ripple[1]);
          if (ringA > 0) {
            const [ox, oy] = proj(ORIGIN[0], ORIGIN[1] - 70);
            ctx.strokeStyle = `rgba(236,120,92,${0.6 * ringA})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ox, oy + 70, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      : null,
  );

  if (!model || !info) return <Stage act={6} source="" />;
  const q = model.data.query;
  const typed = q.code.slice(0, Math.floor(clamp01((frame - T.type[0] - 16) / 56) * q.code.length + 0.0001));
  const boxA = fade(frame, T.type[0], T.type[0] + 14, T.dive[0], T.dive[0] + 20);
  const countA = fade(frame, T.ripple[0] + 20, T.ripple[0] + 40, T.dive[0], T.dive[0] + 20);
  const cardA = fade(frame, T.card[0], T.card[0] + 30, T.close[0], T.close[0] + 30);
  const closeA = fade(frame, T.close[0] + 30, T.close[0] + 60);
  const titleA = fade(frame, 4, 22, T.type[0] + 10, T.type[0] + 24);

  return (
    <Stage
      act={6}
      canvas={canvas}
      source={
        <>
          数据：2027 国考职位表「专业」字段文字匹配 · 本科专业目录（2026）030101K = 法学
          <br />
          来源行：{q.featured.source.sheet} 第 {q.featured.source.row} 行
        </>
      }
    >
      <div style={{position: 'absolute', left: 125, top: 100, ...rise(titleA)}}>
        <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>06 · 一个座位</div>
        <div style={{fontSize: 46, fontWeight: 700, marginTop: 8}}>回到 2027 年的 {fmt(model.data.facts.seats.value)} 个名额</div>
      </div>

      {/* query box */}
      <div style={{position: 'absolute', left: 660, width: 600, top: 120, opacity: boxA, transform: `scale(${0.96 + 0.04 * boxA})`}}>
        <div style={{fontSize: 20, color: C.muted, marginBottom: 10, letterSpacing: 3}}>输入一个专业代码</div>
        <div style={{height: 76, borderRadius: 14, border: '1.5px solid rgba(236,232,225,0.35)', background: 'rgba(13,16,21,0.8)', display: 'flex', alignItems: 'center', padding: '0 26px', fontSize: 44, fontWeight: 700, letterSpacing: 6}}>
          {typed}
          <span style={{width: 3, height: 44, background: C.coralCss, marginLeft: 6, opacity: Math.floor(frame / 12) % 2 ? 1 : 0.2}} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 660, width: 600, top: 236, textAlign: 'left', ...rise(countA)}}>
        <div style={{fontSize: 30}}>
          <b style={{color: C.coralCss}}>{fmt(litPositions)}</b> 个岗位 · <b style={{color: C.coralCss}}>{fmt(lit)}</b> 个名额
        </div>
        <div style={{fontSize: 19, color: C.muted, marginTop: 6}}>专业栏提到 {q.code} · {q.name} · 提到 ≠ 可报资格</div>
      </div>

      {/* the row behind one dot */}
      <div style={{position: 'absolute', left: 520, width: 880, top: 170, ...rise(cardA)}}>
        <div style={{fontSize: 20, color: C.coralCss, letterSpacing: 4}}>这是其中一个点</div>
        <div style={{marginTop: 14, borderRadius: 16, border: '1px solid rgba(236,232,225,0.22)', background: 'rgba(17,21,28,0.92)', padding: '22px 34px'}}>
          {q.featured.fields.map(([k, v], i) => (
            <div key={k} style={{display: 'flex', gap: 24, padding: '9px 0', borderTop: i ? '1px solid rgba(236,232,225,0.08)' : 'none', opacity: fade(frame, T.card[0] + 16 + i * 5, T.card[0] + 30 + i * 5)}}>
              <div style={{width: 150, fontSize: 18, color: C.muted, flexShrink: 0}}>{k}</div>
              <div style={{fontSize: k === '专业' ? 19 : 22, fontWeight: k === '招考职位' || k === '部门名称' ? 700 : 400, lineHeight: 1.45}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* closing */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 360, textAlign: 'center', ...rise(closeA)}}>
        <div style={{fontSize: 30, color: C.muted, letterSpacing: 6}}>{fmt(model.data.facts.seats.value)} 个点</div>
        <div style={{fontSize: 72, fontWeight: 700, marginTop: 12, textShadow: '0 4px 40px rgba(13,16,21,0.95)'}}>每一个，都是一个真实的座位</div>
        <div style={{fontSize: 22, color: C.muted, marginTop: 26, textShadow: '0 2px 20px rgba(13,16,21,1)'}}>2027 国考网上报名：提交申请截止 2026 年 10 月 24 日 18:00（北京时间）</div>
      </div>
    </Stage>
  );
};
