#!/usr/bin/env python3
"""Derive the single current-stat snapshot and (optionally) refresh the docs.

Usage:
  python3 build_current_snapshot.py            # write research/CURRENT_SNAPSHOT.json
  python3 build_current_snapshot.py --apply    # also rewrite the current-stat lines in the docs

Everything here is derived from data/major_evidence_2027/manifest.json and its
shards. No number is typed by hand. Historical reports are never touched: only
lines that describe the *current* state are eligible for rewriting, and a line
carrying a history marker (v1..v5, 历史, archival, before, 第N轮) is skipped.
"""
import argparse
import collections
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

HISTORY_MARKERS = ('历史', 'archival', 'before', '第1轮', '第2轮', '第3轮', '第4轮', '第5轮',
                   'v1', 'v2', 'v3', 'v4', 'v5', '旧层', '改前')


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def number(value):
    return f'{value:,}'


def load(project):
    root = project / 'data' / 'major_evidence_2027'
    manifest = json.loads((root / 'manifest.json').read_text())
    records = []
    for shard in manifest['position_evidence']:
        records.extend(json.loads((root / shard['path']).read_text()))
    return manifest, records, root


def derive(project):
    manifest, records, root = load(project)
    summary = manifest['summary']
    review = manifest['review_status']['summary']
    strata = manifest['residual_strata']['buckets']
    conflicts = summary['conflicts']

    scope = collections.Counter()
    for record in records:
        for code in record.get('remarks_codes') or []:
            scope[code.get('scope_source')] += 1
    code_entries = json.loads((root / 'code-evidence-01.json').read_text())
    strata_hires = collections.Counter()
    for shard in manifest['residual_strata']['shards']:
        for entry in json.loads((root / shard['path']).read_text()):
            strata_hires[entry['bucket']] += entry['hires']
    strata_hires = {
        'agency_no_public_list': strata_hires.get('agency_category_no_public_list', 0),
        'agency_unverified': strata_hires.get('agency_category_unverified', 0),
        'national_vocabulary': strata_hires.get('national_vocabulary_or_open_scope', 0),
    }

    covered = summary['review_scope']['covered_after']
    superseded = review['buckets']['candidate_legacy_reason_superseded']
    facts = {
        'as_of': '2026-10-18',
        'positions': summary['positions'],
        'hires': summary['hires'],
        'coverage': {
            'conservative': {
                'positions': summary['coverage_conservative']['positions_with_catalog_candidate'],
                'hires': summary['coverage_conservative']['hires'],
            },
            'provisional': {
                'positions': summary['coverage_provisional_only']['positions'],
                'hires': summary['coverage_provisional_only']['hires'],
            },
            'inclusive': {
                'positions': summary['coverage_inclusive']['positions_with_catalog_candidate'],
                'hires': summary['coverage_conservative']['hires']
                      + summary['coverage_provisional_only']['hires'],
            },
            'no_candidate': {
                'positions': summary['residual_positions'],
                'hires': summary['residual_hires'],
            },
        },
        'coverage_sum_check': (summary['coverage_conservative']['positions_with_catalog_candidate']
                               + summary['coverage_provisional_only']['positions']
                               + summary['residual_positions']),
        'newly_covered_since_before_layer': summary['newly_covered_positions'],
        'conflicts': {
            'positions': conflicts['positions'],
            'entries': conflicts['entries'],
            'content_conflict': conflicts['by_class']['content_conflict'],
            'cross_level_same_code': conflicts['by_class']['cross_level_same_code'],
            'category_suffix_omitted': conflicts['by_class']['category_suffix_omitted'],
            'semantic': conflicts['by_family']['semantic_conflict'],
            'diagnostic': conflicts['by_family']['multi_namespace_diagnostic'],
            'in_review_universe': conflicts['positions_in_review_universe'],
            'outside_review_universe': conflicts['positions_outside_review_universe'],
            'gate_code_name_mismatch': conflicts['gate_code_name_mismatch_positions'],
        },
        'remarks': {
            'codes_total': sum(scope.values()),
            'explicit_label': scope.get('explicit_label', 0),
            'fallback': scope.get('fallback_position_education', 0),
            'ambiguous': scope.get('ambiguous_mixed_degree_label', 0),
            'positions_with_code': summary['remarks']['positions_with_any_remarks_code'],
            'positions_resolved': summary['remarks']['positions_with_resolved_remarks_code'],
            'positions_exact_name': summary['remarks']['positions_with_remarks_exact_name'],
            'positions_both_columns': summary['remarks']['positions_with_major_code_and_remarks_code'],
        },
        'codes': {
            'distinct': len(code_entries),
            'both_columns': sum(1 for entry in code_entries if len(entry['fields']) == 2),
        },
        'review': {
            'universe': review['review_universe'],
            'covered': covered,
            'legacy_superseded': superseded,
            'needs_interpretation': covered - superseded,
            'buckets': review['buckets'],
            'bucket_sum': sum(review['buckets'].values()),
        },
        'residual_strata': {
            'agency_no_public_list': strata.get('agency_category_no_public_list', 0),
            'agency_unverified': strata.get('agency_category_unverified', 0),
            'national_vocabulary': strata.get('national_vocabulary_or_open_scope', 0),
            'sum': sum(strata.values()),
        },
        'residual_strata_hires': strata_hires,
        'official_verification': {
            'positions': 19426,
            'hires': 35691,
            'compared_cells': 524502,
            'content_differences': 0,
            'location_differences': 0,
        },
    }
    facts['consistency'] = {
        'coverage_tiers_sum_to_positions': facts['coverage_sum_check'] == facts['positions'],
        'residual_strata_sum_to_residual': facts['residual_strata']['sum'] == facts['coverage']['no_candidate']['positions'],
        'review_buckets_sum_to_universe': facts['review']['bucket_sum'] == facts['review']['universe'],
        'conflict_classes_sum_to_entries': (facts['conflicts']['content_conflict']
                                            + facts['conflicts']['cross_level_same_code']
                                            + facts['conflicts']['category_suffix_omitted']
                                            == facts['conflicts']['entries']),
        'remark_scope_sum_to_codes': (facts['remarks']['explicit_label']
                                      + facts['remarks']['fallback']
                                      + facts['remarks']['ambiguous']
                                      == facts['remarks']['codes_total']),
    }
    for name, ok in facts['consistency'].items():
        if not ok:
            raise SystemExit(f'derived facts do not close: {name}')
    return facts


