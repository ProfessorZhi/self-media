# 给 Opus 的国考数据交接

用户本轮要求：提供充足、详实、高质量的国考与岗位数据。创意、叙事和视频表达由 Opus 决定。

## 先读

0. [research/FINAL_DELIVERY_STATUS.md](research/FINAL_DELIVERY_STATUS.md)：当前交付状态与安全读取口径（唯一当前数字）。
1. [DATA_HANDOFF.md](DATA_HANDOFF.md)：数据入口、字段、查询示例与完成范围。
2. [data/README.md](data/README.md)：现行数据文件与历史资料。
3. [research/MAJOR_CODE_MATCHING.md](research/MAJOR_CODE_MATCHING.md)：逐岗位专业原文、代码目录与候选关系。
4. [research/DATA_SOURCES_AND_CHECKS.md](research/DATA_SOURCES_AND_CHECKS.md)：来源版本、官方核验范围。
5. [research/FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json](research/FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json)：范围审计与安全读取口径。
6. [research/REVIEW_STATUS_20261018.json](research/REVIEW_STATUS_20261018.json) 与 [RESIDUAL_STRATA_20261018.json](research/RESIDUAL_STRATA_20261018.json)：复核分层与残留分层。

## 可直接使用

- 2027 全国 19,426 岗的完整 27 个原始字段，合计 35,691 人。每岗有稳定 ID、源工作表和行号。
- 全岗位专业原文及学历分句；734 种完整显式词元，覆盖 3,357 岗、4,599 人。代码可查回岗位。
- 双列专业证据层：**保守覆盖 18,680 岗**；另有 19 岗只有门类推定（provisional），含推定为 18,699；残留 727 岗（1,160 人）已按“机关类别/国家目录词汇”分层。
- 5,835 岗复核状态分十一桶、互斥：有候选但要解释 4,127、旧告警不再复现 981、仅门类推定 19、无候选 727。**有候选不等于核清，5,835 也不是未覆盖数。**
- 备注里的“本科专业应为…”按**显式标签**定层解析；混合标签（本科或研究生）回退并标记，不代表任何一层已确认。
- 安全口径见 [FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json](research/FINAL_EVIDENCE_SCOPE_AUDIT_20261018.json) 的 `opus_safe_read_guidance`：引用覆盖率用 18,680；19 个 provisional 不得表述为“该机关已确认接受”。
- 本科 2026、研究生 2022、税务 2027 官方目录，以及税务多对多类别关系。
- 岗位条件统计和联合分布，备注中的可追溯文字线索。
- 2024—2027 招录表年度汇总；2024—2026 官方资格审查、实际参考与全国政策合格线。
- 2026 全国首批 20,227 岗公布的最低面试分，关联当年职位；另有 35 岗由审计署官网附件对照。批次、来源与缺失岗位单列。

## 取数约定

- 当前事实层从 positions_2027 与 majors_2027 读取。旧 649 词元文件保留研究历史。
- 主键为“年度:六位部门代码:十二位职位代码”。单独职位代码会碰撞；代码保持字符串和前导零。
- 职位、招录名额、报名、过审与实际参考分别计量；保留年份和统计时点。
- 专业词元提及、目录身份候选、类别成员关系和报名资格有不同含义。当前没有完整个人资格判断器。
- 同码必须带学历目录版本，同岗跨专业去重。跨年份不因代码相同就认定是同一个岗位。
- 第三方省份/系统注释与官方部门、机构层级分别保存。HTML 的 28 类与旧 19 标签不强行合并。
- 全国表已与官方招考简章工作簿全表逐格核验：19,426 岗、524,502 单元格、0 差异。这只覆盖本次取得的官方工作簿，不覆盖后续更正，也不覆盖专业目录。前轮 805 岗机关附件核验作为独立证据保留。
- 全国政策合格线、逐岗位入围最低线和实际面试成绩分别使用；不同计分科目或年份不直接混排。2027 尚无未来笔试产生的入围线。

运行 `node scripts/verify_position_data.mjs` 可回读验证整包；`python3 scripts/verify_major_evidence.py --write-report` 校验证据层与复核分层（含“十一桶相加=5,835”“无候选桶并集=残留清单”）。示例及全部读取器接口见 DATA_HANDOFF.md。

分层查询：`node scripts/query_major_evidence.mjs --review-stats`、`--review-status --bucket <桶>`、`--residual --strat-bucket <层>`。

CREATIVE_BRIEF.md、PRODUCTION_PLAN.md 和早期内容卡作为既有项目资料保留。数字及数据能力判断以当前数据入口为准。

