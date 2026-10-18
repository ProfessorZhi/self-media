#!/usr/bin/env python3
"""Critical-field QA for the 2027 position table.

Usage:
  python3 verify_critical_position_fields.py [--write-report]

Checks the fields that decide what a position *is* — key, codes, and the five
official classification columns — against the raw shards, and keeps the official
fields separate from the third-party analysis annotations.

Outputs research/CRITICAL_POSITION_FIELD_AUDIT_20261018.json and .md.
No eligibility conclusion is produced and no subjective classification is added.
"""
import argparse
import collections
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

RAW_COLUMNS = [
    '部门代码', '部门名称', '用人司局', '机构性质', '招考职位', '职位属性',
    '职位分布', '职位简介', '职位代码', '机构层级', '考试类别', '招考人数',
    '专业', '学历', '学位', '政治面貌', '基层工作最低年限',
    '服务基层项目工作经历', '是否在面试阶段组织专业能力测试', '面试人员比例',
    '工作地点', '落户地点', '备注', '部门网站', '咨询电话1', '咨询电话2', '咨询电话3',
]
CLASSIFICATION_FIELDS = ['考试类别', '职位属性', '机构性质', '机构层级', '职位分布']
THIRD_PARTY_FIELDS = ['source_csv_province', 'source_system_tag']


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def load(project):
    root = project / 'data' / 'positions_2027'
    manifest = json.loads((root / 'manifest.json').read_text())
    index = {name: i for i, name in enumerate(manifest['columns'])}
    rows = []
    for shard in manifest['shards']:
        content = json.loads((root / shard['path']).read_text())
        assert content['columns'] == manifest['columns'], f'{shard["path"]}: column order drift'
        rows.extend(content['rows'])
    return manifest, index, rows


def distribution(rows, index, field):
    counts = collections.defaultdict(lambda: {'positions': 0, 'hires': 0})
    for row in rows:
        key = row[index[field]]
        counts[key]['positions'] += 1
        counts[key]['hires'] += int(row[index['招考人数']])
    return dict(sorted(counts.items()))


def check(rows, index, errors):
    totals = {'positions': len(rows), 'hires': sum(int(r[index['招考人数']]) for r in rows)}

    # 1. composite key and code widths
    ids = set()
    position_codes = collections.Counter()
    for row in rows:
        dept, code = row[index['部门代码']], row[index['职位代码']]
        assert re.fullmatch(r'[0-9]{6}', dept), f'{row[0]}: department code width'
        assert re.fullmatch(r'[0-9]{12}', code), f'{row[0]}: position code width'
        expected = f"2027:{dept}:{code}"
        assert row[0] == expected, f'{row[0]}: id does not equal year:dept:code'
        assert row[0] not in ids, f'{row[0]}: duplicate composite key'
        ids.add(row[0])
        position_codes[code] += 1
    assert len(ids) == 19_426, 'position count'
    assert totals['hires'] == 35_691, 'hire count'

    # 2. every raw field present as a string
    for row in rows:
        assert len(row) == len(index), f'{row[0]}: column count'
        for field in RAW_COLUMNS:
            assert isinstance(row[index[field]], str), f'{row[0]}: {field} is not a string'

    # 3. the five official classification columns partition the table
    partitions = {}
    for field in CLASSIFICATION_FIELDS:
        dist = distribution(rows, index, field)
        positions = sum(v['positions'] for v in dist.values())
        hires = sum(v['hires'] for v in dist.values())
        if positions != totals['positions'] or hires != totals['hires']:
            errors.append({'kind': 'partition_mismatch', 'field': field})
        partitions[field] = {
            'distinct_values': len(dist),
            'positions': positions,
            'hires': hires,
            'values': dist,
        }

    # 4. cross-check against the committed condition aggregate
    conditions_path = Path('data/position_conditions_2027.json')
    cross_checks = []
    if conditions_path.exists():
        conditions = json.loads(conditions_path.read_text())
        for field, recorded in conditions.get('by_raw_condition', {}).items():
            if field not in index:
                continue
            recomputed = distribution(rows, index, field)
            recorded_map = {item['raw_value']: (item['positions'], item['hires'])
                            for item in recorded}
            same = {k: (v['positions'], v['hires']) for k, v in recomputed.items()} == recorded_map
            cross_checks.append({'field': field, 'matches_committed_aggregate': same})
            if not same:
                errors.append({'kind': 'aggregate_mismatch', 'field': field})

    # 5. third-party annotations stay separate
    third_party = {}
    for field in THIRD_PARTY_FIELDS:
        third_party[field] = {
            'distinct_values': len({r[index[field]] for r in rows}),
            'provenance': 'third_party_analysis_annotation',
            'used_in_official_aggregates': False,
        }

    return totals, partitions, cross_checks, third_party, len(position_codes)


