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
// Condition buckets read straight from the raw fields.
const EDU = ['本科及以上', '仅限本科', '研究生', '其他'];
const eduOf = v => (v === '本科及以上' ? 0 : v === '仅限本科' ? 1 : ['硕士研究生及以上', '仅限硕士研究生', '仅限博士研究生'].includes(v) ? 2 : 3);
const POL = ['不限', '党员或团员', '中共党员'];
const POL_RAW = ['不限', '中共党员或共青团员', '中共党员'];
const polOf = v => {
  const i = POL_RAW.indexOf(v);
  if (i < 0) throw new Error(`unknown 政治面貌 ${v}`);
  return i;
};
const GRASS = ['不要求基层经历', '要求基层工作年限'];
const grassOf = v => (v === '无限制' ? 0 : 1);
// Major words: a seat joins the first word its 专业 text mentions (text match, not eligibility).
const WORDS = ['经济', '审计', '金融', '统计', '计算机', '法学'];
// A position mentioning several words joins the word whose fill ratio
// (assigned seats ÷ seats mentioning it) is currently lowest, so word sizes stay proportional.
const wordMention = WORDS.map(w => positions.filter(p => p.raw['专业'].includes(w)).reduce((t, p) => t + Number(p.raw['招考人数']), 0));
const wordFill = WORDS.map(() => 0);
const wordOf = (major, hires) => {
  let best = -1;
  WORDS.forEach((w, i) => {
    if (major.includes(w) && (best < 0 || wordFill[i] / wordMention[i] < wordFill[best] / wordMention[best])) best = i;
  });
  if (best >= 0) wordFill[best] += hires;
  return best;
};
const LAW_CODE = '030101K';

