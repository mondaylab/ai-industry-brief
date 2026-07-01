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

function normalizeMeta(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function productFamilyFromTitle(title, company) {
  const text = `${title || ""} ${company || ""}`.toLowerCase();
  const families = [
    ["chatgpt", /\bchatgpt\b|\bgpt[- ]?\d/i],
    ["claude", /\bclaude\b|\banthropic\b/i],
    ["gemini", /\bgemini\b|\bgoogle workspace\b|\bworkspace drops\b/i],
    ["copilot", /\bcopilot\b/i],
    ["perplexity", /\bperplexity\b/i],
    ["notion", /\bnotion\b/i],
    ["canva", /\bcanva\b/i],
    ["figma", /\bfigma\b/i],
    ["cursor", /\bcursor\b/i],
    ["runway", /\brunway\b/i],
    ["jetbrains", /\bjetbrains\b|\bjunie\b/i],
    ["jira", /\bjira\b|\batlassian\b/i],
    ["zoom", /\bzoom\b|\bzoommate\b/i],
    ["hubspot", /\bhubspot\b|\bbreeze\b/i],
  ];
  for (const [family, pattern] of families) {
    if (pattern.test(text)) return family;
  }
  const tool = String(title || "").split("|")[0]?.trim().toLowerCase();
  return tool || normalizeMeta(company);
}

function sourceDomain(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function increment(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function entriesOverLimit(map, limit) {
  return [...map.entries()]
    .filter(([, count]) => count > limit)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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
        sourceDomain: sourceDomain(item.sourceUrl),
        companyNorm: normalizeMeta(item.company),
        topicClusterNorm: normalizeMeta(item.topicCluster),
        sourceTierNorm: normalizeMeta(item.sourceTier),
        productFamilyNorm: normalizeMeta(item.productFamily || productFamilyFromTitle(item.title, item.company)),
        sectionName: section.name || "",
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
      productFamilyNorm: normalizeMeta(productFamilyFromTitle(title, "")),
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

function checkSemanticConcentration(candidateItems) {
  const warnings = [];
  const domainCounts = new Map();
  const companyCounts = new Map();
  const topicCounts = new Map();
  let itemsWithSemanticMeta = 0;

  for (const item of candidateItems) {
    increment(domainCounts, item.sourceDomain);
    increment(companyCounts, item.companyNorm);
    increment(topicCounts, item.topicClusterNorm);
    if (item.companyNorm || item.topicClusterNorm || item.sourceTierNorm) {
      itemsWithSemanticMeta += 1;
    }
  }

  if (domainCounts.size < 6) {
    warnings.push(`source diversity is low: ${domainCounts.size} unique domains; target at least 6`);
  }

  for (const [company, count] of entriesOverLimit(companyCounts, 2)) {
    warnings.push(`company concentration: "${company}" appears ${count} times; target no more than 2 unless explained`);
  }

  for (const [topic, count] of entriesOverLimit(topicCounts, 3)) {
    warnings.push(`topic concentration: "${topic}" appears ${count} times; target no more than 3 unless explained`);
  }

  if (itemsWithSemanticMeta > 0 && itemsWithSemanticMeta < candidateItems.length) {
    warnings.push(`semantic metadata is partial: ${itemsWithSemanticMeta}/${candidateItems.length} items include company/topic/sourceTier`);
  }

  if (itemsWithSemanticMeta === 0) {
    warnings.push("semantic metadata missing: add optional company, topicCluster, sourceTier, discoverySource fields to improve non-repetitive selection");
  }

  return warnings;
}

function checkRecentSectionFatigue(root, candidate, candidatePath) {
  const warnings = [];
  const candidateDate = String(candidate.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidateDate)) return warnings;

  const dataDir = path.resolve(root, "brief-data");
  if (!fs.existsSync(dataDir)) return warnings;

  const recentDates = fs.readdirSync(dataDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .map((name) => name.slice(0, 10))
    .filter((date) => date < candidateDate)
    .sort()
    .reverse()
    .slice(0, 3);

  const recentBySection = new Map();
  for (const date of recentDates) {
    const fp = path.join(dataDir, `${date}.json`);
    if (path.resolve(fp) === candidatePath) continue;
    const data = readJson(fp);
    for (const section of data.sections || []) {
      for (const item of section.items || []) {
        const family = normalizeMeta(item.productFamily || productFamilyFromTitle(item.title, item.company));
        if (!family) continue;
        const key = `${section.name || ""}::${family}`;
        if (!recentBySection.has(key)) recentBySection.set(key, []);
        recentBySection.get(key).push(`${date} "${item.title || family}"`);
      }
    }
  }

  for (const section of candidate.sections || []) {
    for (const item of section.items || []) {
      const family = normalizeMeta(item.productFamily || productFamilyFromTitle(item.title, item.company));
      if (!family) continue;
      const key = `${section.name || ""}::${family}`;
      const recent = recentBySection.get(key) || [];
      if (recent.length) {
        warnings.push(`recent same-section product fatigue: "${family}" in "${section.name}" also appeared in ${recent.join(", ")}`);
      }
    }
  }

  return warnings;
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

  const warnings = [
    ...checkSemanticConcentration(candidateItems),
    ...checkRecentSectionFatigue(root, candidate, candidatePath),
  ];
  if (warnings.length > 0) {
    console.warn("Semantic diversity warnings:");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }

  console.log(`Dedup check passed for ${candidateArg} (12 items, no historical overlap).`);
}

main();
