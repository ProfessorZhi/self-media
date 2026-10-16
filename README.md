# self-media · 视频创作项目库

本仓库用于管理多个独立的自媒体视频项目：选题、参考素材、创意方案、数据口径、制作代码、成片和复盘。

> **仓库定位：** 多项目工作区，不是某一条视频的专属仓库。每个项目独立管理，后续可以持续新增，不必重构整个仓库。

## 项目索引

| 编号 | 项目 | 方向 | 状态 | 入口 |
| --- | --- | --- | --- | --- |
| VIDEO-001 | 国考宇宙 · 2027 招录数据电影 | 国考知识可视化 × Remotion × AI Coding 展示 | 已立项，研究数据已归档，待制作 | [项目目录](projects/guokao-data-film/README.md) |

## 约定

- `projects/<slug>/`：每条视频或系列的独立项目目录，保留创意文档与开发代码。
- `reference/`：原始素材或参考文件；与可运行项目代码分离，避免无意覆盖。
- `CREATIVE_BRIEF.md`：创作意图、叙事结构、审美与技术目标。
- `PRODUCTION_PLAN.md`：里程碑、交付物、验收标准与待办事项。
- 项目需要代码时，优先放在该项目自己的 `remotion/` 或适当子目录，不强制仓库整体共用一个 Node/Remotion 工程。
- 大体积渲染视频、临时素材与缓存不直接提交 Git；有正式成片后按需使用 GitHub Releases 或外部存储。
- 每一份统计、截图及画面叙述都要保留数据来源、年份和口径；演示数据不能冒充官方事实。
- 建议使用独立分支与 Pull Request 交付较大规模的制作修改。

## 当前进度

VIDEO-001 已归档参考 HTML、创意方案、2027 年官方公告调研、经程序聚合的 31 省招录统计、代码词元提及统计与解析问题审计和可复核的数据校验脚本。参见 [数据目录](projects/guokao-data-film/data/README.md)、[内容研究与游戏化选题](projects/guokao-data-film/research/CONTENT_AND_VIDEO_PITCHES.md) 和 [来源核查](projects/guokao-data-film/research/DATA_SOURCES_AND_CHECKS.md)。

新增官方移民管理机构29单位/1,089名额数据、10题知识挑战，以及M1同源场景包。专业数据发现跨学历代码碰撞与TK截断，已明确降为词元探索；见 [本轮复核](projects/guokao-data-film/research/RESEARCH_REVIEW_20261017.md)。

**尚未启动 Remotion 编码、设备Agent、视频渲染或成片交付。**
