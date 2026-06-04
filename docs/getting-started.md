# Getting Started

这份文档面向想复用 `ai-industry-brief` Skill 的用户。你可以把它当成三件东西：

- 一个 Codex Skill
- 一个行业简报静态站点模板
- 一套可扩展到其他行业的日报工作流

## 1. 一句话安装

最推荐的方式不是让用户读完教程，而是直接把下面这句话发给 Codex、Claude Code、Cursor 等 AI 编程助手：

```text
请帮我安装 mondaylab/ai-industry-brief 这个行业简报 Skill，并根据提示帮我初始化一个行业简报项目。
```

如果你已经知道要做哪个行业，可以把行业也放进第一句话：

```text
请帮我安装 mondaylab/ai-industry-brief 这个行业简报 Skill，并帮我生成第一期出海印尼日报。
```

AI Agent 应该自动执行：

```bash
npx skills add mondaylab/ai-industry-brief -y -g
```

如果你已经克隆了这个仓库，也可以从本地路径安装：

```bash
npx skills add . -y -g
```

安装后，重新打开 Codex 或开启新会话，让 Codex 重新发现本地 skills。然后你可以这样触发：

```text
使用 ai-industry-brief Skill，初始化一个跨境电商简报项目，并生成第一期简报。
```

如果你只想继续维护本仓库的 AI 行业简报，可以这样说：

```text
使用 ai-industry-brief Skill，生成今天的 AI 行业简报，并更新静态站点。
```

如果你只想使用 Skill，不想复制整个仓库，可以只保留这个目录：

```text
skills/ai-industry-brief/
```

这个目录里包含：

- `SKILL.md`：主工作流
- `references/brief-spec.md`：内容、品牌、版式和发布规范
- `assets/brief-page-base.html`：详情页模板
- `assets/archive-page-base.html`：首页模板
- `scripts/check-brief-dedup.js`：历史去重检查脚本

## 2. 在其他 AI 产品里使用

如果你使用的不是 Codex，也可以把这个 Skill 当成“项目工作说明”使用。

推荐做法：

1. 把 `skills/ai-industry-brief/SKILL.md` 作为系统说明或项目说明。
2. 把 `skills/ai-industry-brief/references/brief-spec.md` 作为详细规范。
3. 把 `assets/` 里的 HTML 当作生成页面时的模板。
4. 保留 `brief-data/_template.json` 作为每天的数据格式。
5. 如果环境支持执行脚本，运行去重检查脚本；如果不支持，让模型按同样规则人工检查 URL 和标题重复。

适合粘给其他 AI 产品的最短指令：

```text
请阅读 SKILL.md 和 brief-spec.md，按其中的采集、写作、数据结构、版式、归档和发布规则，生成今天的行业简报。先创建 brief-data/YYYY-MM-DD.json，再生成 briefs/YYYY-MM-DD.html，并更新 index.html。
```

## 2.1 安装后的无脑初始化流程

安装完成后，用户不需要自己改配置。只要说清楚行业，AI Agent 应该接管初始化：

1. 询问或提取行业名称、目标读者和发布频率。
2. 为该行业生成 4 个栏目、可信来源优先级和影响判断维度。
3. 复制 `brief-data/_template.json` 为当天数据文件，并替换栏目名称。
4. 使用 `skills/ai-industry-brief/assets/` 中的 HTML 模板生成第一期页面。
5. 运行去重检查和页面检查。
6. 询问是否继续接入 GitHub Pages、飞书群推送或定时任务。

推荐触发语：

```text
请用 ai-industry-brief Skill，帮我搭一个教育行业日报。先生成第一期，不需要我手动配置。
```

```text
请用 ai-industry-brief Skill，初始化一个制造业简报项目，并列出你需要我确认的最少问题。
```

## 3. 每日生成流程

每天生成简报时，建议按这个顺序走：

1. 读取 Skill 和规格文档
2. 复制当天数据配置

```bash
cp brief-data/_template.json brief-data/YYYY-MM-DD.json
```

3. 填写 4 个栏目 x 3 条内容
4. 运行去重检查

```bash
node skills/ai-industry-brief/scripts/check-brief-dedup.js brief-data/YYYY-MM-DD.json
```

5. 生成当天详情页

```text
briefs/YYYY-MM-DD.html
```

6. 更新首页归档

```text
index.html
```

7. 本地检查页面
8. 提交并推送到 GitHub Pages 仓库

## 4. 数据格式

每天的简报数据应该先落到 `brief-data/YYYY-MM-DD.json`。

核心字段：

