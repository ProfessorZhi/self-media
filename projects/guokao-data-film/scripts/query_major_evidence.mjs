#!/usr/bin/env node
/**
 * Reverse query over the 2027 major-evidence layer.
 *
 * Answers: "given this complete code / catalog node / education level / residual
 * reason, which real positions and how many planned hires?"
 *
 * Usage:
 *   node scripts/query_major_evidence.mjs --code 030101K
 *   node scripts/query_major_evidence.mjs --code 0814Z2 --field 专业
 *   node scripts/query_major_evidence.mjs --name 法学 --education graduate
 *   node scripts/query_major_evidence.mjs --catalog moe-bachelor:2026:080901
 *   node scripts/query_major_evidence.mjs --residual --reason 气象类 ... --reason-value
 *   node scripts/query_major_evidence.mjs --position 2027:002000:100110001001
 *   node scripts/query_major_evidence.mjs --stats
 *
 * Every result is evidence, never an applicant-eligibility verdict.
 */
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..');
const evidenceDir = path.join(project, 'data', 'major_evidence_2027');
const positionsDir = path.join(project, 'data', 'positions_2027');

const args = process.argv.slice(2);
function flag(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}
function multi(name) {
  const values = [];
  args.forEach((arg, index) => {
    if (arg === name && args[index + 1]) values.push(args[index + 1]);
  });
  return values;
}
const requestedField = flag('--field');
const education = flag('--education');
const agency = flag('--agency');
const limit = Number(flag('--limit') || 25);
const asJson = args.includes('--json');

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

const evidenceManifest = await readJson(path.join(evidenceDir, 'manifest.json'));
const positionManifest = await readJson(path.join(positionsDir, 'manifest.json'));
const columns = positionManifest.columns;
const columnIndex = Object.fromEntries(columns.map((name, index) => [name, index]));

async function loadShards(dir, shards) {
  const out = [];
  for (const shard of shards) out.push(...await readJson(path.join(dir, shard.path)));
  return out;
}

async function loadPositions() {
  const map = new Map();
  for (const shard of positionManifest.shards) {
    for (const row of (await readJson(path.join(positionsDir, shard.path))).rows) map.set(row[0], row);
  }
  return map;
}

function positionFacts(row) {
  const get = name => row[columnIndex[name]];
  return {
    id: row[0],
    department_code: get('部门代码'),
    department_name: get('部门名称'),
    agency: get('用人司局'),
    title: get('招考职位'),
    position_code: get('职位代码'),
    hires: Number(get('招考人数')),
    education: get('学历'),
    work_location: get('工作地点'),
    major_raw: get('专业'),
    remarks_raw: get('备注'),
  };
}

const AGENCY_MARKERS = {
  pboc: '中国人民银行', cma: '气象', customs: '海关', tax: '税务',
  nfra: '金融监督管理', csrc: '证券监督管理',
};
function agencyMarkersFor(code) {
  return AGENCY_MARKERS[code] ?? null;
}

function matchesEducation(scopes) {
  if (!education) return true;
  const wanted = education === 'undergraduate' ? 'bachelor' : education;
  return scopes.includes(wanted);
}

const records = await loadShards(evidenceDir, evidenceManifest.position_evidence);
const positions = await loadPositions();
const reviewStatus = evidenceManifest.review_status
  ? await loadShards(evidenceDir, evidenceManifest.review_status.shards) : [];
const residualStrata = evidenceManifest.residual_strata
  ? await loadShards(evidenceDir, evidenceManifest.residual_strata.shards) : [];
const provisionalRows = evidenceManifest.provisional_gate_rule
  ? await loadShards(evidenceDir, evidenceManifest.provisional_gate_rule) : [];

function report(summary, rows) {
  if (asJson) {
    console.log(JSON.stringify({summary, rows}, null, 2));
    return;
  }
  console.log(JSON.stringify(summary, null, 2));
  for (const row of rows) {
    console.log(`${row.id}  ${row.department_name} / ${row.agency} / ${row.title}  招考人数=${row.hires}  学历=${row.education}`);
    console.log(`  专业: ${row.major_raw}`);
    if (row.matched.length) console.log(`  命中: ${row.matched.join(' ; ')}`);
  }
}

