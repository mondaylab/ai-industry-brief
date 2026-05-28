# Brief Specification

## Output

- Detail file: `briefs/YYYY-MM-DD.html`
- Archive file: `index.html`
- Detail structure: opening line, 4 sections x 2 items, closing insight, sourcing note, footer
- Archive structure: latest card first; every existing brief remains clickable

## Sections

| Section | Focus | Seed queries |
| --- | --- | --- |
| AI 工作台 | Product updates, knowledge/workspace shifts | Notion AI, YouMind, 飞书 AI, Obsidian AI |
| AI 流水线 | CLI tools, agents, MCP, deployment | Claude Code, Gemini CLI, Codex CLI, MCP, Agent framework |
| AI 大模型 | Model launches, evaluations, benchmarks | Claude, GPT, Gemini, DeepSeek, Kimi model update |
| AI 信息美学 | Image/media generation and creator tools | GPT-Image, Gemini image, Flux, Ideogram, Adobe Firefly |

## Editorial Rules

- Prefer sources published in the seven days up to the brief date.
- Use official/primary URLs wherever available.
- Add visible dates to source links. Mark items outside the preferred window as `邻近窗口` or `最近官方参考`.
- Title form: `产品/工具名 | 核心动作短语`; action phrase no longer than 15 Chinese characters.
- Description form: fact, then meaning or impact; target 60-80 Chinese characters.
- Opening line: one judgment, maximum 50 Chinese characters.
- Closing insight: synthesize multiple sections, maximum 150 Chinese characters; avoid tentative filler.

## Brand

- Public name: `The AI Industry Brief`
- Producer attribution in upper right: `星期一研究室`
- Detail footer left: `星期一研究室出品`
- Detail footer right: `The AI Industry Brief`
- Archive title: `The AI Industry Brief`

## Palette

| Day | Primary | Tone |
| --- | --- | --- |
| 星期一 | `#8B7BA8` | 莫兰迪紫 |
| 星期二 | `#7A9E9F` | 莫兰迪青 |
| 星期三 | `#A68F7A` | 莫兰迪棕 |
| 星期四 | `#8FA68F` | 莫兰迪绿 |
| 星期五 | `#A68F8F` | 莫兰迪玫 |
| 星期六 | `#A68F7A` | 莫兰迪暖棕 |
| 星期日 | `#9B8EA6` | 莫兰迪淡紫 |

Use an approximately 10%-tinted pale background derived from the day's primary color for callouts and counters.

## Existing Site

- Repository: `mondaylab/ai-industry-brief`
- Public archive: `https://mondaylab.github.io/ai-industry-brief/`
- Publish from `main` through GitHub Pages.

## Release Gate

1. No template placeholders remain.
2. The new page contains exactly 4 section containers, 8 content items, and 8 source anchors.
3. The archive contains a clickable card for the new page and preserves earlier links.
4. Browser inspection shows clean header/footer, no obvious clipping, and functioning navigation.
5. If the site is published, verify the deployed archive and current detail page after Pages builds.
