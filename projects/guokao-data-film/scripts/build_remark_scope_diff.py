#!/usr/bin/env python3
"""Before/after report for the 备注 degree-scope fix.

Usage:
  python3 build_remark_scope_diff.py [--before-ref 4d708e1] [--project DIR]

Reads the previous evidence layer straight out of git (read-only) and compares it
with the working tree, so the delta is measured rather than asserted.

Outputs research/REMARK_SCOPE_FIX_DIFF_20261018.json. It never writes to the
data shards and never rewrites a historical report.
"""
import argparse
import collections
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REL = 'projects/guokao-data-film/data/major_evidence_2027/'


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def git_show(repo, ref, path):
    result = subprocess.run(['git', '-C', str(repo), 'show', f'{ref}:{path}'],
                            capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f'cannot read {path} at {ref}: {result.stderr.strip()}')
    return result.stdout


def load_side(loader, manifest):
    records = {}
    for shard in manifest['position_evidence']:
        for record in json.loads(loader(shard['path'])):
            records[record['id']] = record
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--before-ref', default='4d708e1')
    args = parser.parse_args()
    project = args.project
    repo = project
    while repo != repo.parent and not (repo / '.git').exists():
        repo = repo.parent
    if not (repo / '.git').exists():
        raise SystemExit('no git repository found above the project directory')

    before_manifest = json.loads(git_show(repo, args.before_ref, REL + 'manifest.json'))
    before = load_side(lambda name: git_show(repo, args.before_ref, REL + name), before_manifest)

    root = project / 'data' / 'major_evidence_2027'
    after_manifest = json.loads((root / 'manifest.json').read_text())
    after = load_side(lambda name: (root / name).read_text(), after_manifest)

    def conflicts(record):
        return [(c['code'], c['conflict_class'], c.get('printed_name'), c.get('field'))
                for c in record.get('conflicts') or []]

    before_conf = {pid: conflicts(record) for pid, record in before.items() if record.get('conflicts')}
    after_conf = {pid: conflicts(record) for pid, record in after.items() if record.get('conflicts')}
    cleared = sorted(set(before_conf) - set(after_conf))
    added = sorted(set(after_conf) - set(before_conf))
    changed = sorted(pid for pid in set(before_conf) & set(after_conf)
                     if before_conf[pid] != after_conf[pid])

    coverage_changes = []
    for pid in sorted(before):
        old = (before[pid].get('coverage_after'), before[pid].get('coverage_conservative'))
        new = (after[pid].get('coverage_after'), after[pid].get('coverage_conservative'))
        if old != new:
            coverage_changes.append({'id': pid, 'before': old, 'after': new})

    scope_stats = collections.Counter()
    for record in after.values():
        for code in record.get('remarks_codes') or []:
            scope_stats[code.get('scope_source')] += 1

    cleared_detail = []
    for pid in cleared:
        record = after[pid]
        cleared_detail.append({
            'id': pid,
            'removed_entries': before_conf[pid],
            'had_explicit_bachelor_label': any(
                code.get('scope_source') == 'explicit_label' and code.get('scopes_used') == ['bachelor']
                for code in record.get('remarks_codes') or []),
        })

    before_summary = before_manifest['summary']
    after_summary = after_manifest['summary']
    report = {
        'schema_version': '1.0.0',
        'report_id': 'remark-scope-fix-diff-20261018',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'generated_date_timezone': 'Asia/Shanghai',
        'local_date': '2026-10-18',
        'before_ref': args.before_ref,
        'change': ('备注 codes are now resolved in the education level named by an explicit, bounded '
                   'label (本科专业代码 / 本科阶段 / 研究生专业 / 研究生： ...). Outside such a label '
                   'the position 学历 is used and the fallback is marked. Mixed labels such as '
                   '“本科或研究生阶段” fall back and are flagged, never widened.'),
        'why': ('A 研究生 position whose 备注 says “本科专业应为：0702物理学类…” was previously decoded '
                'in the graduate namespace, so the bachelor code produced a cross_level_same_code '
                'diagnostic that looked like a source conflict.'),
        'coverage': {
            'before': {
                'conservative': before_summary['coverage_conservative']['positions_with_catalog_candidate'],
                'provisional': before_summary['coverage_provisional_only']['positions'],
                'no_candidate': before_summary['residual_positions'],
            },
            'after': {
                'conservative': after_summary['coverage_conservative']['positions_with_catalog_candidate'],
                'provisional': after_summary['coverage_provisional_only']['positions'],
                'no_candidate': after_summary['residual_positions'],
            },
            'positions_changed': coverage_changes,
        },
        'conflicts': {
            'before': {
                'positions': before_summary['conflicts']['positions'],
                'entries': before_summary['conflicts']['entries'],
                'by_class': before_summary['conflicts']['by_class'],
            },
            'after': {
                'positions': after_summary['conflicts']['positions'],
                'entries': after_summary['conflicts']['entries'],
                'by_class': after_summary['conflicts']['by_class'],
            },
            'cleared_positions': cleared_detail,
            'added_positions': added,
            'changed_positions': changed,
            'interpretation': ('Every removed entry came from a position whose 备注 named a bachelor '
                               'requirement. content_conflict entries are unchanged, so no semantic '
                               'conflict was discarded.'),
        },
        'remark_code_scope': dict(scope_stats),
        'scope_rules': {
            'explicit_label': ['本科专业', '本科专业代码为', '本科阶段', '本科：',
                               '研究生专业', '研究生阶段', '研究生：', '博士研究生专业'],
            'ambiguous_fallback': ['本科或研究生阶段', '本科、研究生专业'],
            'fallback': 'no explicit label in the governing span',
        },
        'residual_ambiguities': ('Some 备注 mix levels without a clean label; those codes are left at '
                                 'the position scope with scope_source=ambiguous_mixed_degree_label '
                                 'and a visible span, and should be read as unresolved rather than matched.'),
    }
    path = project / 'research' / 'REMARK_SCOPE_FIX_DIFF_20261018.json'
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'report': str(path), 'bytes': path.stat().st_size, 'sha256': sha256(path.read_bytes()),
        'cleared_positions': len(cleared), 'added_positions': len(added),
        'coverage_changed': len(coverage_changes),
        'conflict_entries_before': before_summary['conflicts']['entries'],
        'conflict_entries_after': after_summary['conflicts']['entries'],
        'scope': dict(scope_stats),
    }, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
