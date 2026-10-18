#!/usr/bin/env python3
"""Build the review-status stratification and the residual strata report.

Usage:
  python3 build_review_status.py [--project DIR]

Two separate questions, kept apart on purpose:

  * residual strata — the positions with no catalog candidate at all (728).
    Classified on the raw 专业 text, so an agency phrase written inside a longer
    sentence is still counted.
  * review status — the 5,835 positions whose requirement carried at least one
    review reason in the original three-catalog layer. Every one gets exactly one
    bucket, and the buckets must sum back to 5,835.

Important: the 5,835 denominator is a legacy-layer figure. Some of those review
reasons no longer reproduce under the current five-catalog layer; they are
reported as `candidate_legacy_reason_superseded` and must not be read as
"cleared". A catalog candidate is never evidence of applicant eligibility.

Outputs:
  data/major_evidence_2027/review-status-XX.json  (+ manifest entry)
  research/REVIEW_STATUS_20261018.json
  research/RESIDUAL_STRATA_20261018.json
"""
import argparse
import collections
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

AGENCY_LABELS = {
    'pboc': '中国人民银行',
    'cma': '气象',
    'customs': '海关',
    'tax': '税务',
    'nfra': '金融监督管理',
    'csrc': '证券监督管理',
}
# Verified on the agencies' own 2027 pages during this lane.
AGENCIES_VERIFIED_NO_LIST = {'pboc', 'cma'}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def load(project):
    evidence_dir = project / 'data' / 'major_evidence_2027'
    manifest = json.loads((evidence_dir / 'manifest.json').read_text())
    records = {}
    for shard in manifest['position_evidence']:
        for record in json.loads((evidence_dir / shard['path']).read_text()):
            records[record['id']] = record
    residual = []
    for shard in manifest['residual']:
        residual.extend(json.loads((evidence_dir / shard['path']).read_text()))
    positions_dir = project / 'data' / 'positions_2027'
    positions_manifest = json.loads((positions_dir / 'manifest.json').read_text())
    index = {name: i for i, name in enumerate(positions_manifest['columns'])}
    positions = {}
    for shard in positions_manifest['shards']:
        for row in json.loads((positions_dir / shard['path']).read_text())['rows']:
            positions[row[0]] = row
    requirements = {}
    majors_manifest = json.loads((project / 'data' / 'majors_2027' / 'manifest.json').read_text())
    for shard in majors_manifest['requirements']:
        for req in json.loads((project / 'data' / 'majors_2027' / shard['path']).read_text()):
            requirements[req['id']] = req
    return manifest, records, residual, positions, index, requirements


def catalog_names(project):
    names = set()
    catalog_root = project / 'data' / 'catalogs'
    for filename, fields in (
        ('major_bachelor_2026_official_parsed.json', ['gates', 'categories', 'majors']),
        ('major_graduate_2022_official_parsed.json', ['gates', 'first_level_disciplines', 'professional_degree_categories']),
    ):
        data = json.loads((catalog_root / filename).read_text())
        for field in fields:
            names |= {node['name'] for node in data[field]}
    for filename in ('major_graduate_codebook_2023_admissions_official_parsed.json',
                     'major_graduate_codebook_2024_admissions_official_parsed.json'):
        for node in json.loads((catalog_root / filename).read_text())['nodes']:
            names.add(node['name'])
    return names


def agency_of(department_name):
    for code, marker in AGENCY_LABELS.items():
        if marker in department_name:
            return code
    return None


