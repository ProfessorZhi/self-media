import React from 'react';
import {useCurrentFrame} from 'remotion';
import {hash01} from './seatModel.js';
import {Painter, Stage, fade, rise, useCanvas} from './common';
import {C, H, W, fmt} from './theme';
import {useFilmData} from './useFilmData';

export const PROLOGUE = 390;
export const EPILOGUE = 540;

/** Slow drifting dust, a quiet backdrop for text-only moments. */
function dust(ctx: CanvasRenderingContext2D, frame: number, alpha: number) {
  const p = new Painter();
  for (let i = 0; i < 900; i++) {
    const x = (hash01(i, 61) * W + frame * (0.15 + hash01(i, 62) * 0.35)) % W;
    const y = (hash01(i, 63) * H - frame * (0.05 + hash01(i, 64) * 0.2) + H) % H;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(frame / 50 + i));
    p.add(x, y, 1.6 + hash01(i, 65) * 1.6, C.seat[0], C.seat[1], C.seat[2], alpha * tw * 0.55);
  }
  p.flush(ctx);
}

const Line: React.FC<{o: number; size?: number; color?: string; weight?: number; children: React.ReactNode}> = ({o, size = 44, color = C.ink, weight = 700, children}) => (
  <div style={{fontSize: size, fontWeight: weight, color, marginTop: 22, ...rise(o)}}>{children}</div>
);

export const Prologue: React.FC = () => {
  const frame = useCurrentFrame();
  const model = useFilmData();
  const canvas = useCanvas(ctx => dust(ctx, frame, fade(frame, 0, 60, PROLOGUE - 50, PROLOGUE)));
  if (!model) return <Stage act={-1} source="" />;
  const y26 = model.data.competition.find(c => c.year === 2026)!;
  const out = 1 - fade(frame, PROLOGUE - 40, PROLOGUE - 6);
  const [yy, mm, dd] = (y26.examDate ?? '').split('-').map(Number);
  return (
    <Stage act={-1} canvas={canvas} source="国家公务员局公开数据（新华社报道，按「万」四舍五入）；2027 计划名额为职位表逐岗加总">
      <div style={{position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', opacity: out}}>
        <Line o={fade(frame, 20, 60)} size={26} color={C.muted} weight={400}>
          {yy} 年 {mm} 月 {dd} 日
        </Line>
        <Line o={fade(frame, 70, 110)}>{y26.attendeesText}走进了国考考场。</Line>
        <Line o={fade(frame, 150, 190)}>他们争的，是 {y26.plannedText.replace('人', '')}个计划名额。</Line>
        <Line o={fade(frame, 240, 280)} color={C.coralCss}>
          而这一次，只有 {fmt(model.data.facts.seats.value)} 个。
        </Line>
      </div>
    </Stage>
  );
};

export const Epilogue: React.FC = () => {
  const frame = useCurrentFrame();
  const model = useFilmData();
  const canvas = useCanvas(ctx => dust(ctx, frame, fade(frame, 0, 40, EPILOGUE - 60, EPILOGUE)));
  if (!model) return <Stage act={-1} source="" />;
  const words = 1 - fade(frame, 240, 270);
  const credits = fade(frame, 270, 310, EPILOGUE - 40, EPILOGUE - 6);
  return (
    <Stage act={-1} canvas={canvas} source="">
      <div style={{position: 'absolute', left: 0, right: 0, top: 360, textAlign: 'center', opacity: words}}>
        <Line o={fade(frame, 10, 50)} size={26} color={C.muted} weight={400}>
          致每一个正在备考的人
        </Line>
        <Line o={fade(frame, 70, 110)}>每个座位背后，都排着很长的队。</Line>
        <Line o={fade(frame, 150, 190)}>愿你的每一份准备，都不被辜负。</Line>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', ...rise(credits)}}>
        <div style={{fontSize: 34, fontWeight: 700}}>国考宇宙 · 2027</div>
        <div style={{fontSize: 20, color: C.muted, marginTop: 34, lineHeight: 2}}>
          数据来源
          <br />
          2027 国考职位表 {fmt(model.data.facts.positions.value)} 岗（与官方招考简章工作簿逐格核验）
          <br />
          国家公务员局历年公开数据（新华社、央视报道）· 国家移民管理局公告
          <br />
          2026 年度首批面试名单公开镜像（审计署附件抽核一致）· 2024–2026 年第三方清洗表（已在画面标注）
        </div>
        <div style={{fontSize: 18, color: C.faint, marginTop: 34, lineHeight: 1.8}}>
          画面中的每一个数字都由脚本从原始表格计算，可在项目仓库中复算
          <br />
          Remotion 程序化动画 · 原创合成配乐
        </div>
      </div>
    </Stage>
  );
};
