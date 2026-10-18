import React from 'react';
import {useCurrentFrame} from 'remotion';
import {clamp01, easeInOutCubic, hash01} from './seatModel.js';
import {Heading, Painter, Stage, fade, lerp, rise, useCanvas} from './common';
import {C, fmt} from './theme';
import {useFilmData} from './useFilmData';

// Act I "越来越挤": one seat, ~98 approved applicants around it; then the scissors
// chart of applicants vs seats; then the 2027 field of 35,691 seats (hands off to Act II).
export const T = {
  hook: [0, 200],
  chart: [196, 600],
  field: [600, 760],
  end: 780,
} as const;

const CX = 960;
const CY = 560;
const APPLICANT_RGB = [236, 120, 92];
const SEAT_RGB = [120, 197, 224];
const plot = {x: 330, y: 280, w: 1260, h: 520};

export const Act1Crowded: React.FC = () => {
  const frame = useCurrentFrame();
  const model = useFilmData();
  const comp = model?.data.competition ?? [];
  const ratio2026 = 98; // published "约98:1"
  const xs = comp.map((_, i) => plot.x + (i / Math.max(1, comp.length - 1)) * plot.w);
  // Two bands so the lines never cross: applicants rise in the upper band, seats fall in the lower.
  const yA = (v: number) => plot.y + 300 * (1 - (v - 2_800_000) / (3_900_000 - 2_800_000));
  const yS = (v: number) => plot.y + 520 - 260 * ((v - 34_000) / (41_000 - 34_000));
  const draw = useDrawProgress(frame);

  const canvas = useCanvas(
    model
      ? ctx => {
          const p = new Painter();
          // ---- hook: one seat, 98 applicants spiralling in
          const hookOut = 1 - fade(frame, 168, 206);
          if (hookOut > 0) {
            const scale = lerp(0.35, 1, hookOut);
            for (let k = 0; k < ratio2026; k++) {
              const t = easeInOutCubic(clamp01((frame - 26 - k * 0.9) / 70));
              const a0 = hash01(k, 21) * Math.PI * 2;
              const r0 = 1150;
              const golden = k * 2.39996;
              const r1 = 30 * Math.sqrt(k + 1.6);
              const ang = lerp(a0, golden, t) + (1 - t) * 2.2;
              const r = lerp(r0, r1, t);
              p.add(CX + Math.cos(ang) * r * scale, CY + Math.sin(ang) * r * scale, 9 * scale, C.seat[0], C.seat[1], C.seat[2], hookOut);
            }
            const seatA = fade(frame, 4, 20) * hookOut;
            p.add(CX, CY, 20 * scale, ...(SEAT_RGB as [number, number, number]), seatA);
          }
          // ---- 2027 field (seats appear in hashed order) -> identical to Act II frame 0
          if (frame >= T.field[0]) {
            const {field} = model.layouts;
            for (let i = 0; i < model.seats.count; i++) {
              const a = clamp01((frame - T.field[0] - hash01(i, 3) * 110) / 12);
              p.add(field[i * 2], field[i * 2 + 1], 3.5, C.seat[0], C.seat[1], C.seat[2], a);
            }
          }
          p.flush(ctx);

          // ---- scissors chart
          const chartA = fade(frame, T.chart[0], T.chart[0] + 20, T.chart[1] - 24, T.chart[1]);
          if (chartA > 0) {
            ctx.globalAlpha = chartA;
            ctx.strokeStyle = 'rgba(236,232,225,0.12)';
            ctx.lineWidth = 1;
            xs.forEach(x => {
              ctx.beginPath();
              ctx.moveTo(x, plot.y - 10);
              ctx.lineTo(x, plot.y + plot.h + 10);
              ctx.stroke();
            });
            const A = comp.filter(c => c.approved !== null).map((c, i) => [xs[i], yA(c.approved!)] as const);
            const S = comp.map((c, i) => [xs[i], yS(c.planned)] as const);
            // wedge between the lines, once both are drawn
            const wedge = fade(frame, 400, 440);
            if (wedge > 0) {
              const g = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.h);
              g.addColorStop(0, `rgba(236,120,92,${0.16 * wedge})`);
              g.addColorStop(1, `rgba(120,197,224,${0.1 * wedge})`);
              ctx.fillStyle = g;
              ctx.beginPath();
              A.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
              [...S.slice(0, A.length)].reverse().forEach(([x, y]) => ctx.lineTo(x, y));
              ctx.closePath();
              ctx.fill();
            }
            strokeProgress(ctx, A, draw(250, 400), `rgb(${APPLICANT_RGB})`);
            strokeProgress(ctx, S, draw(262, 412), `rgb(${SEAT_RGB})`);
            ctx.globalAlpha = 1;
          }
        }
      : null,
  );

  if (!model) return <Stage act={0} source="" />;
  const seats = model.data.facts.seats.value;
  const hookText = fade(frame, 30, 50, 160, 180);
  const chartA = fade(frame, T.chart[0] + 10, T.chart[0] + 30, T.chart[1] - 24, T.chart[1]);
  const fieldText = fade(frame, T.field[0] + 20, T.field[0] + 40, T.end - 30, T.end - 14);
  const visible = Math.round(seats * clamp01((frame - T.field[0]) / 122));
  const approvedCount = Math.min(ratio2026, Math.floor(clamp01((frame - 26) / 158) * ratio2026 * 1.15));

  return (
    <Stage
      act={0}
      canvas={canvas}
      source={
        <>
          过审人数、计划名额：国家公务员局（新华社 / 央视报道，按「万」四舍五入）
          <br />
          2027 计划名额：职位表 19,426 岗逐岗加总
        </>
      }
    >
      {/* hook */}
      <div style={{position: 'absolute', left: 125, top: 120, ...rise(hookText)}}>
        <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>01 · 越来越挤</div>
        <div style={{fontSize: 44, fontWeight: 700, marginTop: 10}}>2026 年度国考</div>
        <div style={{fontSize: 30, marginTop: 14}}>
          每 <span style={{color: 'rgb(120,197,224)', fontWeight: 700}}>1</span> 个名额，约{' '}
          <span style={{color: 'rgb(236,120,92)', fontWeight: 700, fontSize: 64}}>{approvedCount}</span> 人通过资格审查
        </div>
        <div style={{fontSize: 18, color: C.muted, marginTop: 12}}>过审人数 ÷ 计划名额（公布值约 98:1）；不代表单个岗位的录取概率</div>
      </div>

      {/* chart */}
      <Heading o={chartA} kicker="01 · 越来越挤" title="人越来越多，位子越来越少" sub={`实际走进考场：${comp.slice(0, 3).map(c => c.attendeesText).join(' → ')}`} />
      {chartA > 0 &&
        comp.map((c, i) => {
          const showA = c.approved !== null ? fade(frame, 250 + i * 75, 270 + i * 75) : 0;
          const showS = fade(frame, 262 + i * 50, 282 + i * 50);
          const badge = c.ratioText ? fade(frame, 420 + i * 18, 440 + i * 18) : 0;
          return (
            <React.Fragment key={c.year}>
              <div style={{position: 'absolute', left: xs[i] - 60, width: 120, top: plot.y + plot.h + 26, textAlign: 'center', fontSize: 24, color: C.muted, opacity: chartA}}>{c.year}</div>
              {c.approved !== null ? (
                <div style={{position: 'absolute', left: xs[i] - 100, width: 200, top: yA(c.approved) - 58, textAlign: 'center', opacity: showA * chartA}}>
                  <div style={{fontSize: 30, fontWeight: 700, color: 'rgb(236,120,92)'}}>{c.approvedText.replace('人', '')}</div>
                </div>
              ) : (
                <div style={{position: 'absolute', left: xs[i] - 110, width: 220, top: plot.y - 20, textAlign: 'center', opacity: showS * chartA, fontSize: 20, color: C.muted, lineHeight: 1.5}}>
                  过审人数
                  <br />
                  报名进行中
                </div>
              )}
              <div style={{position: 'absolute', left: xs[i] - 100, width: 200, top: yS(c.planned) + 16, textAlign: 'center', opacity: showS * chartA}}>
                <div style={{fontSize: 26, fontWeight: 700, color: 'rgb(120,197,224)'}}>{c.year === 2027 ? `${fmt(c.planned)}` : c.plannedText.replace('人', '')}</div>
              </div>
              {c.ratioText && c.approved !== null ? (
                <div
                  style={{
                    position: 'absolute',
                    left: xs[i] + 14,
                    top: (yA(c.approved) + yS(c.planned)) / 2 - 18,
                    opacity: badge * chartA,
                    fontSize: 22,
                    padding: '4px 12px',
                    borderRadius: 8,
                    background: 'rgba(13,16,21,0.75)',
                    border: '1px solid rgba(236,232,225,0.25)',
                  }}
                >
                  {c.ratioText.replace('约', '≈ ')}
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      {chartA > 0 && (
        <div style={{position: 'absolute', right: 125, top: 120, textAlign: 'right', fontSize: 20, lineHeight: 1.7, opacity: chartA}}>
          <div>
            <span style={{color: 'rgb(236,120,92)'}}>━━</span> 通过资格审查人数
          </div>
          <div>
            <span style={{color: 'rgb(120,197,224)'}}>━━</span> 计划招录名额
          </div>
        </div>
      )}

      {/* 2027 field */}
      <div style={{position: 'absolute', left: 125, top: 100, ...rise(fieldText)}}>
        <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>2027 年度 · 计划招录名额</div>
        <div style={{fontSize: 112, fontWeight: 700, lineHeight: 1.05, marginTop: 6}}>{fmt(visible)}</div>
        <div style={{fontSize: 22, color: C.muted, marginTop: 8}}>每个点 = 1 个名额 · 共 {fmt(model.data.facts.positions.value)} 个岗位</div>
      </div>
    </Stage>
  );
};

/** Progress helper for line drawing. */
function useDrawProgress(frame: number) {
  return (a: number, b: number) => easeInOutCubic(clamp01((frame - a) / (b - a)));
}

function strokeProgress(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], t: number, color: string) {
  if (pts.length < 2 || t <= 0) return;
  const segs = pts.length - 1;
  const upto = t * segs;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= segs; i++) {
    const f = Math.min(1, upto - (i - 1));
    if (f <= 0) break;
    ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f));
  }
  ctx.stroke();
  ctx.fillStyle = color;
  pts.forEach(([x, y], i) => {
    if (i <= upto + 1e-6) {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
