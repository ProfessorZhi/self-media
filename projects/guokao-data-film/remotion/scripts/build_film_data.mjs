// Build the film's single data source from the hash-verified 2027 position table.
// Every seat (one planned hire) gets a stable identity: "<position id>#<k>".
// Output: public/film_data.json — facts carry their source field and rule.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadPositions} from '../../scripts/load_positions.mjs';

const out = fileURLToPath(new URL('../public/film_data.json', import.meta.url));
const {manifest, positions} = await loadPositions();

const TAX_RULE = '部门名称包含「税务」';
// Systems are classified from the raw 部门名称 only; first matching rule wins.
const FAMILIES = [
  ['税务', /税务/],
  ['金融监管', /金融监督管理|证券监督管理/],
  ['人民银行', /中国人民银行/],
  ['海关', /海关/],
  ['边检', /出入境边防检查|移民/],
  ['海事', /海事局/],
  ['铁路公安', /铁路公安/],
  ['统计调查', /统计局|调查总队|调查队/],
  ['气象', /气象局/],
  ['矿山安全', /矿山安全/],
  ['中央及其他', /.*/],
];
const familyOf = name => FAMILIES.findIndex(([, re]) => re.test(name));
const isTax = p => p.raw['部门名称'].includes('税务');
const LEVELS = ['中央', '省（副省）级', '市（地）级', '县（区）级及以下'];

const departments = [];
const deptIndex = new Map();
// Compact position rows: [deptIdx, levelIdx, hires, isTax, familyIdx]
const rows = positions.map(p => {
  const code = p.raw['部门代码'];
  if (!deptIndex.has(code)) {
    deptIndex.set(code, departments.length);
    departments.push([code, p.raw['部门名称']]);
  }
  const level = LEVELS.indexOf(p.raw['机构层级']);
  if (level < 0) throw new Error(`${p.id}: unknown 机构层级 ${p.raw['机构层级']}`);
  return [deptIndex.get(code), level, Number(p.raw['招考人数']), isTax(p) ? 1 : 0, familyOf(p.raw['部门名称'])];
});

const sum = (list, f) => list.reduce((t, x) => t + f(x), 0);
const seats = sum(rows, r => r[2]);
const taxPositions = rows.filter(r => r[3]);
const taxSeats = sum(taxPositions, r => r[2]);
const taxBureaus = new Set(taxPositions.map(r => r[0])).size;
if (seats !== manifest.totals.hires || positions.length !== manifest.totals.positions) {
  throw new Error('Totals disagree with the verified manifest');
}

// Per-system panorama and department concentration.
const deptSeats = new Map();
rows.forEach(r => deptSeats.set(r[0], (deptSeats.get(r[0]) ?? 0) + r[2]));
const families = FAMILIES.map(([name, re], fi) => {
  const fr = rows.filter(r => r[4] === fi);
  const depts = [...new Set(fr.map(r => r[0]))];
  const top = depts.reduce((b, d) => (deptSeats.get(d) > (b === null ? -1 : deptSeats.get(b)) ? d : b), null);
  return {
    name,
    rule: fi === FAMILIES.length - 1 ? '不匹配以上任一规则的部门' : `部门名称匹配 /${re.source}/`,
    seats: sum(fr, r => r[2]),
    positions: fr.length,
    departments: depts.length,
    top: top === null ? null : {name: departments[top][1], seats: deptSeats.get(top)},
  };
});
if (sum(families, f => f.seats) !== seats) throw new Error('Families do not partition the seats');
const ranked = [...deptSeats.values()].sort((a, b) => b - a);
let cum = 0;
const deptsFor80 = ranked.findIndex(v => (cum += v) >= 0.8 * seats) + 1;
const immigration = JSON.parse(await readFile(fileURLToPath(new URL('../../data/official_2027_immigration_plan.json', import.meta.url)), 'utf8'));
const border = families.find(f => f.name === '边检');

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
  deptsFor80: {value: deptsFor80, source: src('部门代码 / 招考人数', '部门按名额从多到少累加，达到全国 80% 所需部门数')},
  deptsUpTo5: {value: ranked.filter(v => v <= 5).length, source: src('部门代码 / 招考人数', '全年名额 ≤ 5 的部门数')},
  deptsOnly1: {value: ranked.filter(v => v === 1).length, source: src('部门代码 / 招考人数', '全年只招 1 人的部门数')},
  borderOfficial: {
    value: immigration.totals.hires,
    matches: immigration.totals.hires === border.seats && immigration.totals.units === border.departments,
    source: {file: 'data/official_2027_immigration_plan.json', field: 'totals', rule: '国家移民管理局公告；与职位表按部门名称归出的边检系统对账'},
  },
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
  position_columns: ['deptIdx', 'levelIdx', 'hires', 'isTax', 'familyIdx'],
  families,
  positions: rows,
  facts,
};
await mkdir(fileURLToPath(new URL('../public/', import.meta.url)), {recursive: true});
await writeFile(out, JSON.stringify(payload));
console.log(Object.fromEntries(Object.entries(facts).map(([k, v]) => [k, v.value])), border, facts.borderOfficial.matches);
console.table(families.map(f => ({name: f.name, seats: f.seats, depts: f.departments, top: f.top?.name})));
