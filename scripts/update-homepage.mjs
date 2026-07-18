import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "index.html");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "brief-data", "manifest.json"), "utf8"));
const latestData = JSON.parse(fs.readFileSync(path.join(root, "brief-data", `${manifest.latest}.json`), "utf8"));

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function replaceOne(html, pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Unable to update homepage ${label}.`);
  return html.replace(pattern, replacement);
}

function formatMd(date) {
  return `${date.slice(5, 7)}/${date.slice(8, 10)}`;
}

function weekdayToEnglish(weekday) {
  return {
    星期一: "MONDAY",
    星期二: "TUESDAY",
    星期三: "WEDNESDAY",
    星期四: "THURSDAY",
    星期五: "FRIDAY",
    星期六: "SATURDAY",
    星期日: "SUNDAY",
  }[weekday] || "DAILY";
}

function issueHref(issue) {
  return issue.dataUrl ? `reader.html?date=${issue.date}` : issue.legacyUrl;
}

function existingLegacyCopy(html) {
  const entries = new Map();
  const blocks = html.match(/<a class="archive-item"[^>]*>[\s\S]*?<\/a>/g) || [];
  for (const block of blocks) {
    const href = block.match(/href="([^"]+)"/)?.[1] || "";
    const date = href.match(/(?:date=|briefs\/)(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!date) continue;
    entries.set(date, {
      headline: block.match(/<div class="archive-title">([\s\S]*?)<\/div>/)?.[1]?.trim(),
      summary: block.match(/<div class="archive-desc">([\s\S]*?)<\/div>/)?.[1]?.trim(),
    });
  }
  return entries;
}

function normalizedIssue(issue, legacyCopy) {
  const fallback = legacyCopy.get(issue.date) || {};
  return {
    ...issue,
    headline: issue.legacyOnly ? fallback.headline || issue.headline : issue.headline,
    summary: issue.legacyOnly ? fallback.summary || issue.summary : issue.summary,
  };
}

function buildArchiveCard(issue, featured, label) {
  return `          <a class="brief-card${featured ? " featured" : ""}" href="${issueHref(issue)}">
            <div class="date">${formatMd(issue.date)} · ${escapeHtml(issue.weekday)}</div>
            <h3>${escapeHtml(issue.headline)}</h3>
            <p>${escapeHtml(issue.summary)}</p>
            <span class="read">${label}</span>
          </a>`;
}

function buildArchiveList(issues) {
  return issues.map((issue) => `          <a class="archive-item" href="${issueHref(issue)}"><div class="date">${formatMd(issue.date)} · ${escapeHtml(issue.weekday)}</div><div><div class="archive-title">${escapeHtml(issue.headline)}</div><div class="archive-desc">${escapeHtml(issue.summary)}</div></div><span class="archive-arrow">→</span></a>`).join("\n");
}

function buildMobileSections() {
  return (latestData.homepage?.mobileSections || latestData.sections || []).slice(0, 4).map((item, index) => `                <div class="mobile-section"><span class="mobile-num">${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.summary || item.subtitle)}</span></div></div>`).join("\n");
}

let html = fs.readFileSync(indexPath, "utf8");
const legacyCopy = existingLegacyCopy(html);
const issues = manifest.issues.map((issue) => normalizedIssue(issue, legacyCopy));
const latest = issues[0];
const previous = issues[1];

html = replaceOne(html, /href="(?:briefs\/\d{4}-\d{2}-\d{2}\.html|reader\.html\?date=\d{4}-\d{2}-\d{2})">阅读最新一期<\/a>/, `href="${issueHref(latest)}">阅读最新一期</a>`, "latest button");
html = replaceOne(html, /<div class="mobile-date">[\s\S]*?<\/div>/, `<div class="mobile-date">${formatMd(latest.date)}<br>${weekdayToEnglish(latest.weekday)}</div>`, "mobile date");
html = replaceOne(html, /<div class="mobile-headline">[\s\S]*?<\/div>\s*<div class="mobile-sections">/, `<div class="mobile-headline">
                <h2>${escapeHtml(latest.headline)}</h2>
                <p>${escapeHtml(latest.summary)}</p>
              </div>
              <div class="mobile-sections">`, "mobile headline");
html = replaceOne(html, /<div class="mobile-sections">[\s\S]*?<\/div>\s*<\/article>/, `<div class="mobile-sections">
${buildMobileSections()}
              </div>
            </article>`, "mobile sections");
html = replaceOne(html, /<div class="brief-grid">[\s\S]*?<\/div>\s*<\/section>\s*\n\n      <section class="panel archive">/, `<div class="brief-grid">
${buildArchiveCard(latest, true, "进入新版阅读器 →")}
${buildArchiveCard(previous, false, "查看前一期 →")}
          <a class="brief-card" href="color-palette-demo.html">
            <div class="date">Style System</div>
            <h3>Seven Theme Palette</h3>
            <p>查看七种可主动切换的阅读主题，不再与星期绑定。</p>
            <span class="read">查看色板 →</span>
          </a>
        </div>
      </section>

      <section class="panel archive">`, "brief cards");
html = replaceOne(html, /<div class="archive-list">[\s\S]*?<\/div>\s*<\/section>\s*\n\n      <section class="panel palette">/, `<div class="archive-list">
${buildArchiveList(issues)}
        </div>
      </section>

      <section class="panel palette">`, "archive list");

fs.writeFileSync(indexPath, html);
console.log(`Updated homepage for ${latest.date} with ${issues.length} archive entries.`);
