# VIDEO-002 · 一道向量最值题，藏着多少种解法？

**状态：PLANNED（文案与数学稿）** · v0.1 · 2026-11-12  
**项目编号：VIDEO-002** · slug：vector-dot-product-minimum

把一道高中向量最值选择题从“点积”转换成“投影”，用面积不等式与直径圆两条路线求最小值，再用三角函数验证。

**核心答案：** $\min(\overrightarrow{AD}\cdot\overrightarrow{AB})=-2$，选 D。

## 交付清单

- [数学六解法与原生 TikZ 图：latex/analysis.tex](latex/analysis.tex)：唯一数学母稿，包含严谨性提醒及等号点。
- [口播草稿：content/VOICEOVER.md](content/VOICEOVER.md)：约 4 分钟的逐段讲解。
- [分镜与公式：content/STORYBOARD.md](content/STORYBOARD.md)：逐镜头公式、画面与时间码。
- [立项章程](PROJECT_CHARTER.md) · [创意简报](CREATIVE_BRIEF.md) · [制作计划](PRODUCTION_PLAN.md)。
- [LaTeX 编译说明](latex/README.md) · [来源与许可](reference/SOURCES.md)。

**目前没有完成的内容：** 尚未创建动画工程，尚未渲染 MP4/配音，也未发布。提交的 LaTeX 是供编译审校的源码。

## 本期结构

1. 题面与有向投影：为什么是控制 D 到 AC 的横向距离？
2. 面积不等式：$a^2+b^2+ab=12\Rightarrow ab\le4\Rightarrow h\le1$。
3. 圆的突破：$60^\circ+120^\circ=180^\circ$，负点积构型四点共圆；BC 为直径。
4. 三角函数快速验证；完整六解法在 LaTeX 扩展稿。
5. 等号点 $D=(-1,\sqrt3)$ 和结论 $-2$。

先读 [项目章程](PROJECT_CHARTER.md)；其他视频项目与本项目严格隔离。
