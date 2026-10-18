export const W = 1920;
export const H = 1080;
export const FPS = 30;
// Canvas backing store is drawn at 2× so particles stay sharp in 4K renders (--scale=2).
export const DPR = 2;

// Restrained dark palette: one accent (coral) marks the current focus.
export const C = {
  bg: '#0d1015',
  ink: '#ece8e1',
  muted: '#8b94a1',
  faint: '#4a525d',
  seat: [112, 128, 150] as const, // grey-blue resting seat
  focus: [214, 222, 232] as const, // brightened seat when it becomes the subject
  coral: [236, 120, 92] as const,
  coralCss: '#ec785c',
};

export const FONT = '"Noto Sans SC", "WenQuanYi Zen Hei", sans-serif';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// One fixed colour per system, in data.families order. Muted, distinct on the dark ground.
export const FAMILY_RGB: [number, number, number][] = [
  [224, 122, 95], // 税务
  [91, 155, 213], // 金融监管
  [227, 182, 91], // 人民银行
  [79, 179, 162], // 海关
  [168, 139, 219], // 边检
  [125, 191, 122], // 海事
  [201, 143, 107], // 铁路公安
  [224, 141, 180], // 统计调查
  [120, 197, 224], // 气象
  [185, 179, 94], // 矿山安全
  [176, 184, 196], // 中央及其他
];
export const famCss = (fi: number, a = 1) => `rgba(${FAMILY_RGB[fi].join(',')},${a})`;
