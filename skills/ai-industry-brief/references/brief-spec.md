# Brief Specification

## Output

- Detail file: `briefs/YYYY-MM-DD.html`
- Archive file: `index.html`
- Data config file: `brief-data/YYYY-MM-DD.json`
- Detail structure: opening line, 4 sections x 3 items, closing insight, sourcing note, footer
- Archive structure: latest card first; every existing brief remains clickable

## Sections

| Section | Focus | Seed queries |
| --- | --- | --- |
| AI 工作台 | Product updates, knowledge/workspace shifts | Notion AI, YouMind, 飞书 AI, Obsidian AI |
| AI 流水线 | CLI tools, agents, MCP, deployment | Claude Code, Gemini CLI, Codex CLI, MCP, Agent framework |
| AI 大模型 | Model launches, evaluations, benchmarks | Claude, GPT, Gemini, DeepSeek, Kimi model update |
| AI 信息美学 | Image/media generation and creator tools | GPT-Image, Gemini image, Flux, Ideogram, Adobe Firefly |

## Layout

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

## Palette

| Day | Primary | Tone |
| --- | --- | --- |
| 星期一 | `#A584F5` | 亮紫 |
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
6. If the site is published, verify the deployed archive and current detail page after Pages builds.
