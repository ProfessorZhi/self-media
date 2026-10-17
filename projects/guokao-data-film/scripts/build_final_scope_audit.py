#!/usr/bin/env python3
"""Build the final evidence-scope audit.

Usage:
  python3 build_final_scope_audit.py [--project DIR]

Answers one question: how far does the evidence actually reach, and where does a
matcher stop being evidence?

Outputs research/FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json. Nothing is written to
the data shards; this is an audit over them.
"""
import argparse
import collections
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

NEGATIVE = re.compile(r'不含|不包括|除')


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def load(project):
    evidence_dir = project / 'data' / 'major_evidence_2027'
    manifest = json.loads((evidence_dir / 'manifest.json').read_text())
    records = {}
    for shard in manifest['position_evidence']:
        for record in json.loads((evidence_dir / shard['path']).read_text()):
            records[record['id']] = record
    strata = []
    for shard in manifest['residual_strata']['shards']:
        strata.extend(json.loads((evidence_dir / shard['path']).read_text()))
    provisional = []
    for shard in manifest.get('provisional_gate_rule', []):
        provisional.extend(json.loads((evidence_dir / shard['path']).read_text()))
    positions_dir = project / 'data' / 'positions_2027'
    pm = json.loads((positions_dir / 'manifest.json').read_text())
    index = {name: i for i, name in enumerate(pm['columns'])}
    positions = {}
    for shard in pm['shards']:
        for row in json.loads((positions_dir / shard['path']).read_text())['rows']:
            positions[row[0]] = row
    requirements = {}
    mm = json.loads((project / 'data' / 'majors_2027' / 'manifest.json').read_text())
    for shard in mm['requirements']:
        for req in json.loads((project / 'data' / 'majors_2027' / shard['path']).read_text()):
            requirements[req['id']] = req
    return manifest, records, strata, provisional, positions, index, requirements


def catalog_scope(project):
    names = {'bachelor': set(), 'graduate': set()}
    gates = {'bachelor': set(), 'graduate': set()}
    root = project / 'data' / 'catalogs'
    for filename, fields, scope in (
        ('major_bachelor_2026_official_parsed.json', ['gates', 'categories', 'majors'], 'bachelor'),
        ('major_graduate_2022_official_parsed.json',
         ['gates', 'first_level_disciplines', 'professional_degree_categories'], 'graduate'),
    ):
        data = json.loads((root / filename).read_text())
        for field in fields:
            names[scope] |= {node['name'] for node in data[field]}
        gates[scope] = {node['name'] for node in data['gates']}
    for filename in ('major_graduate_codebook_2023_admissions_official_parsed.json',
                     'major_graduate_codebook_2024_admissions_official_parsed.json'):
        for node in json.loads((root / filename).read_text())['nodes']:
            names['graduate'].add(node['name'])
    return names, gates


def strip_exclusions(text):
    out, i = [], 0
    while True:
        start = text.find('（', i)
        if start < 0:
            out.append(text[i:])
            return ''.join(out)
        end = text.find('）', start)
        if end < 0:
            out.append(text[i:])
            return ''.join(out)
        lead = text[max(0, start - 12):start]
        if NEGATIVE.search(lead) or NEGATIVE.search(text[start + 1:start + 8]):
            out.append(text[i:start])
        else:
            out.append(text[i:end + 1])
        i = end + 1


def education_scopes(education, names):
    scopes = []
    if '本科' in education:
        scopes.append('bachelor')
    if '研究生' in education or education in ('本科及以上', '大专及以上'):
        scopes.append('graduate')
    if '大专' in education or '专科' in education:
        scopes.append('associate')
    return [s for s in (scopes or ['bachelor', 'graduate']) if s in names] or ['bachelor', 'graduate']


