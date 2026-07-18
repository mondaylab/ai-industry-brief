#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "brief-data");
const BRIEFS_DIR = path.join(ROOT, "briefs");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMd(date) {
  return `${date.slice(5, 7)}/${date.slice(8, 10)}`;
}

function validateBrief(data, targetDate) {
  if (data.date !== targetDate) fail(`Data date ${data.date} does not match ${targetDate}.`);
  if (!data.weekday || !data.opening || !data.insight || !data.methodNote) fail("Brief metadata is incomplete.");
  if (!Array.isArray(data.sections) || data.sections.length !== 4) fail("Brief must contain exactly four sections.");
  const items = data.sections.flatMap((section) => section.items || []);
  if (items.length !== 12) fail("Brief must contain exactly twelve items.");
  for (const item of items) {
    if (!item.title || !item.description || !item.sourceUrl || !item.sourceName || !item.sourceDateLabel) {
      fail(`Incomplete item: ${item.title || "untitled"}`);
    }
  }
}

function buildCompatibilityPage(data) {
  const dateLabel = `${formatMd(data.date)} · ${data.weekday}`;
  const target = `../reader.html?date=${encodeURIComponent(data.date)}`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <meta name="description" content="${escapeHtml(data.opening)}">
  <meta http-equiv="refresh" content="0; url=${target}">
  <link rel="canonical" href="${target}">
  <title>The AI Industry Brief | ${escapeHtml(dateLabel)} | 星期一研究室</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#efefeb;color:#111;font:14px Arial,sans-serif}.redirect{width:min(620px,calc(100% - 32px));padding:32px;border:1px solid #111;background:#fbfbf8}.brand{font-size:28px;font-weight:700}.lab{margin-top:8px}.date{margin:34px 0 14px;font-size:13px}.redirect a{color:#604d8f}.footer{display:flex;justify-content:space-between;margin-top:40px;padding-top:16px;border-top:1px solid #111;font-size:11px}
  </style>
</head>
<body>
  <main class="redirect">
    <div class="brand">The AI Industry Brief</div>
    <div class="lab">星期一研究室</div>
    <div class="date">${escapeHtml(dateLabel)}</div>
    <h1>${escapeHtml(data.opening)}</h1>
    <p>正在打开新版简报阅读器。<a href="${target}">继续阅读</a></p>
    <footer class="footer"><div class="footer-lab">星期一研究室出品</div><div class="footer-sub">The AI Industry Brief</div></footer>
  </main>
  <script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>\n`;
}

function runNode(scriptPath) {
  execFileSync(process.execPath, [scriptPath], { cwd: ROOT, stdio: "inherit" });
}

function main() {
  const targetDate = process.argv[2];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate || "")) {
    fail("Usage: node skills/ai-industry-brief/scripts/render-brief.js YYYY-MM-DD");
  }

  const dataPath = path.join(DATA_DIR, `${targetDate}.json`);
  if (!fs.existsSync(dataPath)) fail(`Missing data file: ${dataPath}`);
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  validateBrief(data, targetDate);

  fs.mkdirSync(BRIEFS_DIR, { recursive: true });
  fs.writeFileSync(path.join(BRIEFS_DIR, `${targetDate}.html`), buildCompatibilityPage(data));
  runNode(path.join(ROOT, "scripts", "generate-manifest.mjs"));
  runNode(path.join(ROOT, "scripts", "update-homepage.mjs"));
  runNode(path.join(ROOT, "scripts", "build-app.mjs"));

  console.log(`Rendered React brief site for ${targetDate}.`);
}

main();
