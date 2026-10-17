#!/usr/bin/env python3
"""Cross-file consistency audit for the current-stat statements.

Usage:
  python3 verify_handoff_consistency.py [--write-report]

Derives the current figures from the data manifests, then checks that the
handoffs, status files and the scope-audit guidance state those same figures.
Exits non-zero on any mismatch, so a stale number fails the build instead of
surviving in a document.

Rules
  * only *current* lines are checked; a line carrying a history marker
    (v1..v5, 历史, archival, before, 第N轮, 旧层) or a progression arrow is skipped;
  * a document is checked by re-rendering the same anchored patterns the sync
    script uses, so the comparison is exact rather than fuzzy;
  * relative links and DATASET_STATUS paths must resolve.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # keep the working tree free of __pycache__
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_current_snapshot as snapshot  # noqa: E402

DOCS = [
    'OPUS_HANDOFF.md',
    'DATA_HANDOFF.md',
    'data/README.md',
    'README.md',
    'research/MAJOR_CODE_MATCHING.md',
    'research/DATA_SOURCES_AND_CHECKS.md',
]
LINK_DOCS = ['OPUS_HANDOFF.md', 'DATA_HANDOFF.md', 'data/README.md']
LINK = re.compile(r'\[[^\]]*\]\((?P<target>[^)#]+)(?:#[^)]*)?\)')


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def is_current_line(line):
    if any(marker in line for marker in snapshot.HISTORY_MARKERS):
        return False
    if '→' in line:
        return False
    return True


def check_docs(project, facts):
    errors, checked = [], 0
    for rel, pattern, render in snapshot.REWRITES:
        path = project / rel
        if not path.exists():
            errors.append({'file': rel, 'kind': 'missing_file'})
            continue
        for number, line in enumerate(path.read_text(encoding='utf-8').split('\n'), 1):
            if not is_current_line(line):
                continue
            match = pattern.search(line)
            if not match:
                continue
            checked += 1
            expected = line[:match.start()] + render(facts) + line[match.end():]
            if expected != line:
                errors.append({
                    'file': rel,
                    'line': number,
                    'kind': 'stale_current_stat',
                    'found': line.strip()[:160],
                    'expected': expected.strip()[:160],
                })
    return errors, checked


def check_audit_guidance(project, facts):
    path = project / 'research' / 'FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json'
    errors = []
    if not path.exists():
        return [{'file': str(path), 'kind': 'missing_file'}]
    audit = json.loads(path.read_text())
    guidance = ' '.join(audit.get('opus_safe_read_guidance', []))
    required = [
        f"{facts['coverage']['conservative']['positions']:,}",
        f"{facts['coverage']['inclusive']['positions']:,}",
        f"{facts['coverage']['provisional']['positions']} 岗",
        f"{facts['coverage']['no_candidate']['positions']:,}",
        f"{facts['conflicts']['positions']} 岗位",
        f"{facts['conflicts']['entries']} 条目",
        f"{facts['conflicts']['semantic']} 语义冲突",
    ]
    for token in required:
        if token not in guidance:
            errors.append({'file': 'research/FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json',
                           'kind': 'guidance_missing_current_figure', 'token': token})
    # the guidance must not still quote the retired provisional count
    for stale in ('25 个 provisional', '728 个无候选', '59 岗位 / 101', '18,679'):
        if stale in guidance:
            errors.append({'file': 'research/FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json',
                           'kind': 'guidance_stale_figure', 'token': stale})
    return errors


def check_blocks(project, facts):
    """Multi-line sections (tables) must equal their rendered form."""
    errors = []
    for rel, start_marker, end_marker, render in snapshot.BLOCK_REWRITES:
        path = project / rel
        if not path.exists():
            errors.append({'file': rel, 'kind': 'missing_file'})
            continue
        text = path.read_text(encoding='utf-8')
        start = text.find(start_marker)
        end = text.find(end_marker, start + 1) if start >= 0 else -1
        if start < 0 or end < 0:
            errors.append({'file': rel, 'kind': 'block_missing', 'block': start_marker})
            continue
        if text[start:end] != render(facts):
            errors.append({'file': rel, 'kind': 'stale_block', 'block': start_marker})
    return errors


def check_review_arithmetic(facts):
    """The four review buckets must be exclusive and close on the universe."""
    review = facts['review']
    four = review['four_way']
    errors = []
    if four['sum'] != review['universe']:
        errors.append({'kind': 'review_four_way_sum', 'sum': four['sum'],
                       'universe': review['universe']})
    expected = (four['candidate_requires_review_excluding_provisional']
                + four['legacy_reason_superseded']
                + four['provisional_only']
                + four['no_candidate'])
    if expected != review['universe']:
        errors.append({'kind': 'review_four_way_components', 'computed': expected,
                       'universe': review['universe']})
    if (four['candidate_requires_review_excluding_provisional'] + four['provisional_only']
            != review['candidate_requires_review_including_provisional']):
        errors.append({'kind': 'review_provisional_double_count'})
    if review['candidate_requires_review_including_provisional'] != review['covered'] - review['legacy_superseded']:
        errors.append({'kind': 'review_including_provisional_mismatch'})
    return errors


def check_audit_claims(project, facts):
    """The audits must state derived figures and must not overclaim."""
    errors = []
    conflicts = facts['conflicts']

    delivery_path = project / 'research' / 'FINAL_DELIVERY_AUDIT_20261018.json'
    if not delivery_path.exists():
        errors.append({'file': delivery_path.name, 'kind': 'missing_file'})
    else:
        delivery = json.loads(delivery_path.read_text())
        by_group = {item['group']: item for item in delivery.get('hard_problems', [])}
        semantic = by_group.get('semantic_conflict', {})
        if semantic.get('positions') != conflicts['semantic_positions']:
            errors.append({'file': delivery_path.name, 'kind': 'semantic_positions_mismatch',
                           'found': semantic.get('positions'),
                           'expected': conflicts['semantic_positions']})
        if semantic.get('entries') != conflicts['semantic_entries']:
            errors.append({'file': delivery_path.name, 'kind': 'semantic_entries_mismatch',
                           'found': semantic.get('entries'),
                           'expected': conflicts['semantic_entries']})
        diagnostic = by_group.get('multi_namespace_diagnostic', {})
        if diagnostic.get('positions') != conflicts['diagnostic_positions']:
            errors.append({'file': delivery_path.name, 'kind': 'diagnostic_positions_mismatch',
                           'found': diagnostic.get('positions'),
                           'expected': conflicts['diagnostic_positions']})
        scope_text = delivery.get('autonomously_fixable_scope', '')
        if '本次已审计范围' not in scope_text:
            errors.append({'file': delivery_path.name, 'kind': 'overclaim_scope',
                           'detail': 'autonomously_fixable_scope must limit the claim'})
        joined = json.dumps(delivery.get('not_delivered', []), ensure_ascii=False)
        if 'none is published' in joined or '不存在' in joined and '未找到' not in joined:
            errors.append({'file': delivery_path.name, 'kind': 'absolute_claim',
                           'detail': 'must say not-found, not does-not-exist'})
        if '未找到' not in joined:
            errors.append({'file': delivery_path.name, 'kind': 'missing_not_found_wording'})

    scope_path = project / 'research' / 'FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json'
    if not scope_path.exists():
        errors.append({'file': scope_path.name, 'kind': 'missing_file'})
    else:
        audit = json.loads(scope_path.read_text())
        examined = audit['residual_audit']['scope_examined']
        expected_examined = facts['residual_strata']['national_vocabulary'] + facts['residual_strata']['agency_unverified']
        if examined != expected_examined:
            errors.append({'file': scope_path.name, 'kind': 'scope_examined_mismatch',
                           'found': examined, 'expected': expected_examined})
        current_text = ' '.join(audit.get('updated_this_round', [])
                                + audit.get('not_updated_this_round', []))
        required = [
            f"{facts['coverage']['provisional']['positions']} 岗",
            f"{facts['coverage']['no_candidate']['positions']:,} 个无候选",
            f"{facts['conflicts']['diagnostic']} 条",
        ]
        for token in required:
            if token not in current_text:
                errors.append({'file': scope_path.name, 'kind': 'round_section_missing_figure',
                               'token': token})
        for stale in ('25 岗', '34 条', '195 个残留', '182 national', '728 个无候选'):
            if stale in current_text:
                errors.append({'file': scope_path.name, 'kind': 'round_section_stale',
                               'token': stale})
    return errors


def check_links(project):
    errors = []
    for rel in LINK_DOCS:
        path = project / rel
        if not path.exists():
            continue
        base = path.parent
        for match in LINK.finditer(path.read_text(encoding='utf-8')):
            target = match.group('target').strip()
            if target.startswith(('http://', 'https://', 'mailto:')):
                continue
            resolved = (base / target).resolve()
            if not resolved.exists():
                errors.append({'file': rel, 'kind': 'broken_link', 'target': target})
    return errors


def check_status_paths(project):
    path = project / 'data' / 'DATASET_STATUS.json'
    errors = []
    if not path.exists():
        return [{'file': 'data/DATASET_STATUS.json', 'kind': 'missing_file'}]
    status = json.loads(path.read_text())
    for group in ('current', 'reports', 'legacy'):
        for entry in status.get(group, []):
            rel = entry.get('path')
            if not rel:
                continue
            # This audit's own report is written after the checks run; treat it as
            # expected so a first run on a clean tree is not a false failure.
            if rel.endswith('HANDOFF_CONSISTENCY_20261018.json'):
                continue
            if not (path.parent / rel).resolve().exists():
                errors.append({'file': 'data/DATASET_STATUS.json', 'group': group,
                               'kind': 'unresolved_path', 'path': rel})
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--write-report', action='store_true')
    args = parser.parse_args()
    project = args.project

    facts = snapshot.derive(project)
    stored_path = project / 'research' / 'CURRENT_SNAPSHOT.json'
    snapshot_errors = []
    if not stored_path.exists():
        snapshot_errors.append({'kind': 'missing_snapshot'})
    else:
        stored = json.loads(stored_path.read_text())
        for key in ('coverage', 'conflicts', 'remarks', 'codes', 'review', 'residual_strata'):
            if stored.get(key) != facts.get(key):
                snapshot_errors.append({'kind': 'snapshot_drift', 'key': key,
                                        'stored': stored.get(key), 'derived': facts.get(key)})

    doc_errors, checked = check_docs(project, facts)
    guidance_errors = check_audit_guidance(project, facts)
    claims_errors = check_audit_claims(project, facts)
    block_errors = check_blocks(project, facts)
    arithmetic_errors = check_review_arithmetic(facts)
    link_errors = check_links(project)
    status_errors = check_status_paths(project)
    errors = (snapshot_errors + doc_errors + guidance_errors + claims_errors
              + block_errors + arithmetic_errors + link_errors + status_errors)

    report = {
        'schema_version': '1.0.0',
        'audit': 'handoff-consistency',
        'as_of': facts['as_of'],
        'status': 'PASS' if not errors else 'FAIL',
        'derived_facts': facts,
        'checks': {
            'snapshot_matches_manifests': not snapshot_errors,
            'current_stat_lines_checked': checked,
            'current_stat_errors': len(doc_errors),
            'guidance_errors': len(guidance_errors),
            'audit_claim_errors': len(claims_errors),
            'block_errors': len(block_errors),
            'review_arithmetic_errors': len(arithmetic_errors),
            'broken_links': len(link_errors),
            'status_path_errors': len(status_errors),
        },
        'errors': errors,
    }
    text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.write_report:
        path = project / 'research' / 'HANDOFF_CONSISTENCY_20261018.json'
        path.write_text(text, encoding='utf-8')
        print(json.dumps({'report': str(path), 'sha256': sha256(path.read_bytes())}, ensure_ascii=False))
    print(text)
    if errors:
        sys.exit(1)


if __name__ == '__main__':
    main()
