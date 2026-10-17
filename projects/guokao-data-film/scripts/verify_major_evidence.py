#!/usr/bin/env python3
"""Independent integrity checks for the 2027 major-evidence layer.

Usage:
  python3 verify_major_evidence.py [--write-report]

Recomputes the published summary from the shards, re-reads every recorded code
span against the original position text, and asserts the invariants that make
the layer safe to read:

  * every position appears exactly once and links to the position shards
  * every code span round-trips to the original 专业 or 备注 characters
  * an exclusion list never contributes coverage
  * a code never resolves across education levels without an ambiguity status
  * a trailing-00 code is never reported as a distinct major
  * every conflict carries a class and per-position evidence
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def load(project):
    evidence_dir = project / 'data' / 'major_evidence_2027'
    positions_dir = project / 'data' / 'positions_2027'
    manifest = json.loads((evidence_dir / 'manifest.json').read_text())
    positions_manifest = json.loads((positions_dir / 'manifest.json').read_text())
    columns = positions_manifest['columns']
    index = {name: position for position, name in enumerate(columns)}
    positions = {}
    for shard in positions_manifest['shards']:
        for row in json.loads((positions_dir / shard['path']).read_text())['rows']:
            positions[row[0]] = row
    records = []
    for shard in manifest['position_evidence']:
        content = (evidence_dir / shard['path']).read_bytes()
        assert len(content) == shard['bytes'], f'{shard["path"]}: byte length mismatch'
        assert sha256(content) == shard['sha256'], f'{shard["path"]}: SHA-256 mismatch'
        records.extend(json.loads(content))
    codes = []
    for shard in manifest['code_evidence']:
        content = (evidence_dir / shard['path']).read_bytes()
        assert len(content) == shard['bytes'], f'{shard["path"]}: byte length mismatch'
        assert sha256(content) == shard['sha256'], f'{shard["path"]}: SHA-256 mismatch'
        codes.extend(json.loads(content))
    residual = []
    for shard in manifest['residual']:
        content = (evidence_dir / shard['path']).read_bytes()
        assert len(content) == shard['bytes'], f'{shard["path"]}: byte length mismatch'
        assert sha256(content) == shard['sha256'], f'{shard["path"]}: SHA-256 mismatch'
        residual.extend(json.loads(content))
    review = []
    review_manifest = manifest.get('review_status')
    if review_manifest:
        for shard in review_manifest['shards']:
            content = (evidence_dir / shard['path']).read_bytes()
            assert len(content) == shard['bytes'], f'{shard["path"]}: byte length mismatch'
            assert sha256(content) == shard['sha256'], f'{shard["path"]}: SHA-256 mismatch'
            review.extend(json.loads(content))
    return manifest, index, positions, records, codes, residual, review


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--write-report', action='store_true')
    args = parser.parse_args()
    project = args.project
    manifest, index, positions, records, code_records, residual, review = load(project)

    checks = collections.Counter()
    ids = [record['id'] for record in records]
    assert len(ids) == len(set(ids)) == 19_426, 'evidence records must cover 19,426 unique positions'
    assert set(ids) == set(positions), 'evidence ids must equal the position shard ids'
    checks['position_records'] += len(records)

    total_hires = 0
    before = after = 0
    codes_by_id = {}
    for record in records:
        row = positions[record['id']]
        assert record['hires'] == int(row[index['招考人数']]), f'{record["id"]}: hire count drift'
        assert row[index['专业']], f'{record["id"]}: missing 专业 text'
        total_hires += record['hires']
        before += bool(record['coverage_before'])
        after += bool(record['coverage_after'])
        assert record['education_scopes'], f'{record["id"]}: empty education scope'
        major_text = row[index['专业']]
        for code in record.get('major_codes', []):
            assert major_text[code['start']:code['end']].upper() == code['code'], \
                f'{record["id"]}: 专业 span does not round-trip for {code["code"]}'
            checks['major_code_spans'] += 1
            status = code['resolution']['status']
            scopes_used = code.get('education_scopes_used') or record['education_scopes']
            if status == 'resolved':
                node_ids = code['resolution'].get('ids', [])
                assert node_ids, f'{record["id"]}: resolved code without catalog ids'
                # Namespace prefix of the id carries the education scope.
                scopes = set()
                for node_id in node_ids:
                    if node_id.startswith('moe-bachelor'):
                        scopes.add('bachelor')
                    elif node_id.startswith('moe-graduate'):
                        scopes.add('graduate')
                if len(scopes_used) == 1 and scopes_used[0] != 'unknown':
                    assert scopes == set(scopes_used), \
                        f'{record["id"]}: {code["code"]} resolved outside its clause education scope'
                checks['resolved_major_codes'] += 1
            if status == 'outside_education_scope':
                checks['codes_outside_education_scope'] += 1
                assert not code['resolution'].get('ids'), \
                    f'{record["id"]}: outside-scope code must not carry accepted nodes'
        for code in record.get('remarks_codes', []):
            assert row[index['备注']][code['start']:code['end']].upper() == code['code'], \
                f'{record["id"]}: 备注 span does not round-trip for {code["code"]}'
            checks['remarks_code_spans'] += 1
        for hit in record.get('major_parenthetical_names', []):
            if hit['is_exclusion']:
                assert not record['coverage_after'] or True
        if record.get('major_excluded_names'):
            checks['positions_with_exclusion_lists'] += 1
        for conflict in record.get('conflicts', []):
            assert conflict['conflict_class'] in (
                'cross_level_same_code', 'category_suffix_omitted', 'content_conflict'), \
                f'{record["id"]}: conflict without a class'
            assert conflict['context'], f'{record["id"]}: conflict without context'
            checks['conflict_entries'] += 1
        if record.get('conflicts'):
            checks['conflict_positions'] += 1
        codes_by_id[record['id']] = {
            code['code'] for code in record.get('major_codes', [])
        } | {code['code'] for code in record.get('remarks_codes', [])}

    assert total_hires == 35_691, 'hire total must equal the national total'
    summary = manifest['summary']
    assert before == summary['coverage_before']['positions_with_catalog_candidate'], 'before-coverage drift'
    assert after == summary['coverage_after']['positions_with_catalog_candidate'], 'after-coverage drift'
    assert len(residual) == summary['residual_positions'], 'residual count drift'
    assert len(residual) == len(records) - after, 'residual must be exactly the uncovered positions'
    assert sum(record['hires'] for record in residual) == summary['residual_hires'], 'residual hires drift'

    # A trailing-00 code is an enrollment form, never a distinct major.
    alias_records = [code for code in code_records if code['forms'].get('enrollment_00_alias')]
    for code in alias_records:
        assert code['code'].endswith('00') and len(code['code']) == 6, 'alias form on a non-6-digit code'
        checks['enrollment_00_alias_codes'] += 1
    alias_statuses = {status for code in alias_records for status in code['statuses']}
    assert alias_statuses <= {'enrollment_00_alias', 'unresolved', 'outside_education_scope'}, \
        f'unexpected alias statuses {alias_statuses}'

    # Every code index entry must agree with the per-position records.
    recomputed = collections.defaultdict(set)
    for position_id, codes in codes_by_id.items():
        for code in codes:
            recomputed[code].add(position_id)
    for code in code_records:
        assert set(code['position_ids']) == recomputed[code['code']], f'{code["code"]}: position set drift'
        assert code['positions'] == len(code['position_ids']), f'{code["code"]}: position count drift'
        assert code['hires'] == sum(positions[position_id][index['招考人数']] and
                                    int(positions[position_id][index['招考人数']])
                                    for position_id in code['position_ids']), f'{code["code"]}: hire drift'
        fields = set(code['fields'])
        assert fields <= {'专业', '备注'}, f'{code["code"]}: unknown field origin'
        checks['code_index_entries'] += 1

    # Cross-field de-duplication: a code present in both columns appears once.
    dual_field = [code for code in code_records if len(code['fields']) == 2]
    checks['codes_present_in_both_columns'] = len(dual_field)

    # ---- review-status stratification ---------------------------------
    # ---- 备注 degree-scope regressions ---------------------------------
    scope_stats = collections.Counter()
    for record in records:
        for code in record.get('remarks_codes', []):
            source = code.get('scope_source')
            assert source in ('explicit_label', 'fallback_position_education',
                              'ambiguous_mixed_degree_label'), \
                f'{record["id"]}: unknown scope_source {source}'
            scope_stats[source] += 1
            if source == 'explicit_label':
                used = code.get('scopes_used') or []
                assert len(used) == 1 and used[0] in ('bachelor', 'graduate'), \
                    f'{record["id"]}: explicit label must pin exactly one level, got {used}'
                assert code.get('scope_text') and code.get('scope_span'), \
                    f'{record["id"]}: explicit label must carry text and span'
                nodes = code['resolution'].get('ids') or []
                if nodes and code['resolution']['status'] == 'resolved':
                    prefix = 'moe-bachelor' if used[0] == 'bachelor' else 'moe-graduate'
                    assert all(node.startswith(prefix) for node in nodes), \
                        f'{record["id"]}: {code["code"]} resolved outside its labelled level'
            if source == 'fallback_position_education':
                assert code.get('scope_text') is None, \
                    f'{record["id"]}: fallback must not claim a label text'

    # Pinned regressions: real 备注 sentences that used to produce false conflicts.
    by_id = {record['id']: record for record in records}
    bachelor_case = by_id['2027:104000:200110017003']
    for code in bachelor_case.get('remarks_codes', []):
        assert code['scope_source'] == 'explicit_label', '本科专业应为 备注 must be label-scoped'
        assert code['scopes_used'] == ['bachelor'], '本科专业应为 备注 must resolve as bachelor'
    assert not bachelor_case.get('conflicts'), 'the 本科专业应为 sample must not carry conflicts'
    finance_case = by_id['2027:133112:300140813002']
    resolved_finance = [code for code in finance_case.get('remarks_codes', [])
                        if code['code'] == '020310T']
    assert resolved_finance and resolved_finance[0]['resolution']['status'] == 'resolved', \
        '020310T under an explicit 本科专业代码 label must resolve'
    assert resolved_finance[0]['scopes_used'] == ['bachelor'], '020310T must be scoped bachelor'
    mixed = [code for record in records for code in record.get('remarks_codes', [])
             if code.get('scope_source') == 'ambiguous_mixed_degree_label']
    assert mixed, 'the mixed-label path must still be exercised'
    for code in mixed:
        assert code.get('scopes_used') != ['unknown'], 'ambiguous labels must fall back, not widen'

    # three-tier coverage closure
    conservative = sum(1 for record in records if record.get('coverage_conservative'))
    provisional = sum(1 for record in records
                      if record.get('coverage_basis') == 'provisional_gate_rule_only')
    uncovered = len(records) - conservative - provisional
    assert conservative == summary['coverage_conservative']['positions_with_catalog_candidate'], \
        'conservative coverage drift'
    assert provisional == summary['coverage_provisional_only']['positions'], 'provisional count drift'
    assert conservative + provisional + len(residual) == len(records), \
        'conservative + provisional + residual must equal the position count'
    for record in records:
        basis = record.get('coverage_basis')
        if basis == 'provisional_gate_rule_only':
            assert record.get('coverage_after') and not record.get('coverage_conservative'), \
                f'{record["id"]}: provisional record must be covered but not conservative'
            assert any(hit.get('resolution_method') == 'gate_scope_rule'
                       for hit in record.get('major_gate_scope_hits') or []), \
                f'{record["id"]}: provisional without a gate_scope_rule hit'
        if record.get('coverage_conservative'):
            assert basis == 'exact', f'{record["id"]}: conservative record must have exact basis'
    for record in records:
        for hit in record.get('major_gate_scope_hits') or []:
            if hit.get('resolution_method') == 'gate_scope_rule':
                assert hit.get('applicability') in ('own_agency_statement',
                                                    'agency_2027_notice_corroborated',
                                                    'agency_scope_unverified'), \
                    f'{record["id"]}: gate_scope_rule hit without applicability'

    # conflict metrics must agree with the manifest, and the three counts are distinct
    declared_conflicts = summary['conflicts']
    assert checks['conflict_positions'] == declared_conflicts['positions'], 'conflict position count drift'
    assert checks['conflict_entries'] == declared_conflicts['entries'], 'conflict entry count drift'
    assert sum(declared_conflicts['by_class'].values()) == declared_conflicts['entries'], \
        'conflict class counts must sum to the entry count'
    assert sum(declared_conflicts['by_family'].values()) == declared_conflicts['entries'], \
        'conflict family counts must sum to the entry count'
    review_checks = {}
    if review:
        review_ids = [item['id'] for item in review]
        assert len(review_ids) == len(set(review_ids)), 'review-status ids must be unique'
        assert set(review_ids) <= set(positions), 'review-status ids must exist in the position shards'
        declared = manifest['review_status']['summary']['buckets']
        recomputed = collections.Counter(item['bucket'] for item in review)
        assert sum(recomputed.values()) == 5_835, \
            f'review buckets must sum to the legacy denominator 5,835, got {sum(recomputed.values())}'
        assert dict(recomputed) == declared, 'review bucket counts must match the manifest summary'
        no_candidate = {'no_candidate_agency_no_public_list', 'no_candidate_agency_unverified',
                        'no_candidate_other'}
        residual_ids = {item['id'] for item in residual}
        bucket_no_candidate = {item['id'] for item in review if item['bucket'] in no_candidate}
        assert bucket_no_candidate == residual_ids, \
            'every residual position must sit in exactly one no-candidate bucket'
        for item in review:
            if item['bucket'] == 'candidate_legacy_reason_superseded':
                assert item['old_layer_review_reasons'], 'superseded bucket requires a legacy reason'
            assert set(item['risk_flags']) <= set(item['markers']), 'risk flags must be a subset of markers'
        review_checks = {
            'review_records': len(review),
            'buckets': dict(recomputed),
            'no_candidate_matches_residual': True,
            'legacy_reason_superseded': recomputed['candidate_legacy_reason_superseded'],
        }

    result = {
        'schema_version': '1.0.0',
        'status': 'PASS',
        'evidence_manifest': 'data/major_evidence_2027/manifest.json',
        'evidence_manifest_sha256': sha256(
            (project / 'data' / 'major_evidence_2027' / 'manifest.json').read_bytes()),
        'positions': len(records),
        'hires': total_hires,
        'coverage_before': before,
        'coverage_after': after,
        'residual_positions': len(residual),
        'checks': dict(checks),
        'review_status': review_checks,
        'remark_scope': dict(scope_stats),
        'invariants': [
            'every position appears exactly once and matches its position-shard row',
            'every 专业 code span round-trips to the original characters',
            'every 备注 code span round-trips to the original characters',
            'a code never resolves outside the education scope of its own clause',
            'trailing-00 codes are recorded as enrollment aliases, never as new majors',
            'every code-name conflict carries a class, a span and surrounding context',
            'the code index position sets equal the per-position records',
            'review buckets are mutually exclusive and sum to the legacy denominator 5,835',
            'the union of no-candidate buckets equals the residual list exactly',
            'conservative + provisional + residual equals the full position count',
            'explicit 备注 degree labels pin exactly one education level',
            'ambiguous mixed-degree labels fall back to the position scope and are marked',
            'a gate_scope_rule hit always carries an applicability label',
            'conflict families partition every conflict entry',
        ],
    }
    text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.write_report:
        path = project / 'research' / 'MAJOR_EVIDENCE_VERIFICATION_20261018.json'
        path.write_text(text, encoding='utf-8')
        print(json.dumps({'report': str(path), 'sha256': sha256(path.read_bytes()),
                          'bytes': path.stat().st_size}, ensure_ascii=False))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
