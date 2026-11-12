import {Easing, interpolate} from 'remotion';

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const backOut = Easing.bezier(0.34, 1.56, 0.64, 1);

/** Progress 0→1 of a window [t0, t1] at time t, eased. */
export function prog(t: number, t0: number, t1: number, ease = easeInOut) {
  return interpolate(t, [t0, t1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });
}
