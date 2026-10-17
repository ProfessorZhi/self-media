# 国考 2027 专业证据：交付状态

生成：2026-10-18（本地，Asia/Shanghai）。数据口径来自 [CURRENT_SNAPSHOT](CURRENT_SNAPSHOT.json)，该文件由
`data/major_evidence_2027/manifest.json` 派生，禁止手写。

## 一句话结论

**事实层与证据层可交付；报考资格不可由公开来源判定，也不在本数据内。**

## 当前精确数字

| 项 | 岗位 | 名额 |
| --- | ---: | ---: |
| 全国岗位 | 19,426 | 35,691 |
| 保守目录候选 | 18,694 | 34,526 |
| 仅门类推定（provisional） | 5 | 5 |
| 无任何候选 | 727 | 1,160 |

闭合：18,694 + 5 + 727 = 19,426。

官方工作簿逐格核验：19,426 岗、524,502 单元格、
内容差异 0、工作表/行号差异 0。

## 专业与冲突口径

- 去重后代码 912 种，其中 240 种同时出现在“专业”和“备注”两列。
- 备注代码 1,832 处：显式学历标签 712、回退岗位学历 1,105、混合标签回退并标记 15。
- 结构化冲突 **54 岗 / 87 条**。
  - 语义冲突（content_conflict）：**44 岗 / 67 条**——该类自己触达的岗位数，不等于全库结构化冲突 54 岗，也不等于复核桶的 55。
  - 多学历诊断（跨层 12 条 + 省略“类” 8 条）：**11 岗 / 20 条**，与语义类有 1 岗重叠。
- 另有 5 岗门类码与名称错配，只记 `gate_code_name_mismatch`，不进 `conflicts` 数组。

## 硬问题分组

| 组 | 规模 | 分类 | 能否自主修复 |
| --- | ---: | --- | --- |
| agency_category_no_public_list | 533 | needs_recruiting_agency_explanation | 否 |
| agency_category_unverified | 13 | needs_recruiting_agency_explanation | 否 |
| national_vocabulary_or_open_scope | 181 | human_interpretation_only | 否 |
| provisional_gate_rule | 5 | needs_recruiting_agency_explanation | 否 |
| semantic_conflict | 44 | needs_recruiting_agency_explanation | 否 |
| multi_namespace_diagnostic | 11 | human_interpretation_only | 否 |
| mixed_degree_label | 15 | human_interpretation_only | 否 |

**在本次已审计范围内，未发现内部可自主修复项（0 项）；这不是“不存在进一步问题”的证明。**

## 外部依赖（已按可审计口径收口）

- No applicable 2027 membership list found for the PBOC 经济金融类 or CMA 气象类 categories.
- Some 备注 sentences mix degree levels without a clean label and need a human reading.
- Semantic conflicts inside the source text need the recruiting agency to clarify.

## 能给 Opus 直接用

1. `data/positions_2027/`：19,426 岗 × 27 原字段 + 源表工作表与行号。
2. `data/major_evidence_2027/`：逐岗专业证据（代码、名称、排除项、冲突、原因、学历作用域）。
3. `research/CURRENT_SNAPSHOT.json`：唯一当前口径，引用数字先读它。
4. 查询：`node scripts/query_major_evidence.mjs --stats` 及 README 中的其它命令。

**引用纪律**：覆盖率用 18,694（保守）；5 个 provisional 不得说成“机关已确认”；
727 个无候选不等于“不限专业”或“不可报”；冲突三个数（岗位/条目/语义条目）不可互换。

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
