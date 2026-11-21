# Feishu Brief Push Worker

这个 Worker 从已发布的 AI 行业简报 JSON 读取标题、今日一句话、四个栏目和洞察，发送署名为「坐标原点研究室」的飞书文字卡片。宽屏按 01／02、03／04 两排双栏展示，窄屏按 01–04 纵向堆叠。每栏包含三条动态的标题、正文和来源；「查看当日详情」直达站点阅读器。每日推送不截图，也不上传图片。

它也提供周报/专题页复用入口：周报生成并发布为公网 URL 后，调用 Worker 即可截图并发送到同一个飞书机器人群。

## 工作流

1. 计算当天日期，默认使用 `Asia/Shanghai`。
2. 检查当期详情页，读取 `brief-data/YYYY-MM-DD.json`。
3. 用飞书自建应用凭证向目标群发送文字互动卡片，并记录当天已发送。

## 运行方式

- `scheduled`：按 `wrangler.jsonc` 里的 Cron 定时执行。
- `GET /healthz`：健康检查，包含 `dailyDelivery: "text_card"`。
- `GET /send?date=YYYY-MM-DD`：手动推送当期文字卡，支持 `force=1` 重发。
- `GET /send-link?date=YYYY-MM-DD`：旧入口，与 `/send` 一致并共享去重记录。
- `GET /send-report?url=<REPORT_URL>`：手动触发某个已发布周报/专题页的截图推送。
- `POST /send-report`：用 JSON 触发周报/专题页截图推送，适合生成脚本或 Skill 调用。

手动触发必须带请求头：

```text
Authorization: Bearer <MANUAL_TRIGGER_TOKEN>
```

周报推送的 POST 请求体：

```json
{
  "url": "https://mondaylab.github.io/zero-one-signals/reports/2026-week-23.html",
  "title": "The AI Industry Brief 周报 · 2026 W23",
  "label": "AI 行业周报",
  "id": "2026-week-23",
  "force": false
}
```

- `url` 必填，默认只允许 `SITE_BASE_URL` 同源地址，避免把截图服务开放成任意 URL 代理。
- `title` 可选；不填时从页面 `<h1>` 或 `<title>` 自动读取。
- `label` 可选，默认 `AI 行业周报`，用于飞书卡片标题。
- `id` 可选，用于 KV 去重；不填时从 URL path 自动生成。
- `force` 可选，`true` 或 query `force=1` 会跳过去重并重发。

## 默认配置

- 站点基址：`https://mondaylab.github.io/zero-one-signals`
- 时区：`Asia/Shanghai`
- 周报截图宽度：`1600`；截图使用整页模式，`SCREENSHOT_HEIGHT` 仅作为初始视口高度
- 默认 Cron：`40 22 * * *`，并在失败后每 30 分钟巡逻一次

`40 22 * * *` 对应北京时间每天 `06:40`。Cloudflare Cron 使用 UTC，因此这里已经完成时区换算。后续 `10,40 23,0,1 * * *` 对应北京时间 `07:10`、`07:40`、`08:10`、`08:40`、`09:10`、`09:40` 的巡逻触发，并合并为单个 Cron trigger 以避开 Cloudflare trigger 数量限制。

Worker 会用 `BRIEF_PUSH_STATE` KV 记录每天是否已经推送：如果 06:40 时当天详情页还未发布，就记录 `waiting_for_page` 并退出；后续巡逻发现页面可访问后补推；推送成功后记录 `sent`，后续巡逻自动跳过，避免重复发群。

每日卡片发送成功时会记录 `deliveryMode: "text_card"`。Cloudflare Browser Rendering 只用于独立的周报/专题图片入口。

## 必要 Secrets

```bash
wrangler secret put FEISHU_APP_ID
wrangler secret put FEISHU_APP_SECRET
wrangler secret put FEISHU_CHAT_ID
```

仅周报/专题图片功能需要：

```bash
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_API_TOKEN
```

可选：

```bash
wrangler secret put MANUAL_TRIGGER_TOKEN
```

