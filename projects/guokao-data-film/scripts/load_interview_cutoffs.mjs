import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const defaultDirectory = fileURLToPath(new URL('../data/interview_cutoffs_2026/', import.meta.url));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (condition, message) => { if (!condition) throw new Error(message); };

/** Expand a compact source row without changing the published score or field names. */
export function expandInterviewCutoffRow(columns, row) {
  check(Array.isArray(row) && row.length === columns.length, 'Interview-cutoff row/column width mismatch');
  return Object.fromEntries(columns.map((column, index) => [column, row[index]]));
}

/**
 * Load one published interview-cutoff batch, with hashes, totals and keys checked.
 *
 * const {manifest, records, getCutoff} = await loadInterviewCutoffs();
 * const record = getCutoff('2026:002000:100110001001');
 * console.log(record['最低面试分数'], record.batch_id, record.source_cutoff_field);
 *
 * getCutoff returns the complete record, or null when this batch has no record.
 * Absence is not a zero score or evidence that nobody applied. These are source-
 * published admission thresholds, not national policy passlines or scores earned
 * in an interview. Different posts may use different written-score formulas.
 * Fields prefixed source_csv_ and source_system_tag retain third-party annotations.
 */
export async function loadInterviewCutoffs(directory = defaultDirectory) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  check(manifest.schema_version === '1.0.0', 'Unsupported interview-cutoff schema');
  check(Array.isArray(manifest.columns) && new Set(manifest.columns).size === manifest.columns.length, 'Invalid interview-cutoff columns');
  for (const column of ['id', 'year', 'batch_id', '部门代码', '职位代码', '最低面试分数', 'published_cutoff_values']) {
    check(manifest.columns.includes(column), `Missing interview-cutoff column ${column}`);
  }
  check(Array.isArray(manifest.shards) && Array.isArray(manifest.supporting_files), 'Missing interview-cutoff file descriptors');
  const descriptors = [...manifest.shards, ...manifest.supporting_files];
  check(new Set(descriptors.map(descriptor => descriptor.path)).size === descriptors.length, 'Duplicate interview-cutoff file descriptor');
  const readVerified = async descriptor => {
    check(typeof descriptor.path === 'string' && path.basename(descriptor.path) === descriptor.path, 'Invalid interview-cutoff file path');
    const data = await readFile(path.join(directory, descriptor.path));
    check(data.length === descriptor.bytes, `${descriptor.path}: byte-length mismatch`);
    check(createHash('sha256').update(data).digest('hex') === descriptor.sha256, `${descriptor.path}: SHA-256 mismatch`);
    const value = JSON.parse(data.toString('utf8'));
    check(value.schema_version === manifest.schema_version, `${descriptor.path}: schema mismatch`);
    if (value.dataset_id !== undefined) check(value.dataset_id === manifest.dataset_id, `${descriptor.path}: dataset mismatch`);
    return value;
  };
  const [loadedShards, loadedSupporting] = await Promise.all([
    Promise.all(manifest.shards.map(async (descriptor, index) => {
      check(descriptor.bytes <= manifest.shard_limit_bytes, `${descriptor.path}: shard exceeds declared size limit`);
      const shard = await readVerified(descriptor);
      check(shard.dataset_id === manifest.dataset_id && shard.shard_index === index + 1, `${descriptor.path}: shard identity mismatch`);
      check(same(shard.columns, manifest.columns), `${descriptor.path}: column schema mismatch`);
      check(shard.rows.length === descriptor.positions, `${descriptor.path}: position-count mismatch`);
      const records = shard.rows.map(row => expandInterviewCutoffRow(shard.columns, row));
      check(records[0]?.id === descriptor.first_id && records.at(-1)?.id === descriptor.last_id, `${descriptor.path}: record-order mismatch`);
      return records;
    })),
    Promise.all(manifest.supporting_files.map(async descriptor => [descriptor.path, await readVerified(descriptor)])),
  ]);
  const records = loadedShards.flat();
  const byId = new Map();
  const sourceIds = new Set(manifest.sources.map(source => source.id));
  for (const record of records) {
    check(record.year === manifest.year && record.batch_id === manifest.batch.id, `${record.id}: year/batch mismatch`);
    check(/^[0-9]{6}$/.test(record['部门代码']) && /^[0-9]{12}$/.test(record['职位代码']), `${record.id}: code width mismatch`);
    check(record.id === `${record.year}:${record['部门代码']}:${record['职位代码']}`, `${record.id}: composite-key mismatch`);
    check(!byId.has(record.id), `Duplicate interview-cutoff position ID ${record.id}`);
    check(sourceIds.has(record.source_id), `${record.id}: unknown source`);
    check(Number.isInteger(record.source_first_row) && record.source_first_row >= 2 && Number.isInteger(record.source_last_row) && record.source_last_row >= record.source_first_row, `${record.id}: invalid source row range`);
    check(Number.isInteger(record.source_list_row_count) && record.source_list_row_count > 0, `${record.id}: invalid source-list row count`);
    const values = record.published_cutoff_values;
    check(Array.isArray(values) && values.every(value => typeof value === 'number' && Number.isFinite(value)) && new Set(values).size === values.length, `${record.id}: invalid published cutoff values`);
    check(record.cutoff_unique_in_source === (values.length === 1), `${record.id}: cutoff uniqueness mismatch`);
    check(record['最低面试分数'] === (values.length === 1 ? values[0] : null), `${record.id}: source cutoff not preserved`);
    check(record.source_cutoff_field === manifest.score_definition.source_field && record.score_unit === manifest.score_definition.unit, `${record.id}: source score label/unit mismatch`);
    byId.set(record.id, record);
  }
  check(records.length === manifest.positions, 'Interview-cutoff national position-count mismatch');
  check(records.reduce((total, record) => total + record.source_list_row_count, 0) === manifest.source_list_rows, 'Interview-cutoff source-list row-count mismatch');
  const supportingFiles = Object.fromEntries(loadedSupporting);
  const statistics = supportingFiles['statistics.json'];
  const validation = supportingFiles['validation.json'];
  const officialAuditComparison = supportingFiles['official-audit-comparison.json'];
  check(statistics && validation && officialAuditComparison, 'Missing required interview-cutoff supporting files');
  check(statistics.initial_list_positions === records.length && statistics.source_list_rows === manifest.source_list_rows, 'Interview-cutoff statistics total mismatch');
  check(statistics.positions_with_unique_published_cutoff === records.filter(record => record.cutoff_unique_in_source).length, 'Interview-cutoff unique-score count mismatch');
  check(statistics.positions_with_conflicting_published_cutoffs === records.filter(record => record.published_cutoff_values.length > 1).length, 'Interview-cutoff conflicting-score count mismatch');
  check(statistics.positions_without_published_cutoff === records.filter(record => record.published_cutoff_values.length === 0).length, 'Interview-cutoff missing-score count mismatch');
  check(statistics.matched_to_position_csv === records.filter(record => record.position_csv_match === 'matched_composite_key').length, 'Interview-cutoff CSV join-count mismatch');
  check(validation.csv_position_ids_not_listed.length === statistics.position_csv_jobs_absent_from_initial_list, 'Interview-cutoff absent-position count mismatch');
  check(validation.csv_position_ids_not_listed.every(id => !byId.has(id)), 'An absent position occurs in interview-cutoff records');
  check(officialAuditComparison.records.length === statistics.official_audit_positions, 'Interview-cutoff official comparison-count mismatch');
  check(officialAuditComparison.records.every(record => byId.has(record.position_id)), 'Official comparison references an unknown interview-cutoff position');
  return {
    manifest, records, byId, getCutoff: id => byId.get(id) ?? null,
    statistics, validation, officialAuditComparison, supportingFiles,
  };
}
