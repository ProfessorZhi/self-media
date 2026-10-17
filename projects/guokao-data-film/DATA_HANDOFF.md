# 国考数据交接：给 Opus 的事实与读取入口

更新：2026-10-17。本轮目标是交付充足、详实、可追溯的岗位及国考数据；创意与视频表达由 Opus 决定。

**现在每个 2027 岗位都有完整专业原文和原始条件，显式代码已全量提取；完整个人报考资格尚未自动判定。** 全国主表来自公开职位表镜像，已完成全量版本交叉核对，并用部分招录机关官网附件逐格核验。数据质量范围见下文。

## 1. 已经可以读取的数据

| 数据层 | 当前内容 | 入口 |
| --- | --- | --- |
| 2027 逐岗位原表 | 19,426 岗，35,691 个计划名额；27 原字段、来源工作表和行号 | [岗位 manifest](data/positions_2027/manifest.json) |
| 逐岗位专业要求 | 3,841 种专业原文，按原文、学历、税务范围组成 4,090 组，覆盖全部岗位 ID | [专业 manifest](data/majors_2027/manifest.json) |
| 完整显式代码 | 734 种转大写后的完整词元，覆盖 3,357 岗、4,599 人；可查回每个岗位 | [代码提及](data/majors_2027/code-mentions-01.json) |
| 本科官方目录 | 2026 版：13 门类、92 专业类、883 专业、11 条明确旧码迁移关系 | [本科目录](data/catalogs/major_bachelor_2026_official_parsed.json) |
| 研究生官方目录 | 2022 版：14 门类、117 一级学科、67 专业学位类别 | [研究生目录](data/catalogs/major_graduate_2022_official_parsed.json) |
| 税务官方目录 | 2027 版：53 类别、849 条成员关系，保留多对多类别及特殊说明 | [税务目录](data/catalogs/major_tax_2027_official_parsed.json) |
| 岗位条件 | 11 原始条件维度、5 联合分布、15 类带表达式及例证的备注文字线索 | [条件统计](data/position_conditions_2027.json) |
| 2024—2027 招录表比较 | 每年职位/名额及省份、部门、学历、机构层级、考试类别分布 | [历年职位统计](data/histories_2024_2027.json) |
| 官方历年考试背景 | 2024—2026 过审、确认报名、实际参考、参考率、计划及全国政策合格线；保留官方约数 | [官方历史数据](data/official_historical_exam_data.json) |
| 2026 逐岗位面试入围线 | 首批 20,227 岗的源表公布最低面试分；关联当年职位字段 | [面试线 manifest](data/interview_cutoffs_2026/manifest.json) |
| 2027 时间线与机构计划 | 公告各阶段时间；国家移民管理机构 29 个单位计划 | [考试时间线](data/official_2027_exam_timeline.json)、[移民管理计划](data/official_2027_immigration_plan.json) |

岗位、专业和招录计划分布同时保留职位数与计划人数；面试线的覆盖分布按岗位数统计，具体单位以各层字段说明为准。专业、税务类别、备注线索存在重叠，不可跨类别直接加总为全国人数。

## 2. 每个岗位有什么

岗位主键示例：`2027:002000:100110001001`。年度、六位部门代码、十二位职位代码都参与主键；单独职位代码只有 7,178 个不同值，会发生碰撞。部门代码的前导零必须保留。

27 个原字段按原始中文列名保存：

| 方面 | 原字段 |
| --- | --- |
| 招录单位与岗位 | 部门代码、部门名称、用人司局、机构性质、招考职位、职位属性、职位分布、职位简介、职位代码、机构层级、考试类别、招考人数 |
| 专业与资格条件 | 专业、学历、学位、政治面貌、基层工作最低年限、服务基层项目工作经历 |
| 面试与地点 | 是否在面试阶段组织专业能力测试、面试人员比例、工作地点、落户地点 |
| 完整补充说明 | 备注、部门网站、咨询电话1、咨询电话2、咨询电话3 |

所有原字段按字符串返回；分析人数时显式转数值。空单元格、原文“无”“不限”“无限制”分别保存。部门及职位代码没有转成整数。

`annotations.source_csv_province`、`annotations.source_system_tag` 是第三方注释，来源与原文分开。31 个省级注释都与原工作地点前缀一致，但没有把这项检查提升成完整地理编码认证。系统标签有 19 类，与原 HTML 的 28 类不是同一分类表；比较系统结构前应选定可复现的归集规则。589 个原始部门代码可直接按原表统计。

