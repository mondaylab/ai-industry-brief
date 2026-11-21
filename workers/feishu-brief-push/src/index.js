const DEFAULT_SITE_BASE_URL = "https://mondaylab.github.io/zero-one-signals";
const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const DEFAULT_SCREENSHOT_WIDTH = 1600;
const DEFAULT_SCREENSHOT_HEIGHT = 2200;
const PRIMARY_CRON = "40 22 * * *";
const CARD_PUBLISHER = "坐标原点研究室";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return jsonResponse(200, {
        ok: true,
        service: "ai-industry-brief-feishu-image-push",
        dailyDelivery: "text_card",
      });
    }

    if (url.pathname === "/send" || url.pathname === "/send-link") {
      if (!isManualTriggerAuthorized(request, env)) {
        return jsonResponse(401, {
          ok: false,
          error: "Unauthorized manual trigger.",
        });
      }

      const requestedDate = url.searchParams.get("date");
      if (requestedDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
        return jsonResponse(400, { ok: false, error: "date must be YYYY-MM-DD." });
      }
      const force = url.searchParams.get("force") === "1";

      try {
        const result = await pushBriefIfNeeded({
          env,
          requestedDate,
          force,
          source: "manual",
          requestId: crypto.randomUUID(),
        });
        return jsonResponse(200, {
          ok: true,
          ...result,
        });
      } catch (error) {
        log("manual_brief_push_failed", {
          error: error instanceof Error ? error.message : String(error),
          requestedDate,
        });
        return jsonResponse(500, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (url.pathname === "/send-report") {
      if (!isManualTriggerAuthorized(request, env)) {
        return jsonResponse(401, {
          ok: false,
          error: "Unauthorized manual trigger.",
        });
      }

      let reportRequest;
      try {
        reportRequest = await parseReportRequest(request, env);
      } catch (error) {
        return jsonResponse(400, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const result = await pushReportImage({
          env,
          ...reportRequest,
          requestId: crypto.randomUUID(),
        });
        return jsonResponse(200, {
          ok: true,
          ...result,
        });
      } catch (error) {
        log("report_image_push_failed", {
          error: error instanceof Error ? error.message : String(error),
          reportUrl: reportRequest.reportUrl,
        });
        return jsonResponse(500, {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return jsonResponse(404, {
      ok: false,
      error: "Not found.",
    });
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      pushBriefIfNeeded({
        env,
        source: "scheduled",
        cron: controller?.cron,
        requestId: crypto.randomUUID(),
      }).catch((error) => {
        log("scheduled_brief_push_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }),
    );
  },
};

async function pushBriefIfNeeded({ env, requestedDate, force = false, source, cron, requestId }) {
  const siteBaseUrl = normalizeBaseUrl(env.SITE_BASE_URL || DEFAULT_SITE_BASE_URL);
  const timeZone = env.TIME_ZONE || DEFAULT_TIME_ZONE;
  const date = requestedDate || formatDateInTimeZone(new Date(), timeZone);
  const archiveUrl = `${siteBaseUrl}/`;
  const detailUrl = `${siteBaseUrl}/briefs/${date}.html`;

  assertRequiredSecret(env, "FEISHU_APP_ID");
  assertRequiredSecret(env, "FEISHU_APP_SECRET");
  assertRequiredSecret(env, "FEISHU_CHAT_ID");

  const state = getPushStateStore(env);
  const isPatrol = source === "scheduled" && cron !== PRIMARY_CRON;
  if (!state && isPatrol) {
    log("brief_push_skipped", {
      requestId,
      date,
      source,
      cron,
      reason: "missing_state_store",
    });
    return {
      date,
      detailUrl,
      archiveUrl,
      skipped: true,
      reason: "missing_state_store",
    };
  }

  const stateKey = `brief-push:${date}`;
  const existing = state ? await readPushState(state, stateKey) : null;
  if (!force && existing?.status === "sent") {
    log("brief_push_skipped", {
      requestId,
      date,
      source,
      reason: "already_sent",
      sentAt: existing.sentAt,
    });
    return {
      date,
      detailUrl,
      archiveUrl,
      skipped: true,
      reason: "already_sent",
      sentAt: existing.sentAt,
    };
  }

  let brief;
  try {
    brief = await fetchPublishedBrief(siteBaseUrl, date, detailUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (state) {
      await writePushState(state, stateKey, {
        status: "waiting_for_page",
        date,
        detailUrl,
        source,
        cron,
        checkedAt: new Date().toISOString(),
        error: reason,
      });
    }
    log("brief_page_not_ready", {
      requestId,
      date,
      detailUrl,
      source,
      cron,
      error: reason,
    });
    return {
      date,
      detailUrl,
      archiveUrl,
      skipped: true,
      reason: "page_not_ready",
      error: reason,
    };
  }

  try {
    const tenantAccessToken = await getTenantAccessToken(env);
    const card = buildBriefTextCard({ archiveUrl, detailUrl, date, ...brief });
    const { messageId } = await sendFeishuBotMessage({
      tenantAccessToken,
      chatId: env.FEISHU_CHAT_ID,
      card,
    });
    const delivery = { headline: brief.headline, messageId, deliveryMode: "text_card" };

    if (state) {
      await writePushState(state, stateKey, {
        status: "sent",
        date,
        detailUrl,
        source,
        cron,
        sentAt: new Date().toISOString(),
        ...delivery,
      });
    }

    log("brief_text_pushed", { requestId, date, source, ...delivery });
    return { date, detailUrl, archiveUrl, ...delivery };
  } catch (error) {
    if (state) {
      await writePushState(state, stateKey, {
        status: "failed",
        date,
        detailUrl,
        source,
        cron,
        failedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

async function fetchPublishedBrief(siteBaseUrl, date, detailUrl) {
  const options = { headers: { "cache-control": "no-cache" } };
  const [detail, data] = await Promise.all([
    fetch(detailUrl, { ...options, method: "HEAD" }),
    fetch(`${siteBaseUrl}/brief-data/${date}.json`, options),
  ]);
  if (!detail.ok || !data.ok) {
    throw new Error(`Issue ${date} is not published (page=${detail.status}, data=${data.status}).`);
  }

  const brief = await data.json();
  const opening = stringOrNull(brief?.opening);
  if (brief?.date !== date || !opening) {
    throw new Error(`Issue data is incomplete or has the wrong date: ${date}.`);
  }

  return {
    headline: stringOrNull(brief.homepage?.headline) || opening,
    opening,
    insight: stringOrNull(brief.insight),
  };
}

async function pushReportImage({ env, reportUrl, title, label, reportId, force, requestId }) {
  assertRequiredSecret(env, "FEISHU_APP_ID");
  assertRequiredSecret(env, "FEISHU_APP_SECRET");
  assertRequiredSecret(env, "FEISHU_CHAT_ID");
  assertRequiredSecret(env, "CLOUDFLARE_ACCOUNT_ID");
  assertRequiredSecret(env, "CLOUDFLARE_API_TOKEN");

  const state = getPushStateStore(env);
  const stateKey = `report-push:${reportId}`;
  const existing = state ? await readPushState(state, stateKey) : null;
  if (!force && existing?.status === "sent") {
    log("report_image_push_skipped", {
      requestId,
      reportId,
      reportUrl,
      reason: "already_sent",
      sentAt: existing.sentAt,
    });
    return {
      reportId,
      reportUrl,
      skipped: true,
      reason: "already_sent",
      sentAt: existing.sentAt,
    };
  }

  try {
    const pageMeta = await fetchPageMeta(reportUrl);
    const headline = title || pageMeta.headline || "The AI Industry Brief 周报";
    const screenshot = await capturePageScreenshot({
      env,
      url: addQueryParam(reportUrl, "image_push", "weekly-report"),
    });
    const tenantAccessToken = await getTenantAccessToken(env);
    const imageKey = await uploadFeishuImage({
      tenantAccessToken,
      filename: `ai-industry-brief-report-${reportId}.png`,
      imageBytes: screenshot,
    });
    const card = buildReportCard({
      reportUrl,
      title: headline,
      label,
      imageKey,
    });
    const delivery = await sendFeishuBotMessage({
      tenantAccessToken,
      chatId: env.FEISHU_CHAT_ID,
      card,
    });

    if (state) {
      await writePushState(state, stateKey, {
        status: "sent",
        reportId,
        reportUrl,
        title: headline,
        sentAt: new Date().toISOString(),
        deliveryMode: delivery.mode,
        imageKey,
        screenshotBytes: screenshot.byteLength,
      });
    }

    log("report_image_pushed", {
      requestId,
      reportId,
      reportUrl,
      deliveryMode: delivery.mode,
      imageKey,
      screenshotBytes: screenshot.byteLength,
    });

    return {
      reportId,
      reportUrl,
      title: headline,
      deliveryMode: delivery.mode,
      messageId: delivery.messageId,
      imageKey,
      screenshotBytes: screenshot.byteLength,
      responseText: delivery.responseText,
    };
  } catch (error) {
    if (state) {
      await writePushState(state, stateKey, {
        status: "failed",
        reportId,
        reportUrl,
        failedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

async function capturePageScreenshot({ env, url }) {
  assertRequiredSecret(env, "CLOUDFLARE_ACCOUNT_ID");
  assertRequiredSecret(env, "CLOUDFLARE_API_TOKEN");

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/screenshot`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      url,
      viewport: {
        width: numberFromEnv(env.SCREENSHOT_WIDTH, DEFAULT_SCREENSHOT_WIDTH),
        height: numberFromEnv(env.SCREENSHOT_HEIGHT, DEFAULT_SCREENSHOT_HEIGHT),
        deviceScaleFactor: 1,
      },
      screenshotOptions: {
        type: "png",
        fullPage: true,
      },
      gotoOptions: {
        waitUntil: "load",
        timeout: numberFromEnv(env.SCREENSHOT_NAVIGATION_TIMEOUT_MS, 20000),
      },
      waitForTimeout: numberFromEnv(env.SCREENSHOT_WAIT_MS, 800),
    }),
  });

  if (!response.ok) {
    throw new Error(`Cloudflare screenshot failed with ${response.status}: ${await response.text()}`);
  }

  return response.arrayBuffer();
}


async function parseReportRequest(request, env) {
  const requestUrl = new URL(request.url);
  let body = {};
  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("POST /send-report requires application/json.");
    }
    body = await request.json();
  } else if (request.method !== "GET") {
    throw new Error("/send-report only supports GET and POST.");
  }

  const reportUrl = String(body.url || requestUrl.searchParams.get("url") || "").trim();
  if (!reportUrl) {
    throw new Error("Missing required report url.");
  }

  const parsedReportUrl = normalizeReportUrl(reportUrl, env);
  const title = stringOrNull(body.title || requestUrl.searchParams.get("title"));
  const label = stringOrNull(body.label || requestUrl.searchParams.get("label")) || "AI 行业周报";
  const force = parseBoolean(body.force) || requestUrl.searchParams.get("force") === "1";
  const reportId =
    sanitizeSlug(stringOrNull(body.id || requestUrl.searchParams.get("id")) || slugFromUrl(parsedReportUrl));

  return {
    reportUrl: parsedReportUrl,
    title,
    label,
    reportId,
    force,
  };
}

function normalizeReportUrl(value, env) {
  let reportUrl;
  try {
    reportUrl = new URL(value);
  } catch {
    throw new Error("Report url must be an absolute http(s) URL.");
  }

  if (!["http:", "https:"].includes(reportUrl.protocol)) {
    throw new Error("Report url must use http or https.");
  }

  if (env.ALLOW_EXTERNAL_REPORT_URLS !== "true") {
    const siteBaseUrl = new URL(normalizeBaseUrl(env.SITE_BASE_URL || DEFAULT_SITE_BASE_URL));
    if (reportUrl.origin !== siteBaseUrl.origin) {
      throw new Error(`Report url must be under ${siteBaseUrl.origin}.`);
    }
  }

  return reportUrl.toString();
}

async function fetchPageMeta(url) {
  const response = await fetch(url, {
    headers: {
      "cache-control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page metadata ${url}: ${response.status}`);
  }

  const html = await response.text();
  const headline =
    matchText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    matchText(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
    "The AI Industry Brief";
  return { headline };
}


function getPushStateStore(env) {
  return env.BRIEF_PUSH_STATE || null;
}

async function readPushState(state, key) {
  const value = await state.get(key, "json");
  return value && typeof value === "object" ? value : null;
}

async function writePushState(state, key, value) {
  await state.put(key, JSON.stringify(value), {
    expirationTtl: 60 * 60 * 24 * 14,
  });
}

async function getTenantAccessToken(env) {
  const response = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        app_id: env.FEISHU_APP_ID,
        app_secret: env.FEISHU_APP_SECRET,
      }),
    },
  );
  const data = await response.json();

  if (!response.ok || data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Failed to get Feishu tenant token: ${JSON.stringify(data)}`);
  }

  return data.tenant_access_token;
}

async function uploadFeishuImage({ tenantAccessToken, filename, imageBytes }) {
  const form = new FormData();
  form.append("image_type", "message");
  form.append("image", new File([imageBytes], filename, { type: "image/png" }));

  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/images", {
    method: "POST",
    headers: {
      authorization: `Bearer ${tenantAccessToken}`,
    },
    body: form,
  });
  const data = await response.json();

  if (!response.ok || data.code !== 0 || !data.data?.image_key) {
    throw new Error(`Failed to upload Feishu image: ${JSON.stringify(data)}`);
  }

  return data.data.image_key;
}


function buildBriefTextCard({ archiveUrl, detailUrl, date, headline, opening, insight }) {
  return {
    config: {
      wide_screen_mode: true,
      enable_forward: true,
    },
    header: {
      template: "blue",
      title: {
        tag: "plain_text",
        content: `国际化行业报刊 · ${date}`,
      },
      subtitle: {
        tag: "plain_text",
        content: CARD_PUBLISHER,
      },
    },
    elements: [
      {
        tag: "markdown",
        content: [
          `**${escapeForMarkdown(cardBrandText(headline))}**`,
          opening !== headline && escapeForMarkdown(cardBrandText(opening)),
          insight && `**今日洞察**\n${escapeForMarkdown(cardBrandText(insight))}`,
        ].filter(Boolean).join("\n\n"),
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "查看当日详情",
            },
            type: "primary",
            url: detailUrl,
          },
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "打开首页",
            },
            url: archiveUrl,
          },
        ],
      },
    ],
  };
}

function cardBrandText(value) {
  return value.replaceAll(["星期一", "研究室"].join(""), CARD_PUBLISHER).replace(/Monday\s*Lab/gi, CARD_PUBLISHER);
}

function buildReportCard({ reportUrl, title, label, imageKey }) {
  return {
    config: {
      wide_screen_mode: true,
      enable_forward: true,
    },
    header: {
      template: "blue",
      title: {
        tag: "plain_text",
        content: cardBrandText(label),
      },
      subtitle: {
        tag: "plain_text",
        content: CARD_PUBLISHER,
      },
    },
    elements: [
      {
        tag: "markdown",
        content: `**${escapeForMarkdown(cardBrandText(title))}**`,
      },
      {
        tag: "img",
        img_key: imageKey,
        mode: "fit_horizontal",
        alt: {
          tag: "plain_text",
          content: cardBrandText(title),
        },
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "查看周报",
            },
            type: "primary",
            url: reportUrl,
          },
        ],
      },
    ],
  };
}

async function sendFeishuBotMessage({ tenantAccessToken, chatId, card }) {
  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
    method: "POST",
    headers: {
      authorization: `Bearer ${tenantAccessToken}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "interactive",
      content: JSON.stringify(card),
    }),
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Feishu bot message failed with ${response.status}: ${responseText}`);
  }

  const data = parseJsonResponse(responseText);
  if (data.code !== 0 || !data.data?.message_id) {
    throw new Error(`Feishu bot message rejected: ${responseText}`);
  }

  return {
    mode: "bot",
    messageId: data.data.message_id,
    responseText,
  };
}

function parseJsonResponse(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Expected JSON response, got: ${value}`);
  }
}

function isManualTriggerAuthorized(request, env) {
  if (!env.MANUAL_TRIGGER_TOKEN) {
    return false;
  }

  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${env.MANUAL_TRIGGER_TOKEN}`;
}

function formatDateInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function addQueryParam(value, key, paramValue) {
  const url = new URL(value);
  url.searchParams.set(key, paramValue);
  return url.toString();
}

function stringOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function slugFromUrl(value) {
  const url = new URL(value);
  const pathSlug = url.pathname
    .replace(/\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .pop();
  return sanitizeSlug(pathSlug || url.hostname);
}

function sanitizeSlug(value) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || crypto.randomUUID();
}

function jsonResponse(status, data) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function log(event, fields) {
  console.log(
    JSON.stringify({
      event,
      ...fields,
      service: "ai-industry-brief-feishu-image-push",
    }),
  );
}

function assertRequiredSecret(env, name) {
  if (!env[name]) {
    throw new Error(`Missing required secret: ${name}`);
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function escapeForMarkdown(value) {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, "\\$&");
}

function matchText(value, pattern) {
  const match = value.match(pattern);
  if (!match) return "";
  return decodeHtml(stripTags(match[1])).trim();
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, "");
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
