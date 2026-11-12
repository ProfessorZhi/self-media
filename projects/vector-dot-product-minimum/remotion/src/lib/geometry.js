// Exact geometry of the problem. Every point drawn on screen comes from here.
// A=(0,0), B=(2,0), C=(0,2√3). For D on the opposite side of AC from B with ∠ADC=120°,
// D lies on the minor arc AC of the circle centred O=(1,√3), radius 2 (BC is a diameter).
export const SQ3 = Math.sqrt(3);
export const A = {x: 0, y: 0};
export const B = {x: 2, y: 0};
export const C = {x: 0, y: 2 * SQ3};
export const O = {x: 1, y: SQ3};
export const R = 2;

// Polar angle (degrees) of D around O. The legal arc (x<0) is the open interval (120°, 240°):
// 240° is A, 120° is C, 180° is the leftmost point D*=(-1,√3).
export const ARC_MIN_DEG = 120;
export const ARC_MAX_DEG = 240;

export function dOnArc(deg) {
  if (!(deg > ARC_MIN_DEG && deg < ARC_MAX_DEG)) throw new Error(`D angle ${deg} off legal arc`);
  const t = (deg * Math.PI) / 180;
  return {x: O.x + R * Math.cos(t), y: O.y + R * Math.sin(t)};
}

export const dot = (u, v) => u.x * v.x + u.y * v.y;
export const sub = (p, q) => ({x: p.x - q.x, y: p.y - q.y});
export const len = (u) => Math.hypot(u.x, u.y);

export function angleADCdeg(D) {
  const u = sub(A, D);
  const v = sub(C, D);
  return (Math.acos(dot(u, v) / (len(u) * len(v))) * 180) / Math.PI;
}

// AD·AB = |AB|·x_D = 2·x_D (because AB lies on the x-axis).
export const dotADAB = (D) => dot(sub(D, A), sub(B, A));

// Method 4 (trig): θ = ∠DAC ∈ (0°, 60°). AD = 4 sin(60° − θ) and AD points at 90° + θ.
export function dFromTheta(thetaDeg) {
  const th = (thetaDeg * Math.PI) / 180;
  const ad = 4 * Math.sin(Math.PI / 3 - th);
  return {x: ad * Math.cos(Math.PI / 2 + th), y: ad * Math.sin(Math.PI / 2 + th)};
}
export const trigDot = (thetaDeg) => 2 - 4 * Math.cos(((2 * thetaDeg - 60) * Math.PI) / 180);
