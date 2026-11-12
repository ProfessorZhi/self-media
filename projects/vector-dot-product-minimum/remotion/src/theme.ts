// VIDEO-002 visual tokens. Shot language: glowing line-art on a dark field;
// chapter cards: Bauhaus geometric construction. No per-scene ad-hoc colours.
export const T = {
  bg: '#0A0D14',
  bgLift: '#121826',
  ink: '#ECE6D8', // base strokes and labels
  muted: '#6C7487',
  faint: 'rgba(236,230,216,0.16)',
  blue: '#6FA8FF', // AB
  red: '#FF5A4E', // projection / directed distance
  gold: '#E8C170', // locus / circle
  // Bauhaus card
  paper: '#EFE7D6',
  bRed: '#D7392B',
  bYellow: '#F2B31B',
  bBlue: '#1D4FA6',
  bBlack: '#151515',
  font: '"Noto Sans SC", "PingFang SC", sans-serif',
};

// World → screen. 1 unit = 200 px; A sits right of centre so the left (negative x) side has room.
export const S = 200;
export const ORIGIN = {x: 1060, y: 850};
export const W2S = (p: {x: number; y: number}) => ({x: ORIGIN.x + p.x * S, y: ORIGIN.y - p.y * S});
