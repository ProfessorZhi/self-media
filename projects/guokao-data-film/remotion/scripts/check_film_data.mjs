// Independent re-count of every number the film shows, straight from the raw tables.
// Run: npm test   (fails loudly on any mismatch)
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadPositions} from '../../scripts/load_positions.mjs';
import {loadInterviewCutoffs} from '../../scripts/load_interview_cutoffs.mjs';

const film = JSON.parse(await readFile(fileURLToPath(new URL('../public/film_data.json', import.meta.url)), 'utf8'));
const cut = JSON.parse(await readFile(fileURLToPath(new URL('../public/cutoffs_2026.json', import.meta.url)), 'utf8'));
const {positions} = await loadPositions();
const {records} = await loadInterviewCutoffs();

let failures = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : ` (expected ${JSON.stringify(want)})`}`);
};
const hires = p => Number(p.raw['招考人数']);
const sum = (list, f) => list.reduce((t, x) => t + f(x), 0);
const f = film.facts;

eq('名额总数', sum(positions, hires), f.seats.value);
eq('岗位总数', positions.length, f.positions.value);
eq('部门数', new Set(positions.map(p => p.raw['部门代码'])).size, f.departments.value);
const tax = positions.filter(p => p.raw['部门名称'].includes('税务'));
eq('税务名额', sum(tax, hires), f.taxSeats.value);
eq('税务占比 %', Math.round((sum(tax, hires) / sum(positions, hires)) * 1000) / 10, f.taxSharePct.value);
eq('系统分类覆盖全部名额', sum(film.families, x => x.seats), f.seats.value);
eq('边检 = 移民局公告', f.borderOfficial.matches, true);

const byDept = new Map();
positions.forEach(p => byDept.set(p.raw['部门代码'], (byDept.get(p.raw['部门代码']) ?? 0) + hires(p)));
const ranked = [...byDept.values()].sort((a, b) => b - a);
let acc = 0;
eq('八成名额所需部门数', ranked.findIndex(v => (acc += v) >= 0.8 * f.seats.value) + 1, f.deptsFor80.value);
eq('全年 ≤5 名额的部门', ranked.filter(v => v <= 5).length, f.deptsUpTo5.value);
eq('只招 1 人的部门', ranked.filter(v => v === 1).length, f.deptsOnly1.value);

const lvl = n => sum(positions.filter(p => p.raw['机构层级'] === n), hires);
eq('县区及以下名额', lvl('县（区）级及以下'), film.change.levelsByYear[3]['县（区）级及以下']);
eq('只招 1 人的岗位', positions.filter(p => hires(p) === 1).length, film.conditions.singles);
eq('单岗最多', Math.max(...positions.map(hires)), film.conditions.maxHires);
eq('本科及以上名额', sum(positions.filter(p => p.raw['学历'] === '本科及以上'), hires), film.conditions.edu[0].seats);
eq('不限政治面貌名额', sum(positions.filter(p => p.raw['政治面貌'] === '不限'), hires), film.conditions.pol[0].seats);
eq('不要求基层年限名额', sum(positions.filter(p => p.raw['基层工作最低年限'] === '无限制'), hires), film.conditions.grass[0].seats);
for (const w of film.conditions.words) eq(`专业栏提到「${w.word}」的岗位`, positions.filter(p => p.raw['专业'].includes(w.word)).length, w.positions);
const law = positions.filter(p => p.raw['专业'].includes(film.query.code));
eq('030101K 岗位 / 名额', [law.length, sum(law, hires)], [film.query.positions, film.query.seats]);
eq('落点岗位存在且含 030101K', positions.find(p => p.id === film.query.featured.id)?.raw['专业'].includes('030101K'), true);
eq('落点岗位在 film_data 中的序号', positions.findIndex(p => p.id === film.query.featured.id), film.query.featured.index);

const scores = records.filter(r => r['最低面试分数'] !== null).map(r => Number(r['最低面试分数']));
eq('2026 面试线岗位', records.length, cut.total);
eq('≥85 分组 / 另一口径', [scores.filter(s => s >= 85).length, scores.filter(s => s < 85).length], [cut.main.length, cut.otherCount]);
eq('最高 / 最低（≥85 组）', [Math.max(...scores), Math.min(...scores.filter(s => s >= 85))], [cut.max, cut.min]);

console.log(failures ? `\n${failures} mismatch(es)` : '\nall film numbers re-counted from raw tables');
process.exit(failures ? 1 : 0);
