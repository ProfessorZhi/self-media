export const W = 1920;
export const H = 1080;
export const FPS = 30;

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
