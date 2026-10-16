// VIDEO-001: deterministic integrity checks for public, derived JSON artifacts.
// Run: node projects/guokao-data-film/scripts/verify_data.mjs
// No network access or external dependencies required.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const assert = (cond, why) => { if (!cond) throw new Error(why); };
const eq = (actual, expected, label) => assert(actual === expected, label + ': got ' + actual + ', expected ' + expected);
const sums = (items, key) => items.reduce((n, row) => n + Number(row[key] || 0), 0);
const checkGroup = (name, rows, totals) => {
  eq(sums(rows, 'positions'), totals.positions, name + ' positions');
  eq(sums(rows, 'hires'), totals.hires, name + ' hires');
};

const data = read('2027_position_derived_aggregates.json');
const totals = data.totals;
eq(totals.positions, 19426, '2027 positions');
eq(totals.hires, 35691, '2027 hires');
eq(data.by_province.length, 31, '2027 provinces');
for (const field of [
  'by_province', 'by_agency_class', 'by_exam_category',
  'by_org_level', 'by_education_raw', 'by_source_system_tag',
  'by_province_and_source_system_tag',
]) checkGroup(field, data[field], totals);

const mc = data.major_code_mentions;
eq(mc.unique_codes, mc.codes.length, 'declared number of codes');
eq(mc.unique_codes, 649, '2027 explicit distinct codes at study snapshot');
eq(mc.coded_positions, 3252, '2027 rows with explicit parsed code');
eq(mc.coded_positions + mc.uncoded_positions, totals.positions, 'code coverage partition');
const allCodes = new Set();
for (const item of mc.codes) {
  assert(!allCodes.has(item.code), 'duplicate code: ' + item.code);
  allCodes.add(item.code);
  const expected = { positions: item.explicit_mentions_positions, hires: item.explicit_mentions_hires };
  for (const field of ['by_province', 'by_source_system_tag', 'by_agency_class', 'by_province_and_source_system_tag']) {
    checkGroup('code ' + item.code + ' / ' + field, item[field], expected);
  }
}
// IMPORTANT: Code-based totals overlap across codes. Never sum 649 code nodes to recover nationwide jobs.

const legacy = read('observatory_2027_legacy_snapshot.json');
eq(legacy.records.length, 28, 'legacy 28 records');
eq(sums(legacy.records, 'jobs'), totals.positions, 'legacy total jobs');
eq(sums(legacy.records, 'hires'), totals.hires, 'legacy total hires');

const history = read('annual_recruitment_2024_2027_secondary.json');
const y26 = history.years.find(x => x.year === 2026);
const y27 = history.years.find(x => x.year === 2027);
assert(y26 && y27, 'missing 2026/2027 year');
eq(y27.positions, totals.positions, 'history 2027 jobs');
eq(y27.hires, totals.hires, 'history 2027 hires');
eq(y27.hires - y26.hires, history.y2027_vs_y2026.hires_change, 'yoy hires delta');
eq(y27.positions - y26.positions, history.y2027_vs_y2026.positions_change, 'yoy position delta');

const snap = read('2027_registration_snapshot_20261016_secondary.json');
eq(snap.by_province.length, 31, 'secondary registration snapshot province count');
eq(sums(snap.by_province, 'applicants'), snap.totals.applicants, 'registration applicants');
eq(sums(snap.by_province, 'qualified'), snap.totals.qualified, 'registration qualified');

const timetable = read('official_2027_exam_timeline.json');
for (const event of timetable.events) {
  assert(Number.isFinite(Date.parse(event.start)), 'invalid event start: ' + event.id);
  if (event.end) {
    assert(Number.isFinite(Date.parse(event.end)), 'invalid event end: ' + event.id);
    assert(Date.parse(event.end) >= Date.parse(event.start), 'end precedes start: ' + event.id);
  }
}

console.log(JSON.stringify({
  verified: true,
  year: 2027,
  positions: totals.positions,
  hires: totals.hires,
  provinces: data.by_province.length,
  explicit_major_codes: mc.codes.length,
  explicitly_coded_positions: mc.coded_positions,
  source_status: 'third-party normalized official-job-table, original government bytes not independently checked',
}, null, 2));
