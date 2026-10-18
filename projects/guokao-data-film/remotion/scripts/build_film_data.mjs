// Build the film's single data source from the hash-verified 2027 position table.
// Every seat (one planned hire) gets a stable identity: "<position id>#<k>".
// Output: public/film_data.json — facts carry their source field and rule.
import {writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadPositions} from '../../scripts/load_positions.mjs';

const out = fileURLToPath(new URL('../public/film_data.json', import.meta.url));
const {manifest, positions} = await loadPositions();

const TAX_RULE = '部门名称包含「税务」';
const isTax = p => p.raw['部门名称'].includes('税务');
const LEVELS = ['中央', '省（副省）级', '市（地）级', '县（区）级及以下'];

const departments = [];
const deptIndex = new Map();
// Compact position rows: [deptIdx, levelIdx, hires, isTax]
const rows = positions.map(p => {
  const code = p.raw['部门代码'];
  if (!deptIndex.has(code)) {
    deptIndex.set(code, departments.length);
    departments.push([code, p.raw['部门名称']]);
  }
  const level = LEVELS.indexOf(p.raw['机构层级']);
  if (level < 0) throw new Error(`${p.id}: unknown 机构层级 ${p.raw['机构层级']}`);
  return [deptIndex.get(code), level, Number(p.raw['招考人数']), isTax(p) ? 1 : 0];
});

const sum = (list, f) => list.reduce((t, x) => t + f(x), 0);
const seats = sum(rows, r => r[2]);
const taxPositions = rows.filter(r => r[3]);
const taxSeats = sum(taxPositions, r => r[2]);
const taxBureaus = new Set(taxPositions.map(r => r[0])).size;
if (seats !== manifest.totals.hires || positions.length !== manifest.totals.positions) {
  throw new Error('Totals disagree with the verified manifest');
}

const src = (field, rule) => ({file: 'data/positions_2027', field, rule});
const facts = {
  seats: {value: seats, source: src('招考人数', '19,426 岗逐岗加总')},
  positions: {value: positions.length, source: src('id', '岗位计数')},
  departments: {value: departments.length, source: src('部门代码', '去重计数')},
  taxSeats: {value: taxSeats, source: src('部门名称 / 招考人数', TAX_RULE)},
  taxPositions: {value: taxPositions.length, source: src('部门名称', TAX_RULE)},
  taxBureaus: {value: taxBureaus, source: src('部门代码', `${TAX_RULE}，去重计数`)},
  otherSeats: {value: seats - taxSeats, source: src('招考人数', '全国 − 税务')},
  taxSharePct: {value: Math.round((taxSeats / seats) * 1000) / 10, source: src('招考人数', '税务 ÷ 全国，保留一位小数')},
};

const payload = {
  schema_version: '1.0.0',
  built_from: {
    manifest: 'data/positions_2027/manifest.json',
    manifest_sha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),
    note: '全国主表来源及核验范围见 data/positions_2027/manifest.json；本文件只做加总与压缩。',
  },
  levels: LEVELS,
  departments,
  position_ids: positions.map(p => p.id),
  position_columns: ['deptIdx', 'levelIdx', 'hires', 'isTax'],
  positions: rows,
  facts,
};
await mkdir(fileURLToPath(new URL('../public/', import.meta.url)), {recursive: true});
await writeFile(out, JSON.stringify(payload));
console.log(Object.fromEntries(Object.entries(facts).map(([k, v]) => [k, v.value])));
