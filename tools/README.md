# 工具库 / Video Tools

这里集中管理可供各独立视频项目按需参考的**上游视频工具**，采用 Git Submodule 固定上游版本。**工具不是视频项目，不能替代 `projects/<slug>/`。** 不将大体积第三方源码拷贝、重许可或直接混入本仓 MIT。

| 子模块目录 | 上游 | 用途 | 上游许可证 | 固定版本 |
| --- | --- | --- | --- | --- |
| [`video-shotcraft`](https://github.com/Vincentwei1021/video-shotcraft) | [GitHub](https://github.com/Vincentwei1021/video-shotcraft) | 产品宣传片、镜头卡、运镜、音效和 Remotion | Apache-2.0 | [`6700db2ba805`](https://github.com/Vincentwei1021/video-shotcraft/commit/6700db2ba80572ebc777b99d72049679fed9840c) |
| [`video-talkcraft`](https://github.com/Vincentwei1021/video-talkcraft) | [GitHub](https://github.com/Vincentwei1021/video-talkcraft) | 中文口播视频、字级对齐、动效和工作台 | PolyForm Noncommercial 1.0.0 | [`501708856fbf`](https://github.com/Vincentwei1021/video-talkcraft/commit/501708856fbfdf596e27dba3200e12cf95da57be) |
| [`anything2explainer`](https://github.com/Vincentwei1021/anything2explainer) | [GitHub](https://github.com/Vincentwei1021/anything2explainer) | 从知识/脚本生成科普视频 | PolyForm Noncommercial 1.0.0 | [`0b85f6c7bfc4`](https://github.com/Vincentwei1021/anything2explainer/commit/0b85f6c7bfc4ef094ee1afb6c68c06fcf329cfab) |
| [`mg-styles-15`](https://github.com/Vincentwei1021/mg-styles-15) | [GitHub](https://github.com/Vincentwei1021/mg-styles-15) | 15 种 MG 动画风格的样片、提示词、源码 | MIT | [`269f6ed788cf`](https://github.com/Vincentwei1021/mg-styles-15/commit/269f6ed788cf60aaf9c276b110c548d6e7d353e1) |

## 获取方式（按需、避免下载所有大体积样片）

正常克隆本仓时，子模块内容**不会**自动随主仓下载：

```bash
git clone https://github.com/ProfessorZhi/self-media.git
cd self-media

# 例如只做口播解释视频时，先取所需的一个工具
git submodule update --init --depth 1 tools/video-talkcraft

# 如果确实需要全部四个工具，再执行（会下载较多素材）
git submodule update --init --recursive
```

子模块中的 `SKILL.md` 是上游 Agent 的使用指令，**子模块已检出 ≠ Skill 已注册/安装 ≠ 依赖已安装**。需要按具体代理和平台的规则显式注册 Skill、安装工具所需依赖；不要让项目根目录自动安装所有工具包。未来如需 Agent 自动发现，另行制作小型适配/注册层，并按实际环境测试。

## 版本管理

- 主仓只记录四个子模块的 Git commit 指针；没有自动跟随上游最新提交。
- 上游升级需单独评估变更、许可证和兼容性，更新 gitlink 后走独立 PR。
- **不运行** `git submodule update --remote` 来暗中刷新生产所用版本。
- 大文件仍由各上游仓库托管；本仓不能保证所有上游的下载可用性或历史永远保留。

## 许可与商用提醒

**本仓根目录 MIT 不覆盖子模块的第三方源码。**

- `video-shotcraft`：Apache-2.0；复用时保留 NOTICE/许可证等义务，并单独核对 Remotion、媒体、字体等附属许可。
- `video-talkcraft`、`anything2explainer`：PolyForm Noncommercial 1.0.0；工具包仅在许可证允许的非商业用途内使用，**商业使用须先向上游作者取得授权**。公开传播/变现的实际用途需另行核对，不能因为“视频归创作者”就当作工具包获商用许可。
- `mg-styles-15`：MIT；其中的音视频素材、第三方样本或字体需单独核对许可。

只选择和引入上游引用，不等于已完成部署、实际运行或视频渲染。本文件不替代上游仓库对应许可证全文。

## VIDEO-002 建议

对数学题解析视频 `projects/vector-dot-product-minimum/`，优先评估 `video-talkcraft` 的讲解/口播对齐能力，将几何过程交给严格数学约束的 SVG 或 Manim 等独立实现；`anything2explainer` 可作工作流备选，`mg-styles-15` 仅参考视觉语言，`video-shotcraft` 按需选镜头效果。

这是一份工具整合建议，不表示已在 VIDEO-002 接入、运行或授权商用。
