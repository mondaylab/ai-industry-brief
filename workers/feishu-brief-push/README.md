# Feishu Daily Push Worker

这个 Worker 负责在 Cloudflare 上定时读取已发布的 AI 行业简报页面，并把当天摘要推送到飞书群自定义机器人。

## 目标

- 保留现有的本地生成与 GitHub Pages 发布流程
- 在 Cloudflare 上独立执行飞书推送
- 不把飞书 webhook 或 secret 写入仓库

## 运行方式

- `scheduled`：按 `wrangler.jsonc` 里的 Cron 定时执行
- `GET /healthz`：健康检查
- `GET /send?date=YYYY-MM-DD`：手动触发某一天的推送

手动触发必须带请求头：

```text
Authorization: Bearer <MANUAL_TRIGGER_TOKEN>
```

## 默认行为

- 站点基址：`https://mondaylab.github.io/ai-industry-brief`
- 时区：`Asia/Shanghai`
- 默认 Cron：`50 22 * * *`

`50 22 * * *` 对应北京时间每天 `06:50`。Cloudflare Cron 使用 UTC，因此这里已经完成了时区换算。

## 必要 Secrets

```bash
wrangler secret put FEISHU_BOT_WEBHOOK
```

可选：

```bash
wrangler secret put FEISHU_BOT_SECRET
wrangler secret put MANUAL_TRIGGER_TOKEN
```

## 可调 Vars

在 `wrangler.jsonc` 中：

- `SITE_BASE_URL`：公开站点地址
- `TIME_ZONE`：推送日期计算时区

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
  "http://127.0.0.1:8787/send?date=2026-05-27"
```

## 部署

```bash
npm install
npm run check
npm run deploy
```

部署前请确认：

1. GitHub Pages 上当天详情页已经可访问
2. 飞书群机器人 webhook 已创建
3. 若启用签名校验，`FEISHU_BOT_SECRET` 已设置
