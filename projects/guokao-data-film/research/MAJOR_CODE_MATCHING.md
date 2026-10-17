# 逐岗位专业要求与代码口径

版本：2026-10-18，双列证据版。入口为 `data/major_evidence_2027/manifest.json`；`data/majors_2027/` 保留为可复现的“改前”层。

## 1. 这一轮做了什么

| 变化 | 结果 |
| --- | --- |
| 新增两份研究生招生代码册 | 六位二级学科从“不可解析”变为可解析：3,357 岗中 147 岗因此新获候选 |
| 新增 2026 自设学科名册 | 5,536 + 1,214 条名称，用于识别“这是自设学科名”，不提供代码对应 |
| 把“备注”列纳入统计 | 1,069 岗备注含代码；366 岗可解析；新增覆盖 36 岗 |
| 识别“门类码+名称”写法 | `02经济学`、`08工学` 这类 82 岗 |
| 识别括号内精确目录名 | 11 岗 |
| 排除项单独处理 | 600 岗的 `不含…` 清单不再被当成命中 |

覆盖从 **18,176 / 19,426** 变为 **18,655 / 19,426**；无候选从 **1,250** 降到 **771**（1,209 人）。

“出现一个候选引用”不表示整条要求解析完毕。5,835 个带复核原因的岗位里，有候选的从 4,593 升到 5,064，仍有 771 岗没有任何精确候选。

## 2. 目录命名空间

| 节点键 | 名称 |
| --- | --- |
| `moe-bachelor:2026:0809` | 本科：计算机类 |
| `moe-graduate:2022:0809` | 研究生：电子科学与技术 |
| `moe-graduate-codebook:2024-admissions:085405` | 研究生招生：软件工程（专业学位领域） |
| `moe-graduate-codebook:2023-admissions:020204` | 研究生招生：金融学（二级学科） |
| `moe-bachelor:2026:030101K` | 本科：法学 |
| `moe-selfset:2026` | 自设学科名册（只有名称，没有代码） |

**代码册是招生口径，不是学位授予目录。** 四位码不一定等于 2022 目录编号：例如 0270 统计学、0771—0783 的理学各学科、0870/0871、0970—0973、1071/1072、1151 等都只存在于招生代码册。两版之间也有真实差异（2023 版独有 64 个代码，2024 版独有 70 个），逐版保存，不合并。

本科 2026 保存 883 专业、92 专业类、13 门类及 11 条迁移关系；研究生 2022 保存 117 一级学科、67 专业学位类别、14 门类，没有六位二级学科全集——这正是需要代码册的原因。

## 3. 不许做的合并与修补

| 情形 | 处理 |
| --- | --- |
| `030100` / `050100` / `081200` | 四位学科的招生写法，标记 `enrollment_00_alias`，不是新专业（55 种） |
| `030101K` 在研究生岗位 | 标记 `outside_education_scope`，**不算命中**（41 处） |
| 同一六位数跨学历异名 | 不合并；按分句学历解析，另一层名称作为证据记录 |
| `0814Z2`、`99J…`、`S…` | 只解析四位前缀，标记 `institution_local_code`，不编造名称 |
| `会计学类` | 不模糊匹配到 `会计学`；只有精确节点才算 |
| T/K/TK 与七位码 | 原样保留，不截断不补全 |

分句学历优先于岗位“学历”单元格：`大学本科：030101K法学；研究生：0301法学` 中第一个码按本科解析，第二个按研究生解析。

## 4. 备注列

备注 19,172 岗非空，但主要是电话、年份和地址。过滤后：

| 项 | 数量 |
| --- | ---: |
| 年份词元（2027 等） | 9,915 |
| 7 位以上长数字（电话） | 1,864 |
| 区号 | 146 |
| 无目录命中且无专业语境 | 126 |
| 保留为代码提及 | 1,069 岗 |
| 其中可解析到目录 | 366 岗 |

备注名称只取“精确目录名 + 专业/门类/学科/类”紧邻的写法（67 岗），标为 `exact_name_in_remarks_requires_review`，不与代码同权。

## 5. 冲突与排除

59 个岗位的代码旁名称与目录不一致，按类保留逐岗证据：

| 类型 | 条数 | 例 |
| --- | ---: | --- |
| `cross_level_same_code` | 25 | `080401材料科学与工程`（本科）vs 代码册 080401 精密仪器及机械 |
| `category_suffix_omitted` | 8 | `0203金融学`，目录为金融学类 |
| `content_conflict` | 67 | `120202财务管理`，120202 实为企业管理 |

