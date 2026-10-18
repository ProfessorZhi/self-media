import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {clamp01, easeInOutCubic, hash01, seatProgress} from './seatModel.js';
import {buildStructure, CENTER, shortName} from './structureLayouts.js';
import {ChapterRail} from './ChapterRail';
import {C, FAMILY_RGB, FONT, H, W, famCss, fmt} from './theme';
import {useFilmData, type Model} from './useFilmData';

// Act II "谁在招": field -> sunburst (机构层级, coloured by system) -> system treemap
// -> camera tour of four systems -> Pareto curve of all 589 departments.
const TOUR = ['海关', '金融监管', '边检', '中央及其他'];
const STOP0 = 366;
const STOP_LEN = 100; // fly 40 + hold 60
export const T = {
  spiral: [18, 112],
  unroll: [196, 286],
  tourStart: STOP0,
  tourEnd: STOP0 + TOUR.length * STOP_LEN + 40,
  pareto: [STOP0 + TOUR.length * STOP_LEN + 50, STOP0 + TOUR.length * STOP_LEN + 140],
  end: STOP0 + TOUR.length * STOP_LEN + 250,
} as const;

type Structure = ReturnType<typeof buildStructure>;
type Rect = {x: number; y: number; w: number; h: number};
type Cam = {S: number; fx: number; fy: number};
const BASE: [number, number] = [960, 600];
const OVERVIEW: Cam = {S: 1, fx: BASE[0], fy: BASE[1]};
const camFor = (r: Rect): Cam => ({S: Math.min(1500 / r.w, 600 / r.h, 6), fx: r.x + r.w / 2, fy: r.y + r.h / 2 - 10});

function camKeys(st: Structure, famIndex: (n: string) => number) {
  const keys: {f: number; cam: Cam}[] = [{f: STOP0, cam: OVERVIEW}];
  TOUR.forEach((name, k) => {
    const cam = camFor(st.famRects[famIndex(name)]);
    keys.push({f: STOP0 + k * STOP_LEN + 40, cam}, {f: STOP0 + (k + 1) * STOP_LEN, cam});
  });
  keys.push({f: T.tourEnd, cam: OVERVIEW});
  return keys;
}
function camAt(frame: number, keys: {f: number; cam: Cam}[]): Cam {
  if (frame <= keys[0].f) return keys[0].cam;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame <= b.f) {
      const t = easeInOutCubic((frame - a.f) / (b.f - a.f));
      const both = a.cam.S > 1.01 && b.cam.S > 1.01;
      const logS = Math.log(a.cam.S) + (Math.log(b.cam.S) - Math.log(a.cam.S)) * t - (both ? 0.75 * Math.sin(Math.PI * t) : 0);
      return {S: Math.exp(logS), fx: a.cam.fx + (b.cam.fx - a.cam.fx) * t, fy: a.cam.fy + (b.cam.fy - a.cam.fy) * t};
    }
  }
  return keys[keys.length - 1].cam;
}
const project = (cam: Cam, x: number, y: number): [number, number] => [BASE[0] + (x - cam.fx) * cam.S, BASE[1] + (y - cam.fy) * cam.S];
const rotation = (frame: number) => 0.0009 * Math.min(frame, T.unroll[1]);

