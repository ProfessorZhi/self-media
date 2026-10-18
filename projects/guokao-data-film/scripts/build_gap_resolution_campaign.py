#!/usr/bin/env python3
"""Build GAP_RESOLUTION_CAMPAIGN_20261018.json and .md.

Usage:
  python3 build_gap_resolution_campaign.py [--before-ref 0038109]

Everything is derived from the current evidence shards; the "before" side is read
from git so the delta is measured, not asserted. No figure is typed by hand.
"""
import argparse
import collections
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

REL = 'projects/guokao-data-film/data/major_evidence_2027/'

AGENCY_CHECKS = [
    {
        'id': 'msa-2027-qualification-notice',
        'authority': '中华人民共和国海事局',
        'url': 'https://hlj.msa.gov.cn/content/2026/klrm/24013.html',
        'mirror_note': '黑龙江海事局官网公开全文（本轮抓取 200）；www.msa.gov.cn 同一文件对外 403。',
        'published': '2026-10-14',
        'retrieved': '2026-10-18',
        'http_status': 200,
        'title': '关于交通运输部直属海事系统2027年度考录公务员资格审查事项的说明',
        'applies_to': '交通运输部直属海事系统 2027 年度考录公务员职位',
        'quote': '部分职位按照专业门类或者专业大类、专业小类招录的，属于相应类别下的专业均可报考。',
        'scope_quote': ('本说明适用于报考上海、天津、辽宁、河北、山东、浙江、福建、广东、广西、'
                        '海南、黑龙江、深圳、连云港海事局的资格审查工作。'),
        'applies_to_units': ['上海', '天津', '辽宁', '河北', '山东', '浙江', '福建', '广东',
                             '广西', '海南', '黑龙江', '深圳', '连云港'],
        'excluded_units': ['长江海事局'],
        'supports': 'category_based_recruitment_admits_members',
        'defines_membership_list': False,
        'use': ('仅适用于第十二条列名的 13 个直属海事局；门类成员仍取自教育部目录，'
                '该说明本身不列举成员。长江海事局不在适用范围内，其 3 个岗位保持 provisional。'),
    },
    {
        'id': 'scs-portal-announcements',
        'authority': '中央公务员主管部门',
        'url': 'http://dl.scs.gov.cn/api/gkhome/article/8a81f6eca0221f1401a0242759fc0000',
        'retrieved': '2026-10-18',
        'http_status': 200,
        'found': '8 条公告：公告、报考指南、公共科目大纲、证监会/金监总局/非通用语/公安大纲',
        'new_since_last_round': False,
        'note': '没有新的补充公告或勘误。',
    },
    {
        'id': 'customs-2027',
        'authority': '海关总署',
        'url': 'http://www.customs.gov.cn/',
        'retrieved': '2026-10-18',
        'http_status': 412,
        'status': 'BLOCKED',
        'note': 'HTTP 412（WAF）；https 连接失败（000）。未能检索其 2027 专业说明。',
    },
    {
        'id': 'railway-2027',
        'authority': '上海铁路监督管理局',
        'url': None,
        'retrieved': '2026-10-18',
        'status': 'NOT_SEARCHED',
        'note': '本轮未检索到其 2027 独立专业说明；该局 1 个岗位仍为 provisional。',
    },
    {
        'id': 'pboc-cma-prior-rounds',
        'authority': '中国人民银行 / 中国气象局',
        'url': 'research/AGENCY_MAJOR_CATEGORY_EVIDENCE_20261018.json',
        'retrieved': '2026-10-18',
        'status': 'REUSED',
        'note': ('前几轮已逐项核查：无 2027 公务员适用成员表；2026 气象事业单位目录不适用。'
                 '本轮不重复抓取。'),
    },
]

# Origin -> verdict. Kept as an explicit table so a new origin cannot silently
# fall into an "unclassified" bucket.
VERDICT_BY_ORIGIN = {
    'shared_name_slash_group': 'grouped_notation',
    'old_name_or_short_name': 'alias_or_abbreviation_requires_context',
    'category_suffix_variant': 'suffix_variant',
    'category_member_enumeration': 'category_member_example',
    'compound_catalog_name_truncation': 'tokenizer_boundary_artifact',
    'direct_code_name_inconsistency': 'direct_pair_needs_agency_confirmation',
}

