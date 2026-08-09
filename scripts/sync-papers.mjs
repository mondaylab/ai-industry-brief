import fs from "node:fs";
import path from "node:path";
import {
  dedupePapers,
  mergePaper,
  parseArxivFeed,
  validatePaper,
} from "./papers/lib.mjs";

const root = process.cwd();
const dataDir = path.join(root, "papers-data");
const configPath = path.join(dataDir, "config.json");
const manifestPath = path.join(dataDir, "manifest.json");
const healthPath = path.join(dataDir, "health.json");
const force = process.argv.includes("--force");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const previousManifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;
const now = new Date();
const nowIso = now.toISOString();
const userAgent = "AI-Industry-Brief-Paper-Observatory/1.0 (https://github.com/mondaylab/ai-industry-brief)";
const categoryArgument = process.argv.find((argument) => argument.startsWith("--categories="));
const requestedCategories = categoryArgument ? categoryArgument.slice("--categories=".length).split(",").map((item) => item.trim()).filter(Boolean) : null;

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function hoursSince(value) {
  return value ? (now.getTime() - new Date(value).getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/atom+xml", "user-agent": userAgent },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(3_000 * attempt);
    }
  }
  throw lastError;
}

function readExistingPapers() {
  const papers = new Map();
  for (const day of previousManifest?.days || []) {
    const filePath = path.join(root, day.dataUrl);
    if (!fs.existsSync(filePath)) continue;
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    for (const paper of payload.papers || []) papers.set(paper.id, paper);
  }
  return papers;
}

function groupByPublishedDate(papers) {
  const groups = new Map();
  for (const paper of papers) {
    const date = paper.publishedAt.slice(0, 10);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(paper);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.score.total - a.score.total);
  }
  return groups;
}

async function syncArxiv() {
  const papers = [];
  const categories = requestedCategories || config.categories.map((category) => category.id);
  for (let index = 0; index < categories.length; index += 1) {
    if (index > 0) await sleep(3_100);
    const category = categories[index];
    const url = new URL("https://export.arxiv.org/api/query");
    url.searchParams.set("search_query", `cat:${category}`);
    url.searchParams.set("start", "0");
    url.searchParams.set("max_results", "50");
    url.searchParams.set("sortBy", "lastUpdatedDate");
    url.searchParams.set("sortOrder", "descending");
    const xml = await fetchWithRetry(url);
    const categoryPapers = parseArxivFeed(xml, { discoveredAt: nowIso });
    papers.push(...categoryPapers);
    console.log(`arXiv ${category}: ${categoryPapers.length} papers`);
  }
  return dedupePapers(papers);
}

async function main() {
  if (!force && hoursSince(previousManifest?.lastSuccessfulAt) < 18) {
    console.log(`Paper Observatory already synced at ${previousManifest.lastSuccessfulAt}; use --force to refresh.`);
    return;
  }

  const existing = readExistingPapers();
  try {
    const incoming = await syncArxiv();
    const merged = new Map(existing);
    for (const paper of incoming) merged.set(paper.id, mergePaper(existing.get(paper.id), paper, nowIso));

    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - config.retentionDays);
    const retained = [...merged.values()]
      .filter((paper) => new Date(paper.publishedAt) >= cutoff)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

    const invalid = retained.flatMap((paper) => validatePaper(paper).map((error) => `${paper.id}: ${error}`));
    if (invalid.length) throw new Error(`Paper validation failed:\n${invalid.slice(0, 20).join("\n")}`);

    const groups = groupByPublishedDate(retained);
    const days = [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, papers]) => {
        const payload = {
          schemaVersion: 1,
          date,
          generatedAt: nowIso,
          papers,
        };
        writeJson(path.join(dataDir, `${date}.json`), payload);
        return {
          date,
          dataUrl: `papers-data/${date}.json`,
          paperCount: papers.length,
          revisionCount: papers.filter((paper) => paper.events?.some((event) => event.type === "revision")).length,
        };
      });

    const manifest = {
      schemaVersion: 1,
      mode: "live",
      generatedAt: nowIso,
      lastSuccessfulAt: nowIso,
      cadence: "arXiv 官方日更后自动同步；页面每 10 分钟检查本站数据",
      latestPaperDate: days[0]?.date || null,
      paperCount: retained.length,
      liveSourceCount: 1,
      days,
    };
    writeJson(manifestPath, manifest);
    writeJson(healthPath, {
      schemaVersion: 1,
      status: "healthy",
      lastAttemptAt: nowIso,
      lastSuccessfulAt: nowIso,
      sources: [
        {
          id: "arxiv",
          status: "healthy",
          lastSuccessfulAt: nowIso,
          itemCount: incoming.length,
          note: "单连接顺序抓取，分类请求间隔至少 3 秒。",
        },
      ],
      errors: [],
    });
    console.log(`Paper Observatory synced ${retained.length} papers across ${days.length} days.`);
  } catch (error) {
    writeJson(healthPath, {
      schemaVersion: 1,
      status: "degraded",
      lastAttemptAt: nowIso,
      lastSuccessfulAt: previousManifest?.lastSuccessfulAt || null,
      sources: [{ id: "arxiv", status: "error", lastSuccessfulAt: previousManifest?.lastSuccessfulAt || null, itemCount: 0 }],
      errors: [String(error?.message || error)],
    });
    throw error;
  }
}

await main();
