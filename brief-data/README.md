# Brief Data Config

Use this folder to store daily structured data before generating HTML pages.

## File naming

- One file per day: `YYYY-MM-DD.json`

## Workflow

1. Copy `brief-data/_template.json` to `brief-data/YYYY-MM-DD.json`.
2. Fill all fields and items.
3. Run dedup check:
   - `node skills/ai-industry-brief/scripts/check-brief-dedup.js brief-data/YYYY-MM-DD.json`
4. Only after dedup passes, generate `briefs/YYYY-MM-DD.html` and update `index.html`.

## Dedup policy

The dedup checker blocks entries that duplicate historical content by:

- same source URL
- same item title (`产品/工具名 | 核心动作短语`)
- same normalized key (`产品/工具名|核心动作短语`, case-insensitive)

It checks against:

- existing files in `brief-data/*.json`
- existing archive pages in `briefs/*.html`

