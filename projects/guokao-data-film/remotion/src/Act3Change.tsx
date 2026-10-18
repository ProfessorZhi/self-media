import React from 'react';
import {clamp01, easeInOutCubic} from './seatModel.js';
import {shortName} from './structureLayouts.js';
import {Heading, Stage, fade, lerp, rise, signedPct, useCanvas, useActFrame} from './common';
import {C, FAMILY_RGB, fmt, famCss} from './theme';
import {useFilmData, type Mover} from './useFilmData';

// Act III "一年巨变": department dumbbells (2026 -> 2027), four-year level index,
// province tile map of change.
export const T = {
  movers: [0, 330],
  levels: [330, 640],
  map: [640, 960],
  end: 960,
} as const;

// Tile grid (col,row) — a schematic, not a geographic map.
export const TILES: Record<string, [number, number]> = {
  黑龙江: [8, 0], 新疆: [1, 1], 内蒙古: [6, 1], 吉林: [8, 1],
  甘肃: [2, 2], 宁夏: [3, 2], 山西: [5, 2], 河北: [6, 2], 北京: [7, 2], 辽宁: [8, 2],
  西藏: [1, 3], 青海: [2, 3], 陕西: [4, 3], 河南: [5, 3], 山东: [6, 3], 天津: [7, 3],
  四川: [3, 4], 重庆: [4, 4], 湖北: [5, 4], 安徽: [6, 4], 江苏: [7, 4],
  云南: [3, 5], 贵州: [4, 5], 湖南: [5, 5], 江西: [6, 5], 浙江: [7, 5], 上海: [8, 5],
  广西: [4, 6], 广东: [5, 6], 福建: [6, 6], 海南: [5, 7],
};
const LEVELS = ['县（区）级及以下', '市（地）级', '省（副省）级', '中央'];
const LEVEL_RGB = [
  [176, 184, 196],
  [236, 120, 92],
  [120, 197, 224],
  [227, 182, 91],
];

const famIdx = (data: {families: {name: string}[]}, name: string) => data.families.findIndex(f => f.name === name);
const moverName = (n: string) =>
  n.startsWith('国家税务总局') ? n.replace('国家税务总局', '') : n === '国家金融监督管理总局' ? '金融监管总局（机关）' : shortName(n);

