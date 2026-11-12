# LaTeX 解析母稿

主文件：analysis.tex。采用 ctexart、amsmath 与 TikZ，包含六解法与**自行绘制**的等号示意图。

## 编译

在已安装带中文支持的 XeLaTeX / TeX Live 环境中，从此目录执行：

    xelatex -interaction=nonstopmode -halt-on-error analysis.tex
    xelatex -interaction=nonstopmode -halt-on-error analysis.tex

生成 analysis.pdf 供审阅。即使编译成功，仍要实际检查每一页公式与 TikZ 标记的视觉排版。视频里的公式以本文件为准，口播和分镜是派生稿；本阶段不等于已制作视频。
