const DEFAULT_SITE_BASE_URL = "https://mondaylab.github.io/ai-industry-brief";
const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const DEFAULT_SCREENSHOT_WIDTH = 1600;
const DEFAULT_SCREENSHOT_HEIGHT = 2200;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return jsonResponse(200, {
        ok: true,
        service: "ai-industry-brief-feishu-image-push",
      });
    }

    if (url.pathname === "/send") {
      if (!isManualTriggerAuthorized(request, env)) {
        return jsonResponse(401, {
          ok: false,
          error: "Unauthorized manual trigger.",
        });
      }

      const requestedDate = url.searchParams.get("date");

      try {
        const result = await pushBriefImage({
          env,
          requestedDate,
          requestId: crypto.randomUUID(),
        });
        return jsonResponse(200, {
          ok: true,
          ...result,
        });
      } catch (error) {
        log("manual_image_push_failed", {
          error: error instanceof Error ? error.message : String(error),
          requestedDate,
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

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      pushBriefImage({
        env,
        requestId: crypto.randomUUID(),
      }).catch((error) => {
        log("scheduled_image_push_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }),
    );
  },
};

async function pushBriefImage({ env, requestedDate, requestId }) {
  const siteBaseUrl = normalizeBaseUrl(env.SITE_BASE_URL || DEFAULT_SITE_BASE_URL);
  const timeZone = env.TIME_ZONE || DEFAULT_TIME_ZONE;
  const date = requestedDate || formatDateInTimeZone(new Date(), timeZone);
  const archiveUrl = `${siteBaseUrl}/`;
  const detailUrl = `${siteBaseUrl}/briefs/${date}.html`;

  assertRequiredSecret(env, "FEISHU_BOT_WEBHOOK");
  assertRequiredSecret(env, "FEISHU_APP_ID");
  assertRequiredSecret(env, "FEISHU_APP_SECRET");
  assertRequiredSecret(env, "CLOUDFLARE_ACCOUNT_ID");
  assertRequiredSecret(env, "CLOUDFLARE_API_TOKEN");

  const screenshot = await captureBriefScreenshot({
    env,
    url: `${detailUrl}?image_push=${encodeURIComponent(date)}`,
  });
  const pageMeta = await fetchPageMeta(detailUrl);
  const tenantAccessToken = await getTenantAccessToken(env);
  const imageKey = await uploadFeishuImage({
    tenantAccessToken,
    filename: `ai-industry-brief-${date}.png`,
    imageBytes: screenshot,
  });
  const payload = await buildWebhookPayload(env, {
    archiveUrl,
    detailUrl,
    date,
    headline: pageMeta.headline,
    imageKey,
  });
  const responseText = await sendWebhook(env.FEISHU_BOT_WEBHOOK, payload);

  log("brief_image_pushed", {
    requestId,
    date,
    detailUrl,
    imageKey,
    screenshotBytes: screenshot.byteLength,
  });

  return {
    date,
    detailUrl,
    archiveUrl,
    headline: pageMeta.headline,
    imageKey,
    screenshotBytes: screenshot.byteLength,
    responseText,
  };
}

async function captureBriefScreenshot({ env, url }) {
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

  return {
    headline,
  };
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

async function buildWebhookPayload(env, { archiveUrl, detailUrl, date, headline, imageKey }) {
  const payload = {
    msg_type: "interactive",
    card: {
      config: {
        wide_screen_mode: true,
        enable_forward: true,
      },
      header: {
        template: "grey",
        title: {
          tag: "plain_text",
          content: `每日 AI 行业简报 · ${date}`,
        },
        subtitle: {
          tag: "plain_text",
          content: "星期一研究室",
        },
      },
      elements: [
        {
          tag: "markdown",
          content: `**${escapeForMarkdown(headline)}**`,
        },
        {
          tag: "img",
          img_key: imageKey,
          alt: {
            tag: "plain_text",
            content: `The AI Industry Brief ${date}`,
          },
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
    },
  };

  if (!env.FEISHU_BOT_SECRET) {
    return payload;
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const sign = await buildFeishuSignature(timestamp, env.FEISHU_BOT_SECRET);
  return {
    timestamp,
    sign,
    ...payload,
  };
}

async function sendWebhook(webhook, payload) {
  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Feishu webhook failed with ${response.status}: ${responseText}`);
  }

  return responseText;
}

function isManualTriggerAuthorized(request, env) {
  if (!env.MANUAL_TRIGGER_TOKEN) {
    return false;
  }

  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${env.MANUAL_TRIGGER_TOKEN}`;
}

async function buildFeishuSignature(timestamp, secret) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${timestamp}\n${secret}`),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(""));
  return arrayBufferToBase64(signature);
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