export const Act3Change: React.FC = () => {
  const frame = useActFrame();
  const model = useFilmData();
  const ch = model?.data.change;

  // ---- dumbbell geometry
  const ax = {x0: 820, x1: 1660, max: 200};
  const xv = (v: number) => ax.x0 + (v / ax.max) * (ax.x1 - ax.x0);
  const rowsTop = 300;
  const rowH = 58;
  const rowY = (k: number) => rowsTop + k * rowH + (k >= 5 ? 50 : 0);
  const movers: (Mover & {k: number})[] = ch ? [...ch.gainers, ...ch.losers].map((m, k) => ({...m, k})) : [];
  const moveT = (k: number) => easeInOutCubic(clamp01((frame - 70 - k * 9) / 60));
  const partA = fade(frame, 0, 16, T.movers[1] - 26, T.movers[1]);

  // ---- level index lines
  const lv = ch?.levelsByYear ?? [];
  const lp = {x: 360, y: 270, w: 1000, h: 520, lo: 55, hi: 120};
  const lx = (i: number) => lp.x + (i / 3) * lp.w;
  const ly = (v: number) => lp.y + lp.h - ((v - lp.lo) / (lp.hi - lp.lo)) * lp.h;
  const idx = (name: string, i: number) => (lv[i][name] / lv[0][name]) * 100;
  const partB = fade(frame, T.levels[0], T.levels[0] + 18, T.levels[1] - 26, T.levels[1]);
  const drawB = easeInOutCubic(clamp01((frame - T.levels[0] - 30) / 130));

  // ---- tile map
  const tile = 84;
  const step = 94;
  const mapX = 860;
  const mapY = 238;
  const partC = fade(frame, T.map[0], T.map[0] + 18);

  const canvas = useCanvas(
    ch
      ? ctx => {
          if (partA > 0) {
            ctx.globalAlpha = partA;
            ctx.strokeStyle = 'rgba(236,232,225,0.12)';
            ctx.lineWidth = 1;
            [0, 50, 100, 150, 200].forEach(v => {
              ctx.beginPath();
              ctx.moveTo(xv(v), rowsTop - 30);
              ctx.lineTo(xv(v), rowY(9) + 26);
              ctx.stroke();
            });
            movers.forEach(m => {
              const t = moveT(m.k);
              const y = rowY(m.k);
              const fi = famIdx(model!.data, m.family);
              const [r, g, b] = FAMILY_RGB[fi];
              const appear = fade(frame, 20 + m.k * 6, 40 + m.k * 6);
              ctx.globalAlpha = partA * appear;
              const xNow = lerp(xv(m.from), xv(m.to), t);
              ctx.strokeStyle = `rgba(${r},${g},${b},0.55)`;
              ctx.lineWidth = 6;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(xv(m.from), y);
              ctx.lineTo(xNow, y);
              ctx.stroke();
              ctx.strokeStyle = 'rgba(236,232,225,0.6)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(xv(m.from), y, 9, 0, Math.PI * 2);
              ctx.stroke();
              ctx.fillStyle = `rgb(${r},${g},${b})`;
              ctx.beginPath();
              ctx.arc(xNow, y, 12, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.globalAlpha = 1;
          }
          if (partB > 0) {
            ctx.globalAlpha = partB;
            ctx.strokeStyle = 'rgba(236,232,225,0.12)';
            ctx.lineWidth = 1;
            [60, 80, 100, 120].forEach(v => {
              ctx.beginPath();
              ctx.moveTo(lp.x - 10, ly(v));
              ctx.lineTo(lp.x + lp.w + 10, ly(v));
              ctx.stroke();
            });
            LEVELS.forEach((name, li) => {
              const pts = [0, 1, 2, 3].map(i => [lx(i), ly(idx(name, i))]);
              const upto = drawB * 3;
              const [r, g, b] = LEVEL_RGB[li];
              ctx.strokeStyle = `rgb(${r},${g},${b})`;
              ctx.lineWidth = li === 1 ? 6 : 3;
              ctx.beginPath();
              ctx.moveTo(pts[0][0], pts[0][1]);
              for (let i = 1; i <= 3; i++) {
                const f = Math.min(1, upto - (i - 1));
                if (f <= 0) break;
                ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f));
              }
              ctx.stroke();
              ctx.fillStyle = `rgb(${r},${g},${b})`;
              pts.forEach(([x, y], i) => {
                if (i <= upto + 1e-6) {
                  ctx.beginPath();
                  ctx.arc(x, y, li === 1 ? 8 : 5, 0, Math.PI * 2);
                  ctx.fill();
                }
              });
            });
            ctx.globalAlpha = 1;
          }
          if (partC > 0) {
            ch.provinces.forEach(p => {
              const pos = TILES[p.name];
              if (!pos) return;
              const order = pos[0] + pos[1];
              const a = fade(frame, T.map[0] + 14 + order * 5, T.map[0] + 30 + order * 5) * partC;
              const s = Math.min(1, Math.abs(p.pct) / 0.4);
              const [r, g, b] = p.pct >= 0 ? [236, 120, 92] : [120, 197, 224];
              const x = mapX + pos[0] * step;
              const y = mapY + pos[1] * step;
              const k = 0.75 + 0.25 * a;
              ctx.fillStyle = `rgba(${r},${g},${b},${(0.12 + 0.78 * s) * a})`;
              ctx.fillRect(x + (tile * (1 - k)) / 2, y + (tile * (1 - k)) / 2, tile * k, tile * k);
            });
          }
        }
      : null,
  );

  if (!model || !ch) return <Stage act={2} source="" />;
  const levelChange = (name: string) => (lv[3][name] - lv[0][name]) / lv[0][name];
  const sortedProv = [...ch.provinces].sort((a, b) => b.pct - a.pct);
  const callouts = [...sortedProv.slice(0, 2), ...sortedProv.slice(-2).reverse()];

  return (
    <Stage act={2} canvas={canvas} source={ch.source}>
      {/* A: dumbbells */}
      <Heading o={partA} kicker="03 · 一年巨变" title="同一个部门，一年之间" sub="○ 2026 计划名额　● 2027 计划名额（按部门名称对比）" />
      {partA > 0 && (
        <>
          {[0, 50, 100, 150, 200].map(v => (
            <div key={v} style={{position: 'absolute', left: xv(v) - 30, width: 60, top: rowY(9) + 34, textAlign: 'center', fontSize: 16, color: C.muted, opacity: partA}}>
              {v}
            </div>
          ))}
          <div style={{position: 'absolute', left: 125, top: rowsTop - 52, fontSize: 20, color: 'rgb(236,120,92)', opacity: partA, letterSpacing: 4}}>涨得最猛</div>
          <div style={{position: 'absolute', left: 125, top: rowY(5) - 52, fontSize: 20, color: 'rgb(120,197,224)', opacity: partA, letterSpacing: 4}}>跌得最狠</div>
          {movers.map(m => {
            const appear = fade(frame, 20 + m.k * 6, 40 + m.k * 6) * partA;
            const t = moveT(m.k);
            const y = rowY(m.k);
            const fi = famIdx(model.data, m.family);
            const end = Math.max(xv(m.from), xv(m.to));
            return (
              <React.Fragment key={m.name}>
                <div style={{position: 'absolute', left: 125, top: y - 17, width: 640, display: 'flex', alignItems: 'center', gap: 12, opacity: appear}}>
                  <span style={{width: 10, height: 10, borderRadius: 2, background: famCss(fi)}} />
                  <span style={{fontSize: 24}}>{moverName(m.name)}</span>
                  <span style={{fontSize: 18, color: C.muted}}>{m.family}</span>
                </div>
                <div style={{position: 'absolute', left: end + 26, top: y - 20, fontSize: 26, fontWeight: 700, opacity: appear * fade(t, 0.5, 1), whiteSpace: 'nowrap'}}>
                  <span style={{color: m.pct > 0 ? 'rgb(236,120,92)' : 'rgb(120,197,224)'}}>{signedPct(m.pct)}</span>
                  <span style={{fontSize: 18, color: C.muted, fontWeight: 400, marginLeft: 12}}>
                    {m.from} → {m.to}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </>
      )}

      {/* B: level index */}
      <Heading o={partB} kicker="03 · 一年巨变 · 四年层级" title={`四年里，市（地）级名额少了 ${Math.round(-levelChange('市（地）级') * 100)}%`} sub="以 2024 年为 100 的指数" />
      {partB > 0 && (
        <>
          {[2024, 2025, 2026, 2027].map((y, i) => (
            <div key={y} style={{position: 'absolute', left: lx(i) - 40, width: 80, top: lp.y + lp.h + 20, textAlign: 'center', fontSize: 22, color: C.muted, opacity: partB}}>
              {y}
            </div>
          ))}
          {LEVELS.map((name, li) => {
            const o = fade(drawB, 0.85, 1) * partB;
            const c = levelChange(name);
            return (
              <div key={name} style={{position: 'absolute', left: lp.x + lp.w + 30, top: ly(idx(name, 3)) - 22 + (name === '中央' ? -26 : name === '省（副省）级' ? 18 : 0), opacity: o, whiteSpace: 'nowrap'}}>
                <span style={{fontSize: li === 1 ? 26 : 21, fontWeight: li === 1 ? 700 : 400, color: `rgb(${LEVEL_RGB[li].join(',')})`}}>{name}</span>
                <span style={{fontSize: 19, color: C.muted, marginLeft: 12}}>
                  {fmt(lv[0][name])} → {fmt(lv[3][name])}（{signedPct(c)}）
                </span>
              </div>
            );
          })}
        </>
      )}

      {/* C: province tiles */}
      <Heading o={partC} kicker="03 · 一年巨变 · 地区" title="31 个地区，有涨有跌" sub="2026 → 2027 计划名额变化（省份为第三方注记）" />
      {partC > 0 && (
        <>
          {ch.provinces.map(p => {
            const pos = TILES[p.name];
            if (!pos) return null;
            const order = pos[0] + pos[1];
            const a = fade(frame, T.map[0] + 22 + order * 5, T.map[0] + 38 + order * 5) * partC;
            return (
              <div key={p.name} style={{position: 'absolute', left: mapX + pos[0] * step, top: mapY + pos[1] * step + 14, width: tile, textAlign: 'center', opacity: a, lineHeight: 1.3}}>
                <div style={{fontSize: 20, fontWeight: 700}}>{p.name}</div>
                <div style={{fontSize: 15}}>{signedPct(p.pct)}</div>
              </div>
            );
          })}
          <div style={{position: 'absolute', left: 125, top: 300, ...rise(fade(frame, T.map[0] + 120, T.map[0] + 140))}}>
            {callouts.map(p => (
              <div key={p.name} style={{display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 18}}>
                <span style={{fontSize: 30, fontWeight: 700, width: 80}}>{p.name}</span>
                <span style={{fontSize: 40, fontWeight: 700, color: p.pct > 0 ? 'rgb(236,120,92)' : 'rgb(120,197,224)', width: 170}}>{signedPct(p.pct)}</span>
                <span style={{fontSize: 20, color: C.muted}}>
                  {fmt(p.from)} → {fmt(p.to)}
                </span>
              </div>
            ))}
            <div style={{fontSize: 22, color: C.muted, marginTop: 30, lineHeight: 1.6, ...rise(fade(frame, T.map[0] + 190, T.map[0] + 210))}}>
              招录部门名单也在流动：
              <br />
              <span style={{color: C.ink, fontWeight: 700}}>{ch.deptNamesNew}</span> 个部门名称今年新出现，
              <span style={{color: C.ink, fontWeight: 700}}>{ch.deptNamesGone}</span> 个去年的名称今年没有
            </div>
          </div>
        </>
      )}
    </Stage>
  );
};
