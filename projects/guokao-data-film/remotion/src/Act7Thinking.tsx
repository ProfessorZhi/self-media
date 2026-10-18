import React from 'react';
import {clamp01, easeInOutCubic} from './seatModel.js';
import {TILES} from './Act3Change';
import {Heading, Stage, fade, lerp, rise, useActFrame, useCanvas} from './common';
import {C} from './theme';
import {useFilmData} from './useFilmData';

// Act VII "冷思考": why the exam stays hot (graduates, youth unemployment, intentions),
// where the money comes from (fiscal self-sufficiency by province), then three thoughts.
// Data here is secondary research — every panel says so; thoughts are marked as opinion.
export const T = {
  why: [0, 340],
  money: [340, 700],
  think: [700, 1050],
  end: 1050,
} as const;

const AMBER = '#d9a55b';
const SAGE = [120, 186, 160];
const CORAL = [236, 120, 92];

const Card: React.FC<{x: number; y: number; w: number; o: number; title: string; source: string; children: React.ReactNode}> = ({x, y, w, o, title, source, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, ...rise(o)}}>
    <div style={{fontSize: 22, color: C.muted, letterSpacing: 2}}>{title}</div>
    <div style={{marginTop: 18}}>{children}</div>
    <div style={{fontSize: 14, color: C.faint, marginTop: 18, lineHeight: 1.5}}>{source}</div>
  </div>
);

const Thought: React.FC<{o: number; n: number; title: string; children: React.ReactNode}> = ({o, n, title, children}) => (
  <div style={{display: 'flex', gap: 22, marginBottom: 34, ...rise(o)}}>
    <div style={{width: 4, background: AMBER, borderRadius: 2, flexShrink: 0}} />
    <div>
      <div style={{fontSize: 18, color: AMBER, letterSpacing: 4}}>思考 {n}</div>
      <div style={{fontSize: 34, fontWeight: 700, marginTop: 6}}>{title}</div>
      <div style={{fontSize: 21, color: '#c3c8d0', marginTop: 10, lineHeight: 1.6, maxWidth: 1400}}>{children}</div>
    </div>
  </div>
);

