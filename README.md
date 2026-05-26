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
- `skills/ai-industry-brief/`：用于生成、更新与发布简报的 Codex Skill

## Skill

仓库包含可复用的 `$ai-industry-brief` 技能定义，沉淀采集、撰写、版式、归档及 GitHub Pages 发布规则。将该目录安装至 Codex skills 后，可用于每日运行或进一步封装为 CLI / 插件。

## 许可

本项目以 [MIT License](LICENSE) 开源发布。
