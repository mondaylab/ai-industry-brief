---
name: ai-industry-brief
description: 创建、初始化并维护可追溯来源的每日行业简报和静态 HTML 归档。当用户要求安装或使用 ai-industry-brief 工作流，初始化 AI、跨境电商、出海印尼、外贸、教育、制造业等行业简报，调研每日动态，生成 brief-data JSON，渲染简报页面，更新归档首页，通过 GitHub Pages 发布，或把这套流程复用到自动化、CLI、Skill 中时使用。
---

# The AI Industry Brief

生成一份简洁、有来源依据的每日行业简报，并维护可发布的 HTML 归档站点。

## 安装触发

当用户要求从 GitHub 安装这个 Skill 时，优先使用标准 Skills 安装器：

```bash
npx skills add mondaylab/ai-industry-brief -y -g
```

安装后，如果宿主环境需要重新发现 Skill，提醒用户重启或开启新会话。随后继续完成用户要求的初始化或第一期简报生成。

以下用户话术都应该触发本 Skill：

- `请帮我安装 mondaylab/ai-industry-brief 这个行业简报 Skill，并初始化一个行业简报项目。`
- `请用 ai-industry-brief Skill 生成第一期跨境电商简报。`
- `基于这个 Skill 搭一个出海印尼日报，不要让我手动配。`

## 开始

1. 读取 [references/brief-spec.md](references/brief-spec.md)。
2. 如果用户要初始化非 AI 行业或全新的行业简报，同时读取 [references/industry-starter.md](references/industry-starter.md)。
3. 如果是在更新已有站点，先读取最新的 `briefs/YYYY-MM-DD.html` 和 `index.html`，保留已有布局和历史归档。
4. 如果是在新建站点，使用 `assets/` 里的 HTML 基础模板，并替换所有示例内容、日期、颜色和链接。
5. 创建或更新 `brief-data/YYYY-MM-DD.json`。这个 JSON 是当天简报的唯一数据源，通常从 `brief-data/_template.json` 复制得到。

## 零配置初始化

当用户想做行业简报，但还没有配置项目时，替用户完成初始化，不要把配置清单丢回给用户。

1. 尽量从用户话术中提取行业名称。如果没有说明，只问行业名称和目标读者这两个最小问题。
2. 为该行业生成 4 个栏目、采集关键词、来源优先级和影响判断维度。常见行业默认值见 [references/industry-starter.md](references/industry-starter.md)。
3. 如果项目结构不存在，创建 `brief-data/`、`briefs/`、`skills/ai-industry-brief/` 和 `index.html`。
4. 将 `brief-data/_template.json` 复制为 `brief-data/YYYY-MM-DD.json`，并替换栏目名称、首页手机预览栏目和示例副标题。
5. 先生成第一期简报，再让用户调整高级设置。
6. 只有在第一期已经生成之后，才继续询问是否接入 GitHub Pages 发布、飞书群推送或定时任务。

目标体验是“一句话到第一期”。除非外部账号、权限或部署选择阻塞流程，否则不要让用户自己照着清单操作。

## 调研

1. 使用当前网络搜索，优先选择官方发布、公司博客、开发者文章、产品文档或其他一手来源。
2. 围绕 4 个已配置栏目检索。默认 AI 简报使用：AI 工作台、AI 流水线、AI 大模型、AI 信息美学。
3. 每个栏目选择 3 条值得写入的动态，优先最近 7 天。
4. 如果某个栏目近 30 天内的主流候选源已经被历史简报用尽，不要继续用一两个月前的旧资料凑数；先向外围工具、相邻产品线和同一工作流的替代平台扩展搜索，再考虑更旧来源。
5. 只有在某条更旧资料对当天判断不可替代、且没有近 30 天外围替代源时，才允许使用 30 天前资料，并必须标注 `最近官方参考`。
6. 每条动态必须记录真实 URL 和发布日期。窗口外资料要标注 `邻近窗口` 或 `最近官方参考`，不要暗示它是今天的新消息。
7. 写 HTML 前先运行去重检查，并解决所有冲突：
   - `node skills/ai-industry-brief/scripts/check-brief-dedup.js brief-data/YYYY-MM-DD.json`

## 写作

1. 写一句明确判断式开场，控制在 50 个中文字符以内。
2. 12 条动态都使用 `产品/工具名 | 核心动作短语` 格式，动作短语控制在 15 个中文字符以内。
3. 每条描述先写事实，再写行业影响，长度约 60-80 个中文字符。
4. 写一段跨栏目洞察，控制在 150 个中文字符以内，必须有明确判断，避免模糊套话。

## 构建

