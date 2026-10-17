import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const defaultDirectory = fileURLToPath(new URL('../data/positions_2027/', import.meta.url));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (condition, message) => { if (!condition) throw new Error(message); };

/** Expand one compact shard row. The original 27 fields live under raw. */
export function expandPositionRow(columns, row, rawColumns) {
  check(row.length === columns.length, 'Position row/column width mismatch');
  const values = Object.fromEntries(columns.map((column, index) => [column, row[index]]));
  const rawSet = new Set(rawColumns);
  const annotationColumns = ['source_csv_province', 'source_system_tag'];
  const metadata = Object.fromEntries(Object.entries(values).filter(([column]) => !rawSet.has(column) && !annotationColumns.includes(column)));
  const annotations = Object.fromEntries(annotationColumns.map(column => [column, values[column]]));
  const raw = Object.fromEntries(rawColumns.map(column => [column, values[column]]));
  check(rawColumns.every(column => typeof raw[column] === 'string'), 'Original position fields must be strings');
  return {...metadata, raw, annotations};
}

/**
 * Load the complete position table and verify stored hashes and totals.
 *
 * const {positions, byId} = await loadPositions();
 * const p = byId.get('2027:002000:100110001001');
 * console.log(p.raw['专业'], p.raw['学历'], p.source_sheet, p.source_row);
 *
 * Province/system values are third-party annotations; raw['工作地点'] and
 * the other original columns remain available for source-text decisions.
 */
export async function loadPositions(directory = defaultDirectory) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  check(manifest.schema_version === '1.0.0', 'Unsupported position schema');
  check(manifest.raw_columns.length === 27, 'Expected the complete original 27 fields');
  const loaded = await Promise.all(manifest.shards.map(async descriptor => {
    const data = await readFile(path.join(directory, descriptor.path));
    check(data.length === descriptor.bytes && data.length < 900000, `${descriptor.path}: byte-length mismatch`);
    check(createHash('sha256').update(data).digest('hex') === descriptor.sha256, `${descriptor.path}: SHA-256 mismatch`);
    const shard = JSON.parse(data.toString('utf8'));
    check(shard.schema_version === manifest.schema_version && shard.dataset_id === manifest.dataset_id, `${descriptor.path}: dataset mismatch`);
    check(same(shard.columns, manifest.columns), `${descriptor.path}: column schema mismatch`);
    check(shard.rows.length === descriptor.positions, `${descriptor.path}: position-count mismatch`);
    const positions = shard.rows.map(row => expandPositionRow(shard.columns, row, manifest.raw_columns));
    const hires = positions.reduce((total, position) => {
      const value = position.raw['招考人数'];
      check(/^[0-9]+$/.test(value) && Number(value) > 0, `${position.id}: invalid hire count`);
      return total + Number(value);
    }, 0);
    check(hires === descriptor.hires, `${descriptor.path}: hire-count mismatch`);
    check(positions[0]?.id === descriptor.first_id && positions.at(-1)?.id === descriptor.last_id, `${descriptor.path}: position-order mismatch`);
    return positions;
  }));
  const positions = loaded.flat();
  const index = new Map();
  const locations = new Set();
  for (const position of positions) {
    check(position.year === 2027, `${position.id}: year mismatch`);
    check(/^[0-9]{6}$/.test(position.raw['部门代码']), `${position.id}: department-code width mismatch`);
    check(/^[0-9]{12}$/.test(position.raw['职位代码']), `${position.id}: position-code width mismatch`);
    check(position.id === `${position.year}:${position.raw['部门代码']}:${position.raw['职位代码']}`, `${position.id}: composite-key mismatch`);
    check(!index.has(position.id), `Duplicate position ID ${position.id}`);
    const location = JSON.stringify([position.source_sheet, position.source_row]);
    check(Number.isInteger(position.source_row) && position.source_row >= 3 && !locations.has(location), `${position.id}: invalid or duplicate workbook row`);
    locations.add(location);
    index.set(position.id, position);
  }
  check(positions.length === manifest.totals.positions, 'National position-count mismatch');
  check(positions.reduce((total, position) => total + Number(position.raw['招考人数']), 0) === manifest.totals.hires, 'National hire-count mismatch');
  return {manifest, positions, byId: index, getPosition: id => index.get(id) ?? null};
}
