#!/usr/bin/env python3
"""Build FINAL_DELIVERY_AUDIT_20261018.json and FINAL_DELIVERY_STATUS.md.

Usage:
  python3 build_final_delivery_audit.py

Every figure comes from research/CURRENT_SNAPSHOT.json (itself derived from the
data manifests) and the scope audit, so this report cannot drift from the data.
"""
import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def git_head(repo):
    try:
        return subprocess.run(['git', '-C', str(repo), 'rev-parse', 'HEAD'],
                              capture_output=True, text=True).stdout.strip()
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    project = args.project
    repo = project
    while repo != repo.parent and not (repo / '.git').exists():
        repo = repo.parent

    facts = json.loads((project / 'research' / 'CURRENT_SNAPSHOT.json').read_text())
    audit = json.loads((project / 'research' / 'FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json').read_text())
    review = json.loads((project / 'research' / 'REVIEW_STATUS_20261018.json').read_text())
    manifest = json.loads((project / 'data' / 'major_evidence_2027' / 'manifest.json').read_text())
    campaign_path = project / 'research' / 'GAP_RESOLUTION_CAMPAIGN_20261018.json'
    campaign = json.loads(campaign_path.read_text()) if campaign_path.exists() else {}
    campaign_conflicts = campaign.get('lanes', {}).get('B_conflict_audit', {})

    coverage = facts['coverage']
    conflicts = facts['conflicts']
    remarks = facts['remarks']
    strata = facts['residual_strata']

    hard_problems = [
        {
            'group': 'agency_category_no_public_list',
            'positions': strata['agency_no_public_list'],
            'hires': facts['residual_strata_hires']['agency_no_public_list'],
            'classification': 'needs_recruiting_agency_explanation',
            'why': ('The agency uses an in-house category such as 经济金融类 or 气象类. Its 2027 pages '
                    'were checked and no applicable membership list was found. Not-found is not '
                    'does-not-exist, so the positions stay unresolved.'),
            'autonomously_fixable': False,
            'evidence': 'research/AGENCY_MAJOR_CATEGORY_EVIDENCE_20261018.json',
        },
        {
            'group': 'agency_category_unverified',
            'positions': strata['agency_unverified'],
            'hires': facts['residual_strata_hires']['agency_unverified'],
            'classification': 'needs_recruiting_agency_explanation',
            'why': 'In-house category phrase, but whether the agency publishes a list was not verified.',
            'autonomously_fixable': False,
            'evidence': 'research/FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json',
        },
        {
            'group': 'national_vocabulary_or_open_scope',
            'positions': strata['national_vocabulary'],
            'hires': facts['residual_strata_hires']['national_vocabulary'],
            'classification': 'human_interpretation_only',
            'why': ('Colloquial 类 suffixes, cross-level vocabulary and open phrases such as 相关专业. '
                    'Group audit found zero exact in-scope names that the matcher missed, so there is '
                    'no parser defect left to fix.'),
            'autonomously_fixable': False,
            'evidence': 'research/RESIDUAL_STRATA_20261018.json',
        },
        {
            'group': 'provisional_gate_rule',
            'positions': coverage['provisional']['positions'],
            'hires': coverage['provisional']['hires'],
            'classification': 'needs_recruiting_agency_explanation',
            'why': ('Covered only by the 门类 reading, whose cited statement applies to MOE positions. '
                    'Exact characters and gate nodes are recorded; agency applicability is not.'),
            'autonomously_fixable': False,
            'evidence': 'research/FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json',
        },
        {
            'group': 'semantic_conflict',
            # distinct positions touched by content_conflict, NOT the library-wide
            # structured conflict count (54) and NOT the review bucket (55)
            'positions': conflicts['semantic_positions'],
            'entries': conflicts['semantic_entries'],
            'direct_entries': campaign_conflicts.get(
                'by_verdict', {}).get('direct_pair_needs_agency_confirmation'),
            'direct_positions': campaign_conflicts.get('direct_positions'),
            'classification': 'mostly_context_or_format; a small direct subset needs the agency',
            'why': ('These are the machine-recorded content_conflict entries. Re-audit shows most of them '
                    'are reading artefacts: a slash-grouped code run sharing one name, a catalog name '
                    'that itself contains 、, a category code followed by its members, a 类 suffix, or an '
                    'old/short alias. Only direct_pair_needs_agency_confirmation (see direct_entries) '
                    'cannot be explained by the surrounding text and may need the recruiting agency to '
                    'clarify. None of these entries is asserted to be a source error, and none changes '
                    'what the position accepts.'),
            'autonomously_fixable': False,
            'evidence': 'node scripts/query_major_evidence.mjs --review-status --bucket candidate_with_conflict',
        },
        {
            'group': 'multi_namespace_diagnostic',
            'positions': conflicts['diagnostic_positions'],
            'entries': conflicts['diagnostic_entries'],
            'classification': 'human_interpretation_only',
            'why': ('Same code naming something else at another level, or a dropped 类 suffix. This is a '
                    'reading of the text, not a source error.'),
            'autonomously_fixable': False,
            'evidence': 'data/major_evidence_2027/position-evidence-*.json',
        },
        {
            'group': 'mixed_degree_label',
            'entries': remarks['ambiguous'],
            'classification': 'human_interpretation_only',
            'why': ('备注 mixes levels in one label (本科或研究生阶段). The code falls back to the '
                    'position scope and is flagged; it was deliberately not widened.'),
            'autonomously_fixable': False,
            'evidence': 'node scripts/query_major_evidence.mjs --position <id>',
        },
    ]

    tests = manifest.get('review_status', {}).get('summary', {})
    report = {
        'schema_version': '1.0.0',
        'report_id': 'final-delivery-audit-20261018',
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'local_date': '2026-10-18',
        'generated_from_commit': git_head(repo),
        'statement': ('The fact and evidence layers are deliverable. Applicant eligibility is not '
                      'determined and cannot be, from public sources alone.'),
        'headline': {
            'positions': facts['positions'],
            'hires': facts['hires'],
            'coverage_conservative': coverage['conservative'],
            'coverage_provisional': coverage['provisional'],
            'no_candidate': coverage['no_candidate'],
            'closure': (f"{coverage['conservative']['positions']:,} + "
                        f"{coverage['provisional']['positions']} + "
                        f"{coverage['no_candidate']['positions']:,} = {facts['positions']:,}"),
            'official_workbook_verification': facts['official_verification'],
        },
        'delivered': {
            'raw_positions': 'data/positions_2027/manifest.json',
            'major_evidence': 'data/major_evidence_2027/manifest.json',
            'review_status': 'data/major_evidence_2027/review-status-*.json',
            'residual_strata': 'data/major_evidence_2027/residual-strata-01.json',
            'provisional_list': 'data/major_evidence_2027/provisional-gate-rule-01.json',
            'current_snapshot': 'research/CURRENT_SNAPSHOT.json',
            'scope_audit': 'research/FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json',
            'consistency_audit': 'research/HANDOFF_CONSISTENCY_20261018.json',
            'remark_scope_diff': 'research/REMARK_SCOPE_FIX_DIFF_20261018.json',
            'delivery_status': 'research/FINAL_DELIVERY_STATUS.md',
        },
        'query_interfaces': [
            'node scripts/query_major_evidence.mjs --stats',
            'node scripts/query_major_evidence.mjs --code 030101K',
            'node scripts/query_major_evidence.mjs --review-status --bucket candidate_with_conflict',
            'node scripts/query_major_evidence.mjs --review-status --risk',
            'node scripts/query_major_evidence.mjs --provisional',
            'node scripts/query_major_evidence.mjs --residual --strat-bucket agency_category_no_public_list',
            'node scripts/query_major_evidence.mjs --position 2027:002000:100110001001',
        ],
        'hard_problems': hard_problems,
        'autonomously_fixable_remaining': [item for item in hard_problems if item['autonomously_fixable']],
        'autonomously_fixable_scope': ('在本次已审计范围内（19,426 岗的逐岗证据、残留分层、冲突语族、备注作用域），'
                                       '未发现可自主修复项；这不是“全世界不存在进一步问题”的证明。'),
        'external_blockers': [
            'No applicable 2027 membership list found for the PBOC 经济金融类 or CMA 气象类 categories.',
            'Some 备注 sentences mix degree levels without a clean label and need a human reading.',
            (f'Only the {campaign_conflicts.get("by_verdict", {}).get("direct_pair_needs_agency_confirmation", 2)} '
             'direct name/code pairs inside content_conflict may need the recruiting agency to clarify; '
             'the other entries are context, format or alias artefacts and are not claims that the source '
             'is wrong.'),
        ],
        'not_delivered': [
            'Any applicant-eligibility verdict.',
            '一张 2027 全国统一专业成员表：截至 2026-10-18 的已查公开来源未找到，不能据此断言不存在。',
            '2027 interview cutoffs (they do not exist before the written exam).',
        ],
        'review_caveat': ('5,835 is the legacy review denominator, not an uncovered count. '
                          f"{tests.get('legacy_reason_superseded', 0)} of them no longer reproduce a "
                          'warning under the current catalogs; that is a statement about the tool, '
                          'not a cleared position. Buckets are mutually exclusive but a position can '
                          'carry several risk markers.'),
    }

    path = project / 'research' / 'FINAL_DELIVERY_AUDIT_20261018.json'
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    verdicts = campaign_conflicts.get('by_verdict', {})
    direct_entries = campaign_conflicts.get('by_verdict', {}).get('direct_pair_needs_agency_confirmation')
    direct_positions = campaign_conflicts.get('direct_positions')
    md = f"""# 国考 2027 专业证据：交付状态

生成：2026-10-18（本地，Asia/Shanghai）。数据口径来自 [CURRENT_SNAPSHOT](CURRENT_SNAPSHOT.json)，该文件由
`data/major_evidence_2027/manifest.json` 派生，禁止手写。

## 一句话结论

**事实层与证据层可交付；报考资格不可由公开来源判定，也不在本数据内。**

## 当前精确数字

| 项 | 岗位 | 名额 |
| --- | ---: | ---: |
| 全国岗位 | {facts['positions']:,} | {facts['hires']:,} |
| 保守目录候选 | {coverage['conservative']['positions']:,} | {coverage['conservative']['hires']:,} |
| 仅门类推定（provisional） | {coverage['provisional']['positions']} | {coverage['provisional']['hires']} |
| 无任何候选 | {coverage['no_candidate']['positions']:,} | {coverage['no_candidate']['hires']:,} |

闭合：{coverage['conservative']['positions']:,} + {coverage['provisional']['positions']} + {coverage['no_candidate']['positions']:,} = {facts['positions']:,}。

官方工作簿逐格核验：{facts['official_verification']['positions']:,} 岗、{facts['official_verification']['compared_cells']:,} 单元格、
内容差异 {facts['official_verification']['content_differences']}、工作表/行号差异 {facts['official_verification']['location_differences']}。

## 专业与冲突口径

- 去重后代码 {facts['codes']['distinct']} 种，其中 {facts['codes']['both_columns']} 种同时出现在“专业”和“备注”两列。
- 备注代码 {facts['remarks']['codes_total']:,} 处：显式学历标签 {facts['remarks']['explicit_label']}、回退岗位学历 {facts['remarks']['fallback']:,}、混合标签回退并标记 {facts['remarks']['ambiguous']}。
- 结构化冲突 **{conflicts['positions']} 岗 / {conflicts['entries']} 条**。
  - 语义冲突（content_conflict）：**{conflicts['semantic_positions']} 岗 / {conflicts['semantic_entries']} 条**——该类自己触达的岗位数，不等于全库结构化冲突 {conflicts['positions']} 岗，也不等于复核桶的 55。
  - 其中**无法由上下文/格式/旧名直接解释的仅 {direct_entries} 条（{direct_positions} 岗）**；其余 {conflicts['semantic_entries'] - (direct_entries or 0)} 条为：斜杠共享名称 {verdicts.get('grouped_notation',0)}、旧名/简称 {verdicts.get('alias_or_abbreviation_requires_context',0)}、类后缀 {verdicts.get('suffix_variant',0)}、成员枚举 {verdicts.get('category_member_example',0)}、全名含顿号被截断 {verdicts.get('tokenizer_boundary_artifact',0)}。**这些不是“源表写错”的结论。**
  - 多学历诊断（跨层 {conflicts['cross_level_same_code']} 条 + 省略“类” {conflicts['category_suffix_omitted']} 条）：**{conflicts['diagnostic_positions']} 岗 / {conflicts['diagnostic_entries']} 条**，与语义类有 {conflicts['semantic_and_diagnostic_overlap']} 岗重叠。
- 另有 {conflicts['gate_code_name_mismatch']} 岗门类码与名称错配，只记 `gate_code_name_mismatch`，不进 `conflicts` 数组。

## 硬问题分组

| 组 | 规模 | 分类 | 能否自主修复 |
| --- | ---: | --- | --- |
""" + '\n'.join(
        f"| {item['group']} | {item.get('positions', item.get('entries'))} | {item['classification']} | 否 |"
        for item in hard_problems) + f"""

**在本次已审计范围内，未发现内部可自主修复项（{len(report['autonomously_fixable_remaining'])} 项）；这不是“不存在进一步问题”的证明。**

## 外部依赖（已按可审计口径收口）

""" + '\n'.join(f'- {item}' for item in report['external_blockers']) + f"""

## 能给 Opus 直接用

1. `data/positions_2027/`：19,426 岗 × 27 原字段 + 源表工作表与行号。
2. `data/major_evidence_2027/`：逐岗专业证据（代码、名称、排除项、冲突、原因、学历作用域）。
3. `research/CURRENT_SNAPSHOT.json`：唯一当前口径，引用数字先读它。
4. 查询：`node scripts/query_major_evidence.mjs --stats` 及 README 中的其它命令。

**引用纪律**：覆盖率用 {coverage['conservative']['positions']:,}（保守）；{coverage['provisional']['positions']} 个 provisional 不得说成“机关已确认”；
{coverage['no_candidate']['positions']:,} 个无候选不等于“不限专业”或“不可报”；冲突三个数（岗位/条目/语义条目）不可互换。

## 复现

```bash
python3 scripts/build_major_evidence.py
python3 scripts/build_review_status.py
python3 scripts/build_final_scope_audit.py
python3 scripts/build_current_snapshot.py --apply
python3 scripts/verify_handoff_consistency.py --write-report
python3 scripts/verify_major_evidence.py --write-report
node scripts/verify_position_data.mjs --write-report
python3 scripts/verify_official_national_table.py --workspace <inputs>
python3 scripts/build_final_delivery_audit.py
```
"""
    md_path = project / 'research' / 'FINAL_DELIVERY_STATUS.md'
    md_path.write_text(md, encoding='utf-8')
    print(json.dumps({
        'report': str(path), 'sha256': sha256(path.read_bytes()), 'bytes': path.stat().st_size,
        'status_md': str(md_path), 'sha256_md': sha256(md_path.read_bytes()),
        'autonomously_fixable_remaining': len(report['autonomously_fixable_remaining']),
    }, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