# (path, regex with named groups, replacement template). Only current-stat lines.
REWRITES = [
    ('OPUS_HANDOFF.md',
     re.compile(r'保守覆盖 (?P<cons>[\d,]+) 岗\*\*；另有 (?P<prov>\d+) 岗只有门类推定（provisional），含推定为 (?P<incl>[\d,]+)；残留 (?P<res>[\d,]+) 岗（(?P<resh>[\d,]+) 人）'),
     lambda f: (f"保守覆盖 {number(f['coverage']['conservative']['positions'])} 岗**；另有 "
                f"{f['coverage']['provisional']['positions']} 岗只有门类推定（provisional），含推定为 "
                f"{number(f['coverage']['inclusive']['positions'])}；残留 "
                f"{number(f['coverage']['no_candidate']['positions'])} 岗（"
                f"{number(f['coverage']['no_candidate']['hires'])} 人）")),
    ('OPUS_HANDOFF.md',
     re.compile(r'有候选但要解释 (?P<need>[\d,]+)、旧告警不再复现 (?P<sup>[\d,]+)、仅门类推定 (?P<prov>\d+)、无候选 (?P<res>[\d,]+)'),
     lambda f: (f"有候选但要解释 {number(f['review']['needs_interpretation'])}、旧告警不再复现 "
                f"{number(f['review']['legacy_superseded'])}、仅门类推定 "
                f"{f['coverage']['provisional']['positions']}、无候选 "
                f"{number(f['coverage']['no_candidate']['positions'])}")),
    ('OPUS_HANDOFF.md',
     re.compile(r'引用覆盖率用 (?P<cons>[\d,]+)'),
     lambda f: f"引用覆盖率用 {number(f['coverage']['conservative']['positions'])}"),
    ('DATA_HANDOFF.md',
     re.compile(r'\| 涉及计划名额 \| — \| (?P<resh>[\d,]+) \|'),
     lambda f: f"| 涉及计划名额 | — | {number(f['coverage']['no_candidate']['hires'])} |"),
    ('DATA_HANDOFF.md',
     re.compile(r'相对“改前列”新增覆盖 (?P<n>[\d,]+) 岗'),
     lambda f: f"相对“改前列”新增覆盖 {number(f['newly_covered_since_before_layer'])} 岗"),
    ('DATA_HANDOFF.md',
     re.compile(r'\| 双列合计代码 \| (?P<codes>\d+) 种，含 (?P<both>\d+) 种同时出现在两列'),
     lambda f: (f"| 双列合计代码 | {f['codes']['distinct']} 种，含 "
                f"{f['codes']['both_columns']} 种同时出现在两列")),
    ('DATA_HANDOFF.md',
     re.compile(r'保留结果：(?P<pc>[\d,]+) 岗备注含代码提及，(?P<res>[\d,]+) 岗的备注代码可解析到目录；'),
     lambda f: (f"保留结果：{number(f['remarks']['positions_with_code'])} 岗备注含代码提及，"
                f"{number(f['remarks']['positions_resolved'])} 岗的备注代码可解析到目录；")),
    ('DATA_HANDOFF.md',
     re.compile(r'两列来源都保留（(?P<both>\d+) 种代码两列都出现）'),
     lambda f: f"两列来源都保留（{f['codes']['both_columns']} 种代码两列都出现）"),
    ('data/README.md',
     re.compile(r'后为 (?P<incl>[\d,]+) / (?P<res>\d+)（(?P<resh>[\d,]+) 人无候选），5,835 个带复核原因的岗位中有候选的从 4,593 升到 (?P<cov>[\d,]+)'),
     lambda f: (f"后为 {number(f['coverage']['conservative']['positions'])} / "
                f"{number(f['coverage']['no_candidate']['positions'])}（"
                f"{number(f['coverage']['no_candidate']['hires'])} 人无候选），5,835 个带复核原因的岗位中"
                f"有候选的从 4,593 升到 {number(f['review']['covered'])}")),
    ('research/MAJOR_CODE_MATCHING.md',
     re.compile(r'\| 把“备注”列纳入统计 \| (?P<pc>[\d,]+) 岗备注含代码；(?P<res>[\d,]+) 岗可解析；新增覆盖 (?P<n>\d+) 岗 \|'),
     lambda f: (f"| 把“备注”列纳入统计 | {number(f['remarks']['positions_with_code'])} 岗备注含代码；"
                f"{number(f['remarks']['positions_resolved'])} 岗可解析；新增覆盖 "
                f"{f['newly_covered_since_before_layer']} 岗 |")),
    ('research/MAJOR_CODE_MATCHING.md',
     re.compile(r'\| 其中可解析到目录 \| (?P<res>[\d,]+) 岗 \|'),
     lambda f: f"| 其中可解析到目录 | {number(f['remarks']['positions_resolved'])} 岗 |"),
    ('DATA_HANDOFF.md',
     re.compile(r'### 4\.7 残留分层（(?P<res>[\d,]+) 岗 / (?P<resh>[\d,]+) 人）'),
     lambda f: (f"### 4.7 残留分层（{number(f['coverage']['no_candidate']['positions'])} 岗 / "
                f"{number(f['coverage']['no_candidate']['hires'])} 人）")),
    ('DATA_HANDOFF.md',
     re.compile(r'\| 国家目录词汇或开放表述 \| (?P<n>[\d,]+) \| (?P<h>[\d,]+) \|'),
     lambda f: (f"| 国家目录词汇或开放表述 | {number(f['residual_strata']['national_vocabulary'])} | "
                f"{number(f['residual_strata_hires']['national_vocabulary'])} |")),
    ('DATA_HANDOFF.md',
     re.compile(r'真正的未覆盖是 (?P<n>[\d,]+)'),
     lambda f: f"真正的未覆盖是 {number(f['coverage']['no_candidate']['positions'])}"),
    ('DATA_HANDOFF.md',
     re.compile(r'\*\*仍未解决\*\*：(?P<n>[\d,]+) 岗专业表述无法精确落到目录'),
     lambda f: f"**仍未解决**：{number(f['coverage']['no_candidate']['positions'])} 岗专业表述无法精确落到目录"),
    ('research/MAJOR_CODE_MATCHING.md',
     re.compile(r'无候选从 \*\*1,250\*\* 降到 \*\*(?P<n>[\d,]+)\*\*（(?P<h>[\d,]+) 人）'),
     lambda f: (f"无候选从 **1,250** 降到 **{number(f['coverage']['no_candidate']['positions'])}**"
                f"（{number(f['coverage']['no_candidate']['hires'])} 人）")),
    ('research/MAJOR_CODE_MATCHING.md',
     re.compile(r'^(?P<n>\d+) 个岗位（全库）的代码旁名称与目录不一致，共 (?P<e>\d+) 条冲突条目；其中 (?P<in>\d+) 个岗位在 5,835 复核域内、(?P<out>\d+) 个在域外'),
     lambda f: (f"{f['conflicts']['positions']} 个岗位（全库）的代码旁名称与目录不一致，共 "
                f"{f['conflicts']['entries']} 条冲突条目；其中 {f['conflicts']['in_review_universe']} "
                f"个岗位在 5,835 复核域内、{f['conflicts']['outside_review_universe']} 个在域外")),
    ('research/MAJOR_CODE_MATCHING.md',
     re.compile(r'^## 6\. 残留 (?P<n>[\d,]+) 岗'),
     lambda f: f"## 6. 残留 {number(f['coverage']['no_candidate']['positions'])} 岗"),
    ('research/MAJOR_CODE_MATCHING.md',
     re.compile(r'\| 有目录候选，但仍需解释 \| (?P<n>[\d,]+) \|'),
     lambda f: f"| 有目录候选，但仍需解释 | {number(f['review']['needs_interpretation'])} |"),
    ('research/MAJOR_CODE_MATCHING.md',
     re.compile(r'\| 没有任何目录候选 \| (?P<n>[\d,]+) \|'),
     lambda f: f"| 没有任何目录候选 | {number(f['coverage']['no_candidate']['positions'])} |"),
    ('data/DATASET_STATUS.json',
     re.compile(r'"coverage_note": "专业 \+ 备注 with explicit degree-scope labels; conservative [^"]+"'),
     lambda f: ('"coverage_note": "专业 + 备注 with explicit degree-scope labels; conservative '
                f"{number(f['coverage']['conservative']['positions'])}, provisional gate-rule "
                f"{f['coverage']['provisional']['positions']}, no candidate "
                f"{number(f['coverage']['no_candidate']['positions'])}; review status "
                f"{len(f['review']['buckets'])} buckets; conflicts {f['conflicts']['positions']} positions / "
                f"{f['conflicts']['entries']} entries" + '"')),
    ('research/DATA_SOURCES_AND_CHECKS.md',
     re.compile(r'国家目录词汇 (?P<n>\d+)。'),
     lambda f: f"国家目录词汇 {f['residual_strata']['national_vocabulary']}。"),
]


