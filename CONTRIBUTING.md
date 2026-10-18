# Contributing / 贡献指南

欢迎提交**独立视频创作项目、Remotion/React 动画组件、原创数据可视化、渲染脚本、质量审查工具及文档改进**。我们的目标不是强制所有视频使用同一工程，而是让每一条作品独立、可审查、可复现。

## 加入新项目

1. 阅读 [项目目录说明](projects/README.md) 与 [章程模板](projects/_template/PROJECT_CHARTER.md)，为真正独立的题材选择唯一 `VIDEO-XXX` 和 `projects/<slug>/`。不同清晰度、配乐、字幕、V1/V2 **不是**新项目。
2. 填写 `README.md` 和 `PROJECT_CHARTER.md`，明确主旨、观众、数据/素材来源、目标成片与验收要求。创意、制作计划可使用 `CREATIVE_BRIEF.md`、`PRODUCTION_PLAN.md`。
3. 需要 Remotion 时，在本项目内增加独立的 `remotion/`、锁文件、源码、资源许可、`npm ci`、`npm test`、预览和渲染命令。可以使用其他技术栈；不要全仓安装项目私有依赖。
4. 将大型成片、`node_modules`、下载原件、`out/`、音视频临时资产、账号令牌排除 Git；必要时在说明中链接发布资产并标记版本。
5. 创建独立功能分支并提出 Pull Request；描述影响的项目、精确提交、数据来源、运行命令、变更前后画面和真实测试结果。

## Pull Request 检查

- [ ] 改动仅涉及受影响项目（或明确列出的仓库级规范）。
- [ ] 原始数据、第三方作品与作者观点分别标注；不存在无凭据的“官方”“可报”“已通过”等结论。
- [ ] 依赖版本固定，有安装/预览/真实渲染命令。确实运行过的检查才写 PASS。
- [ ] 不包含 token、Cookies、敏感个人信息、机器专属目录、未获授权的下载件或违反来源许可的素材。
- [ ] 字体/图片/音频/Remotion 依赖按各自许可证保留声明；如不确定，添加权利限制而非给整仓套 MIT。
- [ ] 保留既有历史版本与 V1/V2 SHA；不重写别人正在使用的分支或工作树。
- [ ] 未授权时不执行远程设备操作、合并受保护主分支、发布成片或变更仓库权限。

## 验证例子：VIDEO-001

```bash
# 先检出你打算验证的准确 commit / branch
cd projects/guokao-data-film/remotion
npm ci
npm run data
npm test
python3 -m pip install numpy # 受控虚拟环境/固定 Python 环境中
npm run score
npm run render
```

该例仅说明本仓已有的视频工程；实际 4K 可按 `remotion/README.md` 的 `--scale=2` 命令渲染。机器环境不一致时输出编码字节可能不同。**PR 上的脚本成功与已完成逐帧审片是两个不同验收阶段。**

对发现安全问题，请优先按 [SECURITY.md](SECURITY.md) 私下联系维护者，不要公开粘贴密钥或访问路径。
