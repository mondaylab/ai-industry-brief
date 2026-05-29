---
name: ai-industry-brief
description: Create and maintain The AI Industry Brief as a sourced daily AI industry briefing and static HTML archive. Use when Codex is asked to research daily AI updates, generate or update brief pages, extend the clickable archive, publish the brief through GitHub Pages, or reuse the briefing workflow in an automation, CLI, or skill.
---

# The AI Industry Brief

Produce a concise, source-grounded daily industry brief and maintain its publishable HTML archive.

## Start

1. Read [references/brief-spec.md](references/brief-spec.md).
2. If updating an existing site, read its latest `briefs/YYYY-MM-DD.html` and `index.html`; preserve established layout and history.
3. If starting a new site, copy the HTML bases in `assets/` and replace all sample content, dates, colors, and links.
4. Create or update `brief-data/YYYY-MM-DD.json` (copy from `brief-data/_template.json`) as the source-of-truth config for the day.

## Research

1. Use current web search and prefer official release notes, company blogs, developer posts, or primary documentation.
2. Search the four sections: AI 工作台, AI 流水线, AI 大模型, AI 信息美学.
3. Select two worthwhile items per section, prioritizing the last seven days.
4. Record a real URL and publication date for every item. Label any item outside the preferred window as `邻近窗口` or `最近官方参考`; never imply it is new today.
5. Before writing HTML, run dedup check and resolve any conflicts:
   - `node skills/ai-industry-brief/scripts/check-brief-dedup.js brief-data/YYYY-MM-DD.json`

## Write

1. Write one decisive opening line under 50 Chinese characters.
2. For each of 8 items, use `产品/工具名 | 核心动作短语`; keep the action phrase within 15 Chinese characters.
3. Describe fact first and industry impact second in roughly 60-80 Chinese characters.
4. Write a cross-section insight under 150 Chinese characters with a clear judgment.

## Build

1. Generate `briefs/YYYY-MM-DD.html` from `brief-data/YYYY-MM-DD.json` using the weekday palette and fixed branding from the spec.
2. Update `index.html` with a new date card in reverse chronological order; retain earlier entries.
3. Preserve linkable sources and source-date labels in each brief.

## Check And Publish

1. Check for unresolved placeholders and confirm four sections, eight items, and eight source links.
2. Re-run dedup check to ensure no overlap with historical items before release.
3. Open the archive and new detail page in a browser; confirm card navigation, header, footer, wrapping, and small-screen readability.
4. When publishing is requested or already configured, commit only relevant site and skill files, push to the configured GitHub repository, and verify the GitHub Pages URL after deployment.
5. When a scheduled automation drives the workflow, keep its branding, footer, archive, and publish instructions synchronized with this skill.

## Resources

- Read [references/brief-spec.md](references/brief-spec.md) for content rules, colors, branding, file paths, and release checks.
- Use [assets/brief-page-base.html](assets/brief-page-base.html) as the visual base for a new detail page.
- Use [assets/archive-page-base.html](assets/archive-page-base.html) as the visual base for a new archive page.
- Use `brief-data/_template.json` to create daily config and `scripts/check-brief-dedup.js` to prevent repeats.