## 飞书侧准备

1. 创建飞书自建应用，建议名称：`The AI Industry Brief | 坐标原点研究室`。
2. 启用应用机器人，并把机器人加入目标群。
3. 把目标群 `chat_id` 写入 `FEISHU_CHAT_ID`。
4. 把新应用 `App ID` 和 `App Secret` 写入 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`。
5. 给自建应用开通并发布 `im:message`；周报图片功能另需 `im:resource`，其他权限按需启用。

如果目标群是外部群，OpenAPI 可能会拒绝自动邀请机器人并返回 `232033`。这种情况下需要群主或管理员在飞书客户端群设置中手动添加应用机器人。

截图图片需要先通过飞书开放平台上传，所以必须有自建应用凭证。

Cloudflare API Token 需要能调用 Browser Rendering API。建议创建专用 token，只给这个 Worker 使用，不要复用个人全局 token。

## 可调 Vars

在 `wrangler.jsonc` 中：

- `SITE_BASE_URL`：公开站点地址。
- `TIME_ZONE`：推送日期计算时区。
- `SCREENSHOT_WIDTH`：截图浏览器视口宽度。
- `SCREENSHOT_HEIGHT`：截图浏览器视口高度。
- `SCREENSHOT_WAIT_MS`：页面打开后截图前的等待时间，默认 `800`。
- `SCREENSHOT_NAVIGATION_TIMEOUT_MS`：页面导航超时时间，默认 `20000`。
- `ALLOW_EXTERNAL_REPORT_URLS`：可选。默认不开启；设为字符串 `"true"` 后，`/send-report` 才允许截图非本站 URL。

## 必要 Bindings

- `BRIEF_PUSH_STATE`：KV namespace，用于记录每天是否已推送，防止巡逻触发重复发送。

## 本地开发

```bash
npm install
npm run dev
```

本地测试定时触发时，可访问：

```text
http://127.0.0.1:8787/__scheduled
```

如果要手动触发：

```bash
curl -H "Authorization: Bearer <MANUAL_TRIGGER_TOKEN>" \
  "http://127.0.0.1:8787/send?date=2026-05-29"
```

GitHub Pages 发布成功后立即推送当天文字卡：

```bash
npm --prefix workers/feishu-brief-push run post-publish-send -- --date 2026-05-29
```

脚本等待首页入口、详情页和当期 JSON 可访问，不检查 PNG。设置 `MANUAL_TRIGGER_TOKEN` 或 `FEISHU_PUSH_TOKEN` 时直接调用 Worker；本地未提供 token 时由 GitHub CLI 触发 `Feishu brief push` workflow，使用仓库的 `WORKER_MANUAL_TRIGGER_TOKEN` secret。以工作流成功和发送日志为准。

周报生成后触发：

```bash
curl -X POST \
  -H "Authorization: Bearer <MANUAL_TRIGGER_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{
    "url": "https://mondaylab.github.io/zero-one-signals/reports/2026-week-23.html",
    "title": "The AI Industry Brief 周报 · 2026 W23",
    "id": "2026-week-23"
  }' \
  "http://127.0.0.1:8787/send-report"
```

## 部署

```bash
npm install
npm run check
npm run deploy
```

首次部署前创建 KV，并把返回的 namespace id 写入 `wrangler.jsonc` 的 `kv_namespaces`：

```bash
npx wrangler kv namespace create BRIEF_PUSH_STATE
```

配置示例：

```jsonc
"kv_namespaces": [
  {
    "binding": "BRIEF_PUSH_STATE",
    "id": "<namespace_id>"
  }
]
```

部署前请确认：

1. GitHub Pages 上当天详情页已经可访问。
2. Cloudflare API Token 已具备 Browser Rendering API 调用权限。
3. 飞书自建应用机器人已加入目标群，且 `FEISHU_CHAT_ID` 已配置。
4. 飞书自建应用已具备图片上传和发送消息权限。
5. 所有 secrets 均通过 `wrangler secret put` 写入，不要提交到仓库。