```json
{
  "date": "YYYY-MM-DD",
  "weekday": "星期X",
  "opening": "一句话判断",
  "insight": "今日洞察",
  "methodNote": "采集窗口说明",
  "sections": [
    {
      "name": "栏目名",
      "subtitle": "产品A · 产品B · 产品C",
      "items": [
        {
          "title": "产品/工具名 | 核心动作短语",
          "description": "事实 + 影响",
          "sourceName": "domain.com",
          "sourceUrl": "https://example.com",
          "sourceDateLabel": "YYYY-MM-DD"
        }
      ]
    }
  ]
}
```

默认要求：

- 4 个栏目
- 每栏 3 条
- 共 12 条
- 每条必须有来源 URL
- 每条必须有来源日期或标注

## 5. 如何扩展成你的行业

扩展时，不建议从零写一个新 Skill。更稳的方式是让 AI Agent 基于 `ai-industry-brief` 初始化行业配置，然后替换行业相关字段。

最短提示词：

```text
请用 ai-industry-brief Skill，把当前项目初始化成「跨境电商简报」。目标读者是跨境电商运营团队。请自动生成栏目、采集关键词、来源优先级、影响判断维度，并生成第一期简报。
```

如果你确实要维护一个独立 Skill，再复制目录：

推荐步骤：

1. 复制 Skill 目录

```bash
cp -R skills/ai-industry-brief skills/your-industry-brief
```

2. 修改 `skills/your-industry-brief/SKILL.md`

需要改：

- `name`
- `description`
- 四个栏目名称
- 采集关键词
- 写作重点
- 发布站点路径

3. 修改 `references/brief-spec.md`

需要改：

- Sections 表格
- Editorial Rules
- Brand
- Palette
- Existing Site

4. 修改 `brief-data/_template.json`

把默认 AI 栏目替换成你的行业栏目。

5. 修改 HTML 模板里的品牌文案

通常需要改：

- 页面标题
- 右上角署名
- 页脚
- 首页介绍

## 6. 行业扩展示例

### 出海印尼日报

适合栏目：

- 印尼政策监管
- 电商与平台
- 消费趋势
- 本地品牌与渠道

优先来源：

- 印尼政府或监管部门
- Tokopedia、Shopee Indonesia、TikTok Shop 官方公告
- 本地商业媒体
- 品牌财报或市场研究

判断维度：

- 是否影响准入
- 是否影响履约和支付
- 是否影响消费品类
- 是否影响中国品牌出海机会

### 跨境电商简报

适合栏目：

- Amazon
- TikTok Shop
- Shopee / Lazada
- 物流、支付与广告

判断维度：

- 平台政策变化
- 流量和广告成本
- 履约规则
- 卖家工具和自动化机会

### 外贸行业简报

适合栏目：

- 汇率与关税
- 供应链与港口
- 展会与客户
- 品类价格与订单

判断维度：

- 成本变化
- 交付风险
- 客户需求
- 市场窗口

### 制造业简报

适合栏目：

- 原材料价格
- 工厂动态
- 行业标准
- 出口订单与设备

判断维度：

- 采购成本
- 产能变化
- 质量和认证
- 订单与交期

## 7. 给 Codex 的行业扩展提示词

你可以用下面这段让 Codex 帮你改出一个新行业 Skill：

```text
基于当前 ai-industry-brief Skill，帮我扩展成「跨境电商简报」Skill。

请保留数据结构、去重脚本、HTML 模板、发布流程和质量检查。
请替换栏目、采集关键词、来源优先级、写作判断维度、品牌文案和示例 brief-data 模板。
新 Skill 面向跨境电商运营团队，重点关注 Amazon、TikTok Shop、Shopee、物流、支付和广告变化。
```

## 8. 发布到 GitHub Pages

如果你要使用 GitHub Pages，推荐结构保持不变：

```text
index.html
briefs/YYYY-MM-DD.html
color-palette-demo.html
brief-data/YYYY-MM-DD.json
```

发布流程：

```bash
git add index.html briefs/YYYY-MM-DD.html brief-data/YYYY-MM-DD.json
git commit -m "Publish industry brief for YYYY-MM-DD"
git push origin main
```

GitHub Pages 更新后，公开首页会是：

```text
https://<your-org>.github.io/<your-repo>/
```

## 9. 维护建议

- 每天先写 JSON，再生成 HTML。
- 每天发布前跑去重检查。
- 来源尽量使用官方或一手资料。
- 如果使用窗口外资料，明确标注“邻近窗口”或“最近官方参考”。
- 不要让栏目无限增加。多数日报保持 4 个栏目更容易持续。
- 每个行业都应该定义自己的“影响判断维度”，这会决定简报有没有价值。
