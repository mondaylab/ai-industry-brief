# 强弱信号做图 SOP

这套流程用于把连续 7 天的 `brief-data/YYYY-MM-DD.json` 生成一组适合公众号/小红书发布的 3:4 竖版图片。

## 输出结构

默认输出 6 张图：

1. `00-cover`：封面，强弱信号主视觉
2. `01-products`：产品前线，8 条精选
3. `02-industry`：行业现场，8 条精选
4. `03-capital`：资本与牌局，8 条精选
5. `04-infrastructure`：能力底座，8 条精选
6. `05-recap`：本周留言，总结页

每张图片尺寸为 `900 x 1200`，HTML 文件会和 PNG 一起输出，方便后续局部调整。

## 前置条件

确认目标周有连续 7 个数据文件：

```text
brief-data/YYYY-MM-DD.json
```

每个文件应包含 4 个栏目，每栏 3 条动态，共 12 条。

## 生成命令

```bash
node skills/ai-weekly-call-log/scripts/generate-weekly-call-log.js \
  --start YYYY-MM-DD \
  --picks brief-data/weekly-picks-YYYY-MM-DD.json \
  --out output/yi-zhou-lai-xin-YYYY-MM-DD \
  --render
```

示例：

```bash
node skills/ai-weekly-call-log/scripts/generate-weekly-call-log.js \
  --start 2026-06-29 \
  --picks brief-data/weekly-picks-2026-06-29.json \
  --out output/yi-zhou-lai-xin-2026-06-29-to-2026-07-05-4col \
  --render
```

## 当周精选文件

中间 4 张栏目页的 8 条内容应根据当周新闻单独选择，不要写死在生成脚本里。

建议每周创建：

```text
brief-data/weekly-picks-YYYY-MM-DD.json
```

格式：

```json
{
  "weekStart": "YYYY-MM-DD",
  "weekEnd": "YYYY-MM-DD",
  "columns": {
    "产品": ["源数据里的标题 1", "源数据里的标题 2"],
    "行业": ["源数据里的标题 1", "源数据里的标题 2"],
    "资本": ["源数据里的标题 1", "源数据里的标题 2"],
    "底座": ["源数据里的标题 1", "源数据里的标题 2"]
  }
}
```

每个栏目建议写满 8 条。脚本会按标题匹配 `brief-data` 中的当周条目；如果 picks 文件里的标题找不到，会直接报错，避免静默漏选。

没有传 `--picks` 时，脚本会 fallback 到每个栏目按日期顺序取前 8 条，只适合临时预览，不适合作为最终发布版。

## 颜色规则

封面和结尾页固定使用品牌紫：

- `#B7A8E6` 品牌薰衣草紫

中间 4 张栏目页会从以下 7 个柔和色中抽取 4 个：

- `#BFD88A` 柔和草绿
- `#79B7D8` 清透天蓝
- `#E8A66D` 低饱和杏橙
- `#E6D36A` 柔黄
- `#D9767C` 灰调珊瑚红
- `#C8CED6` 雾灰
- `#86D7C5` 薄荷青

默认用 `--start` 作为颜色种子，所以同一周重复生成会得到同一组颜色。想换一版配色时传入新的种子：

```bash
node skills/ai-weekly-call-log/scripts/generate-weekly-call-log.js \
  --start 2026-06-29 \
  --picks brief-data/weekly-picks-2026-06-29.json \
  --out output/yi-zhou-lai-xin-2026-06-29-to-2026-07-05-4col-alt \
  --color-seed random \
  --render
```

也可以使用固定字符串做可复现的备选方案：

```bash
--color-seed weekend-v2
```

## 文案口径

- 专栏名固定为“强弱信号”。
- 面向大众读者，标题要直白，避免技术黑话堆叠。
- 确实指 AI Agent 时，直接写 `AI Agent` 或 `Agent`，不要写“AI 代理”。
- 不要把 AI Agent 概念改写成“AI 治理”“AI 管控”“AI 可控”“治理能力”等抽象词。只有来源本身讲权限、审计、成本、安全、采购规则、合规或认证时，才使用“治理/管控/可控”。
- 如果条目讲的是 Agent 接活、分派、执行、调用工具、进入工作流、被评测或上岗，标题或正文里必须保留 `AI Agent` / `Agent` / `Agentic` / `Agentforce` 等可见 Agent 术语。
- 禁用“不是……而是……”“不只是……也……”这类讲稿腔句式；脚本会在写文件前检查并报错。
- 每个栏目页只展示 8 条精选，优先选择最能代表本周变化的动态。

## QA 清单

导出后至少检查：

- 输出目录中有 6 个 HTML 和 6 个 PNG。
- PNG 尺寸均为 `900 x 1200`。
- 封面电话不遮挡底部文字。
- 中间 4 张每张都有 8 条卡片。
- 颜色不刺眼，单张栏目页只使用一个强调色。
- HTML 中没有中文“代理”残留。
- Agent 条目没有被抽象成“AI 治理/AI 管控/AI 可控”，可见文案里仍有 `Agent` 或 `Agentic`。
- HTML 中没有禁用句式。

常用检查命令：

```bash
find output/yi-zhou-lai-xin-YYYY-MM-DD -maxdepth 1 \( -name '*.png' -o -name '*.html' \) | wc -l
file output/yi-zhou-lai-xin-YYYY-MM-DD/*.png
rg -n "代理|AI 治理|AI治理|AI 管控|AI管控|AI 可控|AI可控|不是|而是|不只是|不再是|不只" output/yi-zhou-lai-xin-YYYY-MM-DD/*.html
```
