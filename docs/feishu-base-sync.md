# 将行业动态和论文同步到飞书多维表格

GitHub 的 `brief-data` 和 `papers-data` 是各自的数据源，写入同一 Base 的不同表。同步不反向写入 GitHub。评测和架构选题暂不在同步范围。

## 本地同步

需要 Node.js 22 和已授权的 `lark-cli`。行业动态表使用 `标题` 或空表自带的 `文本` 作为主字段，另建以下字段：

- 日期：`刊发日期`，采用北京时间。
- 单选：`栏目`，选项为 AI 产品前线、AI 行业现场、AI 资本与牌局、AI 能力底座。
- 文本：`公司或产品`、`主题`、`摘要`、`来源`、`来源日期`、`同步 ID`、`同步版本`。来源日期保留原始精度和注明的历史背景。
- URL：`报刊链接`、`原文链接`。

通过环境变量 `FEISHU_BASE_TOKEN` 和 `FEISHU_TABLE_ID` 指向目标表。默认读主仓库最近 30 个自然日的结构化刊期，不会把老刊或手动记录删掉：

```bash
npm run base:sync
npm run base:sync -- --apply --wait-for-pages
```

不带 `--apply` 时只读取并打印变动数量。发生超时或部分失败后重新做预检，不直接重放写入请求。同步 ID 由刊发日和规范化来源 URL 派生，与标题、栏目及顺序无关；源链接换成另一篇或另一个路径会产生新 ID，需人工确认旧记录。内容不变会跳过；若外部编辑了同步字段而没改同步版本，脚本不会把这种手工编辑当作源端变化。保留两列同步元数据，只从常用视图隐藏。

## 论文观察

使用 `FEISHU_PAPERS_TABLE_ID` 指向独立的论文表。主字段是 `标题`；日期字段为 `首次发布`、`最近更新`；`版本` 为数字；`论文链接` 为 URL；`arXiv ID`、`主分类`、`主题`、`作者`、`同步 ID`、`同步版本` 为文本。

```bash
npm run base:sync -- --dataset papers
npm run base:sync -- --dataset papers --apply
```

只读仓库最近一次成功的论文快照，预检会显示快照的时间和可选总数。默认按发表日、同日的观察优先级选前 30 篇（`--paper-limit` 可调），不把这个顺序当成论文质量排名。已入表且仍在快照内的论文即使不再排前 30，也继续同步更新。论文 ID 使用不带版本后缀的 arXiv ID；新版更新同一行。表里不复制摘要，不声称补抓截止到今天。

## GitHub Actions

工作流仅在 `main` 运行，默认关闭。先为独立的飞书自建应用授予目标表的字段读取和记录读写权限，再配置仓库 Variables：`FEISHU_BASE_TOKEN`、`FEISHU_BASE_SYNC_APP_ID`，按需添加 `FEISHU_TABLE_ID`（行业动态）及 `FEISHU_PAPERS_TABLE_ID`（论文），以及 Secret：`FEISHU_BASE_SYNC_APP_SECRET`。不要把应用密码或个人授权令牌提交到仓库。

最后把 `FEISHU_BASE_SYNC_ENABLED` 设为 `true` 并手动触发一次，确认应用身份可访问指定表。此后 `main` 的日报与论文数据变更会触发同步；论文抓取工作流成功后也单独检查论文表。日报同步等待最新一期 JSON 在 GitHub Pages 生效，论文条目直接链接 arXiv，不依赖站点发布。工作流不修改公开共享设置。开启后，不要同时从本地对同一张表执行写入。
