const DEFAULT_SITE_BASE_URL = "https://mondaylab.github.io/ai-industry-brief";
const DEFAULT_TIME_ZONE = "Asia/Shanghai";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return jsonResponse(200, {
        ok: true,
        service: "ai-industry-brief-feishu-push",
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
        const result = await pushBrief({
          env,
          requestedDate,
          requestId: crypto.randomUUID(),
        });
        return jsonResponse(200, {
          ok: true,
          ...result,
        });
      } catch (error) {
        log("manual_push_failed", {
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
      pushBrief({
        env,
        requestId: crypto.randomUUID(),
      }).catch((error) => {
        log("scheduled_push_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }),
    );
  },
};

async function pushBrief({ env, requestedDate, requestId }) {
  const siteBaseUrl = normalizeBaseUrl(env.SITE_BASE_URL || DEFAULT_SITE_BASE_URL);
  const timeZone = env.TIME_ZONE || DEFAULT_TIME_ZONE;
  const date = requestedDate || formatDateInTimeZone(new Date(), timeZone);
  const archiveUrl = `${siteBaseUrl}/`;
  const detailPath = `briefs/${date}.html`;
  const detailUrl = `${siteBaseUrl}/${detailPath}`;

  assertRequiredSecret(env, "FEISHU_BOT_WEBHOOK");

  const [archiveHtml, detailHtml] = await Promise.all([
    fetchText(`${archiveUrl}?ts=${encodeURIComponent(date)}`),
    fetchText(`${detailUrl}?ts=${encodeURIComponent(date)}`),
  ]);

  const card = extractArchiveCard(archiveHtml, detailPath);
  const quote = extractQuote(detailHtml);
  const message = buildFeishuCard({
    archiveUrl,
    detailUrl,
    card,
    date,
    quote,
  });

  const payload = await buildFeishuPayload(env, message);
  const response = await fetch(env.FEISHU_BOT_WEBHOOK, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Feishu webhook failed with ${response.status}: ${responseText}`);
  }

  log("brief_pushed", {
    requestId,
    date,
    detailUrl,
  });

  return {
    date,
    detailUrl,
    archiveUrl,
    headline: card.headline,
    quote,
    responseText,
  };
}

function isManualTriggerAuthorized(request, env) {
  if (!env.MANUAL_TRIGGER_TOKEN) {
    return false;
  }

  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${env.MANUAL_TRIGGER_TOKEN}`;
}

async function buildFeishuPayload(env, card) {
  const payload = {
    msg_type: "interactive",
    card,
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

function buildFeishuCard({ archiveUrl, detailUrl, card, date, quote }) {
  return {
    config: {
      wide_screen_mode: true,
      enable_forward: true,
    },
    header: {
      template: "blue",
      title: {
        tag: "plain_text",
        content: `The AI Industry Brief · ${date}`,
      },
      subtitle: {
        tag: "plain_text",
        content: "星期一研究室",
      },
    },
    elements: [
      {
        tag: "markdown",
        content: `**${escapeForMarkdown(card.headline)}**\n${escapeForMarkdown(card.summary)}`,
      },
      {
        tag: "markdown",
        content: `> ${escapeForMarkdown(quote)}`,
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
              content: "打开归档首页",
            },
            url: archiveUrl,
          },
        ],
      },
      {
        tag: "note",
        elements: [
          {
            tag: "plain_text",
            content: `来源站点已发布：${detailUrl}`,
          },
        ],
      },
    ],
  };
}

function extractArchiveCard(html, detailPath) {
  const normalizedPath = detailPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<a class="brief(?: previous)?" href="${normalizedPath}">[\\s\\S]*?<h2>([\\s\\S]*?)<\\/h2>[\\s\\S]*?<p>([\\s\\S]*?)<\\/p>`,
    "i",
  );
  const match = html.match(pattern);

  if (!match) {
    throw new Error(`Could not find archive card for ${detailPath}.`);
  }

  return {
    headline: decodeHtml(stripTags(match[1])).trim(),
    summary: decodeHtml(stripTags(match[2])).trim(),
  };
}

function extractQuote(html) {
  const match = html.match(
    /<div class="quote-label">[\s\S]*?<\/div>\s*([^<]+)\s*<\/div>/i,
  );

  if (!match) {
    throw new Error("Could not extract quote from detail page.");
  }

  return decodeHtml(match[1]).trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "cache-control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
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
      service: "ai-industry-brief-feishu-push",
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

function escapeForMarkdown(value) {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, "\\$&");
}
