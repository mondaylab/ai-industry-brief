# Industry Starter

Use this reference when the user wants to adapt `ai-industry-brief` to a non-AI industry or asks for a zero-config first issue.

## Minimal Questions

Ask at most two questions before generating the first issue:

1. What industry or niche should the brief cover?
2. Who is the target reader?

Infer everything else and state assumptions briefly. Do not ask about layout, data schema, color palette, or publishing until the first issue exists.

## Initialization Output

Create or update:

- `brief-data/YYYY-MM-DD.json`
- `briefs/YYYY-MM-DD.html`
- `index.html`

If the repo is missing templates, copy from `assets/archive-page-base.html` and `assets/brief-page-base.html`.

## Common Industry Defaults

| Brief | Sections | Source priorities | Impact criteria |
| --- | --- | --- | --- |
| 出海印尼日报 | 政策监管, 电商平台, 消费趋势, 本地品牌与渠道 | 印尼政府与监管部门, Tokopedia/Shopee/TikTok Shop 官方公告, 本地商业媒体, 市场研究 | 准入门槛, 履约支付, 消费品类, 中国品牌机会 |
| 跨境电商简报 | Amazon, TikTok Shop, Shopee/Lazada, 物流支付与广告 | 平台公告, seller center, 物流商公告, 广告产品更新, 权威行业媒体 | 平台规则, 流量成本, 履约规则, 卖家自动化机会 |
| 外贸行业简报 | 汇率关税, 供应链与港口, 展会与客户, 品类价格与订单 | 海关/商务部门, 港口与航运公告, 展会官网, 行业协会, 大宗数据 | 成本变化, 交付风险, 客户需求, 市场窗口 |
| 教育行业简报 | 政策法规, 在线教育平台, AI 教学工具, 课程与考试趋势 | 教育主管部门, 平台公告, 学校/机构发布, AI 教育工具更新 | 合规风险, 获客变化, 教学效率, 内容供给 |
| 制造业简报 | 原材料价格, 工厂动态, 行业标准, 出口订单与设备 | 行业协会, 交易所/价格指数, 企业公告, 标准组织, 海关数据 | 采购成本, 产能变化, 认证质量, 订单交期 |

## Section Rules

- Keep exactly 4 sections unless the user explicitly asks otherwise.
- Keep 3 items per section for a standard daily issue.
- Each item must have a source URL and source date label.
- The description must say why the item matters for that industry, not only summarize news.

## Brand Adaptation

Use this pattern unless the user provides brand copy:

- Public title: `The <Industry> Brief`
- Chinese title: `每日<行业>简报`
- Producer: keep `星期一研究室` unless the user gives another publisher
- Footer: `<Chinese title> · 行业动态 · 机会判断 · 来源可追溯`

## Prompt Examples

```text
请用 ai-industry-brief Skill，初始化一个跨境电商简报项目，并生成第一期。
```

```text
请用 ai-industry-brief Skill 搭一个出海印尼日报。目标读者是中国出海品牌团队，先生成第一期，不要让我手动配置。
```

```text
请把这个项目改造成制造业简报，保留页面模板和去重脚本，替换栏目、来源和影响判断维度。
```
