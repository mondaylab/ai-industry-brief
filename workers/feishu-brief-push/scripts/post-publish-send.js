#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_SITE_BASE_URL = "https://mondaylab.github.io/ai-industry-brief";
const DEFAULT_WORKER_URL = "https://ai-industry-brief-feishu-push.zelina-ceo-os.workers.dev";
const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const DEFAULT_WAIT_ATTEMPTS = 18;
const DEFAULT_WAIT_INTERVAL_MS = 10000;
const DEFAULT_REQUEST_TIMEOUT_MS = 120000;
const DEFAULT_SCREENSHOT_WIDTH = 1600;
const DEFAULT_SCREENSHOT_HEIGHT = 2600;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

function usage() {
  console.log(`Usage: npm --prefix workers/feishu-brief-push run post-publish-send -- --date YYYY-MM-DD

Environment:
  MANUAL_TRIGGER_TOKEN or FEISHU_PUSH_TOKEN   Required Worker manual trigger token.
  FEISHU_PUSH_WORKER_URL                      Optional Worker URL.
  SITE_BASE_URL                               Optional GitHub Pages site base URL.
  CHROME_BIN                                  Optional Chrome executable for local fallback screenshot.

Options:
  --date YYYY-MM-DD       Brief date. Defaults to today in Asia/Shanghai.
  --no-local-fallback     Do not create/push local PNG fallback if Worker screenshot fails.
  --help                  Show this message.
`);
}

function parseArgs(argv) {
  const args = {
    date: null,
    localFallback: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--date") {
      args.date = argv[++i];
    } else if (arg.startsWith("--date=")) {
      args.date = arg.slice("--date=".length);
    } else if (arg === "--no-local-fallback") {
      args.localFallback = false;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function formatDateInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function ensureDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date: ${value}`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function waitForPublishedPage({ detailUrl, archiveUrl }) {
  for (let attempt = 1; attempt <= DEFAULT_WAIT_ATTEMPTS; attempt += 1) {
    const cacheBust = `post_publish=${Date.now()}`;
    const [detail, archive] = await Promise.all([
      fetchWithTimeout(`${detailUrl}?${cacheBust}`, {
        headers: { "cache-control": "no-cache" },
      }, 20000).catch((error) => ({ ok: false, status: error.message })),
      fetchWithTimeout(`${archiveUrl}?${cacheBust}`, {
        headers: { "cache-control": "no-cache" },
      }, 20000).catch((error) => ({ ok: false, status: error.message })),
    ]);

    if (detail.ok && archive.ok) {
      console.log(`Pages ready: ${detailUrl}`);
      return;
    }

    console.log(
      `Waiting for Pages (${attempt}/${DEFAULT_WAIT_ATTEMPTS}): detail=${detail.status} archive=${archive.status}`,
    );
    await sleep(DEFAULT_WAIT_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for GitHub Pages detail page: ${detailUrl}`);
}

async function triggerWorkerSend({ workerUrl, token, date, mode, imageUrl }) {
  const url = new URL(mode === "image-url" ? "/send-image-url" : "/send", workerUrl);
  url.searchParams.set("date", date);
  url.searchParams.set("force", "1");
  if (imageUrl) {
    url.searchParams.set("image_url", imageUrl);
  }

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        authorization: `Bearer ${token}`,
        "cache-control": "no-cache",
      },
    },
    DEFAULT_REQUEST_TIMEOUT_MS,
  );
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok || data.ok === false) {
    throw new Error(`Worker ${mode} failed with ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

function chromeCandidates() {
  return [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);
}

async function findChrome() {
  for (const candidate of chromeCandidates()) {
    if (candidate.includes("/") && fs.existsSync(candidate)) {
      return candidate;
    }
    if (!candidate.includes("/")) {
      try {
        await execFileAsync("which", [candidate]);
        return candidate;
      } catch {
        // Try the next candidate.
      }
    }
  }

  throw new Error("Chrome/Chromium not found. Set CHROME_BIN for local screenshot fallback.");
}

async function captureScreenshot({ date, detailUrl, imagePath }) {
  const chrome = await findChrome();
  fs.mkdirSync(path.dirname(imagePath), { recursive: true });

  await execFileAsync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--window-size=${DEFAULT_SCREENSHOT_WIDTH},${DEFAULT_SCREENSHOT_HEIGHT}`,
      `--screenshot=${imagePath}`,
      `${detailUrl}?post_publish_image=${Date.now()}`,
    ],
    {
      cwd: repoRoot,
      maxBuffer: 1024 * 1024 * 4,
    },
  );

  const stat = fs.statSync(imagePath);
  if (stat.size < 10000) {
    throw new Error(`Screenshot looks too small: ${imagePath} (${stat.size} bytes)`);
  }

  console.log(`Captured fallback screenshot for ${date}: ${path.relative(repoRoot, imagePath)}`);
}

async function git(args, options = {}) {
  const result = await execFileAsync("git", args, {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024 * 8,
    ...options,
  });
  return result.stdout.trim();
}

async function commitAndPushImage({ date, imagePath }) {
  const relPath = path.relative(repoRoot, imagePath);
  await git(["add", relPath]);

  const diff = await git(["diff", "--cached", "--name-only", "--", relPath]);
  if (!diff) {
    console.log(`No image changes to commit: ${relPath}`);
    return;
  }

  await git(["commit", "-m", `Add ${date} brief share image`]);
  await git(["push", "origin", "main"]);
  console.log(`Published fallback image asset: ${relPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const token = process.env.FEISHU_PUSH_TOKEN || process.env.MANUAL_TRIGGER_TOKEN;
  if (!token) {
    throw new Error("Missing MANUAL_TRIGGER_TOKEN or FEISHU_PUSH_TOKEN for Worker manual trigger.");
  }

  const date = ensureDate(args.date || formatDateInTimeZone(new Date(), DEFAULT_TIME_ZONE));
  const siteBaseUrl = normalizeBaseUrl(process.env.SITE_BASE_URL || DEFAULT_SITE_BASE_URL);
  const workerUrl = normalizeBaseUrl(process.env.FEISHU_PUSH_WORKER_URL || DEFAULT_WORKER_URL);
  const archiveUrl = `${siteBaseUrl}/`;
  const detailUrl = `${siteBaseUrl}/briefs/${date}.html`;

  await waitForPublishedPage({ detailUrl, archiveUrl });

  try {
    const result = await triggerWorkerSend({
      workerUrl,
      token,
      date,
      mode: "screenshot",
    });
    console.log(`Feishu screenshot push sent: ${result.messageId || result.deliveryMode || "ok"}`);
    return;
  } catch (error) {
    if (!args.localFallback) {
      throw error;
    }
    console.warn(`Worker screenshot push failed; using local PNG fallback. ${error.message}`);
  }

  const imagePath = path.join(repoRoot, "share-images", `${date}.png`);
  const imageUrl = `${siteBaseUrl}/share-images/${date}.png`;
  await captureScreenshot({ date, detailUrl, imagePath });
  await commitAndPushImage({ date, imagePath });
  await waitForPublishedPage({ detailUrl: imageUrl, archiveUrl });

  const fallbackResult = await triggerWorkerSend({
    workerUrl,
    token,
    date,
    mode: "image-url",
    imageUrl,
  });
  console.log(`Feishu fallback image push sent: ${fallbackResult.messageId || "ok"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