export const Act7Thinking: React.FC = () => {
  const frame = useActFrame();
  const model = useFilmData();
  const ctxData = model?.data.context;

  // fiscal tile map geometry (schematic grid shared with Act III)
  const tile = 84;
  const step = 94;
  const mapX = 860;
  const mapY = 238;
  const partB = fade(frame, T.money[0], T.money[0] + 20, T.money[1] - 24, T.money[1]);

  const canvas = useCanvas(
    ctxData
      ? ctx => {
          if (partB <= 0) return;
          const vals: Record<string, number> = ctxData.fiscal_self_sufficiency_2025.values;
          Object.entries(vals).forEach(([name, v]) => {
            const pos = TILES[name];
            if (!pos) return;
            const order = pos[0] + pos[1];
            const a = fade(frame, T.money[0] + 20 + order * 5, T.money[0] + 36 + order * 5) * partB;
            const t = clamp01((v - 8) / (86 - 8));
            const rgb = CORAL.map((c, k) => lerp(c, SAGE[k], t));
            ctx.fillStyle = `rgba(${rgb.join(',')},${(0.25 + 0.6 * (0.35 + 0.65 * t)) * a})`;
            ctx.fillRect(mapX + pos[0] * step, mapY + pos[1] * step, tile, tile);
          });
        }
      : null,
  );

  if (!model || !ctxData) return <Stage act={5} source="" />;
  const g = ctxData.graduates;
  const yu = ctxData.youth_unemployment_2026;
  const it = ctxData.graduate_intentions_2026;
  const fs = ctxData.fiscal_self_sufficiency_2025;
  const vals: Record<string, number> = fs.values;
  const partA = fade(frame, 0, 18, T.why[1] - 24, T.why[1]);
  const partC = fade(frame, T.think[0], T.think[0] + 20);
  const cardA = [fade(frame, 30, 60), fade(frame, 110, 140), fade(frame, 190, 220)];
  const maxG = Math.max(...g.series.map((s: {value: number}) => s.value));
  const lineT = easeInOutCubic(clamp01((frame - 120) / 70));
  const yuMax = 18;
  const yuMin = 13;
  const yuPts = yu.series.map((s: {value: number}, i: number) => [i * 120, 150 - ((s.value - yuMin) / (yuMax - yuMin)) * 150]);

  return (
    <Stage act={5} canvas={canvas} source={partC > 0.5 ? '以下为作者基于本片数据与公开资料的个人思考，不构成预测或建议' : '本幕为公开报道与第三方汇总的二手资料，来源与口径见画面及 data/context_2026_research.json'}>
      {/* A — why it stays hot */}
      <Heading o={partA} kicker="06 · 冷思考" title="为什么考公一年比一年热？" />
      {partA > 0 && (
        <>
          <Card x={125} y={290} w={480} o={cardA[0] * partA} title="高校毕业生规模（预计）" source="教育部、人社部公布的预计规模">
            <div style={{display: 'flex', alignItems: 'flex-end', gap: 34, height: 330, marginTop: 10}}>
              {g.series.map((s: {cohort: number; value: number}, i: number) => {
                const h = (s.value / maxG) * 210 * easeInOutCubic(clamp01((frame - 40 - i * 12) / 40));
                return (
                  <div key={s.cohort} style={{textAlign: 'center', width: 110}}>
                    <div style={{fontSize: 30, fontWeight: 700, color: i === 2 ? C.coralCss : C.ink}}>{s.value}</div>
                    <div style={{fontSize: 15, color: C.muted}}>万人</div>
                    <div style={{height: h, background: i === 2 ? C.coralCss : 'rgba(176,184,196,0.55)', marginTop: 8, borderRadius: 3}} />
                    <div style={{fontSize: 18, color: C.muted, marginTop: 8}}>{s.cohort} 届</div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card x={700} y={290} w={480} o={cardA[1] * partA} title="16–24 岁青年失业率（不含在校生）" source="国家统计局 2026 年月度数据">
            <div style={{position: 'relative', height: 300}}>
              <svg width={480} height={240} style={{position: 'absolute', top: 40, left: 10, overflow: 'visible'}}>
                <polyline
                  points={yuPts.map(([x, y]: number[]) => `${x},${y}`).join(' ')}
                  fill="none"
                  stroke={C.coralCss}
                  strokeWidth={4}
                  strokeDasharray={1000}
                  strokeDashoffset={1000 * (1 - lineT)}
                />
                {yuPts.map(([x, y]: number[], i: number) => (
                  <g key={i} opacity={clamp01(lineT * 4 - i)}>
                    <circle cx={x} cy={y} r={6} fill={C.coralCss} />
                    <text x={x} y={y - 18} fill={C.ink} fontSize={24} fontWeight={700} textAnchor="middle">
                      {yu.series[i].value}%
                    </text>
                    <text x={x} y={200} fill={C.muted} fontSize={16} textAnchor="middle">
                      {yu.series[i].month.slice(5)} 月
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </Card>
          <Card x={1275} y={290} w={520} o={cardA[2] * partA} title="2026 届毕业生求职意向" source="前程无忧调研（第一财经报道）；意向，不是实际去向">
            <div style={{fontSize: 20, color: C.muted}}>国企 + 机关事业单位</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 8}}>
              <div style={{height: 28, width: 4.6 * it.soe_plus_government_institution_pct * clamp01((frame - 200) / 40), background: C.coralCss, borderRadius: 3}} />
              <span style={{fontSize: 34, fontWeight: 700}}>{it.soe_plus_government_institution_pct}%</span>
            </div>
            <div style={{fontSize: 20, color: C.muted, marginTop: 22}}>民营企业</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 8}}>
              <div style={{height: 28, width: 4.6 * it.private_enterprise_pct * clamp01((frame - 210) / 40), background: 'rgba(176,184,196,0.6)', borderRadius: 3}} />
              <span style={{fontSize: 34, fontWeight: 700}}>{it.private_enterprise_pct}%</span>
            </div>
            <div style={{fontSize: 22, marginTop: 30, lineHeight: 1.5}}>
              每 4 个毕业生里，约 1 个打算考公、考编或考教师（<b style={{color: C.coralCss}}>{it.plan_civil_service_or_public_institution_or_teacher_pct}%</b>）
            </div>
          </Card>
        </>
      )}

      {/* B — where the money comes from */}
      <Heading o={partB} kicker="06 · 冷思考 · 钱从哪里来" title="同样是公务员，背后的财力天差地别" sub="2025 年各省财政自给率 = 一般公共预算收入 ÷ 支出" />
      {partB > 0 && (
        <>
          {Object.entries(vals).map(([name, v]) => {
            const pos = TILES[name];
            if (!pos) return null;
            const order = pos[0] + pos[1];
            const a = fade(frame, T.money[0] + 28 + order * 5, T.money[0] + 44 + order * 5) * partB;
            return (
              <div key={name} style={{position: 'absolute', left: mapX + pos[0] * step, top: mapY + pos[1] * step + 14, width: tile, textAlign: 'center', opacity: a, lineHeight: 1.3, textShadow: '0 1px 4px rgba(13,16,21,0.8)'}}>
                <div style={{fontSize: 20, fontWeight: 700}}>{name}</div>
                <div style={{fontSize: 16}}>{v}%</div>
              </div>
            );
          })}
          <div style={{position: 'absolute', left: 125, top: 300, width: 640, ...rise(fade(frame, T.money[0] + 110, T.money[0] + 135) * partB)}}>
            {[
              ['上海', vals['上海']],
              ['河南', vals['河南']],
              ['西藏', vals['西藏']],
            ].map(([n, v]) => (
              <div key={n as string} style={{display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 14}}>
                <span style={{fontSize: 30, fontWeight: 700, width: 80}}>{n}</span>
                <span style={{fontSize: 46, fontWeight: 700, color: (v as number) > 60 ? `rgb(${SAGE.join(',')})` : C.coralCss}}>{v}%</span>
              </div>
            ))}
            <div style={{fontSize: 21, color: '#c3c8d0', lineHeight: 1.65, marginTop: 22, ...rise(fade(frame, T.money[0] + 170, T.money[0] + 195))}}>
              缺口靠中央转移支付补齐：2026 年预算约 <b style={{color: C.ink}}>{ctxData.transfer_payments_2026.value_trillion_yuan} 万亿元</b>，连续 4 年超过 10 万亿。
              <br />
              国考岗位多在中央垂直管理系统，经费主要来自中央财政；地方岗位的津贴补贴和绩效，更依赖本地财力。
            </div>
          </div>
          <div style={{position: 'absolute', left: 125, top: 960, fontSize: 15, color: C.faint, opacity: partB}}>{fs.publisher} · {fs.caveat}</div>
        </>
      )}

      {/* C — thoughts */}
      <div style={{position: 'absolute', left: 125, top: 96, opacity: partC}}>
        <div style={{fontSize: 22, color: AMBER, letterSpacing: 4, ...rise(fade(frame, T.think[0], T.think[0] + 20))}}>06 · 冷思考 · 我的几点看法</div>
        <div style={{marginTop: 40}}>
          <Thought o={fade(frame, T.think[0] + 20, T.think[0] + 50)} n={1} title="名额在收缩，报名在扩张">
            毕业生规模连年创新高，青年就业仍有压力，多数毕业生的意向集中在国企和机关事业单位。只要这几件事不变，「挤」就很难缓解。
          </Thought>
          <Thought o={fade(frame, T.think[0] + 110, T.think[0] + 140)} n={2} title="稳定，本质上是财政的稳定">
            同一个身份，不同地方、不同层级，待遇取决于背后的钱袋子。网上流传的「某地降薪」，我们没有查到官方文件，不下结论；但各地财力的分化，是写在预算里的事实。
          </Thought>
          <Thought o={fade(frame, T.think[0] + 200, T.think[0] + 230)} n={3} title="「铁饭碗」的含义正在改变">
            2014 年起机关事业单位养老保险已与企业并轨：个人缴费 8%，另设职业年金。它更像一份稳定的工作，而不是一份特权。值得考，但不必是唯一的路。
          </Thought>
        </div>
      </div>
    </Stage>
  );
};
