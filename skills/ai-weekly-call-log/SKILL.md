---
name: ai-weekly-call-log
description: Generate and maintain “一周来信”, The AI Industry Brief weekly 3:4 sticker series from seven daily brief-data JSON files. Use when creating the weekly WeChat/公众号 image carousel, 6-card weekly column posters, realistic signal-object opener/recap cards, lavender brand-anchor cards, or reusable scripts/templates for this repository's weekly visual system.
---

# 一周来信

Create a 6-card weekly sticker carousel for The AI Industry Brief:

1. Lavender realistic signal-object opener
2. Four column-pick posters generated from seven `brief-data/YYYY-MM-DD.json` files
3. Lavender realistic signal-object recap card

Keep this skill scoped to this repository. Do not install it globally unless the user explicitly asks.

## Workflow

1. Read [references/visual-system.md](references/visual-system.md) before changing layout, colors, hierarchy, or copy rules.
2. Confirm the repo has seven consecutive `brief-data/YYYY-MM-DD.json` files. Each file should contain 4 sections and 12 items.
3. Generate the weekly set with:

```bash
node skills/ai-weekly-call-log/scripts/generate-weekly-call-log.js \
  --start YYYY-MM-DD \
  --out output/weekly-call-log-YYYY-MM-DD \
  --render
```

4. Inspect at least the cover, one column content card, and the recap PNG. Fix layout collisions before showing results.
5. Preserve generated HTML next to PNG output so the design can be patched without regenerating data.
6. For the full operating procedure, follow [../../docs/weekly-call-log-sop.md](../../docs/weekly-call-log-sop.md).

## Data Rules

- Use `brief-data/YYYY-MM-DD.json` as the only content source.
- Each of the four column cards displays 8 selected items from that column across the week.
- Select for weekly value and representativeness, not just chronological order. If explicit priority metadata is added later, prefer that.
- Preserve English model/product names such as `Claude Sonnet`, `GitHub Copilot`, `AWS Data Mesh`, and `Kimi K2.7 Code`.
- Use `AI Agent` or `Agent` for AI Agent concepts; do not render them as `AI 代理`.
- Shorten only for visual fit; do not invent facts.

## Visual Rules

- Canvas: 900 x 1200 px, 3:4.
- System: black/white editorial grid, signal-line motif, bold Chinese/Latin mixed typography.
- Opener and recap use lavender as the brand anchor.
- Opener and recap currently use the raster phone cutouts in `assets/` as signal-object props, not CSS-drawn placeholders.
- The four column content posters randomly select 4 accents from the 7-color pool, but each column poster uses only one accent color.
- The signal object is a narrative device:
  - opener = the week’s industry letter arrives
  - column posters = weekly picks by theme
  - recap = end note

## Script

Use `scripts/generate-weekly-call-log.js` for deterministic output. It:

- reads seven daily JSON files
- uses `assets/phone-receiver-v1.png` and `assets/rotary-phone-v1.png` for realistic signal-object visuals
- writes `00-cover.html`, `01-products.html`, `02-industry.html`, `03-capital.html`, `04-infrastructure.html`, and `05-recap.html`
- selects 4 accents from the 7-color pool. Default color seed is `--start`; use `--color-seed random` or another seed for alternate palettes
- optionally renders each HTML file to PNG with Playwright via `npx playwright screenshot`

Run `node skills/ai-weekly-call-log/scripts/generate-weekly-call-log.js --help` for options.