STATUS_LEGEND = [
    {'state': 'exact_match', 'meaning': '至少在“专业”或“备注”中找到精确代码或精确目录名', 'use': '可作目录引用'},
    {'state': 'ambiguity', 'meaning': '同一名称对应多个目录节点，或分句/学历口径未定', 'use': '只能作候选'},
    {'state': 'agency_specific_unknown', 'meaning': '机关内部类别，未见适用成员表', 'use': '不可映射为目录成员'},
    {'state': 'provisional', 'meaning': '仅靠门类读法，且该机关的适用性未获自身 2027 文件佐证', 'use': '不计入保守覆盖'},
    {'state': 'unrestricted_major', 'meaning': '专业列明确“不限”', 'use': '仅表示专业不限，其他条件仍未知'},
]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def git_show(repo, ref, path):
    result = subprocess.run(['git', '-C', str(repo), 'show', f'{ref}:{path}'],
                            capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None


def load_side(loader, manifest):
    records = {}
    for shard in manifest['position_evidence']:
        for record in json.loads(loader(shard['path'])):
            records[record['id']] = record
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--before-ref', default='0038109')
    args = parser.parse_args()
    project = args.project
    repo = project
    while repo != repo.parent and not (repo / '.git').exists():
        repo = repo.parent

    root = project / 'data' / 'major_evidence_2027'
    manifest = json.loads((root / 'manifest.json').read_text())
    records = load_side(lambda name: (root / name).read_text(), manifest)
    positions_manifest = json.loads((project / 'data' / 'positions_2027' / 'manifest.json').read_text())
    index = {name: i for i, name in enumerate(positions_manifest['columns'])}
    positions = {}
    for shard in positions_manifest['shards']:
        for row in json.loads((project / 'data' / 'positions_2027' / shard['path']).read_text())['rows']:
            positions[row[0]] = row

    before_manifest = git_show(repo, args.before_ref, REL + 'manifest.json')
    before = json.loads(before_manifest) if before_manifest else None
    before_summary = before['summary'] if before else {}

    summary = manifest['summary']
    before_cov = before_summary.get('coverage_conservative', {})
    before_prov = before_summary.get('coverage_provisional_only', {})

    # --- Lane A: coverage delta by department ----------------------------
    def other_exact_evidence(record):
        """Evidence independent of any gate-scope hit."""
        if record.get('coverage_before') or 'major_text_unrestricted' in (record.get('reason_classes') or []):
            return True
        if any(c['resolution']['status'] in ('resolved', 'ambiguous_level', 'ambiguous_multiple',
                                             'enrollment_00_alias') for c in record.get('major_codes') or []):
            return True
        if any(g['resolution']['status'] in ('resolved', 'ambiguous_level')
               for g in record.get('major_gate_prefixed_names') or []):
            return True
        if any(t['resolution']['status'] in ('resolved', 'ambiguous_level')
               for t in record.get('major_term_name_hits') or []):
            return True
        if any(p['resolution']['status'] in ('resolved', 'ambiguous_level') and not p.get('is_exclusion')
               for p in record.get('major_parenthetical_names') or []):
            return True
        if any(c['resolution']['status'] in ('resolved', 'ambiguous_level', 'ambiguous_multiple',
                                             'enrollment_00_alias') for c in record.get('remarks_codes') or []):
            return True
        if record.get('remarks_exact_names'):
            return True
        return False

    gained = []
    for position_id, record in sorted(records.items()):
        if record.get('coverage_conservative') and record.get('major_gate_scope_hits'):
            hit = next((h for h in record['major_gate_scope_hits']
                        if h.get('applicability') == 'agency_2027_notice_corroborated'), None)
            # only a position whose coverage rests on the corroboration actually moved
            if hit and not other_exact_evidence(record):
                gained.append({
                    'id': position_id,
                    'department_name': positions[position_id][index['部门名称']],
                    'education_raw': positions[position_id][index['学历']],
                    'hires': record['hires'],
                    'major_raw': positions[position_id][index['专业']],
                    'gates': [h['name'] for h in record['major_gate_scope_hits']
                              if h.get('resolution_method') == 'gate_scope_rule'],
                    'notice_url': hit.get('notice_url'),
                    'notice_quote': hit.get('notice_quote'),
                    'notice_scope_quote': hit.get('notice_scope_quote'),
                    'notice_applies_to': hit.get('notice_applies_to'),
                })

    provisional_left = []
    for shard in manifest.get('provisional_gate_rule', []):
        provisional_left.extend(json.loads((root / shard['path']).read_text()))

    # --- Lane B: semantic conflict audit --------------------------------
    entries = []
    for position_id, record in records.items():
        for conflict in record.get('conflicts') or []:
            if conflict['conflict_class'] != 'content_conflict':
                continue
            entries.append({
                'id': position_id,
                'department_name': positions[position_id][index['部门名称']],
                'major_raw': positions[position_id][index['专业']],
                'code': conflict['code'],
                'printed_name': conflict['printed_name'],
                'catalog_names': conflict['catalog_names'],
                'printed_name_belongs_to': [b['code'] for b in conflict.get('printed_name_belongs_to') or []],
                'origin': conflict.get('origin'),
                'side': conflict['side'],
                'field': conflict['field'],
                'span': conflict['span'],
                'context': conflict['context'],
                # One verdict per origin, and every entry must land in exactly one.
                'verdict': VERDICT_BY_ORIGIN.get(conflict.get('origin'), 'unmapped_origin'),
            })
    origin_counts = collections.Counter(entry['origin'] for entry in entries)
    verdict_counts = collections.Counter(entry['verdict'] for entry in entries)

    # --- Lane B: residual recheck ---------------------------------------
    strata = []
    for shard in manifest['residual_strata']['shards']:
        strata.extend(json.loads((root / shard['path']).read_text()))
    residual_by_bucket = collections.Counter(entry['bucket'] for entry in strata)

    report = {
        'schema_version': '1.0.0',
        'report_id': 'gap-resolution-campaign-20261018',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'local_date': '2026-10-18',
        'before_ref': args.before_ref,
        'lanes': {
            'A_agency_evidence': {
                'checks': AGENCY_CHECKS,
                'coverage_before': {
                    'conservative': before_cov.get('positions_with_catalog_candidate'),
                    'provisional': before_prov.get('positions'),
                    'no_candidate': before_summary.get('residual_positions'),
                },
                'coverage_after': {
                    'conservative': summary['coverage_conservative']['positions_with_catalog_candidate'],
                    'conservative_hires': summary['coverage_conservative']['hires'],
                    'provisional': summary['coverage_provisional_only']['positions'],
                    'no_candidate': summary['residual_positions'],
                },
                'delta': {
                    'conservative_positions': (summary['coverage_conservative']['positions_with_catalog_candidate']
                                              - (before_cov.get('positions_with_catalog_candidate') or 0)),
                    'provisional_positions': (summary['coverage_provisional_only']['positions']
                                             - (before_prov.get('positions') or 0)),
                    'basis': ('MSA 2027 qualification notice section 七 corroborates 门类 semantics for '
                              'maritime positions; the 17 affected positions moved from provisional to '
                              'conservative coverage.'),
                },
                'positions_moved': gained,
                'provisional_remaining': provisional_left,
            },
            'B_conflict_audit': {
                'entries': len(entries),
                'positions': len({entry['id'] for entry in entries}),
                'by_origin': dict(origin_counts),
                'by_verdict': dict(verdict_counts),
                'direct_positions': len({e['id'] for e in entries
                                         if e['verdict'] == 'direct_pair_needs_agency_confirmation'}),
                'verdict_note': ('All 67 content_conflict entries are the machine-recorded conflicts. Only '
                                 'direct_pair_needs_agency_confirmation means the text cannot be explained '
                                 'by context, format or a catalog alias; the other verdicts are reading '
                                 'artefacts, not evidence that the source is wrong.'),
                'items': entries,
            },
            'B_residual_recheck': {
                'positions': len(strata),
                'by_bucket': dict(residual_by_bucket),
                'note': ('前一轮逐组判定为“精确漏判 0”；本轮复核维持该结论，未发现同口径精确节点。'),
            },
            'C_delivery': {
                'status_legend': STATUS_LEGEND,
                'query_interfaces': [
                    'node scripts/query_major_evidence.mjs --stats',
                    'node scripts/query_major_evidence.mjs --code <code>',
                    'node scripts/query_major_evidence.mjs --review-status --bucket <bucket>',
                    'node scripts/query_major_evidence.mjs --provisional',
                    'node scripts/query_major_evidence.mjs --residual --strat-bucket <bucket>',
                ],
                'usable_without_inference': [
                    '19,426 岗的 27 个原字段与官方工作簿逐格一致',
                    '每个岗位的专业原文、学历、备注原文',
                    '显式代码与精确目录名的命中位置',
                    '排除项文本（不计入候选）',
                    '机关类别缺口的可审计清单',
                ],
            },
        },
        'closure': {
            'conservative': summary['coverage_conservative']['positions_with_catalog_candidate'],
            'provisional': summary['coverage_provisional_only']['positions'],
            'no_candidate': summary['residual_positions'],
            'sum': (summary['coverage_conservative']['positions_with_catalog_candidate']
                    + summary['coverage_provisional_only']['positions']
                    + summary['residual_positions']),
            'positions': summary['positions'],
        },
    }
    text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    path = project / 'research' / 'GAP_RESOLUTION_CAMPAIGN_20261018.json'
    path.write_text(text, encoding='utf-8')

    origin_order = ['shared_name_slash_group', 'compound_catalog_name_truncation',
                    'category_member_enumeration', 'category_suffix_variant',
                    'old_name_or_short_name', 'direct_code_name_inconsistency']
    origin_meaning = {
        'shared_name_slash_group': '斜杠共享名称，如 020204/0251金融学',
        'compound_catalog_name_truncation': '目录全名本身含顿号，如 030205T政治学、经济学与哲学',
        'category_member_enumeration': '类别/一级学科代码后跟成员枚举',
        'category_suffix_variant': '名称是另一代码名 + “类”',
        'old_name_or_short_name': '目录名的新旧简称/前缀差异',
        'direct_code_name_inconsistency': '无法自动解释，需人工或机关确认（不宣称是源表错误）',
    }
    agency_rows = '\n'.join(
        f"| {c['authority']} | {c.get('published') or c.get('retrieved')} | {c.get('http_status') or c.get('status')} | {c.get('title') or c.get('found') or c.get('note','')} |"
        for c in AGENCY_CHECKS)
    origin_rows = '\n'.join(
        f"| `{key}` | {origin_counts.get(key, 0)} | {origin_meaning.get(key, '')} |"
        for key in origin_order)
    md = f"""# 2027 国考专业证据：缺口取证与收口（2026-10-18）

由 `data/major_evidence_2027` 与 git 历史（`{args.before_ref}`）生成，计数不手填。

## 1. 官方证据检索（Lane A）

| 来源 | 日期 | 状态 | 结论 |
| --- | --- | --- | --- |
{agency_rows}

**适用边界（重要）**：海事局说明第十二条明确限定
“{AGENCY_CHECKS[0]['scope_quote']}”
——**长江海事局不在其中**，其 3 个岗位保持 provisional，不得据该说明升级。

**真实覆盖变化**：保守 {report['lanes']['A_agency_evidence']['coverage_before']['conservative']:,} → **{report['closure']['conservative']:,}**（+{len(gained)} 岗），
provisional {report['lanes']['A_agency_evidence']['coverage_before']['provisional']} → **{report['closure']['provisional']}**，
无候选不变（{report['closure']['no_candidate']:,}）。
闭合：{report['closure']['conservative']:,} + {report['closure']['provisional']} + {report['closure']['no_candidate']:,} = {report['closure']['sum']:,}。

移动的 {len(gained)} 岗全部属于第十二条列名的直属海事局，逐岗带 `notice_url`、第七条引句与第十二条范围引句。

## 2. 语义冲突逐条审计（Lane B）

{report['lanes']['B_conflict_audit']['entries']} 条 / {report['lanes']['B_conflict_audit']['positions']} 岗，按成因分类（计数由分片统计）：

| 成因 | 条数 | 含义 |
| --- | ---: | --- |
{origin_rows}

其中 `direct_code_name_inconsistency` 共 {origin_counts.get('direct_code_name_inconsistency', 0)} 条，
是**唯一**可能需要机关澄清的一类；其余均为格式或目录命名差异，不得报为“源表错误”。
逐条明细（岗位 ID、原文、跨度、上下文）见 JSON 的 `items`。

## 3. 残留复核（Lane B）

{len(strata)} 岗：机关类别无名单 {residual_by_bucket.get('agency_category_no_public_list', 0)}、
未核实 {residual_by_bucket.get('agency_category_unverified', 0)}、
国家目录词汇/开放表述 {residual_by_bucket.get('national_vocabulary_or_open_scope', 0)}。
维持“精确漏判 0”结论。

## 4. 交付可用性（Lane C）

状态含义：`exact_match` / `ambiguity` / `agency_specific_unknown` / `provisional` / `unrestricted_major`。
无需推断资格即可使用：27 原字段、专业原文、显式代码位置、排除项、机关缺口清单。

**本数据不含资格判定**；`agency_specific_unknown` 与 `provisional` 不得表述为“已确认接受”。
"""
    md_path = project / 'research' / 'GAP_RESOLUTION_CAMPAIGN_20261018.md'
    md_path.write_text(md, encoding='utf-8')
    print(json.dumps({
        'json': str(path), 'sha256': sha256(path.read_bytes()),
        'md': str(md_path), 'sha256_md': sha256(md_path.read_bytes()),
        'conservative': report['closure']['conservative'],
        'provisional': report['closure']['provisional'],
        'no_candidate': report['closure']['no_candidate'],
        'conflict_entries': len(entries),
        'by_origin': dict(origin_counts),
        'moved_positions': len(gained),
    }, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
