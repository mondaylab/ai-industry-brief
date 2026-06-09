# Brief Specification

## Output

- Detail file: `briefs/YYYY-MM-DD.html`
- Archive file: `index.html`
- Data config file: `brief-data/YYYY-MM-DD.json`
- Share image file: `share-images/YYYY-MM-DD.png`
- Detail structure: opening line, 4 sections x 3 items, closing insight, sourcing note, footer
- Archive structure: latest card first; every existing brief remains clickable

## Sections

Default AI brief sections:

| Section | Focus | Seed queries |
| --- | --- | --- |
| AI 工作台 | Product updates, knowledge/workspace shifts | Notion AI, YouMind, 飞书 AI, Obsidian AI |
| AI 流水线 | CLI tools, agents, MCP, deployment | Claude Code, Gemini CLI, Codex CLI, MCP, Agent framework |
| AI 大模型 | Model launches, evaluations, benchmarks | Claude, GPT, Gemini, DeepSeek, Kimi model update |
| AI 信息美学 | Image/media generation and creator tools | GPT-Image, Gemini image, Flux, Ideogram, Adobe Firefly |

For non-AI industries, keep the same 4 sections x 3 items shape, but replace section names, seed queries, source priorities, and impact criteria before research. See `industry-starter.md`.

## Archive Layout

- Archive/homepage uses a neutral black/white/gray shell even when the detail pages use weekday Morandi colors.
- Top visible brand text is Chinese-first: `每日 AI 行业简报`; upper right remains `星期一研究室`.
- Top navigation labels are Chinese and ordered: `今日`, `色板`, `往期`.
- The hero section keeps the English publication masthead `The AI Industry Brief`, a phone-shaped daily-paper preview, and three action buttons:
  - `阅读最新一期` links to the latest detail page.
  - `查看七天色板` switches to the palette panel without forcing scroll-to-top.
  - `查看往期` switches to the previous-issues panel without forcing scroll-to-top.
- The archive/recommendation panel is visibly named `往期`; do not use `历史归档` or `精彩推荐` as the section heading.
- Weekly palette on the homepage uses individual swatch archive cards with weekday shorthand, Chinese tone name, and hex code. Avoid plain oval/pill strips.
- Keep `color-palette-demo.html` as a broader design-system preview page with comfortable left/right margins and a tabbed seven-day preview.
- If homepage card markup changes, update the Feishu push worker archive parser so scheduled pushes can still locate the latest issue headline and summary.

## Detail Layout

- Detail pages use a two-column editorial layout.
- Detail pages should feel like a landscape A3 editorial sheet, not a tall poster:
  - use a wide page frame around `1480px`
  - use the A3 landscape ratio as a minimum paper-height reference, not as a fixed crop box
  - allow vertical overflow to scroll naturally; never crop lower sections, insight, or footer
  - use generous left/right page margins and clear row spacing between section pairs
  - keep generous vertical breathing room around the opening line and closing insight so major editorial blocks do not touch
  - style the opening line as an international editorial pull quote: thin top/bottom rules, a non-numeric `LEAD` rail, strong serif text, and a right-side illustration panel; avoid rounded AI-card styling.
  - style the closing insight as an editorial note: top/bottom rules, a left label with a small theme-colored signal icon, and larger serif body text; avoid office-report card styling.
- The visual language should lean toward an international editorial atlas:
  - use a faint paper grid inside the page frame
  - place international editorial illustration inside the opening-line card as a right-side visual panel on desktop, not between section cards or near the footer
  - prefer original inline SVG figures, globe grids, magnifiers, source-ledger tags, model-atlas marks, or archive labels
  - avoid barely visible route paths and repeated paper-plane marks
  - use English micro-labels that fit the publication theme, such as `AI INDUSTRY MAP`, `GLOBAL SIGNALS`, `SOURCE LEDGER`, and `MODEL ATLAS`; avoid vague placeholder phrases.
  - keep section cards clean; decorative illustration should not cross over article text
  - hide heavy illustration ornaments on mobile
- Section order is horizontal:
  - top row: `01 AI 工作台`, `02 AI 信息美学`
  - bottom row: `03 AI 流水线`, `04 AI 大模型`
- Each section header uses a skewed numbered marker and a subtle dashed guide line.
- Item markers inside each section use non-numeric symbols (`◆`, `◇`, `◈`) so they do not compete with section numbers.
- The section marker color must be derived from the day's `--primary` Morandi color:
  - `--section-ink: var(--primary)`
  - `--section-ink-soft: var(--primary-light)`
  - `--section-guide: color-mix(in srgb, var(--primary) 42%, transparent)`
- The top masthead rule should also derive from the day's `--primary`, using a slightly darker mix for newspaper weight.
- Do not hard-code an unrelated blue or accent color for section markers.
- Item rows should dynamically align left/right corresponding items by measured content height on desktop; mobile stays natural single-column.