// Compact position rows: [deptIdx, levelIdx, hires, isTax, familyIdx, edu, pol, grass, wordIdx, lawCode]
const rows = positions.map(p => {
  const code = p.raw['部门代码'];
  if (!deptIndex.has(code)) {
    deptIndex.set(code, departments.length);
    departments.push([code, p.raw['部门名称']]);
  }
  const level = LEVELS.indexOf(p.raw['机构层级']);
  if (level < 0) throw new Error(`${p.id}: unknown 机构层级 ${p.raw['机构层级']}`);
  const major = p.raw['专业'];
  return [
    deptIndex.get(code),
    level,
    Number(p.raw['招考人数']),
    isTax(p) ? 1 : 0,
    familyOf(p.raw['部门名称']),
    eduOf(p.raw['学历']),
    polOf(p.raw['政治面貌']),
    grassOf(p.raw['基层工作最低年限']),
    wordOf(major, Number(p.raw['招考人数'])),
    major.includes(LAW_CODE) ? 1 : 0,
  ];
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

// ---- Act I: official competition series (国家公务员局 via 新华社/央视), seats for 2027 from P27
const official = JSON.parse(await readFile(fileURLToPath(new URL('../../data/official_historical_exam_data.json', import.meta.url)), 'utf8'));
const competition = official.exam_years.map(y => ({
  year: y.exam_year,
  planned: y.recruitment_plan.planned_seats.value,
  plannedText: y.recruitment_plan.planned_seats.published_text,
  approved: y.qualification.approved_applicants.value,
  approvedText: y.qualification.approved_applicants.published_text,
  ratioText: y.qualification.approved_applicants_per_planned_seat.published_text,
  attendees: y.attendance?.actual_attendees?.value ?? null,
  attendeesText: y.attendance?.actual_attendees?.published_text ?? null,
}));
competition.push({year: 2027, planned: seats, plannedText: `${seats.toLocaleString('en-US')} 人`, approved: null, approvedText: '报名中', ratioText: null, attendees: null, attendeesText: null});

// ---- Act III: year-on-year change (H: 2024–2026 third-party tables; 2027 raw table)
const hist = JSON.parse(await readFile(fileURLToPath(new URL('../../data/histories_2024_2027.json', import.meta.url)), 'utf8'));
const H = Object.fromEntries(hist.years.map(y => [y.year, y]));
const byName = (y, key, field) => Object.fromEntries(H[y][key].map(r => [r[field], r.hires]));
const d26 = byName(2026, 'by_department', 'department_name');
const d27 = byName(2027, 'by_department', 'department_name');
const moves = Object.keys(d26)
  .filter(k => k in d27 && Math.max(d26[k], d27[k]) >= 40 && Math.abs(d27[k] - d26[k]) >= 30)
  .map(k => ({name: k, from: d26[k], to: d27[k], pct: (d27[k] - d26[k]) / d26[k], family: FAMILIES[familyOf(k)][0]}));
const pickMovers = sign => {
  const seen = new Set();
  return [...moves]
    .sort((a, b) => sign * (b.pct - a.pct))
    .filter(m => !seen.has(m.family) && seen.add(m.family))
    .slice(0, 5);
};
const levelsByYear = [2024, 2025, 2026, 2027].map(y => ({year: y, ...byName(y, 'by_org_level', 'org_level_raw')}));
const p26 = byName(2026, 'by_province', 'source_csv_province');
const p27 = byName(2027, 'by_province', 'source_csv_province');
const provinces = Object.keys(p27).map(k => ({name: k, from: p26[k], to: p27[k], pct: (p27[k] - p26[k]) / p26[k]}));
const change = {
  gainers: pickMovers(1),
  losers: pickMovers(-1),
  levelsByYear,
  provinces,
  deptNamesNew: Object.keys(d27).filter(k => !(k in d26)).length,
  deptNamesGone: Object.keys(d26).filter(k => !(k in d27)).length,
  source: '2024–2026 为固定哈希的第三方清洗表；2027 为全国职位表原字段。部门按名称对比，省份为第三方注记。',
};

// ---- Act IV: condition panorama and major words
const cond = (idx, names) => names.map((name, i) => ({name, seats: sum(rows.filter(r => r[idx] === i), r => r[2])}));
const singles = rows.filter(r => r[2] === 1).length;
const bySize = [1, 2, 3, 4].map(k => ({k: String(k), positions: rows.filter(r => r[2] === k).length})).concat([{k: '5+', positions: rows.filter(r => r[2] >= 5).length}]);
const words = WORDS.map(w => {
  const ps = positions.filter(p => p.raw['专业'].includes(w));
  return {word: w, positions: ps.length, seats: sum(ps, p => Number(p.raw['招考人数']))};
});
const cet6 = positions.filter(p => p.raw['备注'].includes('英语六级'));
const conditions = {
  edu: cond(5, EDU),
  pol: cond(6, POL),
  grass: cond(7, GRASS),
  bySize,
  singles,
  maxHires: Math.max(...rows.map(r => r[2])),
  words,
  cet6: {positions: cet6.length, seats: sum(cet6, p => Number(p.raw['招考人数']))},
};

// ---- Act VI: one code, one seat
const lawPositions = positions.filter(p => p.raw['专业'].includes(LAW_CODE));
const featured = lawPositions.filter(p => p.raw['机构层级'] === '县（区）级及以下' && p.raw['招考人数'] === '1').sort((a, b) => (a.id < b.id ? -1 : 1))[0];
const query = {
  code: LAW_CODE,
  name: '法学（本科专业目录 2026）',
  positions: lawPositions.length,
  seats: sum(lawPositions, p => Number(p.raw['招考人数'])),
  featured: {
    id: featured.id,
    index: positions.indexOf(featured),
    fields: ['部门名称', '用人司局', '招考职位', '职位代码', '机构层级', '专业', '学历', '政治面貌', '基层工作最低年限', '工作地点', '招考人数'].map(k => [k, featured.raw[k]]),
    source: {sheet: featured.source_sheet, row: featured.source_row},
  },
};

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
  position_columns: ['deptIdx', 'levelIdx', 'hires', 'isTax', 'familyIdx', 'edu', 'pol', 'grass', 'wordIdx', 'lawCode'],
  families,
  competition,
  change,
  conditions,
  query,
  positions: rows,
  facts,
};
await mkdir(fileURLToPath(new URL('../public/', import.meta.url)), {recursive: true});
await writeFile(out, JSON.stringify(payload));
console.log(Object.fromEntries(Object.entries(facts).map(([k, v]) => [k, v.value])), border, facts.borderOfficial.matches);
console.log(JSON.stringify({competition, gainers: change.gainers, losers: change.losers, levels: levelsByYear, conditions: {...conditions}, query}, null, 1).slice(0, 6000));
console.table(families.map(f => ({name: f.name, seats: f.seats, depts: f.departments, top: f.top?.name})));