## 3. 专业究竟统计到哪一步

| 覆盖检查 | 岗位数 | 含义 |
| --- | ---: | --- |
| 专业原文保全 | 19,426 | 全部岗位都有原文和原始学历、备注 |
| 原文有显式代码词元 | 3,357 | 已完整提取，含后缀和内部字母 |
| 原文没有显式代码词元 | 16,069 | 多数用专业名称或类别表达，不能视为不限专业 |
| 至少一个已加载目录候选引用 | 18,176 | 只说明至少一处名称/代码找到候选，不说明整条要求已解析完毕 |
| 没有已加载目录候选引用 | 1,250 | 保留原文和未解析项，可继续补充目录或人工核对 |
| 存在进一步核对原因 | 5,835 | 包括学历分句、排除、方向、开放范围、歧义和未解义词元；与上一行重叠 |
| 专业列全文明确为不限等精确表达 | 8 | 只描述专业列，不免除学历、备注等其他条件 |

代码提及保留字符位置、原始大小写、所属分句、相容学历目录、候选 ID 和核对原因。例如 `030101K` 在完整原文中出现于 **329 岗、399 人**；旧清洗字段的 316 / 385 漏掉了部分提及，不是招录计划变更。

目录 ID 必须带版本和学历命名空间：

| ID | 目录含义 |
| --- | --- |
| `moe-bachelor:2026:0809` | 本科计算机类 |
| `moe-graduate:2022:0809` | 研究生电子科学与技术 |
| `moe-bachelor:2026:0812` | 本科测绘类 |
| `moe-graduate:2022:0812` | 研究生计算机科学与技术 |
| `moe-bachelor:2026:030101K` | 本科法学 |
| `moe-bachelor:2026:120402` | 本科行政管理 |

本科后缀 T、K、TK，七位数字本科代码及 `0814Z2` 等内部字母都保留。研究生 2022 官方目录没有六位二级学科全集；未加载的二级学科、自设代码或机关自定义范围保留未解义。税务类别独立保存；其成员没有逐项教育部代码或学历时保持空值，只另存精确同名候选连接。

原文“本科专业不限，研究生……”属于局部条件。“除海洋测绘”“法学（某方向）”“相关专业”等仍需读完整限制。当前数据没有 `eligible=true`，所有目录关系均不构成个人报名资格结论。详见 [专业口径](research/MAJOR_CODE_MATCHING.md)。

## 4. 直接读取和查回岗位

下面的代码可存成项目目录下的 `example.mjs` 后运行；读取器只依赖 Node.js 标准库。

```js
import {loadPositions} from './scripts/load_positions.mjs';
import {loadMajorData} from './scripts/load_majors.mjs';
import {loadInterviewCutoffs} from './scripts/load_interview_cutoffs.mjs';

const jobs = await loadPositions();
const majors = await loadMajorData();
const interviews = await loadInterviewCutoffs();

const law = majors.findExplicitCode('030101K');
console.log(law.positions, law.hires); // 329, 399

const position = jobs.getPosition(law.position_ids[0]);
const requirement = majors.getRequirement(position.id);
console.log(position.raw['部门名称'], position.raw['工作地点']);
console.log(position.raw['专业'], position.raw['学历']);
console.log(requirement.review_reasons);

const references = majors.findPositionReferences(
  'moe-bachelor:2026:080901',
  {includeCategoryMembership: true}
);
const uniqueIds = new Set(references.flatMap(r => r.position_ids));
const referencedJobs = [...uniqueIds].map(id => jobs.getPosition(id));
const seats = referencedJobs.reduce((n, p) => n + Number(p.raw['招考人数']), 0);
console.log({candidatePositions: uniqueIds.size, candidateSeats: seats});
// 这是目录引用候选集合，包含需复核限制；不能命名为可报岗位。

console.log(interviews.records.length); // 20227
const historicalCutoff = interviews.getCutoff(interviews.records[0].id);
console.log(historicalCutoff['最低面试分数']);
// 2026 首批公布的入围分数；不能接到同码 2027 岗并当作当年分数。
```

岗位和面试线分片采用 `columns + rows` 节约重复键名；读取器还原为有名称的字段。manifest 记录分片字节数、SHA-256、行数及来源。专业分片用对象结构保存分句、关系和证据。

