# LaTeX 解析母稿

主文件：analysis.tex。采用 ctexart、amsmath 与 TikZ，包含六解法与**自行绘制**的等号示意图。

## 编译

在已安装带中文支持的 XeLaTeX / TeX Live 环境中，从此目录执行：

    xelatex -interaction=nonstopmode -halt-on-error analysis.tex
    xelatex -interaction=nonstopmode -halt-on-error analysis.tex

2026-11-12 已在本地 TeX Live 使用 XeLaTeX 实际连续编译两次成功，输出 4 页 PDF；第一版图示有标签拥挤，已调整位置并重新编译、复查首张图。生成 analysis.pdf 供审阅。后续内容改动仍需重新执行上述检查。视频里的公式以本文件为准，口播和分镜是派生稿；本阶段不等于已制作视频。