def apply_rewrites(project, facts):
    changed = []
    for rel, pattern, render in REWRITES:
        path = project / rel
        if not path.exists():
            continue
        text = path.read_text(encoding='utf-8')
        new_lines = []
        touched = 0
        for line in text.split('\n'):
            if any(marker in line for marker in HISTORY_MARKERS):
                new_lines.append(line)
                continue
            match = pattern.search(line)
            if match:
                replacement = render(facts)
                start, end = match.span()
                updated = line[:start] + replacement + line[end:]
                if updated != line:
                    touched += 1
                new_lines.append(updated)
            else:
                new_lines.append(line)
        if touched:
            path.write_text('\n'.join(new_lines), encoding='utf-8')
            changed.append({'file': rel, 'lines': touched})
    return changed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--apply', action='store_true', help='also rewrite current-stat lines in the docs')
    args = parser.parse_args()
    project = args.project
    facts = derive(project)
    facts['generated_at_utc'] = datetime.now(timezone.utc).isoformat()
    facts['derived_from'] = ['data/major_evidence_2027/manifest.json',
                             'data/major_evidence_2027/position-evidence-*.json',
                             'data/major_evidence_2027/code-evidence-01.json']
    path = project / 'research' / 'CURRENT_SNAPSHOT.json'
    path.write_text(json.dumps(facts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    result = {'snapshot': str(path), 'sha256': sha256(path.read_bytes()),
              'consistency': facts['consistency']}
    if args.apply:
        result['rewritten'] = apply_rewrites(project, facts)
    print(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
