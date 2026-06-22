#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "brief-data");
const BRIEFS_DIR = path.join(ROOT, "briefs");

const PALETTES = {
  "星期一": { primary: "#927BBE", light: "#F4EFFA" },
  "星期二": { primary: "#6F97A8", light: "#EEF4F7" },
  "星期三": { primary: "#7FA6C9", light: "#EEF4FB" },
  "星期四": { primary: "#7FA68B", light: "#EFF5F0" },
  "星期五": { primary: "#6F9F99", light: "#EEF6F3" },
  "星期六": { primary: "#8A93B7", light: "#F0F1F8" },
  "星期日": { primary: "#EC9BC8", light: "#FDF0F7" },
};

const SECTION_ICONS = {
  "AI 产品前线": '<svg width="13" height="13" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="7" rx="1.5" fill="white"/><rect x="10" y="1" width="7" height="7" rx="1.5" fill="white"/><rect x="1" y="10" width="7" height="7" rx="1.5" fill="white"/><rect x="10" y="10" width="7" height="7" rx="1.5" fill="white"/></svg>',
  "AI 行业现场": '<svg width="13" height="13" viewBox="0 0 18 18" fill="none"><circle cx="4" cy="5" r="2.2" fill="white"/><circle cx="13" cy="5" r="2.2" fill="white"/><circle cx="8.5" cy="13" r="2.2" fill="white"/><path d="M5.8 6.4L7.3 11M11.2 6.4L9.7 11M6.1 13H3.2M14 13h-2.9" stroke="white" stroke-width="1.35" stroke-linecap="round"/></svg>',
  "AI 资本与牌局": '<svg width="13" height="13" viewBox="0 0 18 18" fill="none"><path d="M4 14.5V8.5M9 14.5V3.5M14 14.5V6.5" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M3 15H15.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><circle cx="4" cy="7" r="1.4" fill="white"/><circle cx="9" cy="2.5" r="1.4" fill="white"/><circle cx="14" cy="5" r="1.4" fill="white"/></svg>',
  "AI 能力底座": '<svg width="13" height="13" viewBox="0 0 18 18" fill="none"><path d="M10.5 2L4 10h5.5L7.5 16L14 8H8.5L10.5 2Z" fill="white"/></svg>',
};

const SECTION_NUMBERS = {
  "AI 产品前线": "01",
  "AI 行业现场": "02",
  "AI 资本与牌局": "03",
  "AI 能力底座": "04",
};

const ITEM_MARKS = ["◆", "◇", "◈"];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function weekdayToEnglish(weekday) {
  return {
    "星期一": "MONDAY",
    "星期二": "TUESDAY",
    "星期三": "WEDNESDAY",
    "星期四": "THURSDAY",
    "星期五": "FRIDAY",
    "星期六": "SATURDAY",
    "星期日": "SUNDAY",
  }[weekday] || "WEEKDAY";
}

function getTemplateBrief(targetDate) {
  const files = fs.readdirSync(BRIEFS_DIR).filter((name) => /^\d{4}-\d{2}-\d{2}\.html$/.test(name) && name !== `${targetDate}.html`);
  files.sort().reverse();
  if (!files.length) fail("No existing brief template found.");
  return fs.readFileSync(path.join(BRIEFS_DIR, files[0]), "utf8");
}

function replaceOne(html, pattern, value, label) {
  if (!pattern.test(html)) fail(`Unable to replace ${label}`);
  return html.replace(pattern, value);
}

function splitTitle(title) {
  const parts = String(title).split("|");
  return {
    tool: (parts[0] || "").trim(),
    heading: parts.slice(1).join("|").trim(),
  };
}

function buildSectionsHtml(data) {
  return data.sections
    .map((section) => {
      const num = SECTION_NUMBERS[section.name] || "00";
      const icon = SECTION_ICONS[section.name] || "";
      const items = section.items
        .map((item, index) => {
          const { tool, heading } = splitTitle(item.title);
          return `    <article class="item">
      <div class="item-title"><span class="item-num" data-mark="${ITEM_MARKS[index]}" aria-label="${String(index + 1).padStart(2, "0")}">${String(index + 1).padStart(2, "0")}</span><span class="item-copy"><span class="item-tool">${escapeHtml(tool)}</span><span class="item-divider"> | </span><span class="item-heading">${escapeHtml(heading)}</span></span></div>
      <p class="item-desc">${escapeHtml(item.description)}</p>
      <a class="item-source" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">→ ${escapeHtml(item.sourceName)}</a><span class="source-date">${escapeHtml(item.sourceDateLabel)}</span>
    </article>`;
        })
        .join("\n");

      return `  <section class="section">
    <div class="section-header">
      <span class="section-tag" data-num="${num}">
        ${icon}
        ${escapeHtml(section.name)}
      </span>
    </div>
    <div class="section-sub">${escapeHtml(section.subtitle)}</div>
    <div class="section-items">
${items}
    </div>
  </section>`;
    })
    .join("\n\n");
}

