#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeyFromTitle(title) {
  const parts = String(title || "").split("|").map((s) => s.trim().toLowerCase());
  if (parts.length >= 2) return `${parts[0]}|${parts.slice(1).join("|")}`;
  return normalizeTitle(title);
}

function unescapeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function collectFromDataJson(data) {
  const out = [];
  for (const section of data.sections || []) {
    for (const item of section.items || []) {
      out.push({
        title: item.title || "",
        titleNorm: normalizeTitle(item.title),
        keyNorm: normalizeKeyFromTitle(item.title),
        sourceUrl: item.sourceUrl || "",
      });
    }
  }
  return out;
}

function collectFromHtml(html) {
  const out = [];
  const articleBlocks = html.match(/<article class="item">[\s\S]*?<\/article>/g) || [];
  for (const block of articleBlocks) {
    const toolMatch = block.match(/<span class="item-tool">([\s\S]*?)<\/span>/);
    const headingMatch = block.match(/<span class="item-heading">([\s\S]*?)<\/span>/);
    const urlMatch = block.match(/<a class="item-source" href="([^"]+)"/);
    const tool = unescapeHtml((toolMatch && toolMatch[1]) || "").trim();
    const heading = unescapeHtml((headingMatch && headingMatch[1]) || "").trim();
    const title = tool && heading ? `${tool} | ${heading}` : "";
    out.push({
      title,
      titleNorm: normalizeTitle(title),
      keyNorm: normalizeKeyFromTitle(title),
      sourceUrl: (urlMatch && urlMatch[1]) || "",
    });
  }
  return out;
}

function ensureCandidateShape(candidate) {
  if (!candidate || !Array.isArray(candidate.sections)) {
    fail("candidate JSON must include a `sections` array");
  }
  if (candidate.sections.length !== 4) {
    fail(`candidate JSON must contain 4 sections, got ${candidate.sections.length}`);
  }
  let itemCount = 0;
  for (const section of candidate.sections) {
    if (!Array.isArray(section.items)) {
      fail(`section "${section.name || "unknown"}" must include items array`);
    }
    if (section.items.length !== 3) {
      fail(`section "${section.name || "unknown"}" must contain exactly 3 items`);
    }
    itemCount += section.items.length;
  }
  if (itemCount !== 12) {
    fail(`candidate JSON must contain exactly 12 items, got ${itemCount}`);
  }
}

function main() {
  const candidateArg = process.argv[2];
  if (!candidateArg) {
    fail("usage: node skills/ai-industry-brief/scripts/check-brief-dedup.js brief-data/YYYY-MM-DD.json");
  }

  const root = process.cwd();
  const candidatePath = path.resolve(root, candidateArg);
  if (!fs.existsSync(candidatePath)) {
    fail(`candidate file not found: ${candidatePath}`);
  }

  const candidate = readJson(candidatePath);
  ensureCandidateShape(candidate);
  const candidateDate = candidate.date ? String(candidate.date).trim() : "";
  const candidateItems = collectFromDataJson(candidate);

  const historical = [];

  const dataDir = path.resolve(root, "brief-data");
  if (fs.existsSync(dataDir)) {
    for (const name of fs.readdirSync(dataDir)) {
      if (!name.endsWith(".json") || name === "_template.json") continue;
      const fp = path.join(dataDir, name);
      if (path.resolve(fp) === candidatePath) continue;
      const d = readJson(fp);
      historical.push(...collectFromDataJson(d).map((x) => ({ ...x, from: `brief-data/${name}` })));
    }
  }

  const briefsDir = path.resolve(root, "briefs");
  if (fs.existsSync(briefsDir)) {
    for (const name of fs.readdirSync(briefsDir)) {
      if (!name.endsWith(".html")) continue;
      if (candidateDate && name === `${candidateDate}.html`) continue;
      const fp = path.join(briefsDir, name);
      const html = fs.readFileSync(fp, "utf8");
      historical.push(...collectFromHtml(html).map((x) => ({ ...x, from: `briefs/${name}` })));
    }
  }

  const urlMap = new Map();
  const titleMap = new Map();
  const keyMap = new Map();
  for (const h of historical) {
    if (h.sourceUrl) urlMap.set(h.sourceUrl, h.from);
    if (h.titleNorm) titleMap.set(h.titleNorm, h.from);
    if (h.keyNorm) keyMap.set(h.keyNorm, h.from);
  }

  const issues = [];
  for (const item of candidateItems) {
    if (item.sourceUrl && urlMap.has(item.sourceUrl)) {
      issues.push(`duplicate source URL: ${item.sourceUrl} (already in ${urlMap.get(item.sourceUrl)})`);
    }
    if (item.titleNorm && titleMap.has(item.titleNorm)) {
      issues.push(`duplicate title: "${item.title}" (already in ${titleMap.get(item.titleNorm)})`);
    }
    if (item.keyNorm && keyMap.has(item.keyNorm)) {
      issues.push(`duplicate normalized key: "${item.keyNorm}" (already in ${keyMap.get(item.keyNorm)})`);
    }
  }

  if (issues.length > 0) {
    console.error("Dedup check failed:");
    for (const i of issues) console.error(`- ${i}`);
    process.exit(2);
  }

  console.log(`Dedup check passed for ${candidateArg} (12 items, no historical overlap).`);
}

main();
