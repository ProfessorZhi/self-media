# Self Media Lab

**Open-source, code-driven video projects · 开源程序化视频创作实验室**

在这里，我们使用 **Remotion + React + TypeScript**、数据可视化、Canvas/SVG 与其他适合的工具，把资料与创意变成**能够运行、重建、审查的视频作品**。

> **理念：一部视频，一个独立项目。** 源代码、数据、设计选择和版本记录都保留；大体积成片单独交付。项目可以使用不同技术栈，Remotion 是主要工具之一，**不是整个仓库的强制依赖**。

**English:** A collection of independently managed, reproducible video projects. Learn from the code, explore data-driven motion design, and build your own films. Third-party content and dependencies keep their own licenses.

## Projects / 视频项目

| ID | Project | 技术及内容 | 阶段 | 源码与说明 |
| --- | --- | --- | --- | --- |
| **VIDEO-001** | **席位之间 · 35,691 · A Data Film** | 国考 2027 招录数据电影 · Remotion / React / Canvas / 程序化配乐 | **REVIEW** · V2.1 片名/末幕编号更正已进入源码，待新 MP4 重渲染和正式审片 | [项目主页](projects/guokao-data-film/README.md) · [项目章程](projects/guokao-data-film/PROJECT_CHARTER.md) · [Remotion](projects/guokao-data-film/remotion/README.md) |

当前仅有这个已登记的独立项目，后续新增视频在 `projects/<slug>/` 立项；**V1/V2 是版本，不是两个项目**。详情见 [项目管理规范](projects/README.md)。

## Start building / 快速运行

```bash
git clone https://github.com/ProfessorZhi/self-media.git
cd self-media

# 进入想复现的视频项目（每条视频独立安装依赖）
cd projects/guokao-data-film/remotion
npm ci
npm run data
npm test

# NumPy 需要另行安装在合适的 Python 虚拟环境内
npm run score
npm run render  # 默认 1080p；4K 命令见本项目 remotion/README.md
```

**当前主分支：** `main` 已包含 VIDEO-001 的 **V1/V2 Remotion 工程**、官方 2027 逐岗核验和专业证据层，以及完整的项目章程与开源许可。可直接从本 README 的命令运行；若要精确复原历史 V1/V2，请按照 [影片版本表](projects/guokao-data-film/remotion/README.md) 检出**整个仓库**对应提交，而不是只覆盖旧版本的 `remotion/` 子目录。原始政府/第三方附件只保留 URL 与哈希索引，源文件复核需要独立取得。

需要 Node.js/npm、Python + NumPy、Chromium，4K 渲染还需要适当的磁盘/内存。原版 MP4 和 `score.wav` 不是 Git 必须保存的内容；源代码负责生成它们，**不同 OS/浏览器/编码器不承诺字节级相同**。

## Repository layout / 仓库结构

```text
self-media/
├── README.md                       # 项目目录入口
├── LICENSE                         # 原创软件 MIT License
├── RIGHTS_AND_SOURCES.md           # 第三方数据、字体、音视频的权利边界
├── CONTRIBUTING.md                 # 新建项目、提交代码与测试
├── SECURITY.md                     # 凭据与敏感信息处理
└── projects/
    ├── README.md                   # 独立项目生命周期
    ├── _template/                  # README + PROJECT_CHARTER 模板
    └── guokao-data-film/
        ├── PROJECT_CHARTER.md      # 主旨、受众与发布闸门
        ├── README.md
        ├── CREATIVE_BRIEF.md
        ├── PRODUCTION_PLAN.md
        ├── data/ research/ reference/ content/
        └── remotion/               # VIDEO-001 独立源码、字体、音频生成器
```

## Our standards / 项目原则

1. **Reproducible**：代码、锁文件、数据版本、音频/视频构建命令可追踪；测试报告注明实际运行环境。
2. **Truthful data**：公开原表、第三方整理、规则归类与观点分级；不能把文字命中当成报考资格或把统计相关性说成因果。
3. **Independent projects**：每个选题独立立项和验收；仓库不要求统一版本节奏，跨项目共享能力需要明确接口。
4. **License-aware**：开源的是有权授权的源码。**源网站公开不代表素材属于 MIT。** 不上传凭据、Cookies、受限素材或未经授权的原文。
5. **Source ≠ release**：提交源码不等于通过审片，更不等于成片正式发布。项目阶段为 `IDEA → PLANNED → BUILDING → REVIEW → PUBLISHED`（或 `ARCHIVED`）。

## Open source & contributions / 开放许可

本仓**贡献者拥有授权权利的原创源代码**以 [MIT License](LICENSE) 开放，欢迎学习、修改、引用或创建新作品。请先阅读 [贡献指南](CONTRIBUTING.md)、[来源与素材许可](RIGHTS_AND_SOURCES.md) 和 [安全准则](SECURITY.md)。

**Remotion 本身另有许可要求**；公司/商业团队是否可免费使用，应以 [Remotion 官方 License](https://www.remotion.dev/docs/license) 为准。第三方字体、资料、原始数据和引用素材**不自动随根目录 MIT 授权**。任何利用本仓渲染结果发布的内容，仍由发布方确保素材许可及事实审核。

---

**Project status is based on verifiable GitHub commits and tested outputs, not marketing claims.**