## 5. 其他国考数据的使用口径

历年职位表统计：

| 招录年度 | 职位数 | 计划人数 |
| --- | ---: | ---: |
| 2024 | 18,948 | 39,561 |
| 2025 | 20,810 | 39,721 |
| 2026 | 20,714 | 38,119 |
| 2027 | 19,426 | 35,691 |

2027 原字段取自全国 XLS；2024—2026 取第三方 CSV 保留的原始字段，属于不同来源等级。各年五个分布均能加总回该年总量。官方公告的“3.96 万”等约数仍按约数记录，不能伪装成个位精确统计。

[官方历史数据](data/official_historical_exam_data.json) 将资格审查人数、确认报名人数、实际参考人数分开。过审人数/计划人数与实际参考人数/计划人数不是同一个“竞争比”。缺失数据保持空值，不用参考率倒推出精确人数。

2026 全国首批最低面试分数据来自公开名单镜像的**源表公布最低线列**，没有用个人成绩求最小值。20,227 岗全部匹配当年职位表；审计署官网 35 岗公布线与这批记录一致。另有 487 个当年职位表岗位没出现在首批名单，不能填 0 分或推断无人报考。2026-01-15 全国首批与 2026-01-26 审计署部门公告保留不同批次来源。全国政策合格线、逐岗位入围最低线、实际面试成绩有不同含义；不同科目权重的岗位分数不直接做全国高低排名。仓库只保存岗位层面记录。

备注的 15 类线索，例如最低服务年限、英语等级、法律职业资格、户籍、夜班或宿舍条件，都是可复现文字检索结果。表达式和例证随统计保存；完整适用条件应查回岗位备注，不能把文字出现次数说成完成资格审核后的岗位数。

## 6. 核验强度与保留事项

全国镜像 XLS 与上游转换 XLSX 的 19,426 岗、全部 27 原字段逐格一致。直接招录机关官网附件累计核验 **805 岗、1,501 个名额、21,713 个可比较单元格**，内容差异为 0。其中上海税务 224 岗、国家移民管理机构 570 岗、教育部 11 岗；教育部附件有 25 个可比较字段。外交部 PDF 的 23 岗、102 人仅做范围核验，不计入 805 岗逐格核验。详见 [官方子集核验](research/OFFICIAL_ROW_CROSSCHECK_20261017.json)。

这些结果证明已检查部分及版本的一致性。全国主表尚未直接从国家公务员局附件完成字节同源核验，也未对每个岗位取得独立官网附件。

已修正旧清洗带来的前导零丢失、部分“二年”基层要求错误数值化、专业 TK 截断及同码跨学历混名。原始字段优先，不继续使用旧年龄、基层年限、待遇评分等推导字段。

当前还没有：完整个人报考资格判断、全国全岗位官方直链逐格认证、2027 笔试后才会产生的入围分数、全程实时报名人数、可证明的个人上岸概率或待遇结论。保留缺失、约数、批次与来源，比补一个没有依据的数值更适合后续创作。

## 7. 校验与历史文件

在项目目录运行：

```bash
node scripts/verify_position_data.mjs --write-report
```

这会加载全部现行数据、验证分片完整性、岗位/代码/目录关联、原文跨度和可加总统计，并输出 [本轮校验结果](research/DATA_VALIDATION_20261017_V2.json)。构建脚本位于 `scripts/build_*.py`，输入 URL、文件名与哈希在 manifest 中；需要先取得这些固定版本输入，不在构建中自动调用研究服务。

需要重建时，`build_position_foundation.py --workspace /path/to/inputs` 读取全国 XLS 与各年 CSV；`build_major_data.py`、`build_condition_statistics.py` 使用相同参数直接读取并校验该 XLS，专业目录默认读取仓库现有 JSON，不依赖临时缓存。`build_interview_cutoffs_2026.py --workspace /path/to/inputs` 需要对应首批名单、审计署附件和 2026 CSV。读取现有数据只需 Node 标准库；从 Excel 重建还需 Python 的 xlrd/openpyxl，依赖与固定输入见各脚本及 manifest。

现行/历史状态由 [DATASET_STATUS.json](data/DATASET_STATUS.json) 记录。旧聚合、早期内容卡、创意文档和原始 HTML 保留研究历史。它们的旧专业覆盖数字不应覆盖当前原文重建结果。
