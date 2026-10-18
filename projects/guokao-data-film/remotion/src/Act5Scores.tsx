import React, {useMemo} from 'react';
import {clamp01, hash01, seatProgress} from './seatModel.js';
import {Heading, Painter, Stage, fade, lerp, rise, useCanvas, useActFrame} from './common';
import {C, W, fmt} from './theme';
import {useFilmData, type Cutoffs} from './useFilmData';

// Act V "分数": a new unit — 2026 positions. Published minimum interview scores fall
// into a dot histogram; medians by exam category; spotlight on the extremes.
export const T = {
  intro: [0, 70],
  fall: [60, 230],
  medians: [240, 330],
  spot: [340, 540],
  other: [540, 640],
  end: 780,
} as const;

const AX = {lo: 88, hi: 156, x0: 210, x1: 1710, base: 860};
const CAT_RGB = [
  [120, 197, 224],
  [125, 191, 122],
  [227, 182, 91],
];
const CAT_SHORT = ['行政执法类', '市（地）级综合管理类', '中央省级综合管理类'];
const xOf = (score: number) => AX.x0 + ((score - AX.lo) / (AX.hi - AX.lo)) * (AX.x1 - AX.x0);

function buildHistogram(c: Cutoffs) {
  const BIN = 0.5;
  const binW = ((AX.x1 - AX.x0) / (AX.hi - AX.lo)) * BIN;
  const across = 3;
  const bins = new Map<number, number[]>();
  const order = c.main.map((_, i) => i).sort((a, b) => c.main[a][1] - c.main[b][1] || c.main[a][0] - c.main[b][0] || a - b);
  order.forEach(i => {
    const b = Math.floor(c.main[i][0] / 10 / BIN);
    if (!bins.has(b)) bins.set(b, []);
    bins.get(b)!.push(i);
  });
  const maxRows = Math.max(...[...bins.values()].map(l => Math.ceil(l.length / across)));
  const pitchY = Math.min(binW / across, 540 / maxRows);
  const xy = new Float32Array(c.main.length * 2);
  for (const [b, list] of bins) {
    const left = xOf(b * BIN);
    list.forEach((i, k) => {
      xy[i * 2] = left + ((k % across) + 0.5) * (binW / across);
      xy[i * 2 + 1] = AX.base - (Math.floor(k / across) + 0.5) * pitchY;
    });
  }
  // the other-scale cluster as a compact block
  const other = new Float32Array(c.otherCount * 2);
  const cols = 75;
  for (let k = 0; k < c.otherCount; k++) {
    other[k * 2] = 250 + (k % cols) * 4.4;
    other[k * 2 + 1] = 330 + Math.floor(k / cols) * 4.4;
  }
  return {xy, other, size: Math.min(binW / across, pitchY) * 0.8};
}

