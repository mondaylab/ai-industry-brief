# 推送与核验

目标为 [mondaylab/ai-industry-brief](https://github.com/mondaylab/ai-industry-brief) 的 `main`，GitHub Pages 从该分支根目录发布。默认生成一期就推送一期，技术归档入口为 [全球技术视野](https://mondaylab.github.io/ai-industry-brief/global-tech-radar/)。

1. 校验目标仓库，使用干净的检出目录。如果当前工作区远端不匹配或有未提交的其他改动，找已有的干净检出目录，或另行克隆。取回最新的 `origin/main`，从该提交开始处理。使用其 `global-tech-radar/brief-data/` 作为去重与跟进依据。
2. 从仓库根目录运行 `python3 skills/global-tech-radar/scripts/render.py --root global-tech-radar`。检查当天稿件、日期页和首页的链接，确认旧期仍可访问。
3. 每次更新只提交本期的 `global-tech-radar/brief-data/YYYY-MM-DD.json`、`global-tech-radar/briefs/YYYY-MM-DD.html`、`global-tech-radar/index.html`。若有必要修订历史期，逐一检查差异并提交关联文件。先查看暂存 diff，再提交和推送到 `origin main`。同日重跑如无实质变化，复用已发布的链接。
4. 用普通快进推送。如果远端在此期间变化，取回远端并合入最新改动，运行校验和渲染器后重试。如果日期稿有冲突，先对照远端内容解决，再重新生成 HTML。
5. 核对该提交已进入远端 `main`。再检查 `https://mondaylab.github.io/ai-industry-brief/global-tech-radar/briefs/YYYY-MM-DD.html` 的期号和头条。如果 Pages 仍部署中，先以实际状态报告，并附 GitHub 上的本期原稿链接。