function renderBriefPage(data) {
  const palette = PALETTES[data.weekday];
  if (!palette) fail(`Unknown weekday: ${data.weekday}`);
  let html = getTemplateBrief(data.date);
  const dateLabel = `${formatMd(data.date)} · ${data.weekday}`;
  const title = `The AI Industry Brief | ${dateLabel} | 星期一研究室`;
  const sectionsHtml = buildSectionsHtml(data);

  html = replaceOne(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, "detail title");
  html = replaceOne(html, /--primary:\s*#[0-9A-Fa-f]{6};/, `--primary: ${palette.primary};`, "detail primary");
  html = replaceOne(html, /--primary-light:\s*#[0-9A-Fa-f]{6};/, `--primary-light: ${palette.light};`, "detail primary light");
  html = replaceOne(html, /<div class="lab">星期一研究室<\/div>/, '<div class="lab">星期一研究室</div>', "detail lab");
  html = replaceOne(html, /<div class="date">[\s\S]*?<\/div>/, `<div class="date">${dateLabel}</div>`, "detail header date");
  html = replaceOne(
    html,
    /<div class="quote-copy">[\s\S]*?<\/div>\s*<svg class="hero-illustration"/,
    `<div class="quote-copy">
    <div class="quote-label">今日一句话</div>
    ${escapeHtml(data.opening)}
  </div>
  <svg class="hero-illustration"`,
    "detail opening"
  );
  html = replaceOne(
    html,
    /<div class="sections-layout">[\s\S]*?<\/div>\s*<aside class="insight-card">/,
    `<div class="sections-layout">
${sectionsHtml}
  </div>

  <aside class="insight-card">`,
    "detail sections"
  );
  html = replaceOne(html, /<p class="insight-text">[\s\S]*?<\/p>/, `<p class="insight-text">${escapeHtml(data.insight)}</p>`, "detail insight");
  html = replaceOne(html, /<p class="method-note">[\s\S]*?<\/p>/, `<p class="method-note">${escapeHtml(data.methodNote)}</p>`, "detail method note");
  html = replaceOne(html, /<div class="footer-lab">[\s\S]*?<\/div>/, '<div class="footer-lab">星期一研究室出品</div>', "detail footer left");
  html = replaceOne(
    html,
    /<div class="footer-sub">[\s\S]*?<\/div>/,
    '<div class="footer-sub">The AI Industry Brief · AI Product · AI PKM/PMO · AI System Design</div>',
    "detail footer right"
  );

  fs.writeFileSync(path.join(BRIEFS_DIR, `${data.date}.html`), html);
}

function buildArchiveCard(entry, featured = false, readLabel = "查看往期 →") {
  const md = entry.dateLabel || `${formatMd(entry.date)} · ${entry.weekday}`;
  const href = entry.href || `briefs/${entry.date}.html`;
  const cls = featured ? "brief-card featured" : "brief-card";
  return `          <a class="${cls}" href="${href}">
            <div class="date">${escapeHtml(md)}</div>
            <h3>${escapeHtml(entry.headline)}</h3>
            <p>${escapeHtml(entry.summary)}</p>
            <span class="read">${readLabel}</span>
          </a>`;
}

function buildArchiveList(entries) {
  return entries
    .map((entry) => {
      const md = entry.dateLabel || `${formatMd(entry.date)} · ${entry.weekday}`;
      const href = entry.href || `briefs/${entry.date}.html`;
      return `          <a class="archive-item" href="${href}"><div class="date">${escapeHtml(md)}</div><div><div class="archive-title">${escapeHtml(entry.headline)}</div><div class="archive-desc">${escapeHtml(entry.summary)}</div></div><span class="archive-arrow">→</span></a>`;
    })
    .join("\n");
}

function buildMobileSections(entry) {
  const sections = entry.homepage.mobileSections || [];
  return sections
    .map((item, index) => `                <div class="mobile-section"><span class="mobile-num">${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.summary)}</span></div></div>`)
    .join("\n");
}

function parseArchiveEntries(html) {
  const matches = html.match(/<a class="archive-item" href="briefs\/\d{4}-\d{2}-\d{2}\.html">[\s\S]*?<\/a>/g) || [];
  return matches
    .map((block) => {
      const href = block.match(/href="([^"]+)"/)?.[1];
      const dateLabel = block.match(/<div class="date">([\s\S]*?)<\/div>/)?.[1]?.trim();
      const headline = block.match(/<div class="archive-title">([\s\S]*?)<\/div>/)?.[1]?.trim();
      const summary = block.match(/<div class="archive-desc">([\s\S]*?)<\/div>/)?.[1]?.trim();
      const date = href?.match(/briefs\/(\d{4}-\d{2}-\d{2})\.html/)?.[1];
      if (!href || !dateLabel || !headline || !summary || !date) return null;
      return { href, dateLabel, headline, summary, date };
    })
    .filter(Boolean);
}

function renderIndexPage(latestData) {
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const oldEntries = parseArchiveEntries(html).filter((entry) => entry.date !== latestData.date);
  const latest = {
    date: latestData.date,
    weekday: latestData.weekday,
    href: `briefs/${latestData.date}.html`,
    dateLabel: `${formatMd(latestData.date)} · ${latestData.weekday}`,
    headline: latestData.homepage.headline,
    summary: latestData.homepage.summary,
  };
  const previous = oldEntries[0];
  if (!previous) fail("Unable to determine previous issue from index.html");

  html = replaceOne(html, /href="briefs\/\d{4}-\d{2}-\d{2}\.html">阅读最新一期<\/a>/, `href="briefs/${latest.date}.html">阅读最新一期</a>`, "index latest button");
  html = replaceOne(html, /<div class="mobile-date">[\s\S]*?<\/div>/, `<div class="mobile-date">${formatMd(latest.date)}<br>${weekdayToEnglish(latest.weekday)}</div>`, "index mobile date");
  html = replaceOne(html, /<div class="mobile-headline">[\s\S]*?<\/div>\s*<div class="mobile-sections">/, `<div class="mobile-headline">
                <h2>${escapeHtml(latest.headline)}</h2>
                <p>${escapeHtml(latest.summary)}</p>
              </div>
              <div class="mobile-sections">`, "index mobile headline");
  html = replaceOne(html, /<div class="mobile-sections">[\s\S]*?<\/div>\s*<\/article>/, `<div class="mobile-sections">
${buildMobileSections(latestData)}
              </div>
            </article>`, "index mobile sections");
  html = replaceOne(
    html,
    /<div class="brief-grid">[\s\S]*?<\/div>\s*<\/section>\s*\n\n      <section class="panel archive">/,
    `<div class="brief-grid">
${buildArchiveCard(latest, true, "查看今日早报 →")}
${buildArchiveCard(previous, false, "查看前一期 →")}
          <a class="brief-card" href="color-palette-demo.html">
            <div class="date">Style System</div>
            <h3>Weekly Palette Demo</h3>
            <p>查看周一到周日的紫、蓝、绿、粉色系在简报组件里的实际效果。</p>
            <span class="read">查看色板 →</span>
          </a>
        </div>
      </section>

      <section class="panel archive">`,
    "index brief grid"
  );
  html = replaceOne(
    html,
    /<div class="archive-list">[\s\S]*?<\/div>\s*<\/section>\s*\n\n      <section class="panel palette">/,
    `<div class="archive-list">
${buildArchiveList([latest, ...oldEntries])}
        </div>
      </section>

      <section class="panel palette">`,
    "index archive list"
  );

  fs.writeFileSync(path.join(ROOT, "index.html"), html);
}

function main() {
  const targetDate = process.argv[2];
  if (!targetDate) fail("Usage: node skills/ai-industry-brief/scripts/render-brief.js YYYY-MM-DD");
  const dataPath = path.join(DATA_DIR, `${targetDate}.json`);
  if (!fs.existsSync(dataPath)) fail(`Missing data file: ${dataPath}`);
  const data = readJson(dataPath);
  renderBriefPage(data);
  renderIndexPage(data);
  console.log(`Rendered brief and index for ${targetDate}`);
}

main();
