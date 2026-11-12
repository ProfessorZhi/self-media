import React from 'react';
import {backOut, easeInOut, easeOut, prog} from '../lib/anim';
import {useScene} from '../lib/timeline';
import {dFromTheta} from '../lib/geometry';
import {Figure} from '../components/Figure';
import {Hud, Stage} from '../components/Hud';
import {Tex} from '../components/Tex';
import {T} from '../theme';

// Wrap-up: six tiles → the four circle methods light gold, the two projection methods red →
// they merge into one figure: the projection extremum. Then the convexity caveat and the answer.

const TILES = [
  {n: '一', name: '面积', kind: 'proj', fig: {dist: 1, hLabel: 1, tri: 1}},
  {n: '二', name: '直径圆', kind: 'circle', fig: {circle: 1, bcGold: 1, center: 1}},
  {n: '三', name: '外接圆', kind: 'circle', fig: {circle: 1, mid: 1, center: 1}},
  {n: '四', name: '三角函数', kind: 'proj', fig: {theta: 1, axis: 1, drop: 1, proj: 1}},
  {n: '五', name: '坐标', kind: 'circle', fig: {circle: 1, grid: 1, tangent: 1}},
  {n: '六', name: '向量配方', kind: 'circle', fig: {circle: 1, center: 1, vecZ: 1}},
];
const TW = 520;
const TH = 300;
const tilePos = (i: number) => ({x: 150 + (i % 3) * (TW + 40), y: 170 + Math.floor(i / 3) * (TH + 40)});

export const Wrap: React.FC = () => {
  const {t, dur, B, w} = useScene('c7');
  const fade = prog(t, 0, 0.5);
  const tiles = B('tiles');
  const circles = w('circles', easeOut);
  const projs = w('projs', easeOut);
  const merge = w('merge');
  const essence = w('essence', easeOut);
  const caveat = w('caveat', easeOut);
  const ghost = w('ghost');
  const sides = w('sides');
  const answer = w('answer', backOut);
  const showBig = merge > 0;

  return (
    <Stage fade={fade}>
      {/* six tiles */}
      {merge < 1
        ? TILES.map((tile, i) => {
            const p = tilePos(i);
            const s = prog(t, tiles.t0 + i * 0.15, tiles.t0 + i * 0.15 + 0.45, backOut);
            const hl = tile.kind === 'circle' ? circles : projs;
            const col = tile.kind === 'circle' ? T.gold : T.red;
            const cx = 960 - TW / 2;
            const cy = 540 - TH / 2;
            const mx = p.x + (cx - p.x) * merge;
            const my = p.y + (cy - p.y) * merge;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: mx,
                  top: my,
                  width: TW,
                  height: TH,
                  borderRadius: 10,
                  border: `2px solid ${hl > 0 ? col : T.faint}`,
                  boxShadow: hl > 0 ? `0 0 ${30 * hl}px ${col}44` : undefined,
                  opacity: s * (1 - merge),
                  transform: `scale(${0.85 + 0.15 * s})`,
                  overflow: 'hidden',
                  background: 'rgba(10,13,20,0.6)',
                }}
              >
                <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: 'translate(-20px, 22px) scale(0.3)', transformOrigin: '0 0'}}>
                  <Figure deg={i === 3 ? 200 : 180} base={1} ab={1} ac={1} d={1} ad={1} cd={1} right={1} {...tile.fig} glowD={hl} />
                </div>
                <div style={{position: 'absolute', left: 22, top: 16, color: hl > 0 ? col : T.muted, fontSize: 30, fontWeight: 700}}>解法{tile.n}</div>
                <div style={{position: 'absolute', left: 22, top: 58, color: T.ink, fontSize: 26}}>{tile.name}</div>
              </div>
            );
          })
        : null}

      {/* merged figure: the projection extremum */}
      {showBig ? (
        <div style={{position: 'absolute', inset: 0, opacity: prog(t, B('merge').t0 + 0.6, B('merge').t1)}}>
          <Figure
            D={dFromTheta(30)}
            base={1}
            ab={1}
            ac={1}
            right={1}
            d={1}
            ad={1}
            cd={1}
            ang120={1}
            abLen={1}
            circle={1}
            circleDim={0.4 + 0.4 * caveat}
            center={1 - caveat}
            axis={1}
            drop={1}
            proj={1}
            xLabel={1}
            dist={1}
            acPulse={sides}
            sideTint={sides}
            ghostD={ghost}
            glowD={answer}
          />
          <div style={{position: 'absolute', left: 120, top: 170, opacity: essence * (1 - caveat), transform: `translateY(${(1 - essence) * 20}px)`}}>
            <div style={{fontSize: 30, color: T.muted, letterSpacing: 4}}>六种写法</div>
            <div style={{fontSize: 76, fontWeight: 700, color: T.ink, marginTop: 10}}>一个投影极值</div>
            <div style={{marginTop: 24, color: T.red}}>
              <Tex tex="\overrightarrow{AD}\cdot\overrightarrow{AB}=|AB|\cdot x_D" size={46} />
            </div>
          </div>
          {caveat > 0 ? (
            <div style={{position: 'absolute', left: 120, top: 170, opacity: caveat * (1 - answer * 0.6)}}>
              <div style={{display: 'inline-block', border: `1.5px solid ${T.gold}`, color: T.gold, borderRadius: 30, padding: '8px 22px', fontSize: 28}}>题目没写凸四边形</div>
              <div style={{marginTop: 26, fontSize: 40, color: T.ink, opacity: ghost}}>D、B 同侧：点积 ≥ 0</div>
              <div style={{marginTop: 18, fontSize: 40, color: T.gold, opacity: sides}}>先说明 D、B 异侧 · 再用共圆</div>
            </div>
          ) : null}
          {ghost > 0 ? (
            <div style={{position: 'absolute', left: 1235, top: 470, color: T.muted, opacity: ghost * (1 - answer)}}>
              <Tex tex="D'" size={40} />
            </div>
          ) : null}
        </div>
      ) : null}
      {answer > 0 ? (
        <div style={{position: 'absolute', left: 120, top: 560, color: T.ink, transform: `scale(${answer})`, transformOrigin: 'left center', opacity: Math.min(1, answer)}}>
          <div style={{display: 'inline-flex', alignItems: 'center', gap: 30, border: `3px solid ${T.gold}`, borderRadius: 10, padding: '18px 36px', boxShadow: `0 0 40px ${T.gold}44`}}>
            <Tex tex={`\\min=\\textcolor{${T.gold}}{-2}`} size={84} />
            <span style={{fontSize: 56, fontWeight: 700, color: T.gold}}>选 D</span>
          </div>
          <div style={{marginTop: 26, fontSize: 32, color: T.muted, opacity: w('outro', easeInOut)}}>从向量里读出几何极值</div>
        </div>
      ) : null}
      <Hud label="07 · 一个本质" />
    </Stage>
  );
};
