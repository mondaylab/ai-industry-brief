# The AI Industry Brief

一个可复用的**国际化报刊 Skill** 与静态站点模板，用来把“每天追踪行业动态”变成稳定流程：采集、去重、撰写、排版、归档、发布。

当前示例站点聚焦 AI 行业，覆盖四个方向：

- AI 工作台
- AI 流水线
- AI 大模型
- AI 信息美学

你也可以把它扩展成其他行业简报，比如出海印尼日报、跨境电商简报、外贸行业简报、制造业简报。


更多好文欢迎关注公众号 **「星期一研究室」** 👇🏻

交流群请加作者微信：`mondaylab712`，备注「报刊」。

<img width="300" height="300" alt="7c71066c-b11d-4b84-99ee-6cea297de8ef" src="https://github.com/user-attachments/assets/90ffbb0c-d02f-4242-b60e-fd081f1bda3e" />



## 在线预览

- 简报首页：[https://mondaylab.github.io/ai-industry-brief/](https://mondaylab.github.io/ai-industry-brief/)
- 七天色板 Demo：[https://mondaylab.github.io/ai-industry-brief/color-palette-demo.html](https://mondaylab.github.io/ai-industry-brief/color-palette-demo.html)

## 这个 Skill 做了什么

这个仓库在存放每日行业简报的基础上，还沉淀了一套可持续复用的行业简报生产系统。

1. **采集规范**
   优先使用官方发布、公司博客、开发者文档、权威媒体或可核验的一手来源。

2. **结构化数据**
   每天先创建 `brief-data/YYYY-MM-DD.json`，再生成页面。JSON 是当天简报的 source of truth。

3. **栏目框架**
   默认 4 个栏目，每栏 3 条，共 12 条动态。AI 示例为：AI 工作台、AI 信息美学、AI 流水线、AI 大模型。

4. **去重检查**
   `scripts/check-brief-dedup.js` 会检查当天条目是否和历史简报重复，覆盖来源 URL、标题和规范化 key。

5. **写作规则**
   每条动态采用“事实 + 行业影响”的写法，避免只堆新闻摘要。

6. **视觉模板**
   详情页使用横版 A3 报刊感版式，包含 LEAD 引文、双栏栏目、主题色、editorial note 洞察区和页脚品牌。

7. **归档发布**
   自动维护 `index.html` 的日期卡片，保留历史归档，并适配 GitHub Pages 发布。

## 文件结构

```text
.
├── index.html
├── color-palette-demo.html
├── briefs/
│   └── YYYY-MM-DD.html
├── brief-data/
│   ├── _template.json
│   └── YYYY-MM-DD.json
├── skills/
│   └── ai-industry-brief/
│       ├── SKILL.md
│       ├── assets/
│       ├── references/
│       └── scripts/
├── docs/
│   └── getting-started.md
└── workers/
    └── feishu-brief-push/
```

## 快速使用

如果你使用 Codex 或支持 Skills 的 AI 编程助手，不需要手动复制文件。直接把下面这句话发给它即可。

```text
请帮我安装 mondaylab/ai-industry-brief 这个行业简报 Skill，并根据提示帮我初始化一个行业简报项目。
```

如果已经知道要做哪个行业，也可以直接说：

```text
请帮我安装 mondaylab/ai-industry-brief 这个行业简报 Skill，并帮我生成第一期跨境电商简报。
```

AI Agent 通常会执行：

```bash
npx skills add mondaylab/ai-industry-brief -y -g
```

如果你已经克隆了本仓库，也可以从本地路径安装：

```bash
npx skills add . -y -g
```

安装后，在 Codex 里这样使用：

```text
使用 ai-industry-brief Skill，生成今天的 AI 行业简报，更新首页并发布到 GitHub Pages。
```

更完整的安装、运行和行业扩展方式见：[docs/getting-started.md](docs/getting-started.md)。

## 每日生产流程

1. 读取 `skills/ai-industry-brief/SKILL.md` 和 `references/brief-spec.md`
2. 复制 `brief-data/_template.json` 为当天数据文件
3. 搜集并填入 4 个栏目 x 3 条动态
4. 运行去重检查

```bash
node skills/ai-industry-brief/scripts/check-brief-dedup.js brief-data/YYYY-MM-DD.json
```

5. 生成 `briefs/YYYY-MM-DD.html`
6. 更新 `index.html`
7. 检查页面与链接
8. 提交并推送到 GitHub Pages 仓库

## 扩展到其他行业

这个 Skill 可以理解为是“行业简报的稳定框架”，不单用于 AI 行业，还可以扩展到任何其他行业。扩展时通常只需要改以下四件事：

- **栏目**：把默认 4 个 AI 栏目换成你的行业分析维度。
- **来源**：定义该行业最可信的信息源和优先级。
- **判断逻辑**：把“行业影响”改成该行业真正关心的指标。
- **品牌语气**：改标题、署名、页脚、色板和文案风格。

示例：

| 简报类型 | 可替换栏目 |
| --- | --- |
| 出海印尼日报 | 政策监管、电商平台、消费趋势、本地品牌 |
| 跨境电商简报 | Amazon、TikTok Shop、Shopee、物流与支付 |
| 外贸行业简报 | 汇率关税、供应链、展会客户、品类价格 |
| 制造业简报 | 原材料、工厂动态、行业标准、出口订单 |

## 许可证

本项目以 [MIT License](LICENSE) 开源发布。
