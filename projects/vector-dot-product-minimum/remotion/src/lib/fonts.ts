import {continueRender, delayRender, staticFile} from 'remotion';
import 'katex/dist/katex.min.css';

const WEIGHTS = [400, 500, 700];
let started = false;

/** Load the bundled Noto Sans SC weights and KaTeX fonts before the first frame renders. */
export function ensureFonts() {
  if (started || typeof document === 'undefined') return;
  started = true;
  const handle = delayRender('fonts');
  const faces = WEIGHTS.map((w) => new FontFace('Noto Sans SC', `url(${staticFile(`fonts/NotoSansSC-${w}.woff2`)})`, {weight: String(w)}));
  Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff))))
    .then(() => Promise.all(['KaTeX_Main', 'KaTeX_Math'].map((f) => document.fonts.load(`40px ${f}`))))
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error(e);
      continueRender(handle);
    });
}