排除句：600 岗含 `不含/除/不包括` 括号清单，清单内名称记入 `major_excluded_names`，**不计覆盖**。“经济金融类（不含统计、国际商务…）”里的国际商务是排除项。

## 6. 残留 771 岗

| 原因 | 岗位 |
| --- | ---: |
| 专业列无显式代码 | 764 |
| 两列均无可机读代码 | 768 |
| 开放表述 | 492 |
| 否定/排除 | 446 |
| 排除清单 | 444 |
| “类”结尾但无精确节点 | 213 |
| 名称只在另一学历层 | 22 |
| 代码无法解析 | 7 |

最大来源：人民银行“经济金融类（不含…）”420 岗、722 人；气象“气象类”88 岗。两者都**没有公开的机关专用专业目录**——人民银行 2027 公告原文只说“具体职位和资格条件请查看专题网站招考简章”。因此不把“经济金融类”拆解成教育部目录里的近似名称。

## 7. 读取与查回

```bash
node scripts/query_major_evidence.mjs --code 030101K
node scripts/query_major_evidence.mjs --name 世界经济 --education graduate
node scripts/query_major_evidence.mjs --catalog moe-graduate-codebook:2024-admissions:085405
node scripts/query_major_evidence.mjs --position 2027:002000:100110001001
node scripts/query_major_evidence.mjs --residual --reason exclusion_list_present
```

JSON 读取：

```js
const manifest = JSON.parse(await readFile('data/major_evidence_2027/manifest.json','utf8'));
// manifest.position_evidence[] / code_evidence[] / residual[] 各带 bytes 与 sha256
```

每个岗位记录含：`major_codes[]`（代码、分句、跨度、教育口径、解析状态）、`remarks_codes[]`、`major_term_name_hits[]`、`major_parenthetical_names[]`、`major_excluded_names[]`、`reason_classes[]`、`conflicts[]`。

解析状态含义：

| 状态 | 含义 |
| --- | --- |
| `resolved` | 在相容学历命名空间内唯一命中 |
| `ambiguous_level` | 多学历命名空间都可命中，未定层 |
| `ambiguous_multiple` | 同层多个节点 |
| `enrollment_00_alias` | 四位码的 `00` 招生写法 |
| `outside_education_scope` | 只存在于另一学历层，不算命中 |
| `institution_local_code` | Z/J/S 机构自设代码 |
| `unresolved` | 已加载目录中找不到 |

所有状态都不构成 `eligible=true`。

## 8. 校验

```bash
python3 scripts/verify_major_evidence.py --write-report
```

重新计算覆盖口径、回放每个代码跨度、检查排除项不计覆盖、检查 00 尾码不成为新专业、检查每个冲突都带类别与上下文。结果见 [MAJOR_EVIDENCE_VERIFICATION_20261018.json](MAJOR_EVIDENCE_VERIFICATION_20261018.json)。

## 9. 来源

- [本科 2026 官方目录](http://www.moe.gov.cn/srcsite/A08/moe_1034/s3882/202604/W020260427440749576927.pdf)
- [研究生 2022 官方目录](http://www.moe.gov.cn/srcsite/A22/moe_833/202209/W020220914572994461110.pdf)
- [研究生招生学科、专业代码册 2022-09](https://www.wcjyj.com/data/upload/file/2311/15/65548688b8aae.docx)
- [研究生招生学科专业代码册 2023-09](https://rst.xinjiang.gov.cn/xjrst/c112746/202606/6200d15452494c00a1a50f6d7bb9edbf/files/2.%E9%99%84%E4%BB%B62%EF%BC%9A%E7%A0%94%E7%A9%B6%E7%94%9F%E6%8B%9B%E7%94%9F%E5%AD%A6%E7%A7%91%E4%B8%93%E4%B8%9A%E4%BB%A3%E7%A0%81%E5%86%8C%EF%BC%882023%E5%B9%B49%E6%9C%88%EF%BC%89.pdf)
- [自设二级学科名单 2026](http://www.moe.gov.cn/jyb_xxgk/s5743/s5744/A22/202610/t20261008_1453325.html)
- [税务 2027 官方说明及目录](https://shanghai.chinatax.gov.cn/xxgk/rsxx/202610/t481766.html)
- [岗位来源与逐格校验](DATA_SOURCES_AND_CHECKS.md)
