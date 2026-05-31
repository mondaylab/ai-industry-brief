# Feishu Brief Image Push Worker

这个 Worker 负责每天打开已发布的 AI 行业简报详情页，截成一张 PNG，并自动发送到飞书群。

## 工作流

1. 计算当天日期，默认使用 `Asia/Shanghai`。
2. 打开 `https://mondaylab.github.io/ai-industry-brief/briefs/YYYY-MM-DD.html`。
3. 使用 Cloudflare Browser Rendering REST API 截取整页 PNG。
4. 用飞书自建应用凭证获取 `tenant_access_token`。
5. 上传截图到飞书图片接口，拿到 `image_key`。
6. 通过飞书群自定义机器人 webhook 发送一张含图片的互动卡片。

## 运行方式

- `scheduled`：按 `wrangler.jsonc` 里的 Cron 定时执行。
- `GET /healthz`：健康检查。
- `GET /send?date=YYYY-MM-DD`：手动触发某一天的截图推送。

手动触发必须带请求头：

```text
Authorization: Bearer <MANUAL_TRIGGER_TOKEN>
```

## 默认配置

- 站点基址：`https://mondaylab.github.io/ai-industry-brief`
- 时区：`Asia/Shanghai`
- 截图宽高：`1600 x 2200`
- 默认 Cron：`40 22 * * *`，并在失败后每 30 分钟巡逻一次

`40 22 * * *` 对应北京时间每天 `06:40`。Cloudflare Cron 使用 UTC，因此这里已经完成时区换算。后续 `10,40 23,0,1 * * *` 对应北京时间 `07:10`、`07:40`、`08:10`、`08:40`、`09:10`、`09:40` 的巡逻触发，并合并为单个 Cron trigger 以避开 Cloudflare trigger 数量限制。

Worker 会用 `BRIEF_PUSH_STATE` KV 记录每天是否已经推送：如果 06:40 时当天详情页还未发布，就记录 `waiting_for_page` 并退出；后续巡逻发现页面可访问后补推；推送成功后记录 `sent`，后续巡逻自动跳过，避免重复发群。

## 必要 Secrets

```bash
wrangler secret put FEISHU_BOT_WEBHOOK
wrangler secret put FEISHU_APP_ID
wrangler secret put FEISHU_APP_SECRET
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_API_TOKEN
```

可选：

```bash
wrangler secret put FEISHU_BOT_SECRET
wrangler secret put MANUAL_TRIGGER_TOKEN
```

## 飞书侧准备

1. 创建飞书自定义群机器人，复制 webhook 到 `FEISHU_BOT_WEBHOOK`。
2. 如果群机器人启用了签名校验，把签名密钥写入 `FEISHU_BOT_SECRET`。
3. 创建飞书自建应用，把 `App ID` 和 `App Secret` 写入 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`。
4. 给自建应用开通图片上传相关权限，并发布/安装到目标组织。

截图图片需要先通过飞书开放平台上传，所以只靠 webhook 不够，必须有自建应用凭证。

Cloudflare API Token 需要能调用 Browser Rendering API。建议创建专用 token，只给这个 Worker 使用，不要复用个人全局 token。

## 可调 Vars

在 `wrangler.jsonc` 中：

- `SITE_BASE_URL`：公开站点地址。
- `TIME_ZONE`：推送日期计算时区。
- `SCREENSHOT_WIDTH`：截图浏览器视口宽度。
- `SCREENSHOT_HEIGHT`：截图浏览器视口高度。
- `SCREENSHOT_WAIT_MS`：页面打开后截图前的等待时间，默认 `800`。
- `SCREENSHOT_NAVIGATION_TIMEOUT_MS`：页面导航超时时间，默认 `20000`。

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
3. 飞书群机器人 webhook 已创建。
4. 飞书自建应用已具备图片上传权限。
5. 所有 secrets 均通过 `wrangler secret put` 写入，不要提交到仓库。
