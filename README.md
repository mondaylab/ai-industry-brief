# The AI Industry Brief

一份面向团队阅读与复用的 AI 行业简报静态站点，追踪四个方向：

- AI 工作台
- AI 流水线
- AI 大模型
- AI 信息美学

每期内容优先整理最近 7 天内的官方来源；当某一专栏缺少窗口内可核实的新发布时，会明确标注“邻近窗口”或“最近官方参考”。本仓库以开放内容归档为起点，后续可延展为 CLI 或 Skill，为团队提供可复用的行业情报入口。

## 在线阅读

通过 GitHub Pages 访问行业简报归档首页，并按日期进入每日详情。

## 文件结构

- `index.html`：每日简报聚合首页
- `briefs/YYYY-MM-DD.html`：每日长图式详情页
- `brief-data/YYYY-MM-DD.json`：每日结构化数据配置（生成详情页前的单一事实源）
- `skills/ai-industry-brief/`：用于生成、更新与发布简报的 Codex Skill
- `workers/feishu-brief-push/`：Cloudflare Worker，定时读取公开站点并推送飞书机器人

## 数据配置与去重

为避免“每天条目和历史重复”，新增了数据配置与去重校验流程：

1. 从 `brief-data/_template.json` 复制生成当天配置 `brief-data/YYYY-MM-DD.json`
2. 填写 4 个栏目 x 2 条内容（共 8 条）
3. 生成页面前运行：
   - `node skills/ai-industry-brief/scripts/check-brief-dedup.js brief-data/YYYY-MM-DD.json`

该校验会与历史 `brief-data/*.json` 和 `briefs/*.html` 比较，阻止重复的来源 URL 或重复条目标题进入当天简报。

## Skill

仓库包含可复用的 `$ai-industry-brief` 技能定义，沉淀采集、撰写、版式、归档及 GitHub Pages 发布规则。将该目录安装至 Codex skills 后，可用于每日运行或进一步封装为 CLI / 插件。

## 飞书推送

仓库同时提供一个独立的 Cloudflare Worker，用于保持“本地生成并发布 GitHub Pages”不变的前提下，把已发布的日报按定时任务推送到飞书群机器人。该 Worker 只消费公开站点，不参与内容生成。

## 许可

本项目以 [MIT License](LICENSE) 开源发布。
