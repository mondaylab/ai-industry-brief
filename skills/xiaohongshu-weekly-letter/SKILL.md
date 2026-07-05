---
name: xiaohongshu-weekly-letter
description: Generate Xiaohongshu titles, post body copy, hooks, and hashtags for “一周来信” based on a week of The AI Industry Brief data. Use when drafting 小红书/社媒 copy for weekly AI industry dynamics, especially when the user asks for 网感标题, 小红书标题, 正文, caption, hashtags, or a publish-ready post from brief-data and weekly-picks.
---

# 小红书一周来信文案

Create Xiaohongshu-ready copy for the weekly column “一周来信”. The output should feel like a sharp creator post based on the week’s AI industry dynamics, not a generic AI summary.

## Inputs

Use the best available inputs in this order:

1. `brief-data/weekly-picks-YYYY-MM-DD.json` for editorially selected weekly signals.
2. The seven `brief-data/YYYY-MM-DD.json` files for source descriptions and context.
3. Existing generated poster copy only as supporting context, not as the main source.

If the user gives a date range, map it to the Monday/start date used by the repo. If no picks file exists, read the seven daily data files and choose the strongest cross-week signals yourself.

## Workflow

1. Read `references/xiaohongshu-style.md` before drafting.
2. Identify the week’s central tension in one plain sentence.
3. Pick 3-5 concrete signals from the week to support the post.
4. Draft 5-8 title options first.
5. Choose one recommended title and write the body.
6. Add hashtags only if the user wants publish-ready copy or asks for 小红书正文.

## Title Rules

- Do not make `AI` the first word of the title.
- Do not use title patterns like `AI 行业周报`, `AI 行业动态`, `AI 趋势观察`, `AI 正在...`.
- Prefer human, internet-native hooks: `这周...`, `打工`, `上岗`, `接活`, `老板开始算账`, `终于轮到...`, `有点离谱`.
- Keep titles concrete and easy to understand in 1 second.
- Avoid heavy terms in the title: `agentic`, `基础设施`, `可观测性`, `治理密度`, `范式迁移`.
- `AI` can appear later in the title if needed, but not as the leading subject.

## Body Rules

- Start with a strong first line, not a greeting or explanation of the column.
- Base claims on actual weekly items. Name concrete companies/products when useful.
- Use short paragraphs. Xiaohongshu copy should scan quickly on mobile.
- Explain technical concepts through work scenes: meeting, codebase, customer service, payment, company system, budget.
- When referring to AI Agent, write `AI Agent` or `Agent`; do not write `AI 代理`.
- Avoid lecture-like phrases: `不是……而是……`, `不只是……也……`, `从 A 到 B 的范式迁移`.
- Keep the tone smart, casual, and slightly punchy. No clickbait that overstates the facts.

## Output Shape

For a normal request, return:

```text
标题推荐：
...

备选标题：
1. ...
2. ...

正文：
...

话题：
#AI #AI工具 #AIAgent #AI行业 #一周来信 #星期一研究室
```

If the user asks for multiple styles, provide concise variants:

- `网感版`
- `专业但好读版`
- `更像朋友圈版`