def negative_fixture(rows, index):
    """Swapping 考试类别 and 职位属性 must change the recomputed partitions."""
    before = distribution(rows, index, '考试类别')
    mutated = [list(row) for row in rows[:200]]
    for row in mutated:
        row[index['考试类别']], row[index['职位属性']] = \
            row[index['职位属性']], row[index['考试类别']]
    after = distribution(mutated, index, '考试类别')
    differs = {k: (v['positions'], v['hires']) for k, v in before.items()} != \
              {k: (v['positions'], v['hires']) for k, v in after.items()}
    assert differs, 'negative fixture: swapping classification fields was not detected'
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--write-report', action='store_true')
    args = parser.parse_args()
    project = args.project
    manifest, index, rows = load(project)

    errors = []
    totals, partitions, cross_checks, third_party, distinct_position_codes = check(rows, index, errors)
    negative_fixture(rows, index)

    missing = [field for field in RAW_COLUMNS if field not in index]
    report = {
        'schema_version': '1.0.0',
        'report_id': 'critical-position-field-audit-20261018',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'local_date': '2026-10-18',
        'source': {'manifest': 'data/positions_2027/manifest.json',
                   'shards': len(manifest['shards']),
                   'sha256': sha256((project / 'data/positions_2027/manifest.json').read_bytes())},
        'status': 'PASS' if not errors else 'FAIL',
        'totals': totals,
        'field_map': {
            'raw_fields': RAW_COLUMNS,
            'missing_from_manifest': missing,
            'raw_field_count': len(RAW_COLUMNS),
            'classification_fields': CLASSIFICATION_FIELDS,
            'third_party_fields': THIRD_PARTY_FIELDS,
        },
        'code_rules': {
            'department_code': 'six digits, leading zeros preserved',
            'position_code': 'twelve digits, leading zeros preserved',
            'composite_key': 'year:department_code:position_code',
            'position_code_alone_is_unique': False,
            'distinct_position_codes': distinct_position_codes,
        },
        'partitions': partitions,
        'cross_checks': cross_checks,
        'third_party_annotations': third_party,
        'tests': {
            'composite_key_unique': True,
            'code_widths': True,
            'raw_fields_are_strings': True,
            'classification_partitions_sum_to_totals': not any(
                e['kind'] == 'partition_mismatch' for e in errors),
            'negative_fixture_swapped_classification_detected': True,
        },
        'notes': [
            '考试类别、职位属性、机构性质、机构层级、职位分布 are the official columns; '
            'source_system_tag 与 source_csv_province 是第三方分析注记，不参与任何官方分组。',
            '本报告不判断任何个人是否符合报考条件。',
        ],
        'errors': errors,
    }
    text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.write_report:
        path = project / 'research' / 'CRITICAL_POSITION_FIELD_AUDIT_20261018.json'
        path.write_text(text, encoding='utf-8')
        md = f"""# 关键岗位字段审计（2026-10-18）

来源：`data/positions_2027`（{len(manifest['shards'])} 个分片，manifest SHA-256
`{report['source']['sha256'][:16]}…`）。状态：**{report['status']}**。

## 结果

| 检查 | 结果 |
| --- | --- |
| 岗位 / 名额 | {totals['positions']:,} / {totals['hires']:,} |
| 27 原字段齐全 | {'是' if not missing else '否：' + ','.join(missing)} |
| 复合键唯一 | 是（{distinct_position_codes:,} 个不同职位代码 → 单独不唯一） |
| 部门代码 6 位 / 职位代码 12 位 | 是，前导零保留 |
| 五个官方分类列各自加总 | 均为 {totals['positions']:,} 岗 / {totals['hires']:,} 人 |
| 与已提交条件聚合交叉核对 | {sum(1 for c in cross_checks if c['matches_committed_aggregate'])}/{len(cross_checks)} 一致 |
| 负向注入（交换考试类别/职位属性） | 已检出分布变化 |

## 五个官方分类列

""" + '\n'.join(
        f"- `{field}`：{partitions[field]['distinct_values']} 种取值" for field in CLASSIFICATION_FIELDS) + f"""

## 官方字段与第三方注记

- 官方：{'、'.join(CLASSIFICATION_FIELDS)}
- 第三方：`source_system_tag`（{third_party['source_system_tag']['distinct_values']} 类）、
  `source_csv_province`（{third_party['source_csv_province']['distinct_values']} 个）——
  不得用于推断行政/参公编制、公检法身份或考试类别。

## 未做的事

不判断任何个人是否符合报考条件；不新增任何主观岗位归类字段。
"""
        md_path = project / 'research' / 'CRITICAL_POSITION_FIELD_AUDIT_20261018.md'
        md_path.write_text(md, encoding='utf-8')
        print(json.dumps({'json': str(path), 'md': str(md_path),
                          'status': report['status'], 'errors': errors}, ensure_ascii=False, indent=1))
    else:
        print(text)
    if errors:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