## Editorial Rules

- Prefer sources published in the seven days up to the brief date.
- Use official/primary URLs wherever available.
- Keep source freshness hierarchical:
  - Tier 1: sources from the seven days up to the brief date.
  - Tier 2: sources from the last 30 days, marked `邻近窗口` when outside the seven-day window.
  - Tier 3: if the last 30 days of mainstream candidates are exhausted by historical dedup, expand outward to adjacent tools, competing platforms, infrastructure layers, creator utilities, governance/security tooling, or ecosystem releases that affect the same workflow.
  - Tier 4: sources older than 30 days are exceptional background references only. Do not use them to fill quota when a relevant adjacent or peripheral source from the last 30 days exists.
- When a section lacks enough fresh primary items, broaden the search radius before broadening the time window. Examples: for `AI 工作台`, also check browser/workspace/search/knowledge-base tools; for `AI 流水线`, check CI, sandbox, observability, MCP/security, deployment, and agent runtime tools; for `AI 大模型`, check model gateways, inference platforms, evals, safety releases, and open deployment ecosystems; for `AI 信息美学`, check video, image, design-system, asset-management, font/brand, and creator workflow tools.
- If an item is older than 30 days, document why it is still necessary in the daily `methodNote`, not only in the source date label.
- Add visible dates to source links. Mark items outside the preferred window as `邻近窗口` or `最近官方参考`.
- Daily draft data must be prepared in `brief-data/YYYY-MM-DD.json` before HTML generation.
- New daily items must not duplicate historical entries by source URL or item title.
- Title form: `产品/工具名 | 核心动作短语`; action phrase no longer than 15 Chinese characters.
- Description form: fact, then meaning or impact; target 60-80 Chinese characters.
- Opening line: one judgment, maximum 50 Chinese characters.
- Closing insight: synthesize multiple sections, maximum 150 Chinese characters; avoid tentative filler.

## Brand

- Public name: `The AI Industry Brief`
- Producer attribution in upper right: `星期一研究室`
- Detail footer left: `星期一研究室出品`
- Detail footer right: `The AI Industry Brief · 每日行业简报 · 项目管理 · 信息美学`
- Archive title: `The AI Industry Brief`

For a new industry, replace the public name and footer terms while preserving the template hierarchy. Suggested pattern: `The <Industry> Brief` plus a Chinese subtitle such as `每日跨境电商简报`.

## Palette

| Day | Primary | Tone |
| --- | --- | --- |
| 星期一 | `#927BBE` | 莫兰迪紫 |
| 星期二 | `#6F97A8` | 雾蓝 |
| 星期三 | `#7FA6C9` | 晴蓝 |
| 星期四 | `#7FA68B` | 鼠尾草绿 |
| 星期五 | `#6F9F99` | 青瓷绿 |
| 星期六 | `#8A93B7` | 紫蓝 |
| 星期日 | `#EC9BC8` | 柔粉 |

Use an approximately 10%-tinted pale background derived from the day's primary color for callouts and counters.
Use the same day's primary color family for section number markers, marker shadows, and guide lines.
Keep the weekly palette balanced around purple, blue, green, and pink families; do not use brown, orange, or honey-gold weekday accents.

## Existing Site

- Repository: `mondaylab/ai-industry-brief`
- Public archive: `https://mondaylab.github.io/ai-industry-brief/`
- Publish from `main` through GitHub Pages.

## Release Gate

1. No template placeholders remain.
2. The new page contains exactly 4 section containers, 12 content items, and 12 source anchors.
3. Dedup check passes: `node skills/ai-industry-brief/scripts/check-brief-dedup.js brief-data/YYYY-MM-DD.json`.
4. The archive contains a clickable card for the new page and preserves earlier links.
5. Browser inspection shows clean header/footer, no obvious clipping, and functioning navigation.
6. The share image `share-images/YYYY-MM-DD.png` exists, is a PNG screenshot of the detail page, and is published with the same issue.
7. If the site is published, verify the deployed archive, current detail page, and current share image after Pages builds. Deployment is complete only when the archive contains `briefs/YYYY-MM-DD.html`, the detail page shows the correct date/footer, and `share-images/YYYY-MM-DD.png` returns `image/png`.
8. After Pages deployment verification succeeds, immediately trigger the Feishu image push with `npm --prefix workers/feishu-brief-push run post-publish-send -- --date YYYY-MM-DD`, or call `/send-image-url` with the published PNG when the Worker screenshot path is unavailable. Do not rely only on the scheduled patrol. Manual trigger commands require `MANUAL_TRIGGER_TOKEN` or `FEISHU_PUSH_TOKEN`.
