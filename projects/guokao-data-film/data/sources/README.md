# 上游数据：出处、校验与本地复算

本目录的 **`manifest.json` 是来源台账**，不是对第三方原件拥有版权或再分发许可的声明。面向公众发布的 `self-media` 代码主分支**不随代码附带 2027 招考简章原 ZIP、教育目录 PDF/DOCX、海事官网 HTML 副本等原始下载件**。

## 为什么不直接放到 Git

- Git 源代码及派生统计可被审查、比较和复用；第三方发布的完整附件仍受各自权利及网站条款约束，不能因本仓源码使用 MIT 就自动取得 MIT 授权。
- 当用户需要原始资料复算时，应从 `manifest.json` 的 `url` 或 `source_page_url` 独立获取，与台账中的 `sha256`、`bytes` 核对。这些原件放在**使用者已获授权的独立本地输入目录**，而不是本 Git 项目或仓库历史。
- `research/OFFICIAL_NATIONAL_TABLE_VERIFICATION_20261018.json` 等报告保留此前已真实核验的结论；**去掉原件并不意味着在本次提交里重新执行了官方核验**。后续复算需要重新下载校验同一版本。

## 如何重新核验

在允许执行项目的设备中，手动下载（或从合规授权的数据保管处获得）与 manifest 完全对应的文件，保持 `file` 中指定的本地文件名，然后运行：

```bash
# 请使用独立、本地授权的目录；不要上传原始资料到未授权服务器
mkdir -p /path/to/guokao-official-inputs

# 示例：放入已下载的 zhaokao_jianzhang_2027.zip 后，对比其 SHA-256
sha256sum /path/to/guokao-official-inputs/zhaokao_jianzhang_2027.zip

# 国考 2027 全部 19,426 岗 × 27 个原字段逐格校验
python3 scripts/verify_official_national_table.py \
  --workspace /path/to/guokao-official-inputs

# 如需重建 2023/2024 研究生代码册及 2026 自设学科名册，
# 将四份对应附件下载并核验后运行：
python3 scripts/build_major_catalogs_20261018.py \
  --workspace /path/to/guokao-official-inputs
```

工作目录、具体输入及 Python 依赖以项目脚本说明为准。**不要在东京服务器创建本项目的下载、临时文件、执行或缓存**；该项目历史执行授权只针对 Dell A6000 的指定隔离环境。

## 权利和证据边界

- 官方工作簿来自 2027 国考招录专题；代码册和自设名册来自被追溯的政府/教育部门资料，部分文件经外部转存链接获取。转载链接的域名**不等于原发布机构**。
- 来源 URL 可失效或更换；SHA-256 用于锁定文件版本，不代表该文件的法律许可或某项专业资格解释必然适用。
- 申明 `raw_source_files_embedded=false` 的意思仅是**当前公开发布候选不直接跟踪这些附件副本**。如果此前分支的历史提交曾添加附件，普通删除新提交**不会抹掉旧 Git 对象**；若存在隐私/权利问题还需要单独审核历史和处理。

源码及数据使用许可说明见 [RIGHTS_AND_SOURCES.md](../../../../RIGHTS_AND_SOURCES.md)。