export const Act5Scores: React.FC = () => {
  const frame = useActFrame();
  const model = useFilmData();
  const c = model?.cutoffs;
  const hist = useMemo(() => (c ? buildHistogram(c) : null), [c]);
  const topCut = c ? Math.round(c.top[c.top.length - 1].score * 10) : 0;

  const canvas = useCanvas(
    c && hist
      ? ctx => {
          const p = new Painter();
          const spot = fade(frame, T.spot[0], T.spot[0] + 24);
          const n = c.main.length;
          for (let i = 0; i < n; i++) {
            const [s10, cat] = c.main[i];
            const j = hash01(i, 41);
            const sx = hash01(i, 42) * W;
            const sy = 330 + hash01(i, 43) * 380;
            const appear = clamp01((frame - j * 40) / 16);
            const g = seatProgress(frame, T.fall[0], T.fall[1], (s10 / 10 - AX.lo) / (AX.hi - AX.lo), j, 0.6);
            const x = lerp(sx, hist.xy[i * 2], g);
            const y = lerp(sy, hist.xy[i * 2 + 1], g);
            const isTop = s10 >= topCut;
            const isMin = s10 === Math.round(c.min * 10);
            const [r, gg, b] = CAT_RGB[cat];
            const alpha = appear * (isTop || isMin ? 1 : 1 - spot * 0.7);
            const size = lerp(2.2, hist.size, g) * (isTop || isMin ? 1 + spot * 1.6 : 1);
            p.add(x, y, size, isTop ? lerp(r, 255, spot) : r, isTop ? lerp(gg, 255, spot) : gg, isTop ? lerp(b, 255, spot) : b, alpha);
          }
          const oA = fade(frame, T.other[0], T.other[0] + 40);
          for (let k = 0; k < c.otherCount; k++) {
            const a = oA * clamp01((frame - T.other[0] - hash01(k, 44) * 50) / 14);
            p.add(hist.other[k * 2], hist.other[k * 2 + 1], 3.2, 150, 156, 168, a * (1 - spot * 0.4));
          }
          p.flush(ctx);
          // axis
          const axA = fade(frame, T.fall[0] + 40, T.fall[0] + 80);
          ctx.strokeStyle = `rgba(236,232,225,${0.35 * axA})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(AX.x0, AX.base + 6);
          ctx.lineTo(AX.x1, AX.base + 6);
          ctx.stroke();
          // medians
          c.medians.forEach((m, k) => {
            const a = fade(frame, T.medians[0] + k * 14, T.medians[0] + 20 + k * 14) * (1 - spot * 0.6);
            if (a <= 0) return;
            ctx.strokeStyle = `rgba(${CAT_RGB[k].join(',')},${a})`;
            ctx.setLineDash([6, 6]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(xOf(m), AX.base + 6);
            ctx.lineTo(xOf(m), 262 + k * 34);
            ctx.stroke();
            ctx.setLineDash([]);
          });
        }
      : null,
  );

  if (!model || !c || !hist) return <Stage act={4} source="" />;
  const intro = fade(frame, 0, 18, T.fall[1] - 30, T.fall[1] - 10);
  const head = fade(frame, T.fall[1] - 10, T.fall[1] + 10);
  const med = fade(frame, T.medians[0], T.medians[0] + 30) * (1 - fade(frame, T.spot[0], T.spot[0] + 20) * 0.6);
  const spot = fade(frame, T.spot[0] + 10, T.spot[0] + 34);
  const other = fade(frame, T.other[0] + 30, T.other[0] + 50);
  const spread = (c.max - c.min).toFixed(1);

  return (
    <Stage act={4} canvas={canvas} source="数据：2026 年度国考首批面试名单公开镜像（审计署 35 岗与官方附件一致）· 最低面试分数按发布值，非合格线">
      <div style={{position: 'absolute', left: 125, top: 110, ...rise(intro)}}>
        <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>05 · 分数</div>
        <div style={{fontSize: 46, fontWeight: 700, marginTop: 8}}>换一个单位：2026 年的 {fmt(c.total)} 个岗位</div>
        <div style={{fontSize: 24, color: C.muted, marginTop: 12}}>每个点 = 1 个岗位 · 位置 = 它公布的最低进面分数</div>
      </div>
      <Heading o={head} kicker="05 · 分数" title={`同一场考试，进面线相差 ${spread} 分`} sub={`${fmt(c.main.length)} 个岗位 · 最低 ${c.min} · 最高 ${c.max}`} />

      {[90, 100, 110, 120, 130, 140, 150].map(v => (
        <div key={v} style={{position: 'absolute', left: xOf(v) - 30, width: 60, top: AX.base + 16, textAlign: 'center', fontSize: 18, color: C.muted, opacity: fade(frame, T.fall[0] + 40, T.fall[0] + 80)}}>
          {v}
        </div>
      ))}
      {c.medians.map((m, k) => (
        <div key={k} style={{position: 'absolute', left: xOf(m) + 10, top: 244 + k * 34, fontSize: 19, whiteSpace: 'nowrap', opacity: med}}>
          <span style={{color: `rgb(${CAT_RGB[k].join(',')})`, fontWeight: 700}}>{CAT_SHORT[k]}</span>
          <span style={{color: C.muted, marginLeft: 8}}>中位数 {m}</span>
        </div>
      ))}
      <div style={{position: 'absolute', left: 125, top: 960, fontSize: 17, color: C.muted, opacity: med}}>各类别笔试试卷与计分不同，中位数仅作各自参考，不宜横向比较</div>

      {/* spotlight */}
      <div style={{position: 'absolute', left: xOf(c.max) - 470, top: 300, width: 420, textAlign: 'right', ...rise(spot)}}>
        <div style={{fontSize: 20, color: C.muted, letterSpacing: 3}}>最高进面分</div>
        <div style={{fontSize: 80, fontWeight: 700, lineHeight: 1.05}}>{c.max}</div>
        <div style={{fontSize: 22, marginTop: 6}}>
          {c.top[0].org} · {c.top[0].unit}
        </div>
        <div style={{fontSize: 19, color: C.muted}}>
          {c.top[0].post} · 招 {c.top[0].seats} 人
        </div>
        <div style={{fontSize: 17, color: C.muted, marginTop: 18, lineHeight: 1.6}}>
          {c.top.slice(1).map(t => (
            <div key={t.unit + t.post}>
              {t.score} · {t.unit}
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', left: xOf(c.min) - 4, top: 690, ...rise(spot)}}>
        <div style={{fontSize: 20, color: C.muted}}>最低</div>
        <div style={{fontSize: 48, fontWeight: 700}}>{c.min}</div>
        <div style={{fontSize: 16, color: C.muted, width: 260}}>政策倾斜职位的合格线为 90 分</div>
      </div>

      {/* other-scale cluster */}
      <div style={{position: 'absolute', left: 250, top: 286, width: 330, ...rise(other)}}>
        <div style={{fontSize: 20}}>
          另有 <b>{fmt(c.otherCount)}</b> 个岗位计分方式不同
        </div>
        <div style={{fontSize: 16, color: C.muted, marginTop: 4, lineHeight: 1.5, position: 'absolute', top: 210, width: 340}}>
          以公安、金融监管等设专业科目的职位为主，分数口径不同，单独成组、不参与比较
        </div>
      </div>
    </Stage>
  );
};
