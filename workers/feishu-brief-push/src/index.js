const DEFAULT_SITE_BASE_URL = "https://mondaylab.github.io/ai-industry-brief";
const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const DEFAULT_SCREENSHOT_WIDTH = 1600;
const DEFAULT_SCREENSHOT_HEIGHT = 2200;
const PRIMARY_CRON = "40 22 * * *";

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

    if (url.pathname === "/send-link") {
      if (!isManualTriggerAuthorized(request, env)) {
        return jsonResponse(401, {
          ok: false,
          error: "Unauthorized manual trigger.",
        });
      }

      const requestedDate = url.searchParams.get("date");
      const force = url.searchParams.get("force") === "1";

      try {
        const result = await pushBriefLink({
          env,
          requestedDate,
          force,
          requestId: crypto.randomUUID(),
        });
        return jsonResponse(200, {
          ok: true,
          ...result,
        });
      } catch (error) {
        log("manual_link_push_failed", {
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

    if (url.pathname === "/send-image-url") {
      if (!isManualTriggerAuthorized(request, env)) {
        return jsonResponse(401, {
          ok: false,
          error: "Unauthorized manual trigger.",
        });
      }
      if (request.method !== "GET") {
        return jsonResponse(405, {
          ok: false,
          error: "GET required.",
        });
      }

      const requestedDate = url.searchParams.get("date");
      const imageUrl = normalizeSameOriginAssetUrl(url.searchParams.get("image_url"), env);
      const siteBaseUrl = normalizeBaseUrl(env.SITE_BASE_URL || DEFAULT_SITE_BASE_URL);
      const timeZone = env.TIME_ZONE || DEFAULT_TIME_ZONE;
      const date = requestedDate || formatDateInTimeZone(new Date(), timeZone);
      const archiveUrl = `${siteBaseUrl}/`;
      const detailUrl = `${siteBaseUrl}/briefs/${date}.html`;
      const pageMeta = await fetchPageMeta(detailUrl);
      const result = await pushBriefImageFromUrl({
        env,
        archiveUrl,
        detailUrl,
        date,
        pageMeta,
        imageUrl,
        requestId: crypto.randomUUID(),
        deliveryMode: "manual_image",
      });

      const state = getPushStateStore(env);
      if (state) {
        await writePushState(state, `brief-push:${date}`, {
          status: "sent",
          date,
          detailUrl,
          source: "manual",
          sentAt: new Date().toISOString(),
          headline: result.headline,
          deliveryMode: result.deliveryMode,
          imageUrl,
          imageKey: result.imageKey,
          messageId: result.messageId,
        });
      }

      return jsonResponse(200, {
        ok: true,
        ...result,
      });
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
        log("scheduled_image_push_failed", {
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
    log("brief_image_push_skipped", {
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
    log("brief_image_push_skipped", {
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

  const pageMeta = await tryFetchPageMeta(detailUrl);
  if (!pageMeta.ok) {
    if (state) {
      await writePushState(state, stateKey, {
        status: "waiting_for_page",
        date,
        detailUrl,
        source,
        cron,
        checkedAt: new Date().toISOString(),
        error: pageMeta.error,
      });
    }
    log("brief_page_not_ready", {
      requestId,
      date,
      detailUrl,
      source,
      cron,
      error: pageMeta.error,
    });
    return {
      date,
      detailUrl,
      archiveUrl,
      skipped: true,
      reason: "page_not_ready",
      error: pageMeta.error,
    };
  }

  const publishedImageUrl = `${siteBaseUrl}/share-images/${date}.png`;
  try {
    const publishedImage = await pushBriefImageFromUrl({
      env,
      date,
      archiveUrl,
      detailUrl,
      pageMeta: pageMeta.value,
      imageUrl: publishedImageUrl,
      requestId,
      deliveryMode: "published_image",
    });
    if (state) {
      await writePushState(state, stateKey, {
        status: "sent",
        date,
        detailUrl,
        source,
        cron,
        sentAt: new Date().toISOString(),
        headline: publishedImage.headline,
        deliveryMode: publishedImage.deliveryMode,
        imageUrl: publishedImageUrl,
        imageKey: publishedImage.imageKey,
        imageBytes: publishedImage.imageBytes,
      });
    }
    return publishedImage;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log("brief_published_image_push_failed", {
      requestId,
      date,
      detailUrl,
      imageUrl: publishedImageUrl,
      source,
      cron,
      error: errorMessage,
    });
  }

  try {
    const result = await pushBriefImage({
      env,
      date,
      archiveUrl,
      detailUrl,
      pageMeta: pageMeta.value,
      requestId,
    });
    if (state) {
      await writePushState(state, stateKey, {
        status: "sent",
        date,
        detailUrl,
        source,
        cron,
        sentAt: new Date().toISOString(),
        headline: result.headline,
        deliveryMode: result.deliveryMode,
        imageKey: result.imageKey,
        screenshotBytes: result.screenshotBytes,
      });
    }
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      log("brief_image_push_fallback_to_published_image", {
        requestId,
        date,
        detailUrl,
        imageUrl: publishedImageUrl,
        source,
        cron,
        error: errorMessage,
      });
      const fallbackImage = await pushBriefImageFromUrl({
        env,
        date,
        archiveUrl,
        detailUrl,
        pageMeta: pageMeta.value,
        imageUrl: publishedImageUrl,
        requestId,
        deliveryMode: "published_image_fallback",
      });
      if (state) {
        await writePushState(state, stateKey, {
          status: "sent",
          date,
          detailUrl,
          source,
          cron,
          sentAt: new Date().toISOString(),
          headline: fallbackImage.headline,
          deliveryMode: fallbackImage.deliveryMode,
          fallbackFrom: "screenshot",
          imageUrl: publishedImageUrl,
          imageKey: fallbackImage.imageKey,
          messageId: fallbackImage.messageId,
          error: errorMessage,
        });
      }
      return {
        ...fallbackImage,
        fallbackFrom: "screenshot",
        fallbackError: errorMessage,
      };
    } catch (publishedImageError) {
      log("brief_published_image_fallback_failed", {
        requestId,
        date,
        detailUrl,
        imageUrl: publishedImageUrl,
        source,
        cron,
        error: publishedImageError instanceof Error ? publishedImageError.message : String(publishedImageError),
      });
    }

    if (source === "scheduled") {
      log("brief_image_push_fallback_to_link", {
        requestId,
        date,
        detailUrl,
        source,
        cron,
        error: errorMessage,
      });
      const fallback = await pushBriefLink({
        env,
        requestedDate: date,
        force: true,
        requestId,
      });
      if (state) {
        await writePushState(state, stateKey, {
          status: "sent",
          date,
          detailUrl,
          source,
          cron,
          sentAt: new Date().toISOString(),
          headline: fallback.headline,
          deliveryMode: "link_fallback",
          fallbackFrom: "image",
          error: errorMessage,
        });
      }
      return {
        ...fallback,
        deliveryMode: "link_fallback",
        fallbackFrom: "image",
        fallbackError: errorMessage,
      };
    }
    if (state) {
      await writePushState(state, stateKey, {
        status: "failed",
        date,
        detailUrl,
        source,
        cron,
        failedAt: new Date().toISOString(),
        error: errorMessage,
      });
    }
    throw error;
  }
}

async function pushBriefLink({ env, requestedDate, force = false, requestId }) {
  const siteBaseUrl = normalizeBaseUrl(env.SITE_BASE_URL || DEFAULT_SITE_BASE_URL);
  const timeZone = env.TIME_ZONE || DEFAULT_TIME_ZONE;
  const date = requestedDate || formatDateInTimeZone(new Date(), timeZone);
  const archiveUrl = `${siteBaseUrl}/`;
  const detailUrl = `${siteBaseUrl}/briefs/${date}.html`;

  assertRequiredSecret(env, "FEISHU_APP_ID");
  assertRequiredSecret(env, "FEISHU_APP_SECRET");
  assertRequiredSecret(env, "FEISHU_CHAT_ID");

  const state = getPushStateStore(env);
  const stateKey = `brief-link-push:${date}`;
  const existing = state ? await readPushState(state, stateKey) : null;
  if (!force && existing?.status === "sent") {
    log("brief_link_push_skipped", {
      requestId,
      date,
      detailUrl,
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

  const pageMeta = await fetchPageMeta(detailUrl);
  const tenantAccessToken = await getTenantAccessToken(env);
  const card = buildBriefLinkCard({
    archiveUrl,
    detailUrl,
    date,
    headline: pageMeta.headline,
  });
  const delivery = await sendFeishuBotMessage({
    tenantAccessToken,
    chatId: env.FEISHU_CHAT_ID,
    card,
  });

  if (state) {
    await writePushState(state, stateKey, {
      status: "sent",
      date,
      detailUrl,
      sentAt: new Date().toISOString(),
      headline: pageMeta.headline,
      deliveryMode: delivery.mode,
    });
  }

  log("brief_link_pushed", {
    requestId,
    date,
    detailUrl,
    deliveryMode: delivery.mode,
  });

  return {
    date,
    detailUrl,
    archiveUrl,
    headline: pageMeta.headline,
    deliveryMode: delivery.mode,
    messageId: delivery.messageId,
    responseText: delivery.responseText,
  };
}

async function pushBriefImage({ env, date, archiveUrl, detailUrl, pageMeta, requestId }) {
  const screenshot = await capturePageScreenshot({
    env,
    url: `${detailUrl}?image_push=${encodeURIComponent(date)}`,
  });
  const tenantAccessToken = await getTenantAccessToken(env);
  const imageKey = await uploadFeishuImage({
    tenantAccessToken,
    filename: `ai-industry-brief-${date}.png`,
    imageBytes: screenshot,
  });
  const card = buildFeishuCard({
    archiveUrl,
    detailUrl,
    date,
    headline: pageMeta.headline,
    imageKey,
  });
  const delivery = await sendFeishuBotMessage({
    tenantAccessToken,
    chatId: env.FEISHU_CHAT_ID,
    card,
  });

  log("brief_image_pushed", {
    requestId,
    date,
    detailUrl,
    deliveryMode: delivery.mode,
    imageKey,
    screenshotBytes: screenshot.byteLength,
  });

  return {
    date,
    detailUrl,
    archiveUrl,
    headline: pageMeta.headline,
    deliveryMode: delivery.mode,
    messageId: delivery.messageId,
    imageKey,
    screenshotBytes: screenshot.byteLength,
    responseText: delivery.responseText,
  };
}

async function pushBriefImageFromUrl({
  env,
  date,
  archiveUrl,
  detailUrl,
  pageMeta,
  imageUrl,
  requestId,
  deliveryMode,
}) {
  const imageBytes = await fetchImageBytes(imageUrl);
  const tenantAccessToken = await getTenantAccessToken(env);
  const imageKey = await uploadFeishuImage({
    tenantAccessToken,
    filename: `ai-industry-brief-${date}.png`,
    imageBytes,
  });
  const card = buildFeishuCard({
    archiveUrl,
    detailUrl,
    date,
    headline: pageMeta.headline,
    imageKey,
  });
  const delivery = await sendFeishuBotMessage({
    tenantAccessToken,
    chatId: env.FEISHU_CHAT_ID,
    card,
  });

  log("brief_image_url_pushed", {
    requestId,
    date,
    detailUrl,
    imageUrl,
    deliveryMode,
    imageKey,
    imageBytes: imageBytes.byteLength,
  });

  return {
    date,
    detailUrl,
    archiveUrl,
    headline: pageMeta.headline,
    deliveryMode,
    messageId: delivery.messageId,
    imageUrl,
    imageKey,
    imageBytes: imageBytes.byteLength,
    responseText: delivery.responseText,
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

async function fetchImageBytes(imageUrl) {
  const response = await fetch(imageUrl, {
    headers: {
      "cache-control": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image ${imageUrl}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("image/png")) {
    throw new Error(`Expected PNG image at ${imageUrl}, got ${contentType || "unknown content type"}`);
  }

  return response.arrayBuffer();
}

function normalizeSameOriginAssetUrl(value, env) {
  if (!value) {
    throw new Error("Missing image_url.");
  }

  const imageUrl = new URL(value);
  if (imageUrl.protocol !== "https:") {
    throw new Error("image_url must use https.");
  }

  const siteBaseUrl = new URL(normalizeBaseUrl(env.SITE_BASE_URL || DEFAULT_SITE_BASE_URL));
  if (imageUrl.origin !== siteBaseUrl.origin || !imageUrl.pathname.startsWith("/ai-industry-brief/")) {
    throw new Error(`image_url must be under ${siteBaseUrl.origin}/ai-industry-brief/.`);
  }

  return imageUrl.toString();
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

  return {
    headline,
  };
}

async function tryFetchPageMeta(url) {
  try {
    return {
      ok: true,
      value: await fetchPageMeta(url),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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

function buildFeishuCard({ archiveUrl, detailUrl, date, headline, imageKey }) {
  return {
    config: {
      wide_screen_mode: true,
      enable_forward: true,
    },
    header: {
      template: "blue",
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
  };
}

function buildBriefLinkCard({ archiveUrl, detailUrl, date, headline }) {
  return {
    config: {
      wide_screen_mode: true,
      enable_forward: true,
    },
    header: {
      template: "blue",
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
        content: `**${escapeForMarkdown(headline)}**\n\n今日简报补发，点击按钮查看详情。`,
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
        content: label,
      },
      subtitle: {
        tag: "plain_text",
        content: "星期一研究室",
      },
    },
    elements: [
      {
        tag: "markdown",
        content: `**${escapeForMarkdown(title)}**`,
      },
      {
        tag: "img",
        img_key: imageKey,
        alt: {
          tag: "plain_text",
          content: title,
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
