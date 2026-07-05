# 一周来信视觉系统

## Job

Make a weekly 公众号 carousel that feels like “one letter from the AI industry.” The user should understand the week through a short, scannable sequence:

- first card attracts attention
- four column cards deliver the most valuable signals
- last card compresses the week into a judgment

## Card Sequence

1. `00-cover`: lavender realistic signal-object opener. No detailed news titles. Use date range and a short arrival phrase.
2. `01-products`: 产品前线, 8 selected signals.
3. `02-industry`: 行业现场, 8 selected signals.
4. `03-capital`: 资本与牌局, 8 selected signals.
5. `04-infrastructure`: 能力底座, 8 selected signals.
6. `05-recap`: lavender realistic signal-object recap. Show the four column judgments and one weekly synthesis.

## Color

- Lavender is the brand anchor and belongs mainly to `00-cover` and `05-recap`.
- Column cards randomly select 4 colors from the 7-color pool.
- Default color selection should be deterministic by week start date; use a seed to produce alternate palettes.
- Use only one accent color per column card. All dots, highlights, sticker shadows, and tag text should use that accent.
- Keep black, white, off-white, and neutral gray stable across all cards.

Accent pool:

- Monday: `#BFD88A` 柔和草绿
- Tuesday: `#79B7D8` 清透天蓝
- Wednesday: `#E8A66D` 低饱和杏橙
- Thursday: `#E6D36A` 柔黄
- Friday: `#D9767C` 灰调珊瑚红
- Saturday: `#C8CED6` 雾灰
- Sunday: `#86D7C5` 薄荷青
- Brand lavender: `#B7A8E6`

## Layout

- Canvas: 900 x 1200 px.
- Keep the date large and fixed near the top-right.
- Keep the series label top-left.
- Use a faint grid to imply scanning, logging, or signal capture.
- Use signal-line graphics as a sequence motif, but keep them behind content.
- Use generated realistic signal-object cutouts for opener and recap. Avoid CSS-drawn placeholders.
- Column headline should be a strong judgment, not a neutral label.

## Column Pick Board

- The column card is an editorial pick board, not a clean dashboard.
- Use 8 cards per column.
- Select by weekly value and representativeness.
- Render cards as white blocks with accent shadows.
- Avoid overlapping text. Overlap shapes if needed, but preserve title legibility.
- Use section tags such as `产品前线`, `行业现场`, `资本与牌局`, `能力底座` or shortened variants.

## Copy

- Preserve English product/model names.
- Use `AI Agent` or `Agent` when the concept is AI Agent. Do not use `AI 代理` in rendered copy.
- Keep Chinese title chunks short.
- Strip the vertical bar in source item titles and use a natural compact title.
- Cover copy should feel like the week’s letter has arrived, not explain.
- Recap copy should synthesize, not repeat all 32 selected items.
- Avoid lecture-like copy patterns such as `不是……而是……` and `不只是……也……`.

## QA

Before showing output:

- Confirm 6 PNG files exist if `--render` was used.
- Visually inspect cover, at least one column card, and recap.
- Check that every column card contains 8 visible picks.
- Check that no text is hidden behind visual props.
- Check that a column card does not mix multiple accent colors.
- Check that rendered HTML has no Chinese `代理` when it means AI Agent.