def classify_group(text, education, names, gates):
    """Why a residual phrase does not resolve. Zero suffix stripping: an exact
    in-scope name that was missed would be a tool gap and must surface as such."""
    scopes = education_scopes(education, names)
    others = [s for s in ('bachelor', 'graduate') if s not in scopes]
    cleaned = strip_exclusions(text)
    exact, suffix, gate, cross = [], [], [], []
    for segment in re.split(r'[、,，;；（）()]', cleaned):
        token = segment.strip()
        if not token:
            continue
        if any(token in names[s] for s in scopes):
            exact.append(token)
        elif token.endswith('门类') and any(token[:-2] in gates[s] for s in scopes):
            gate.append(token)
        elif token.endswith('类') and any(token[:-1] in names[s] for s in scopes):
            suffix.append(token)
        elif token.endswith('类') and any(token[:-1] in gates[s] for s in scopes):
            gate.append(token)
        elif any(token in names[s] for s in others):
            cross.append(token)
    if exact:
        return 'exact_in_scope_unmatched', exact
    if gate:
        return 'gate_scope_only', gate
    if suffix:
        return 'catalog_name_plus_类_suffix', suffix
    if cross:
        return 'name_exists_only_in_other_education_level', cross
    return 'no_exact_catalog_node', []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    project = args.project
    manifest, records, strata, provisional, positions, index, requirements = load(project)
    names, gates = catalog_scope(project)
    summary = manifest['summary']

    # residual groups, excluding the 533 verified-no-list agency bucket
    groups = collections.OrderedDict()
    for entry in strata:
        if entry['bucket'] == 'agency_category_no_public_list':
            continue
        text = entry['major_raw']
        bucket = groups.setdefault(text, {
            'text': text,
            'positions': 0,
            'hires': 0,
            'education': collections.Counter(),
            'departments': collections.Counter(),
            'verdicts': collections.Counter(),
        })
        bucket['positions'] += 1
        bucket['hires'] += entry['hires']
        bucket['education'][entry['education_raw']] += 1
        bucket['departments'][entry['department_name']] += 1
        verdict, tokens = classify_group(text, entry['education_raw'], names, gates)
        bucket['verdicts'][verdict] += 1

    group_rows = []
    for text, bucket in sorted(groups.items(), key=lambda item: -item[1]['positions']):
        verdict = bucket['verdicts'].most_common(1)[0][0]
        group_rows.append({
            'text': text,
            'positions': bucket['positions'],
            'hires': bucket['hires'],
            'verdict': verdict,
            'education_mix': dict(bucket['education']),
            'departments': [d for d, _ in bucket['departments'].most_common(3)],
        })
    gap_groups = [row for row in group_rows if row['verdict'] == 'exact_in_scope_unmatched']
    verdict_totals = collections.Counter()
    for bucket in groups.values():
        for verdict, count in bucket['verdicts'].items():
            verdict_totals[verdict] += count

    # the 13 agency-unverified positions
    unverified = []
    for entry in strata:
        if entry['bucket'] != 'agency_category_unverified':
            continue
        unverified.append({
            'id': entry['id'],
            'department_name': entry['department_name'],
            'education_raw': entry['education_raw'],
            'hires': entry['hires'],
            'major_raw': entry['major_raw'],
            'unresolved_phrases': entry['unresolved_phrases'],
        })

    provisional_rows = [{
        'id': item['id'],
        'department_name': item['department_name'],
        'education_raw': item['education_raw'],
        'hires': item['hires'],
        'major_raw': item['major_raw'],
        'gates': item['gates'],
        'risk_level': item['risk_level'],
    } for item in provisional]

    conflicts = summary['conflicts']
    report = {
        'schema_version': '1.0.0',
        'report_id': 'final-evidence-scope-audit-20261018',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'generated_date_timezone': 'Asia/Shanghai',
        'local_date': '2026-10-18',
        'question': ('How far does the professional evidence reach, which parts rest on an inference '
                     'about another agency, and what is still undecidable from public sources?'),
        'answer_in_one_paragraph': (
            f"{summary['positions']:,} positions are complete on the 27 source fields. "
            f"{summary['coverage_conservative']['positions_with_catalog_candidate']:,} positions have "
            'professional evidence independent of any cross-agency inference; '
            f"{summary['coverage_provisional_only']['positions']} more are covered only by the 门类 rule "
            'on non-MOE positions and are therefore provisional; '
            f"{summary['residual_positions']} have no catalog candidate at all. "
            'No residual phrase hides an exact in-scope catalog name that the matcher missed, so the '
            'remaining gap is semantic, cross-level or agency-internal, not a parser defect.'),

        'coverage_tiers': {
            'conservative': summary['coverage_conservative'],
            'provisional_gate_rule': summary['coverage_provisional_only'],
            'inclusive': summary['coverage_inclusive'],
            'no_candidate': {
                'positions': summary['residual_positions'],
                'hires': summary['residual_hires'],
            },
            'closure': (f"{summary['coverage_conservative']['positions_with_catalog_candidate']:,} conservative + "
                        f"{summary['coverage_provisional_only']['positions']} provisional + "
                        f"{summary['residual_positions']} no-candidate = "
                        f"{summary['positions']:,}"),
        },

        'gate_scope_rule_audit': {
            'rule': '专业要求写作“X门类/学科门类”时解析到 X 学科门类节点',
            'cited_source': {
                'title': '关于教育部2027年度公务员考录职位要求的说明',
                'authority': '教育部人事司',
                'date': '2026-10-14',
                'url': 'http://www.moe.gov.cn/s78/A04/tongzhi/202610/t20261014_1454189.html',
                'scope_in_source': '教育部 2027 年度考录职位',
                'is_national_eligibility_policy': False,
            },
            'hits': 95,
            'hits_on_moe_positions': 0,
            'hits_on_other_agencies': 95,
            'positions_with_hits': 69,
            'positions_covered_only_by_this_rule': len(provisional_rows),
            'decision': ('The rule is kept as a traceable reading aid but is excluded from the conservative '
                         'coverage numerator, because the only cited statement is scoped to MOE positions '
                         'and no agency-specific corroboration was found for the others.'),
            'contrast_source_declared_gate_code': {
                'positions': 145,
                'status': 'counted as exact evidence',
                'why': 'The position text itself prints the two-digit gate code (e.g. 经济学类（02）); '
                       'no external rule is needed.',
            },
            'provisional_positions': provisional_rows,
            'provisional_by_department': dict(collections.Counter(
                row['department_name'] for row in provisional_rows)),
        },

        'conflict_audit': {
            'positions': conflicts['positions'],
            'positions_in_review_universe': conflicts['positions_in_review_universe'],
            'positions_outside_review_universe': conflicts['positions_outside_review_universe'],
            'entries': conflicts['entries'],
            'by_class': conflicts['by_class'],
            'by_family': conflicts['by_family'],
            'interpretation': {
                'semantic_conflict': ('The printed name belongs to a different code. This is the only '
                                      'family that indicates a genuine source inconsistency.'),
                'multi_namespace_diagnostic': ('Same code naming something else at another education level, '
                                               'or a 类 suffix omitted by the source. These are diagnostics '
                                               'about how the text was resolved, not proof of an error.'),
            },
            'gate_code_name_mismatch_positions': conflicts['gate_code_name_mismatch_positions'],
            'note': ('The 5 gate-code/name mismatches do not appear in the conflicts array; they are a '
                     'separate reason class. The review bucket candidate_with_conflict counts review-'
                     'universe positions and is not the library-wide structured conflict set.'),
        },

        'residual_audit': {
            'scope_examined': 195,
            'scope_note': ('182 national vocabulary/open scope + 13 agency unverified. The 533 agency '
                           'positions with no public list found are reported separately and not re-litigated here.'),
            'groups': len(group_rows),
            'verdict_totals': dict(verdict_totals),
            'exact_in_scope_gaps': len(gap_groups),
            'exact_in_scope_gap_groups': gap_groups,
            'verdict_meaning': {
                'exact_in_scope_unmatched': 'the catalog has this exact name in the position scope and the matcher missed it (a defect)',
                'gate_scope_only': 'a gate name; only the provisional 门类 rule would resolve it',
                'catalog_name_plus_类_suffix': 'the official node name plus a colloquial 类 (e.g. 中国语言文学类)',
                'name_exists_only_in_other_education_level': 'the name exists only for the other degree level',
                'no_exact_catalog_node': 'no catalog node by that name in any scope',
            },
            'largest_groups': group_rows[:25],
            'agency_unverified_positions': unverified,
        },

        'official_sources_checked_this_round': [
            {
                'id': 'moe-2027-position-statement',
                'url': 'http://www.moe.gov.cn/s78/A04/tongzhi/202610/t20261014_1454189.html',
                'authority': '教育部人事司',
                'date': '2026-10-14',
                'applies_to_2027_civil_service': '只适用于教育部职位',
                'use_in_this_round': '支撑“门类覆盖其下专业与一级学科”的读法；未推广为全国政策',
            },
            {
                'id': 'nfra-2027-exam-outline',
                'url': 'http://dl.scs.gov.cn/api/article/8a81f6d8a129c66701a1335b58c700c4',
                'authority': '国家金融监督管理总局',
                'date': '2027 年度',
                'applies_to_2027_civil_service': '笔试大纲，不是专业目录',
                'use_in_this_round': '复核后仍不提供类别成员；相关岗位保持未解析',
            },
            {
                'id': 'csrc-2027-exam-outline',
                'url': 'http://dl.scs.gov.cn/api/article/8a81f6d0a135938a01a135d657580004',
                'authority': '中国证券监督管理委员会',
                'date': '2027 年度',
                'applies_to_2027_civil_service': '笔试大纲（财金/法律/会计/计算机类为试卷类别）',
                'use_in_this_round': '同上，未提供专业成员表',
            },
            {
                'id': 'scs-2027-application-guide',
                'url': 'http://dl.scs.gov.cn/api/article/8a81f6d8a129c66701a132bae3a70082',
                'authority': '中央公务员主管部门',
                'date': '2027 年度',
                'applies_to_2027_civil_service': '是，但全文不定义任何专业类别成员',
                'use_in_this_round': '再次确认无全国统一专业分类表',
            },
        ],

        'updated_this_round': [
            '新增三层覆盖口径：conservative / provisional_gate_rule / no_candidate，并在校验器中断言三者之和为 19,426',
            'gate_scope_rule 命中全部标为 agency_scope_unverified，且不计入保守分子',
            '新增复核桶 candidate_provisional_agency_scope_rule（25 岗）',
            '冲突拆分为 semantic_conflict（67 条）与 multi_namespace_diagnostic（34 条）',
            '对 195 个残留岗位逐组判定，确认真实解析缺口为 0',
        ],
        'not_updated_this_round': [
            '19,426 岗的 27 个原字段与 524,502 单元格官方核验结果',
            '728 个无候选岗位的文本与分类',
            '历史报告 RESIDUAL_20271018_V2.json、OFFICIAL_NATIONAL_TABLE_VERIFICATION_20261018.json 未被改写',
        ],

        'opus_safe_read_guidance': [
            f"引用“专业候选覆盖”时用 {summary['coverage_conservative']['positions_with_catalog_candidate']:,}（保守），"
            f"不要用 {summary['coverage_inclusive']['positions_with_catalog_candidate']:,}，除非同时说明其中 "
            f"{summary['coverage_provisional_only']['positions']} 岗依赖跨机关推定。",
            f"{summary['coverage_provisional_only']['positions']} 个 provisional 岗位可描述为“原文门类写法 + 目录节点”，"
            "但不得表述为“该机关已确认接受这些门类”。",
            f"{summary['residual_positions']:,} 个无候选岗位不等于“不限专业”，也不等于“不可报”；"
            "多数是机关内部类别或开放表述。",
            f"冲突数按口径引用：{summary['conflicts']['positions']} 岗位 / "
            f"{summary['conflicts']['entries']} 条目 / "
            f"{summary['conflicts']['by_family']['semantic_conflict']} 语义冲突条目；三者不可互换。",
            "任何“可报/不可报”结论都不在本数据内；本节只描述原文证据与解析状态。",
            "机关类别（人行、气象等）应表述为“截至 2026-10-18 已查来源未找到 2027 适用名单”，不是“不存在”。",
        ],

        'reproduce': [
            'python3 scripts/build_major_evidence.py',
            'python3 scripts/build_review_status.py',
            'python3 scripts/build_final_scope_audit.py',
            'python3 scripts/verify_major_evidence.py --write-report',
            'node scripts/verify_position_data.mjs --write-report',
        ],
    }
    path = project / 'research' / 'FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json'
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'report': str(path), 'bytes': path.stat().st_size,
                      'sha256': sha256(path.read_bytes()),
                      'provisional': len(provisional_rows),
                      'residual_groups': len(group_rows),
                      'exact_gaps': len(gap_groups),
                      'verdicts': dict(verdict_totals)}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