/** Weight (0..1) of the current tour focus, and which system it is. */
function focusAt(frame: number, famIndex: (n: string) => number) {
  for (let k = 0; k < TOUR.length; k++) {
    const arrive = STOP0 + k * STOP_LEN + 40;
    const leave = STOP0 + (k + 1) * STOP_LEN;
    const w = interpolate(frame, [arrive - 24, arrive - 4, leave, leave + 20], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    if (w > 0) return {fam: famIndex(TOUR[k]), w, k};
  }
  return {fam: -1, w: 0, k: -1};
}

const q = (v: number) => Math.round(v / 6) * 6;

function paint(ctx: CanvasRenderingContext2D, m: Model, st: Structure, frame: number, cam: Cam, focus: {fam: number; w: number}) {
  const {seats, layouts} = m;
  const field = layouts.field;
  const {polar, treemap, pareto, pitch, family} = st;
  const rot = rotation(frame);
  const buckets = new Map<string, number[]>();
  const [cx, cy] = CENTER;
  const famT = clamp01((frame - T.spiral[0] - 20) / 60);

  for (let i = 0; i < seats.count; i++) {
    const fi = family[i];
    const j = hash01(i, 7);
    const theta = polar[i * 2] + rot;
    const sx = cx + polar[i * 2 + 1] * Math.sin(theta);
    const sy = cy - polar[i * 2 + 1] * Math.cos(theta);

    const d = Math.hypot(field[i * 2] - cx, field[i * 2 + 1] - cy) / 900;
    const g1 = seatProgress(frame, T.spiral[0], T.spiral[1], clamp01(1 - d), j, 0.5);
    let x = field[i * 2] + (sx - field[i * 2]) * g1;
    let y = field[i * 2 + 1] + (sy - field[i * 2 + 1]) * g1;
    const sw = Math.sin(Math.PI * g1) * 0.7;
    const dx = x - cx;
    const dy = y - cy;
    x = cx + dx * Math.cos(sw) - dy * Math.sin(sw);
    y = cy + dx * Math.sin(sw) + dy * Math.cos(sw);

    const key = (polar[i * 2] % (Math.PI * 2)) / (Math.PI * 2);
    const g2 = seatProgress(frame, T.unroll[0], T.unroll[1], key, j, 0.6);
    x += (treemap[i * 2] - x) * g2;
    y += (treemap[i * 2 + 1] - y) * g2 - Math.sin(Math.PI * g2) * 30 * (j - 0.3);

    const g3 = seatProgress(frame, T.pareto[0], T.pareto[1], clamp01((pareto[i * 2] - 200) / 1540), j, 0.55);
    x += (pareto[i * 2] - x) * g3;
    y += (pareto[i * 2 + 1] - y) * g3;

    const [px, py] = project(cam, x, y);
    let size = 3.5 + (2.3 - 3.5) * g1 + (pitch * 0.72 - 2.3) * g2 + (2.8 - pitch * 0.72) * g3;
    size *= Math.pow(cam.S, 0.92);
    if (px < -40 || px > W + 40 || py < -40 || py > H + 40) continue;

    const base = C.seat;
    const fam = FAMILY_RGB[fi];
    const rgb = [0, 1, 2].map(c => base[c] + (fam[c] - base[c]) * famT);
    const alpha = focus.fam >= 0 && fi !== focus.fam ? 1 - 0.8 * focus.w : 1;
    const k = `${q(rgb[0])},${q(rgb[1])},${q(rgb[2])},${(Math.round(alpha * 20) / 20).toFixed(2)}`;
    let list = buckets.get(k);
    if (!list) buckets.set(k, (list = []));
    list.push(px - size / 2, py - size / 2, size);
  }

  ctx.clearRect(0, 0, W, H);
  const ringA = clamp01((frame - T.spiral[1] + 30) / 20) * (1 - clamp01((frame - T.unroll[0]) / 18));
  if (ringA > 0) {
    st.levelArcs.forEach((a: {a0: number; a1: number}, li: number) => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(236,232,225,${ringA * (0.25 + li * 0.17)})`;
      ctx.lineWidth = 12;
      ctx.arc(cx, cy, 168, a.a0 + rot - Math.PI / 2 + 0.004, a.a1 + rot - Math.PI / 2 - 0.004);
      ctx.stroke();
    });
  }
  const areaA = clamp01((frame - T.pareto[1] + 30) / 30);
  if (areaA > 0) {
    const grad = ctx.createLinearGradient(0, st.plot.y, 0, st.plot.y + st.plot.h);
    grad.addColorStop(0, `rgba(236,232,225,${0.09 * areaA})`);
    grad.addColorStop(1, 'rgba(236,232,225,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    st.curve.forEach(([x, y]: number[], i: number) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineTo(st.plot.x + st.plot.w, st.plot.y + st.plot.h);
    ctx.closePath();
    ctx.fill();
  }
  for (const [key, list] of buckets) {
    const [r, g, b, a] = key.split(',');
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    for (let k = 0; k < list.length; k += 3) ctx.fillRect(list[k], list[k + 1], list[k + 2], list[k + 2]);
  }

  // treemap separators (department thin, system thick), faded out for the Pareto
  const lineA = clamp01((frame - T.unroll[1] + 20) / 24) * (1 - clamp01((frame - T.pareto[0]) / 14));
  if (lineA > 0) {
    ctx.strokeStyle = `rgba(13,16,21,${lineA * 0.9})`;
    for (const r of st.rects) {
      if (r.w * r.h < 300) continue;
      const [x0, y0] = project(cam, r.x, r.y);
      ctx.lineWidth = Math.max(1, cam.S * 0.9);
      ctx.strokeRect(x0, y0, r.w * cam.S, r.h * cam.S);
    }
    ctx.lineWidth = 4 * Math.max(1, cam.S * 0.6);
    for (const r of st.famRects) {
      const [x0, y0] = project(cam, r.x, r.y);
      ctx.strokeRect(x0, y0, r.w * cam.S, r.h * cam.S);
    }
  }
}

const fade = (frame: number, a: number, b: number, c?: number, d?: number) =>
  c === undefined
    ? interpolate(frame, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : interpolate(frame, [a, b, c, d!], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
const rise = (o: number) => ({opacity: o, transform: `translateY(${(1 - o) * 14}px)`});
const offscreen: {c?: HTMLCanvasElement} = {};
const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(1)}%`;

export const Act2WhoHires: React.FC = () => {
  const frame = useCurrentFrame();
  const model = useFilmData();
  const canvas = useRef<HTMLCanvasElement>(null);
  const st = useMemo(() => (model ? buildStructure(model.data, model.seats) : null), [model]);
  const famIndex = (n: string) => model!.data.families.findIndex(f => f.name === n);
  const keys = useMemo(() => (st && model ? camKeys(st, famIndex) : null), [st, model]);
  const cam = keys ? camAt(frame, keys) : OVERVIEW;
  const focus = model ? focusAt(frame, famIndex) : {fam: -1, w: 0, k: -1};

  useLayoutEffect(() => {
    if (!model || !st || !canvas.current) return;
    const off = (offscreen.c ??= document.createElement('canvas'));
    off.width = W;
    off.height = H;
    paint(off.getContext('2d')!, model, st, frame, cam, focus);
    const ctx = canvas.current.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0);
  });

  if (!model || !st) return <AbsoluteFill style={{background: C.bg}} />;
  const {facts: f, families} = model.data;
  const total = f.seats.value;
  const rot = rotation(frame);
  const [cx, cy] = CENTER;

  const intro = fade(frame, 0, 14, T.spiral[0] + 34, T.spiral[0] + 54);
  const sun = fade(frame, T.spiral[1] - 16, T.spiral[1] + 6, T.unroll[0] - 4, T.unroll[0] + 12);
  const tree = fade(frame, T.unroll[1] - 6, T.unroll[1] + 14, T.tourStart - 12, T.tourStart + 2);
  const treeBack = fade(frame, T.tourEnd - 16, T.tourEnd, T.pareto[0], T.pareto[0] + 12);
  const par = fade(frame, T.pareto[1] - 20, T.pareto[1] + 6);
  const famOrder = families.map((fam, fi) => ({...fam, fi})).sort((a, b) => b.seats - a.seats);

  return (
    <AbsoluteFill style={{background: C.bg, fontFamily: FONT, color: C.ink, fontVariantNumeric: 'tabular-nums'}}>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 55%, rgba(40,48,60,0.35), rgba(0,0,0,0) 60%)'}} />
      <canvas ref={canvas} width={W} height={H} style={{position: 'absolute', inset: 0}} />

      <div style={{position: 'absolute', left: 125, top: 100, ...rise(intro)}}>
        <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>02 · 谁在招</div>
        <div style={{fontSize: 46, fontWeight: 700, marginTop: 8}}>这 {fmt(total)} 个名额，分在哪里？</div>
      </div>

      {/* sunburst: centre, level labels, system legend */}
      <div style={{position: 'absolute', left: cx - 160, top: cy - 64, width: 320, textAlign: 'center', opacity: sun}}>
        <div style={{fontSize: 64, fontWeight: 700, lineHeight: 1}}>{fmt(total)}</div>
        <div style={{fontSize: 20, color: C.muted, marginTop: 10}}>按机构层级 · 按系统着色</div>
      </div>
      {st.levelArcs.map((a: {name: string; seats: number; a0: number; a1: number}, li: number) => {
        const mid = (a.a0 + a.a1) / 2 + rot;
        const x = cx + 470 * Math.sin(mid);
        const y = cy - 470 * Math.cos(mid);
        const right = Math.sin(mid) >= 0;
        const small = a.seats / total < 0.04;
        return (
          <div key={a.name} style={{position: 'absolute', left: right ? x : undefined, right: right ? undefined : W - x, top: y - 26 + (small ? (li === 0 ? -34 : 6) : 0), textAlign: right ? 'left' : 'right', opacity: sun}}>
            <div style={{fontSize: small ? 26 : 40, fontWeight: 700}}>{pct(a.seats, total)}</div>
            <div style={{fontSize: 18, color: C.muted}}>
              {a.name} · {fmt(a.seats)}
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 125, top: 250, opacity: sun, fontSize: 18, lineHeight: '30px'}}>
        {famOrder.map(fam => (
          <div key={fam.name} style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <span style={{width: 12, height: 12, borderRadius: 2, background: famCss(fam.fi)}} />
            <span style={{width: 92}}>{fam.name}</span>
            <span style={{color: C.muted}}>{pct(fam.seats, total)}</span>
          </div>
        ))}
      </div>

      {/* treemap overview */}
      <div style={{position: 'absolute', left: 125, top: 72, ...rise(Math.max(tree, treeBack))}}>
        <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>02 · 谁在招</div>
        <div style={{fontSize: 40, fontWeight: 700, marginTop: 8}}>
          {f.departments.value} 个招录部门 · {families.length} 个系统 · 面积 = 名额
        </div>
      </div>
      {families.map((fam, fi) => {
        const r = st.famRects[fi];
        const [x, y] = project(cam, r.x, r.y);
        const w = r.w * cam.S;
        const h = r.h * cam.S;
        const big = w > 220 && h > 120;
        if (w < 60 || h < 40) return null;
        return (
          <div key={fam.name} style={{position: 'absolute', left: x + 10, top: y + 8, width: w - 20, opacity: Math.max(tree, treeBack), textShadow: '0 1px 8px rgba(13,16,21,1)', overflow: 'hidden', whiteSpace: 'nowrap'}}>
            <div style={{fontSize: big ? 30 : 15, fontWeight: 700}}>{fam.name}</div>
            <div style={{fontSize: big ? 20 : 13}}>
              {fmt(fam.seats)} · {pct(fam.seats, total)}
            </div>
          </div>
        );
      })}

      {/* tour stops */}
      {TOUR.map((name, k) => {
        const fi = famIndex(name);
        const fam = families[fi];
        const o = focus.k === k ? focus.w : 0;
        if (o <= 0) return null;
        const note =
          name === '边检' && f.borderOfficial.matches
            ? `与国家移民管理局公告一致：${fam.departments} 个单位 · ${fmt(f.borderOfficial.value)} 人 ✓`
            : name === '中央及其他'
              ? `平均每个部门 ${(fam.seats / fam.departments).toFixed(1)} 个名额 · 最多：${fam.top!.name} ${fam.top!.seats}`
              : `最多：${shortName(fam.top!.name)} ${fmt(fam.top!.seats)} 个`;
        return (
          <div key={name} style={{position: 'absolute', left: 125, top: 64, ...rise(o)}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
              <span style={{width: 16, height: 16, borderRadius: 3, background: famCss(fi)}} />
              <span style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>
                02 · 谁在招 · {k + 1}/{TOUR.length}
              </span>
            </div>
            <div style={{fontSize: 44, fontWeight: 700, marginTop: 6}}>
              {name}：{fam.departments} 个单位，{fmt(fam.seats)} 个名额
            </div>
            <div style={{fontSize: 22, color: name === '边检' ? famCss(fi) : C.muted, marginTop: 8}}>{note}</div>
          </div>
        );
      })}
      {focus.fam >= 0 &&
        st.rects
          .filter(r => r.fam === focus.fam)
          .map(r => {
            const [x, y] = project(cam, r.x, r.y);
            const w = r.w * cam.S;
            const h = r.h * cam.S;
            if (w < 86 || h < 44 || x > W || y > H || x + w < 0 || y + h < 0) return null;
            return (
              <div key={r.d} style={{position: 'absolute', left: x + 8, top: y + 6, width: w - 16, opacity: focus.w, textShadow: '0 1px 8px rgba(13,16,21,1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>
                <div style={{fontSize: w > 200 ? 20 : 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis'}}>{shortName(r.name)}</div>
                <div style={{fontSize: w > 200 ? 17 : 13}}>{fmt(r.value)}</div>
              </div>
            );
          })}

      {/* Pareto */}
      {(() => {
        const p = st.plot;
        const y80 = p.y + p.h * 0.2;
        const x80 = p.x + (f.deptsFor80.value / st.deptTotal) * p.w;
        const tail0 = p.x + ((st.deptTotal - f.deptsUpTo5.value) / st.deptTotal) * p.w;
        const line = 'rgba(236,232,225,0.35)';
        return (
          <div style={{position: 'absolute', inset: 0, opacity: par}}>
            <div style={{position: 'absolute', left: 125, top: 72}}>
              <div style={{fontSize: 22, color: C.muted, letterSpacing: 4}}>02 · 谁在招 · 集中度</div>
              <div style={{fontSize: 40, fontWeight: 700, marginTop: 8}}>589 个部门，八成名额集中在 {f.deptsFor80.value} 个</div>
            </div>
            <div style={{position: 'absolute', left: p.x, top: y80, width: x80 - p.x, borderTop: `1.5px dashed ${line}`}} />
            <div style={{position: 'absolute', left: x80, top: y80, height: p.y + p.h - y80, borderLeft: `1.5px dashed ${line}`}} />
            <div style={{position: 'absolute', left: x80 + 16, top: y80 + 16, fontSize: 24}}>
              <b>前 {f.deptsFor80.value} 个部门</b>
              <span style={{color: C.muted}}> → 80% 的名额</span>
            </div>
            <div style={{position: 'absolute', left: tail0, width: p.x + p.w - tail0, top: p.y - 30, borderTop: `1.5px solid ${line}`, borderLeft: `1.5px solid ${line}`, borderRight: `1.5px solid ${line}`, height: 10}} />
            <div style={{position: 'absolute', right: W - (p.x + p.w), top: p.y - 104, textAlign: 'right', fontSize: 24, lineHeight: 1.45}}>
              <b>{f.deptsUpTo5.value} 个部门</b>全年 ≤ 5 个名额
              <div style={{color: C.muted, fontSize: 20}}>其中 {f.deptsOnly1.value} 个部门只招 1 人</div>
            </div>
            <div style={{position: 'absolute', left: p.x, top: p.y + p.h + 14, width: p.w, borderTop: `1px solid ${line}`, paddingTop: 8, fontSize: 16, color: C.muted, display: 'flex', justifyContent: 'space-between'}}>
              <span>名额最多的部门</span>
              <span>部门按名额从多到少排列 →</span>
              <span>第 {st.deptTotal} 个</span>
            </div>
            {[0, 50, 100].map(v => (
              <div key={v} style={{position: 'absolute', left: p.x - 64, top: p.y + p.h - (v / 100) * p.h - 11, width: 52, textAlign: 'right', fontSize: 16, color: C.muted}}>
                {v}%
              </div>
            ))}
          </div>
        );
      })()}

      <ChapterRail active={1} />
      <div style={{position: 'absolute', right: 40, bottom: 30, fontSize: 15, color: C.faint, textAlign: 'right', lineHeight: 1.6}}>
        数据：2027 国考职位表 {fmt(f.positions.value)} 岗逐岗加总
        <br />
        系统按「部门名称」归类 · 层级取「机构层级」字段
      </div>
    </AbsoluteFill>
  );
};