if (args.includes('--stats')) {
  console.log(JSON.stringify(evidenceManifest.summary, null, 2));
} else if (flag('--position')) {
  const wanted = flag('--position');
  const record = records.find(item => item.id === wanted);
  if (!record) {
    console.error(`position ${wanted} not found in the 2027 evidence layer`);
    process.exit(2);
  }
  console.log(JSON.stringify({facts: positionFacts(positions.get(wanted)), evidence: record}, null, 2));
} else if (flag('--code') || flag('--name') || flag('--catalog')) {
  const code = flag('--code')?.toUpperCase();
  const name = flag('--name');
  const catalogId = flag('--catalog');
  const rows = [];
  for (const record of records) {
    if (!matchesEducation(record.education_scopes)) continue;
    const matched = [];
    const names = entry => entry.resolution.names ?? [];
    const ids = entry => [...(entry.resolution.ids ?? []), ...(entry.resolution.prefix_ids ?? [])];
    const consider = (entry, field) => {
      if (requestedField && requestedField !== field) return;
      if (code && entry.code === code) matched.push(`${field}:${entry.code}:${entry.resolution.status}`);
      if (name && names(entry).includes(name)) matched.push(`${field}:${entry.code}->${name}`);
      if (catalogId && ids(entry).includes(catalogId)) matched.push(`${field}:${entry.code}->${catalogId}`);
    };
    (record.major_codes ?? []).forEach(entry => consider(entry, '专业'));
    (record.remarks_codes ?? []).forEach(entry => consider(entry, '备注'));
    const nameHits = [
      ...(record.major_term_name_hits ?? []).map(hit => ({...hit, evidence_quality: 'exact_name_term_in_major_column'})),
      ...(record.major_parenthetical_names ?? []).map(hit => ({...hit, evidence_quality: 'exact_name_inside_parentheses'})),
      ...(record.remarks_exact_names ?? []).map(hit => ({...hit, evidence_quality: 'exact_name_in_remarks'})),
    ];
    for (const hit of nameHits) {
      if (hit.is_exclusion) continue;
      if (name && hit.name === name) matched.push(`${hit.evidence_quality}:${hit.name}`);
      if (catalogId && ids(hit).includes(catalogId)) matched.push(`${hit.evidence_quality}:${hit.name}->${catalogId}`);
    }
    if (!name && !code && catalogId) {
      for (const gate of record.major_gate_prefixed_names ?? []) {
        if (gate.gate_matches_name === false) continue;
        if (ids(gate).includes(catalogId)) matched.push(`gate_prefixed_name:${gate.name}->${catalogId}`);
      }
    }
    if (!matched.length) continue;
    rows.push({...positionFacts(positions.get(record.id)), matched});
  }
  const summary = {
    query: {code, name, catalog: catalogId, field: requestedField, education},
    positions: rows.length,
    hires: rows.reduce((total, row) => total + row.hires, 0),
    note: 'Catalog-reference candidates only. Not an applicant-eligibility result.',
  };
  report(summary, rows.slice(0, limit));
} else if (args.includes('--provisional')) {
  const rows = provisionalRows.map(item => ({
    ...positionFacts(positions.get(item.id)),
    gates: item.gates,
    risk_level: item.risk_level,
    applicability: item.applicability,
    why_not_counted: item.why_not_counted,
    matched: [],
  }));
  const summary = {
    query: {provisional: true},
    positions: rows.length,
    hires: rows.reduce((total, row) => total + row.hires, 0),
    note: 'Covered only by the 门类 rule on a non-MOE position. Not part of the conservative coverage numerator.',
  };
  report(summary, rows.slice(0, limit));
} else if (args.includes('--review-status')) {
  const bucket = flag('--bucket');
  const riskOnly = args.includes('--risk');
  const rows = [];
  for (const item of reviewStatus) {
    if (bucket && item.bucket !== bucket) continue;
    if (riskOnly && !(item.risk_flags ?? []).length) continue;
    if (agency && !(item.department_name ?? '').includes(agencyMarkersFor(agency))) continue;
    const facts = positionFacts(positions.get(item.id));
    rows.push({...facts, bucket: item.bucket, markers: item.markers,
      risk_flags: item.risk_flags, excluded_terms: item.excluded_terms,
      unresolved_codes: item.unresolved_codes, conflict_count: item.conflict_count,
      old_layer_review_reasons: item.old_layer_review_reasons, matched: []});
  }
  const summary = {
    query: {review_status: true, bucket, risk_only: riskOnly, agency, education},
    positions: rows.length,
    hires: rows.reduce((total, row) => total + row.hires, 0),
    note: 'Review work state, not an eligibility verdict. legacy_reason_superseded means the old warning no longer reproduces.',
  };
  report(summary, rows.slice(0, limit));
} else if (args.includes('--review-stats')) {
  console.log(JSON.stringify(evidenceManifest.review_status?.summary ?? {}, null, 2));
} else if (args.includes('--residual') && flag('--strat-bucket')) {
  const wanted = flag('--strat-bucket');
  const rows = [];
  for (const item of residualStrata) {
    if (item.bucket !== wanted) continue;
    if (agency && !(item.department_name ?? '').includes(agencyMarkersFor(agency))) continue;
    const facts = positionFacts(positions.get(item.id));
    rows.push({...facts, bucket: item.bucket, unresolved_phrases: item.unresolved_phrases,
      reason_classes: item.reason_classes, matched: []});
  }
  const summary = {query: {strat_bucket: wanted, agency}, positions: rows.length,
    hires: rows.reduce((total, row) => total + row.hires, 0),
    note: 'No catalog candidate. Bucket assigned from the raw 专业 text.'};
  report(summary, rows.slice(0, limit));
} else if (args.includes('--residual')) {
  const reasons = multi('--reason');
  if (agency && !agencyMarkersFor(agency)) {
    console.error(`unknown --agency ${agency}; expected one of pboc, cma, customs, tax, nfra, csrc`);
    process.exit(2);
  }
  const rows = [];
  for (const record of records) {
    if (record.coverage_after) continue;
    if (!matchesEducation(record.education_scopes)) continue;
    if (reasons.length && !reasons.every(reason => (record.reason_classes ?? []).includes(reason))) continue;
    const facts = positionFacts(positions.get(record.id));
    if (agency && !facts.department_name.includes(agencyMarkersFor(agency))) continue;
    if (flag('--text') && !facts.major_raw.includes(flag('--text'))) continue;
    rows.push({...facts, reason_classes: record.reason_classes, matched: []});
  }
  const summary = {
    query: {residual: true, reasons, education, agency, text: flag('--text')},
    positions: rows.length,
    hires: rows.reduce((total, row) => total + row.hires, 0),
    note: 'No exact catalog reference was found in either column for these positions.',
  };
  report(summary, rows.slice(0, limit));
} else {
  console.log(
    'Usage: node scripts/query_major_evidence.mjs --code <code> | --name <name> | --catalog <catalog-id> | --position <id>\n' +
    '       | --residual [--reason <r>] [--strat-bucket <b>] | --review-status [--bucket <b>] [--risk]\n' +
    '       | --review-stats | --stats\n' +
    '  optional: --field 专业|备注  --education bachelor|graduate  --agency pboc|cma|tax|customs|nfra|csrc  --limit N  --json'
  );
}
