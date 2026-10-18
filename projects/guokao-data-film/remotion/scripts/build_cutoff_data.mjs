// Act V data: 2026 initial-batch published minimum interview scores, one record per position.
// Output: public/cutoffs_2026.json. Scores are kept as published; nothing is rescaled.
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadInterviewCutoffs} from '../../scripts/load_interview_cutoffs.mjs';

const {records} = await loadInterviewCutoffs();
const CATS = ['行政执法类', '市（地）级及以下直属机构综合管理类', '中央机关及其省级直属机构综合管理类'];
// The published scores split into two clusters with an empty band at 80–85 points.
const GAP = 85;
const scored = records.filter(r => r['最低面试分数'] !== null).map(r => ({...r, score: Number(r['最低面试分数'])}));
const main = scored.filter(r => r.score >= GAP);
const other = scored.filter(r => r.score < GAP);
if (scored.some(r => r.score >= 80 && r.score < 90)) throw new Error('Expected empty band 80–90 between score clusters');

const median = xs => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const top = [...main].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, 5);
const attr = other.reduce((m, r) => ((m[r.source_csv_position_attribute] = (m[r.source_csv_position_attribute] ?? 0) + 1), m), {});

const payload = {
  schema_version: '1.0.0',
  source: 'data/interview_cutoffs_2026（2026 年度首批面试名单公开镜像；审计署 35 岗官方附件对照一致）',
  note: '最低面试分数按发布值保留；不是全国政策合格线，也不是实际面试成绩。不同职位计分可能不同。',
  total: records.length,
  categories: CATS,
  // main cluster: [score × 10, category index]
  main: main.map(r => [Math.round(r.score * 10), CATS.indexOf(r.source_csv_exam_category)]),
  otherCount: other.length,
  otherAttributes: Object.entries(attr).sort((a, b) => b[1] - a[1]).slice(0, 4),
  min: Math.min(...main.map(r => r.score)),
  max: Math.max(...main.map(r => r.score)),
  medians: CATS.map(c => median(main.filter(r => r.source_csv_exam_category === c).map(r => r.score))),
  top: top.map(r => ({score: r.score, org: r['招录机关'], unit: r['用人司局'], post: r['招考职位'], seats: r.source_csv_planned_seats})),
};
await writeFile(fileURLToPath(new URL('../public/cutoffs_2026.json', import.meta.url)), JSON.stringify(payload));
console.log({total: payload.total, main: main.length, other: other.length, min: payload.min, max: payload.max, medians: payload.medians, attrs: payload.otherAttributes, top: payload.top});
