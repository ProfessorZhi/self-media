#!/usr/bin/env node
/**
 * Offline acceptance checks for the current position/data package.
 * Run from any directory. Prints JSON; only --write-report writes a report.
 * Uses committed JSON and loaders, without source Excel files or network access.
 */
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import path from 'node:path';
import {loadPositions} from './load_positions.mjs';
import {loadMajorData} from './load_majors.mjs';
import {loadInterviewCutoffs} from './load_interview_cutoffs.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const reportRelativePath = 'research/DATA_VALIDATION_20261017_V2.json';
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node /path/to/scripts/verify_position_data.mjs [--write-report]\nDefault: JSON report on stdout. --write-report also saves research/DATA_VALIDATION_20261017_V2.json.');
  process.exit(0);
}
if (args.some(arg => arg !== '--write-report')) {
  console.error('Unsupported argument. Use --help for usage.');
  process.exit(2);
}
const startedAt = new Date().toISOString();
let section = 'loaders';
const assertionCounts = {};
const fingerprints = {};
const check = (condition, message) => {
  assertionCounts[section] = (assertionCounts[section] ?? 0) + 1;
  if (!condition) throw new Error(`${section}: ${message}`);
};
const equal = (actual, expected, label) => check(isDeepStrictEqual(actual, expected), label);
const sameSet = (actual, expected, label) => equal([...new Set(actual)].sort(), [...new Set(expected)].sort(), label);
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const totals = rows => ({positions: sum(rows, 'positions'), hires: sum(rows, 'hires')});
const hiresFor = (ids, positions) => ids.reduce((total, id) => total + Number(positions.getPosition(id).raw['招考人数']), 0);
async function readJson(relativePath) {
  const bytes = await readFile(path.resolve(project, relativePath));
  fingerprints[relativePath] = {bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
  return JSON.parse(bytes.toString('utf8'));
}
const group = (positions, dimensions) => {
  const groups = new Map();
  for (const row of positions) {
    const key = JSON.stringify(dimensions.map(get => get(row)));
    const cell = groups.get(key) ?? {positions: 0, hires: 0};
    cell.positions++; cell.hires += Number(row.raw['招考人数']); groups.set(key, cell);
  }
  return groups;
};
function compareGroups(storedRows, keyOf, expected, label) {
  const actual = new Map();
  for (const row of storedRows) {
    const key = JSON.stringify(keyOf(row));
    check(!actual.has(key), `${label}: duplicate group ${key}`);
    actual.set(key, {positions: row.positions, hires: row.hires});
  }
  sameSet(actual.keys(), expected.keys(), `${label}: group keys`);
  for (const [key, value] of expected) equal(actual.get(key), value, `${label}: group ${key}`);
}

async function verify() {
  const [positions, majors, cutoffs, conditions, histories, officialHistory, officialRows] = await Promise.all([
    loadPositions(), loadMajorData(), loadInterviewCutoffs(),
    readJson('data/position_conditions_2027.json'), readJson('data/histories_2024_2027.json'),
    readJson('data/official_historical_exam_data.json'), readJson('research/OFFICIAL_ROW_CROSSCHECK_20261017.json'),
  ]);
  await Promise.all([
    'data/positions_2027/manifest.json', 'data/majors_2027/manifest.json', 'data/interview_cutoffs_2026/manifest.json',
    ...majors.manifest.catalogs.map(relative => path.posix.normalize(`data/majors_2027/${relative}`)),
    'data/majors_2027/tax-catalog-name-crosswalk.json',
  ].map(readJson));
  check(true, 'All three loaders accepted their byte counts, declared hashes, keys and counts');
  const expectedTotals = {positions: 19426, hires: 35691};

  section = 'positions_2027';
  equal(positions.positions.length, expectedTotals.positions, 'national position count');
  equal(positions.positions.reduce((n, p) => n + Number(p.raw['招考人数']), 0), expectedTotals.hires, 'national hires');
  equal(positions.manifest.shards.length, 23, 'position shard count');
  equal(positions.manifest.raw_columns.length, 27, 'original field count');
  equal(new Set(positions.positions.map(p => p.raw['部门代码'])).size, 589, 'department count');
  equal(new Set(positions.positions.map(p => p.annotations.source_csv_province)).size, 31, 'province annotation count');
  equal(new Set(positions.positions.map(p => p.annotations.source_system_tag)).size, 19, 'third-party system tag count');
  compareGroups(positions.manifest.by_source_sheet, p => [p.source_sheet], group(positions.positions, [p => p.source_sheet]), 'source worksheets');

  section = 'major_catalogs';
  const nodeIndex = new Map();
  const catalogSizes = {};
  let referencesChecked = 0;
  for (const catalog of majors.catalogs) {
    catalogSizes[catalog.catalog_id] = {};
    for (const field of ['gates', 'categories', 'majors', 'first_level_disciplines', 'professional_degree_categories']) {
      if (!catalog[field]) continue;
      catalogSizes[catalog.catalog_id][field] = catalog[field].length;
      for (const node of catalog[field]) {
        check(!nodeIndex.has(node.id), `duplicate catalog ID ${node.id}`);
        check(node.id.startsWith(`${catalog.catalog_id}:`), `wrong namespace ${node.id}`);
        nodeIndex.set(node.id, node);
        check(majors.getCatalogNode(node.id)?.id === node.id, `catalog lookup ${node.id}`);
      }
    }
  }
  equal(catalogSizes, {
    'moe-bachelor:2026': {gates: 13, categories: 92, majors: 883},
    'moe-graduate:2022': {gates: 14, first_level_disciplines: 117, professional_degree_categories: 67},
    'sat-recruitment:2027': {categories: 53},
  }, 'catalog counts');
  const verifyRefs = (ids, label) => {
    for (const id of ids) { referencesChecked++; check(nodeIndex.has(id), `${label}: unknown catalog ID ${id}`); }
  };
  for (const node of nodeIndex.values()) if (node.parent_id) verifyRefs([node.parent_id], `${node.id} parent`);
  for (const catalog of majors.catalogs) {
    for (const edge of catalog.membership_edges ?? []) verifyRefs([edge.category_id], 'tax membership');
  }
  const tax = majors.catalogs.find(c => c.catalog_id === 'sat-recruitment:2027');
  equal(tax.membership_edges.length, 849, 'tax membership edges');
  equal(majors.taxNameCrosswalk.length, 849, 'tax exact-name crosswalk edges');
  for (const edge of majors.taxNameCrosswalk) {
    verifyRefs([edge.tax_category_id, ...edge.catalog_candidate_ids], `tax member ${edge.member_name}`);
    check(edge.eligibility_evaluated === false, 'tax crosswalk must not decide eligibility');
  }

  section = 'major_requirements';
  equal(majors.manifest.requirements.length, 13, 'requirement shard count');
  equal(majors.requirements.length, 4090, 'requirement group count');
  equal(majors.codeMentions.length, 734, 'literal token count');
  const requirementIndex = new Map();
  const positionIds = new Set();
  const independentlyFoundCodes = new Map();
  const independentCodeRequirements = new Map();
  let codeSpans = 0, clauseSpans = 0, rowLinks = 0;
  for (const requirement of majors.requirements) {
    check(!requirementIndex.has(requirement.id), `duplicate requirement ${requirement.id}`);
    requirementIndex.set(requirement.id, requirement);
    check(requirement.eligibility_evaluated === false, `${requirement.id}: eligibility must remain unevaluated`);
    const raw = Array.from(requirement.major_raw);
    for (const clause of requirement.clauses) {
      equal(raw.slice(clause.start, clause.end).join(''), clause.text, `${requirement.id}: Unicode clause span`); clauseSpans++;
    }
    for (const mention of requirement.code_mentions) {
      equal(raw.slice(mention.start, mention.end).join(''), mention.code_raw, `${requirement.id}: Unicode code span`); codeSpans++;
      equal(mention.code_raw.toUpperCase(), mention.code, `${requirement.id}: full case-folded token`);
      verifyRefs(mention.catalog_candidate_ids, `${requirement.id} code`);
    }
    verifyRefs(requirement.catalog_candidate_ids, `${requirement.id} combined references`);
    for (const term of requirement.name_references) verifyRefs(term.catalog_candidate_ids, `${requirement.id} name`);
    // Scan the complete source string independently of the stored clause parser.
    const tokens = new Set([...requirement.major_raw.matchAll(/(?<![A-Za-z0-9])([0-9]{4,7}[A-Za-z0-9]*)(?![A-Za-z0-9])/g)].map(m => m[1].toUpperCase()));
    sameSet(tokens, requirement.explicit_code_tokens, `${requirement.id}: independent literal tokens`);
    sameSet(tokens, requirement.code_mentions.map(m => m.code), `${requirement.id}: parsed token mentions`);
    equal(requirement.positions, requirement.position_ids.length, `${requirement.id}: position count`);
    let hires = 0;
    for (const id of requirement.position_ids) {
      check(!positionIds.has(id), `${id}: duplicate requirement membership`); positionIds.add(id); rowLinks++;
      const row = positions.getPosition(id);
      check(Boolean(row), `${id}: missing position`);
      equal(row.raw['专业'], requirement.major_raw, `${id}: professional source text`);
      equal(row.raw['学历'], requirement.education_raw, `${id}: education source text`);
      equal(majors.getRequirement(id)?.id, requirement.id, `${id}: requirement lookup`);
      hires += Number(row.raw['招考人数']);
      for (const token of tokens) {
        if (!independentlyFoundCodes.has(token)) independentlyFoundCodes.set(token, new Set());
        independentlyFoundCodes.get(token).add(id);
      }
    }
    equal(hires, requirement.hires, `${requirement.id}: hires from full positions`);
    for (const token of tokens) {
      if (!independentCodeRequirements.has(token)) independentCodeRequirements.set(token, new Set());
      independentCodeRequirements.get(token).add(requirement.id);
    }
  }
  sameSet(positionIds, positions.byId.keys(), 'complete position partition');
  const codedIds = new Set();
  for (const code of majors.codeMentions) {
    sameSet(code.position_ids, independentlyFoundCodes.get(code.code) ?? [], `${code.code}: position references`);
    sameSet(code.requirement_ids, independentCodeRequirements.get(code.code) ?? [], `${code.code}: requirement references`);
    equal(code.hires, hiresFor(code.position_ids, positions), `${code.code}: hires`);
    equal(majors.findExplicitCode(code.code.toLowerCase()), code, `${code.code}: lookup`);
    verifyRefs(code.catalog_candidates_without_degree_scope, `${code.code}: unscoped catalog references`);
    for (const id of code.position_ids) codedIds.add(id);
  }
  const countRequirements = predicate => majors.requirements.filter(predicate).reduce((n, r) => n + r.positions, 0);
  const majorSummary = {
    positions: positionIds.size, hires: sum(majors.requirements, 'hires'),
    distinct_major_raw_strings: new Set(majors.requirements.map(r => r.major_raw)).size,
    requirement_groups: majors.requirements.length, distinct_case_folded_literal_code_tokens: majors.codeMentions.length,
    positions_with_explicit_code_tokens: codedIds.size, hires_with_explicit_code_tokens: hiresFor([...codedIds], positions),
    positions_without_explicit_code_tokens: positionIds.size - codedIds.size,
    positions_with_at_least_one_catalog_reference_candidate: countRequirements(r => r.catalog_candidate_ids.length > 0),
    positions_without_catalog_reference_candidate: countRequirements(r => r.catalog_candidate_ids.length === 0),
    positions_with_review_reasons: countRequirements(r => r.review_reasons.length > 0),
    positions_globally_unrestricted_in_major_column: countRequirements(r => r.global_unrestricted_explicit),
    hires_globally_unrestricted_in_major_column: sum(majors.requirements.filter(r => r.global_unrestricted_explicit), 'hires'),
  };
  for (const [key, value] of Object.entries(majorSummary)) equal(value, majors.manifest.summary[key], `manifest summary ${key}`);
  equal([majorSummary.positions_with_at_least_one_catalog_reference_candidate, majorSummary.positions_without_catalog_reference_candidate, majorSummary.positions_with_review_reasons, majorSummary.positions_globally_unrestricted_in_major_column], [18176, 1250, 5835, 8], 'current candidate/review counts');
  equal([codedIds.size, majorSummary.hires_with_explicit_code_tokens], [3357, 4599], 'coded positions and hires');

  section = 'real_expression_regressions';
  const regressions = [];
  const scoped = requirementIndex.get('req:ec283f564fee915f');
  for (const code of ['0712', '0809']) sameSet(scoped.code_mentions.filter(m => m.code === code).flatMap(m => m.catalog_candidate_ids), [`moe-bachelor:2026:${code}`], `explicit bachelor scope ${code}`);
  regressions.push('degree_scoped_0712_and_0809_are_bachelor_only');
  const graduate = requirementIndex.get('req:cdaef8854ebb25aa');
  sameSet(graduate.code_mentions.filter(m => m.code === '0812').flatMap(m => m.catalog_candidate_ids), ['moe-graduate:2022:0812'], 'explicit graduate 0812');
  check(!graduate.catalog_candidate_ids.includes('moe-bachelor:2026:0812'), 'graduate clause must not attach bachelor 0812');
  regressions.push('graduate_application_clause_0812_is_not_bachelor');
  check(requirementIndex.get('req:eb1057cabab72ce7').global_unrestricted_explicit, 'full-field unrestricted expression');
  regressions.push('full_field_unrestricted_is_global');
  sameSet(requirementIndex.get('req:4ef5d151e42cd139').catalog_candidate_ids, ['02', '03', '04', '07', '08'].map(c => `moe-graduate:2022:${c}`), 'MOE discipline gates');
  regressions.push('explicit_discipline_gates_do_not_expand_to_homonymous_disciplines');
  const qualified = requirementIndex.get('req:4549651b7a31aa92');
  check(qualified.catalog_candidate_ids.includes('moe-graduate:2022:0301') && !qualified.catalog_candidate_ids.includes('moe-graduate:2022:03'), '0301 law must not add the 03 gate');
  check(qualified.review_reasons.includes('parenthetical_scope_requires_review'), 'accounting/auditing parenthetical scope');
  check(qualified.code_mentions.filter(m => m.code === '1202').every(m => m.condition_requires_review), 'parenthetical condition reaches code evidence');
  regressions.push('coded_law_preserves_specificity_and_parenthetical_scope_is_reviewed');
  for (const [id, name] of [['req:71fff4ad4120cf69', 'sign_language_exclusion'], ['req:a85029ac23cccb0d', 'marine_surveying_exclusion']]) {
    check(requirementIndex.get(id).review_reasons.includes('negative_condition_present'), name); regressions.push(name);
  }
  const local = majors.getRequirement('2027:132106:300147196001');
  check(!local.global_unrestricted_explicit && local.clauses.some(c => c.local_unrestricted), 'bachelor-only unrestricted clause');
  regressions.push('local_bachelor_unrestricted_is_not_global');
  const law = majors.findExplicitCode('030101K');
  equal([law.positions, law.hires], [329, 399], 'complete law token count');

  section = 'position_conditions';
  equal(conditions.totals, expectedTotals, 'conditions national totals');
  equal(Object.keys(conditions.by_raw_condition).length, 11, 'condition dimensions');
  let conditionCells = 0, jointCells = 0, signalExamples = 0;
  for (const [field, cells] of Object.entries(conditions.by_raw_condition)) {
    compareGroups(cells, c => [c.raw_value], group(positions.positions, [p => p.raw[field]]), field);
    equal(totals(cells), expectedTotals, `${field}: additive totals`); conditionCells += cells.length;
  }
  equal(conditions.joint_distributions.length, 5, 'joint distributions');
  for (const grid of conditions.joint_distributions) {
    compareGroups(grid.cells, c => c.values, group(positions.positions, grid.dimensions.map(field => p => p.raw[field])), grid.dimensions.join(' × '));
    equal(totals(grid.cells), expectedTotals, 'joint distribution totals'); jointCells += grid.cells.length;
  }
  for (const signal of conditions.remarks_text_signals) {
    const regex = new RegExp(signal.regex, 'i');
    const matching = positions.positions.filter(p => regex.test(p.raw[signal.source_field]));
    equal([matching.length, matching.reduce((n, p) => n + Number(p.raw['招考人数']), 0)], [signal.positions, signal.hires], `remarks signal ${signal.label}`);
    check(signal.semantics === 'literal_text_signal_not_complete_eligibility_condition', 'remarks signals remain textual signals');
    for (const example of signal.examples) {
      const row = positions.getPosition(example.position_id); check(Boolean(row), 'remarks example position');
      const text = row.raw[signal.source_field], raw = Array.from(text), match = regex.exec(text);
      check(Boolean(match), 'remarks example pattern exists');
      const start = Array.from(text.slice(0, match.index)).length;
      equal([example.start, example.end], [start, start + Array.from(match[0]).length], 'remarks code-point span');
      equal(example.evidence, raw.slice(Math.max(0, example.start - 18), Math.min(raw.length, example.end + 65)).join(''), 'remarks evidence text'); signalExamples++;
    }
  }

  section = 'position_histories';
  const historicalSources = new Set(histories.sources.map(s => s.id));
  const dimensionKeys = ['by_province', 'by_department', 'by_education_raw', 'by_org_level', 'by_exam_category'];
  equal(histories.years.map(y => y.year), [2024, 2025, 2026, 2027], 'history years');
  const expectedYearTotals = {2024: [18948, 39561], 2025: [20810, 39721], 2026: [20714, 38119], 2027: [19426, 35691]};
  let historicalGroups = 0;
  for (const year of histories.years) {
    check(historicalSources.has(year.field_source) && historicalSources.has(year.province_annotation_source), `${year.year}: valid source references`);
    equal([year.totals.positions, year.totals.hires], expectedYearTotals[year.year], `${year.year}: snapshot totals`);
    for (const key of dimensionKeys) {
      equal(totals(year[key]), year.totals, `${year.year} ${key}: additive totals`);
      historicalGroups += year[key].length;
    }
    equal(year.by_province.length, 31, `${year.year}: province annotation groups`);
  }
  const y2027 = histories.years.find(y => y.year === 2027);
  for (const [key, storedKeys, getters] of [
    ['by_province', ['source_csv_province'], [p => p.annotations.source_csv_province]],
    ['by_department', ['department_code', 'department_name'], [p => p.raw['部门代码'], p => p.raw['部门名称']]],
    ['by_education_raw', ['education_raw'], [p => p.raw['学历']]],
    ['by_org_level', ['org_level_raw'], [p => p.raw['机构层级']]],
    ['by_exam_category', ['exam_category_raw'], [p => p.raw['考试类别']]],
  ]) compareGroups(y2027[key], row => storedKeys.map(key => row[key]), group(positions.positions, getters), `2027 historical ${key}`);

  section = 'recorded_official_row_audit';
  const sourceVerification = positions.manifest.recorded_source_verification;
  const declaredReport = path.resolve(project, 'data/positions_2027', sourceVerification.audit_report_path);
  equal(declaredReport, path.resolve(project, 'research/OFFICIAL_ROW_CROSSCHECK_20261017.json'), 'official report path');
  equal(fingerprints['research/OFFICIAL_ROW_CROSSCHECK_20261017.json'].sha256, sourceVerification.audit_report_sha256, 'official report SHA-256');
  const auditedIds = new Set();
  let officialHires = 0, officialCells = 0, contentDifferences = 0;
  const comparedFiles = officialRows.files.filter(f => f.status === 'cell_comparison_completed');
  equal(comparedFiles.length, 30, 'current cell-compared attachment count');
  for (const file of comparedFiles) {
    equal(file.row_audits.length, file.positions, `${file.id}: audited rows`);
    equal(sum(file.row_audits, 'hires'), file.hires, `${file.id}: audited hires`);
    equal(sum(file.row_audits, 'compared_fields'), file.statistics.compared_cells, `${file.id}: compared cells`);
    equal(file.text_differences.length, 0, `${file.id}: text differences`);
    equal(file.official_only_positions.length + file.national_only_positions_within_observed_department_codes.length + file.anomalies.length, 0, `${file.id}: missing positions or anomalies`);
    contentDifferences += file.statistics.content_difference_cells;
    for (const row of file.row_audits) {
      const id = `2027:${row.position_id}`, current = positions.getPosition(id);
      check(current && !auditedIds.has(id), `${file.id}: current unique position ${id}`); auditedIds.add(id);
      equal([current.source_sheet, current.source_row, Number(current.raw['招考人数'])], [row.national_sheet, row.national_row, row.hires], `${id}: stored audit locator`);
      check(row.status === 'all_compared_text_equal', `${id}: source-comparison status`);
      officialHires += row.hires; officialCells += row.compared_fields;
    }
  }
  equal([auditedIds.size, officialHires, officialCells], [581, 1101, 15665], 'current official comparison scope');
  for (const prior of officialRows.prior_verifications) {
    equal(prior.position_ids_in_current_master_department.length, prior.positions, `${prior.id}: prior position scope`);
    const ids = prior.position_ids_in_current_master_department.map(id => `2027:${id}`);
    for (const id of ids) { check(positions.byId.has(id) && !auditedIds.has(id), `${prior.id}: nonoverlapping current ID ${id}`); auditedIds.add(id); }
    equal(hiresFor(ids, positions), prior.hires, `${prior.id}: prior hires scope`);
    officialHires += prior.hires; officialCells += prior.compared_cells; contentDifferences += prior.content_difference_cells;
  }
  equal([auditedIds.size, officialHires, officialCells, contentDifferences], [805, 1501, 21713, 0], 'combined official comparison scope');
  const combined = sourceVerification.mirror_vs_official_subsets_combined;
  equal([combined.positions, combined.hires, combined.compared_cells, combined.content_difference_cells], [805, 1501, 21713, 0], 'manifest official scope');
  equal([officialRows.summary.combined_nonoverlapping_positions_cell_compared, officialRows.summary.combined_nonoverlapping_hires_cell_compared, officialRows.summary.combined_nonoverlapping_compared_cells], [805, 1501, 21713], 'official report summary');
  const pdfOnly = officialRows.files.filter(f => f.status === 'scope_only_not_cell_verified');
  equal([sum(pdfOnly, 'positions'), sum(pdfOnly, 'hires')], [23, 102], 'PDF scope-only totals');
  check(!combined.pdf_scope_only_positions_included, 'PDF-only scope excluded from cell verification');

  section = 'official_historical_evidence';
  const sourceIds = new Set(officialHistory.sources.map(source => source.id));
  equal(sourceIds.size, officialHistory.sources.length, 'unique official historical source IDs');
  equal(sourceIds.size, 22, 'official historical source count');
  for (const source of officialHistory.sources) check(/^https?:\/\//.test(source.url), `${source.id}: source URL`);
  let sourceReferenceCount = 0;
  function walkReferences(value, location = '$') {
    if (Array.isArray(value)) { value.forEach((v, i) => walkReferences(v, `${location}[${i}]`)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'source_id' || key === 'source_ids') {
        for (const id of (Array.isArray(child) ? child : [child])) {
          check(sourceIds.has(id), `${location}.${key}: missing source ${id}`); sourceReferenceCount++;
        }
      } else walkReferences(child, `${location}.${key}`);
    }
  }
  walkReferences(officialHistory);
  equal(officialHistory.exam_years.map(y => y.exam_year), [2024, 2025, 2026], 'official historical exam years');
  for (const year of officialHistory.exam_years) {
    check(year.national_policy_passline.does_not_guarantee_interview === true, `${year.exam_year}: national passline boundary`);
    check(year.national_policy_passline.categories.every(c => c.score_condition === 'both_minima_must_be_met'), `${year.exam_year}: public total and aptitude conjunction`);
  }
  equal(officialHistory.exam_years.find(y => y.exam_year === 2026).attendance.confirmed_applicants.value, null, '2026 confirmation count remains unknown');
  const linkedAudit = officialHistory.official_row_verification_summary_2027;
  equal([linkedAudit.positions, linkedAudit.planned_seats, linkedAudit.compared_cells, linkedAudit.content_difference_cells], [805, 1501, 21713, 0], 'historical evidence official audit index');

  section = 'interview_cutoffs_2026';
  equal([cutoffs.records.length, cutoffs.manifest.source_list_rows, cutoffs.statistics.official_audit_positions, cutoffs.validation.csv_position_ids_not_listed.length], [20227, 113377, 35, 487], 'cutoff batch scope');
  equal(cutoffs.manifest.shards.length, 18, 'cutoff shard count');
  equal(cutoffs.statistics.positions_with_unique_published_cutoff, 20227, 'unique source cutoff values');
  equal([cutoffs.statistics.positions_with_conflicting_published_cutoffs, cutoffs.statistics.positions_without_published_cutoff, cutoffs.statistics.unmatched_to_position_csv], [0, 0, 0], 'cutoff conflict/missing/join failures');
  equal(new Set(cutoffs.validation.csv_position_ids_not_listed).size, 487, 'unique absent 2026 job IDs');
  equal(cutoffs.records.length + cutoffs.validation.csv_position_ids_not_listed.length, histories.years.find(y => y.year === 2026).totals.positions, '2026 cutoff presence partition versus 2026 position total');
  for (const row of cutoffs.officialAuditComparison.records) {
    const initial = cutoffs.getCutoff(row.position_id);
    check(Boolean(initial), `${row.position_id}: official comparison lookup`);
    check(row.national_initial_comparison === 'same_published_cutoff', `${row.position_id}: official cutoff comparison`);
    equal(row.published_cutoff_values, initial.published_cutoff_values, `${row.position_id}: official versus initial published score`);
  }
  const linkedCutoffs = officialHistory.post_specific_interview_cutoffs;
  equal([linkedCutoffs.positions, linkedCutoffs.source_list_rows, linkedCutoffs.position_csv_jobs_absent_from_initial_list, linkedCutoffs.official_audit_same_published_cutoff_positions], [20227, 113377, 487, 35], 'historical evidence cutoff index');
  check(!cutoffs.manifest.score_definition.is_national_policy_passline && !cutoffs.manifest.score_definition.is_actual_interview_test_score, 'cutoff score semantics');

  const hashVerifiedFiles = positions.manifest.shards.length + majors.manifest.requirements.length + majors.manifest.code_mentions.length + cutoffs.manifest.shards.length + cutoffs.manifest.supporting_files.length;
  return {
    schema_version: '2.0.0', status: 'PASS', started_at_utc: startedAt, generated_at_utc: new Date().toISOString(),
    verification_script: 'scripts/verify_position_data.mjs', network_used: false, original_excel_or_pdf_files_required: false,
    execution_scope: 'Read current repository JSON, invoke its three loaders, recompute relations and statistics, and verify the stored official audit report hash and scope. No source workbook/PDF comparison or live web verification is rerun.',
    checks: {
      explicit_assertions: Object.values(assertionCounts).reduce((a, b) => a + b, 0), assertions_by_section: assertionCounts,
      loader_count: 3, loader_internal_assertions_in_explicit_count: false,
      loader_sha256_and_byte_verified_files: hashVerifiedFiles, additional_official_report_sha256_verified_files: 1,
      position_shards: 23, original_fields_per_position: 27, position_rows: 19426,
      major_requirement_shards: 13, requirement_groups: 4090, professional_and_education_row_links: rowLinks,
      independent_complete_tokens: 734, unicode_code_point_code_spans: codeSpans, unicode_code_point_clause_spans: clauseSpans,
      catalog_nodes: nodeIndex.size, catalog_references_checked: referencesChecked, tax_membership_edges: 849,
      real_expression_regressions: regressions,
      raw_condition_dimensions_recomputed: 11, raw_condition_cells_recomputed: conditionCells,
      joint_distributions_recomputed: 5, joint_cells_recomputed: jointCells,
      remarks_text_signal_patterns_recomputed: conditions.remarks_text_signals.length, remarks_examples_verified: signalExamples,
      historical_years: 4, historical_dimension_totals_checked: 20, historical_group_rows: historicalGroups, historical_2027_dimensions_recomputed: 5,
      official_historical_source_entries: sourceIds.size, official_historical_source_references_resolved: sourceReferenceCount,
      interview_cutoff_shards: 18, interview_cutoff_positions: 20227, source_list_rows: 113377, official_cutoff_comparisons: 35,
    },
    position_totals: expectedTotals, major_summary: majorSummary, law_literal_030101K: {positions: law.positions, hires: law.hires},
    historical_totals: histories.years.map(y => ({year: y.year, ...y.totals})),
    recorded_official_row_verification: {
      positions: auditedIds.size, hires: officialHires, compared_cells: officialCells, content_difference_cells: contentDifferences,
      report: 'research/OFFICIAL_ROW_CROSSCHECK_20261017.json', report_sha256: sourceVerification.audit_report_sha256,
      report_generated_at_utc: officialRows.generated_at_utc,
      current_report_positions: 581, imported_prior_shanghai_positions: 224, pdf_scope_only_excluded: {positions: 23, hires: 102},
      original_official_files_reopened_by_this_run: false,
    },
    interview_cutoff_summary: {
      year: 2026, batch_id: cutoffs.manifest.batch.id, positions: 20227, source_list_rows: 113377,
      unique_published_cutoffs: 20227, missing_cutoffs: 0, conflicting_cutoffs: 0,
      matched_to_2026_position_csv: 20227, position_csv_jobs_absent_from_this_initial_batch: 487,
      official_audit_comparisons_with_equal_published_cutoff: 35,
      original_source_workbooks_reopened_by_this_run: false,
    },
    source_authentication_boundaries: [
      '2027 national positions come from a public workbook mirror, with recorded all-field consistency against an upstream conversion. Direct official attachment cell verification covers 805 jobs, not all 19,426.',
      'This run verifies the stored official cross-check report hash, row IDs, locators, hires and scope totals. The 21,713 original-cell comparisons were performed in the recorded source audit, not rerun here.',
      'Official catalogs are parsed official-source text. Catalog JSON references and identities are checked here; original catalog PDF binary checksums were not verified in the catalog extraction.',
      '2024–2026 position history uses third-party CSV source fields. This run verifies all marginal sums; only 2027 history is recomputed from the full bundled position table.',
      'Official historical exam statistics retain 22 source entries and their precision, missing-value and metric definitions. Resolving references is not fresh verification of remote articles.',
      '2026 interview cutoffs come from a national initial-list mirror. A later Audit Office attachment agrees on the 35 compared jobs; this does not certify the entire nationwide mirror or equate release batches.',
    ],
    interpretation_limits: [
      'A catalog candidate is a source-text reference, not a fully interpreted professional requirement or applicant eligibility result. There are 1,250 jobs with no catalog candidate and 5,835 with requirement-level review reasons.',
      'Use requirement.review_reasons for the whole expression. A false local condition_requires_review does not remove other degree-clause or expression-level review reasons.',
      'Literal code counts include negative or qualified contexts. Jobs may reference multiple codes; these counts are not additive to national totals.',
      'Graduate secondary/self-defined codes, agency-specific categories, degree equivalence and complex restrictions remain unresolved where flagged.',
      'Remarks regex matches are textual signals, not complete qualifications. Province and system annotations retain their third-party status.',
      'Per-job published interview-admission cutoffs are separate from national policy passlines and from actual interview test scores; score formulas may differ across jobs.',
      'A job absent from the 2026 initial interview list is not assigned zero, inferred to have no applicants, or assumed to be absent from subsequent batches. No 2027 per-job interview cutoff is fabricated.',
    ],
    input_json_fingerprints: fingerprints,
  };
}

try {
  const report = await verify();
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (args.includes('--write-report')) await writeFile(path.resolve(project, reportRelativePath), text);
  process.stdout.write(text);
} catch (error) {
  const report = {schema_version: '2.0.0', status: 'FAIL', started_at_utc: startedAt, generated_at_utc: new Date().toISOString(), verification_script: 'scripts/verify_position_data.mjs', failed_section: section, error: error.message, assertions_by_section: assertionCounts};
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (args.includes('--write-report')) await writeFile(path.resolve(project, reportRelativePath), text);
  process.stderr.write(text);
  process.exitCode = 1;
}
