import {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {buildLayouts, expandSeats} from './seatModel.js';

export type Fact = {value: number; source: {file: string; field: string; rule: string}};
export type Family = {name: string; rule: string; seats: number; positions: number; departments: number; top: {name: string; seats: number} | null};
export type FilmData = {
  facts: Record<'seats' | 'positions' | 'departments' | 'taxSeats' | 'taxPositions' | 'taxBureaus' | 'otherSeats' | 'taxSharePct' | 'deptsFor80' | 'deptsUpTo5' | 'deptsOnly1', Fact> & {
    borderOfficial: Fact & {matches: boolean};
  };
  families: Family[];
  positions: number[][];
  departments: [string, string][];
  levels: string[];
};
export type Model = {
  data: FilmData;
  seats: {count: number; tax: Uint8Array; position: Int32Array};
  layouts: {
    field: Float32Array;
    split: Float32Array;
    reflow: Float32Array;
    sweep: Float32Array;
    boxes: Record<'field' | 'tax' | 'other' | 'zoom', {left: number; top: number; rows: number; cols: number; pitch: number}>;
  };
};

const fonts: [string, string][] = [
  ['400', 'fonts/NotoSansSC-400.woff2'],
  ['500', 'fonts/NotoSansSC-500.woff2'],
  ['700', 'fonts/NotoSansSC-700.woff2'],
];

let cache: Promise<Model> | null = null;
const load = () =>
  (cache ??= (async () => {
    await Promise.all(
      fonts.map(async ([weight, file]) => {
        const face = new FontFace('Noto Sans SC', `url(${staticFile(file)})`, {weight});
        document.fonts.add(await face.load());
      }),
    );
    const data: FilmData = await (await fetch(staticFile('film_data.json'))).json();
    const seats = expandSeats(data);
    if (seats.count !== data.facts.seats.value) throw new Error('Seat expansion disagrees with facts');
    return {data, seats, layouts: buildLayouts(seats)};
  })());

export function useFilmData(): Model | null {
  const [model, setModel] = useState<Model | null>(null);
  const [handle] = useState(() => delayRender('Loading film data and fonts'));
  useEffect(() => {
    load()
      .then(m => {
        setModel(m);
        continueRender(handle);
      })
      .catch(err => cancelRender(err));
  }, [handle]);
  return model;
}