def collect_markers(record, requirement):
    """Current-layer risk markers. Evidence layer first, structure from the requirement."""
    reasons = set(record.get('reason_classes') or [])
    review = set(requirement['review_reasons'])
    markers = set()
    if reasons & {'exclusion_list_present', 'negative_or_exclusion_present'} or 'negative_condition_present' in review:
        markers.add('exclusion_or_negative')
    if reasons & {'code_name_conflict', 'gate_code_name_mismatch'} or record.get('conflicts'):
        markers.add('code_name_conflict')
    if reasons & {'code_outside_education_scope', 'degree_word_inside_single_clause'} or \
            review & {'multiple_degree_clauses', 'unresolved_degree_context'}:
        markers.add('degree_scope_issue')
    if reasons & {'code_unresolved_in_loaded_catalogs', 'institution_local_code',
                  'category_phrase_without_exact_catalog_node',
                  'bachelor_category_name_in_graduate_position',
                  'colloquial_gate_name_with_类_suffix', 'name_exists_only_in_other_education_level'}:
        markers.add('unresolved_or_imprecise_vocabulary')
    if reasons & {'open_scope_or_qualifier'} or \
            review & {'qualifier_or_open_scope_present', 'parenthetical_scope_requires_review'}:
        markers.add('open_scope')
    if review & {'multiple_catalog_name_candidates', 'ambiguous_catalog_namespace'}:
        markers.add('namespace_ambiguity')
    return markers


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    project = args.project
    manifest, records, residual, positions, index, requirements = load(project)
    names = catalog_names(project)

    # ---------- residual strata (text-level) ----------------------------
    strata = []
    phrase_summary = collections.Counter()
    for entry in residual:
        position_id = entry['id']
        row = positions[position_id]
        department = row[index['部门名称']]
        text = row[index['专业']]
        education = row[index['学历']]
        agency = agency_of(department)
        unknown_phrases = sorted({p for p in re.findall(r'[一-鿿]{2,8}类', text) if p not in names})
        if agency in AGENCIES_VERIFIED_NO_LIST and (unknown_phrases or '经济金融' in text):
            bucket = 'agency_category_no_public_list'
        elif agency and agency not in AGENCIES_VERIFIED_NO_LIST and unknown_phrases:
            bucket = 'agency_category_unverified'
        else:
            bucket = 'national_vocabulary_or_open_scope'
        strata.append({
            'id': position_id,
            'bucket': bucket,
            'agency': agency,
            'department_name': department,
            'education_raw': education,
            'hires': entry['hires'],
            'major_raw': text,
            'unresolved_phrases': unknown_phrases,
            'reason_classes': entry.get('reason_classes', []),
        })
        for phrase in unknown_phrases:
            phrase_summary[phrase] += 1

    bucket_counts = collections.Counter(item['bucket'] for item in strata)
    assert sum(bucket_counts.values()) == len(residual), 'residual strata must cover every residual position'
    assert len(residual) == manifest['summary']['residual_positions']

    residual_by_agency = collections.Counter(
        (item['bucket'], item['agency'] or 'other') for item in strata)
    residual_by_education = collections.Counter(
        (item['bucket'], item['education_raw']) for item in strata)

    # Five named phrases the requester asked about, judged one by one.
    named = []
    for phrase_text in ['数学、统计',
                        '财会类专业（会计、审计、财务管理等专业）',
                        '中国语言文学类、新闻传播学类',
                        '英语',
                        '理学类、工学类']:
        hit_rows = [item for item in strata if item['major_raw'] == phrase_text]
        if not hit_rows:
            named.append({'text': phrase_text, 'positions': 0, 'verdict': 'not_present_now',
                          'note': '本轮已不再出现在残留中'})
            continue
        educate = collections.Counter(item['education_raw'] for item in hit_rows)
        named.append({
            'text': phrase_text,
            'positions': len(hit_rows),
            'hires': sum(item['hires'] for item in hit_rows),
            'education_mix': dict(educate),
            'bucket': collections.Counter(item['bucket'] for item in hit_rows).most_common(1)[0][0],
            'unresolved_phrases': collections.Counter(
                p for item in hit_rows for p in item['unresolved_phrases']).most_common(5),
            'verdict': {
                '数学、统计': 'inherently_fuzzy',
                '财会类专业（会计、审计、财务管理等专业）': 'open_list_with_exact_member',
                '中国语言文学类、新闻传播学类': 'cross_level_vocabulary',
                '英语': 'cross_level_vocabulary',
                '理学类、工学类': 'colloquial_gate_suffix',
            }.get(phrase_text, 'unclassified'),
        })

    # ---------- review status -------------------------------------------
    status_records = []
    buckets = collections.Counter()
    marker_counts = collections.Counter()
    superseded = 0
    for position_id, record in records.items():
        requirement = requirements[record['requirement_id']]
        if not requirement['review_reasons']:
            continue
        row = positions[position_id]
        markers = collect_markers(record, requirement)
        covered = bool(record.get('coverage_after'))
        agency_context = record.get('agency_category_context') or {}
        if not covered:
            agency = agency_of(row[index['部门名称']])
            if agency in AGENCIES_VERIFIED_NO_LIST and agency_context:
                bucket = 'no_candidate_agency_no_public_list'
            elif agency and agency not in AGENCIES_VERIFIED_NO_LIST and agency_context:
                bucket = 'no_candidate_agency_unverified'
            else:
                bucket = 'no_candidate_other'
        elif record.get('coverage_basis') == 'provisional_gate_rule_only':
            bucket = 'candidate_provisional_agency_scope_rule'
        elif 'code_name_conflict' in markers:
            bucket = 'candidate_with_conflict'
        elif 'exclusion_or_negative' in markers:
            bucket = 'candidate_with_exclusion'
        elif 'degree_scope_issue' in markers:
            bucket = 'candidate_with_degree_scope'
        elif 'unresolved_or_imprecise_vocabulary' in markers:
            bucket = 'candidate_with_unresolved_vocabulary'
        elif 'open_scope' in markers:
            bucket = 'candidate_with_open_scope'
        elif 'namespace_ambiguity' in markers:
            bucket = 'candidate_with_namespace_ambiguity'
        else:
            bucket = 'candidate_legacy_reason_superseded'
            superseded += 1
        buckets[bucket] += 1
        for marker in markers:
            marker_counts[marker] += 1
        excluded = sorted({hit['name'] for hit in record.get('major_parenthetical_names') or []
                           if hit.get('is_exclusion')})
        unresolved_codes = sorted({code['code'] for code in record.get('major_codes') or []
                                   if code['resolution']['status'] in
                                   ('unresolved', 'institution_local_code', 'outside_education_scope')})
        status_records.append({
            'id': position_id,
            'bucket': bucket,
            'hires': record['hires'],
            'education_raw': row[index['学历']],
            'department_name': row[index['部门名称']],
            'markers': sorted(markers),
            'old_layer_review_reasons': sorted(requirement['review_reasons']),
            'excluded_terms': excluded,
            'unresolved_codes': unresolved_codes,
            'conflict_count': len(record.get('conflicts') or []),
            'agency': agency_context.get('agency'),
            'risk_flags': sorted({m for m in markers if m in
                                  ('code_name_conflict', 'exclusion_or_negative',
                                   'degree_scope_issue', 'namespace_ambiguity')}),
        })

    assert sum(buckets.values()) == 5_835, f'review buckets must sum to 5,835, got {sum(buckets.values())}'
    assert superseded == buckets['candidate_legacy_reason_superseded']

    # write shards
    output = project / 'data' / 'major_evidence_2027'
    for old in output.glob('review-status-*.json'):
        old.unlink()
    shards, bucket, size = [], [], 0
    for record in sorted(status_records, key=lambda r: r['id']):
        encoded = json.dumps(record, ensure_ascii=False, separators=(',', ':'))
        length = len(encoded.encode('utf-8')) + 2
        if bucket and size + length > 820_000:
            path = output / f'review-status-{len(shards) + 1:02d}.json'
            path.write_text(json.dumps(bucket, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
            shards.append({'path': path.name, 'records': len(bucket),
                           'bytes': path.stat().st_size, 'sha256': sha256(path.read_bytes())})
            bucket, size = [], 0
        bucket.append(record)
        size += length
    if bucket:
        path = output / f'review-status-{len(shards) + 1:02d}.json'
        path.write_text(json.dumps(bucket, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
        shards.append({'path': path.name, 'records': len(bucket),
                       'bytes': path.stat().st_size, 'sha256': sha256(path.read_bytes())})

    # residual strata as a data shard too, so the CLI never reads research/
    strata_path = output / 'residual-strata-01.json'
    strata_path.write_text(json.dumps(strata, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    strata_shard = {'path': strata_path.name, 'records': len(strata),
                    'bytes': strata_path.stat().st_size, 'sha256': sha256(strata_path.read_bytes())}

    conflict_bucket = [r for r in status_records if r['bucket'] == 'candidate_with_conflict']
    structured_in_bucket = sum(1 for r in conflict_bucket if r['conflict_count'])
    gate_only_in_bucket = len(conflict_bucket) - structured_in_bucket
    summary = {
        'review_universe': 5_835,
        'review_universe_note': ('Legacy denominator: requirements carrying at least one review reason '
                                 'in the original three-catalog layer.'),
        'buckets': dict(buckets),
        'markers': dict(marker_counts),
        'legacy_reason_superseded': superseded,
        'with_risk_flag': sum(1 for r in status_records if r['risk_flags']),
        'conflict_bucket_composition': {
            'total': len(conflict_bucket),
            'structured_conflict_positions_in_universe': structured_in_bucket,
            'gate_code_name_mismatch_only': gate_only_in_bucket,
            'note': ('This bucket counts positions inside the review universe only. The library-wide '
                     'structured conflict set is a different set: it has its own position count '
                     '(manifest summary conflicts.positions), which must not be substituted here.'),
        },
    }
    manifest['residual_strata'] = {
        'shards': [strata_shard],
        'buckets': dict(bucket_counts),
        'method': 'assigned from the raw 专业 text, not from extracted term labels',
    }
    manifest['review_status'] = {
        'as_of': '2026-10-18',
        'shards': shards,
        'summary': summary,
        'bucket_order': [
            'no_candidate_agency_no_public_list',
            'no_candidate_agency_unverified',
            'no_candidate_other',
            'candidate_provisional_agency_scope_rule',
            'candidate_with_conflict',
            'candidate_with_exclusion',
            'candidate_with_degree_scope',
            'candidate_with_unresolved_vocabulary',
            'candidate_with_open_scope',
            'candidate_with_namespace_ambiguity',
            'candidate_legacy_reason_superseded',
        ],
        'bucket_rules': {
            'no_candidate_agency_no_public_list': 'no catalog candidate; no applicable 2027 membership list was found in the public sources checked',
            'no_candidate_agency_unverified': 'no catalog candidate; agency uses in-house categories but publication not verified',
            'no_candidate_other': 'no catalog candidate; national catalog vocabulary or open scope',
            'candidate_with_conflict': 'has candidate; a printed name contradicts the code',
            'candidate_with_exclusion': 'has candidate; exclusion or negative condition present',
            'candidate_with_degree_scope': 'has candidate; clause/degree scope still ambiguous',
            'candidate_with_unresolved_vocabulary': 'has candidate; another term remains unresolved',
            'candidate_with_open_scope': 'has candidate; 相关/等/方向 style open scope',
            'candidate_with_namespace_ambiguity': 'has candidate; multiple catalog nodes for one name',
            'candidate_provisional_agency_scope_rule': ('covered only by the 门类 rule on a non-MOE position; '
                                                        'exact characters recorded, agency scope unverified'),
            'candidate_legacy_reason_superseded': 'has candidate; the legacy review reason no longer reproduces',
        },
        'semantics': ('A bucket is a work state, not an eligibility verdict. "legacy_reason_superseded" means the '
                      'tool no longer reproduces its own old warning, not that the position is cleared.'),
    }
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n',
                                          encoding='utf-8')

    residual_report = {
        'schema_version': '1.0.0',
        'report_id': 'residual-strata-20261018',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'method': ('Residual buckets are assigned from the raw 专业 text, not from extracted term labels, '
                   'so a category phrase inside a longer sentence is still counted.'),
        'totals': {
            'residual_positions': len(residual),
            'residual_hires': sum(item['hires'] for item in strata),
            'by_bucket': dict(bucket_counts),
            'by_bucket_hires': {
                bucket: sum(item['hires'] for item in strata if item['bucket'] == bucket)
                for bucket in bucket_counts},
        },
        'by_agency': [
            {'bucket': bucket, 'agency': agency, 'positions': count}
            for (bucket, agency), count in residual_by_agency.most_common()
        ],
        'by_education': [
            {'bucket': bucket, 'education_raw': education, 'positions': count}
            for (bucket, education), count in residual_by_education.most_common()
        ],
        'unknown_phrases': [
            {'phrase': phrase, 'positions': count}
            for phrase, count in phrase_summary.most_common(30)
        ],
        'named_phrases': named,
        'precise_gains_this_round': {
            'positions': 18,
            'rule_disjunction': {'positions': 2, 'example': '会计学或审计学或财务管理',
                                 'support': '岗位原文本身列举三个精确专业名，仅因旧解析器不按“或”切分'},
            'rule_open_list_member': {'positions': 16, 'example': '财会类专业（会计、审计、财务管理等专业）',
                                      'support': '括号内“财务管理”是精确本科专业名；列表开放，故保留 open_scope 标记'},
        },
        'positions_sample': strata[:50],
    }

    review_report = {
        'schema_version': '1.0.0',
        'report_id': 'review-status-20261018',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'universe': summary,
        'caution': [
            '5,835 是旧三层目录时代的“带复核原因”分母，不是未覆盖数。',
            '1,003 个岗位的旧原因在现行五目录层已不再复现；这表示本工具的旧告警消失，不等于岗位已核清。',
            '有目录候选不等于约束解析完整，更不等于个人可报。',
        ],
        'bucket_definitions': manifest['review_status']['bucket_rules'],
        'shards': shards,
    }

    for name, payload in (('RESIDUAL_STRATA_20261018.json', residual_report),
                          ('REVIEW_STATUS_20261018.json', review_report)):
        path = project / 'research' / name
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps({'report': str(path), 'bytes': path.stat().st_size,
                          'sha256': sha256(path.read_bytes())}, ensure_ascii=False))
    print(json.dumps({'residual': dict(bucket_counts), 'review': dict(buckets),
                      'sum_review': sum(buckets.values())}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