1. 根据 `brief-data/YYYY-MM-DD.json` 生成 `briefs/YYYY-MM-DD.html`，使用规格文档中的星期色板和品牌规则。
2. 更新 `index.html`，包含最新一期、`往期`推荐列表和七天色板入口；保留历史简报链接。
3. 生成 `share-images/YYYY-MM-DD.png` 并随当日简报一起发布，作为飞书图片卡的稳定兜底素材。
4. 每期简报都必须保留可点击来源链接和来源日期标注。
5. 保留基础模板里的归档页/首页布局：
   - 首页外层保持黑、白、灰的中性色，不要用当天主题色污染全局页面框架。
   - 顶部导航使用中文标签，顺序为：`今日`、`色板`、`往期`。
   - Hero 按钮使用：`阅读最新一期`、`查看七天色板`、`查看往期`；切换 Tab 的按钮不要强制页面滚回顶部。
   - 使用手机形状预览来表达“一个手机里装着一份每日小报”。
   - 首页七天色板使用色卡归档卡片，包含 `MON`-`SUN`、中文色调名和 HEX 色值，不使用普通胶囊条。
   - 可见的归档/推荐区名称使用 `往期`，不要写成 `历史归档` 或 `精彩推荐`。
6. 保留基础模板里的详情页双栏编辑版式：
   - 桌面端页面更接近横版 A3 编辑页，不要做成长图海报。
   - 默认 AI 简报的栏目顺序是：上排 `01 AI 工作台`、`02 AI 信息美学`；下排 `03 AI 流水线`、`04 AI 大模型`。
   - 保留低对比 route-map 图层、纸张网格和 waypoint 风格栏目卡片，形成国际化编辑地图报刊感。
   - 栏目数字标记、阴影和引导线必须来自当天的 `--primary` 和 `--primary-light` 色彩。
   - 栏目内部条目标记使用非数字符号（`◆`、`◇`、`◈`），不要使用 `01/02/03`。
   - 生成或编辑详情页时，保留桌面端动态行高对齐脚本。

## 检查与发布

1. 检查是否还有未替换占位符，并确认包含 4 个栏目、12 条内容和 12 个来源链接。
2. 发布前重新运行去重检查，确保与历史简报没有重复。
3. 在浏览器打开归档页和新详情页，确认卡片导航、头部、页脚、换行、小屏可读性、栏目横向顺序和莫兰迪主题色标记都正常。
4. 如果用户要求发布，或仓库已经配置发布流程，只提交相关站点和 Skill 文件，推送到配置好的 GitHub 仓库，并在部署后验证 GitHub Pages URL。
5. GitHub Pages 当前部署完全生效后，立即触发飞书图片推送，不要只等待 cron 巡逻。部署完成门槛是：归档首页已包含当天详情页链接、详情页日期/页脚正确、`share-images/YYYY-MM-DD.png` 已在公开站点返回 PNG：
   - `MANUAL_TRIGGER_TOKEN=<token> npm --prefix workers/feishu-brief-push run post-publish-send -- --date YYYY-MM-DD`
   - 该脚本会等待上述部署门槛通过后再触发 Worker，避免 Pages 仍为旧版本或 PNG 尚未生效时发送链接卡。
   - 如果本地环境没有 `MANUAL_TRIGGER_TOKEN` 或 `FEISHU_PUSH_TOKEN`，但当前 Wrangler 已登录且能管理 Worker secrets，可以临时轮换 `MANUAL_TRIGGER_TOKEN`，用新 token 调用 `/send-image-url?date=YYYY-MM-DD&image_url=<published_png_url>`，成功后删除本地临时 token 文件，不要在输出或记忆中记录 token 明文。
   - 如果无法取得或轮换触发 token，明确报告“站点已发布，但发布后飞书即时推送缺少 Worker 手动触发 token”，并说明定时 Worker 仍会按 cron 巡逻；此时因为 `share-images/YYYY-MM-DD.png` 已发布，Worker 截图失败时也应优先发送该图片而不是链接卡。
6. 如果这个流程由定时任务驱动，保持品牌、页脚、归档页、Worker 解析逻辑和发布说明与本 Skill 同步。

## 资源

- 读取 [references/brief-spec.md](references/brief-spec.md)，获取内容规则、颜色、品牌、文件路径和发布检查要求。
- 初始化或改造成新行业简报时，读取 [references/industry-starter.md](references/industry-starter.md)。
- 使用 [assets/brief-page-base.html](assets/brief-page-base.html) 作为新详情页的视觉基础模板。
- 使用 [assets/archive-page-base.html](assets/archive-page-base.html) 作为新归档页的视觉基础模板。
- 使用 `brief-data/_template.json` 创建每日配置，用 `scripts/check-brief-dedup.js` 防止重复。
