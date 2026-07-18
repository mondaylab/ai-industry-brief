import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "brief-data");
const outputDir = path.join(root, "radar-data");
const outputPath = path.join(outputDir, "snapshot.json");
const datePattern = /^\d{4}-\d{2}-\d{2}\.json$/;
const sectionOrder = ["AI 产品前线", "AI 行业现场", "AI 资本与牌局", "AI 能力底座"];

function dateOnly(value, fallback) {
  return String(value || "").match(/\d{4}-\d{2}-\d{2}/)?.[0] || fallback;
}

function dayDiff(later, earlier) {
  return Math.max(0, Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000));
}

function domainOf(item) {
  try {
    return new URL(item.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return String(item.sourceName || "unknown").replace(/^www\./, "");
  }
}

function titleOf(item) {
  return String(item.title || "").replace(/\s*\|\s*/g, " ");
}

const files = fs.readdirSync(dataDir).filter((name) => datePattern.test(name)).sort().reverse();
if (!files.length) throw new Error("No daily brief JSON files found.");

const briefs = files.map((name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8")));
const latestDate = briefs[0].date;
const windowStart = new Date(`${latestDate}T00:00:00Z`);
windowStart.setUTCDate(windowStart.getUTCDate() - 13);
const windowStartDate = windowStart.toISOString().slice(0, 10);
const windowBriefs = briefs.filter((brief) => brief.date >= windowStartDate);

const rawSignals = windowBriefs.flatMap((brief) => (brief.sections || []).flatMap((section, sectionIndex) =>
  (section.items || []).map((item, itemIndex) => ({
    briefDate: brief.date,
    weekday: brief.weekday,
    section: section.name,
    sectionIndex,
    itemIndex,
    item,
    domain: domainOf(item),
    publishedAt: dateOnly(item.sourceDateLabel, brief.date),
  })),
));

const clusterCounts = new Map();
for (const signal of rawSignals) {
  const key = signal.item.topicCluster || signal.item.company || signal.domain;
  clusterCounts.set(key, (clusterCounts.get(key) || 0) + 1);
}

function scoreSignal(signal) {
  const age = dayDiff(latestDate, signal.publishedAt);
  const freshness = Math.max(8, 34 - age * 4);
  const evidence = signal.item.sourceTier === "evidence" ? 24 : 16;
  const metadata = [signal.item.company, signal.item.topicCluster, signal.item.productFamily].filter(Boolean).length * 3;
  const agentRelevance = /agent|智能体|代理|mcp/i.test(`${signal.item.title} ${signal.item.description}`) ? 10 : 5;
  const clusterKey = signal.item.topicCluster || signal.item.company || signal.domain;
  const resonance = Math.min(10, Math.max(0, (clusterCounts.get(clusterKey) || 1) - 1) * 3);
  const editorial = 14;
  const total = Math.min(98, freshness + evidence + metadata + agentRelevance + resonance + editorial);
  return {
    total,
    factors: { freshness, evidence, metadata, agentRelevance, resonance, editorial },
    strength: total >= 78 ? "strong" : total >= 62 ? "medium" : "weak",
  };
}

const signals = rawSignals.map((signal) => {
  const score = scoreSignal(signal);
  return {
    id: `${signal.briefDate}-${signal.sectionIndex + 1}-${signal.itemIndex + 1}`,
    title: titleOf(signal.item),
    description: signal.item.description,
    company: signal.item.company || titleOf(signal.item).split(/\s/)[0],
    topicCluster: signal.item.topicCluster || "unclassified",
    productFamily: signal.item.productFamily || null,
    section: signal.section,
    sourceName: signal.item.sourceName,
    sourceUrl: signal.item.sourceUrl,
    sourceTier: signal.item.sourceTier || "evidence",
    discoverySource: signal.item.discoverySource || null,
    domain: signal.domain,
    publishedAt: signal.publishedAt,
    discoveredAt: signal.briefDate,
    briefDate: signal.briefDate,
    workflowStatus: "published",
    score,
  };
}).sort((a, b) => b.score.total - a.score.total || b.publishedAt.localeCompare(a.publishedAt));

const sourceMap = new Map();
for (const signal of signals) {
  if (!sourceMap.has(signal.domain)) {
    sourceMap.set(signal.domain, {
      id: signal.domain,
      name: signal.sourceName || signal.domain,
      domain: signal.domain,
      latestPublishedAt: signal.publishedAt,
      lastIncludedAt: signal.briefDate,
      signalCount: 0,
      sections: new Set(),
      sourceTier: signal.sourceTier,
    });
  }
  const source = sourceMap.get(signal.domain);
  source.signalCount += 1;
  source.sections.add(signal.section);
  if (signal.publishedAt > source.latestPublishedAt) source.latestPublishedAt = signal.publishedAt;
  if (signal.briefDate > source.lastIncludedAt) source.lastIncludedAt = signal.briefDate;
}

const sources = [...sourceMap.values()].map((source) => {
  const ageDays = dayDiff(latestDate, source.latestPublishedAt);
  return {
    ...source,
    sections: [...source.sections].sort((a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b)),
    ageDays,
    freshness: ageDays <= 2 ? "fresh" : ageDays <= 7 ? "watch" : "stale",
    monitorMode: "brief-observed",
  };
}).sort((a, b) => a.ageDays - b.ageDays || b.signalCount - a.signalCount);

const snapshot = {
  schemaVersion: 1,
  generatedAt: `${latestDate}T23:59:00+08:00`,
  latestBriefDate: latestDate,
  window: { from: windowStartDate, to: latestDate, days: 14 },
  mode: "brief-observed",
  modeNote: "当前快照来自已收录简报，用于验证编辑工作流；实时来源抓取尚未启用。",
  metrics: {
    signalCount: signals.length,
    sourceCount: sources.length,
    strongCount: signals.filter((signal) => signal.score.strength === "strong").length,
    agentCount: signals.filter((signal) => signal.score.factors.agentRelevance === 10).length,
  },
  pipeline: [
    { id: "discover", name: "发现", status: "ready", count: signals.length },
    { id: "dedupe", name: "去重", status: "ready", count: new Set(signals.map((signal) => signal.sourceUrl)).size },
    { id: "classify", name: "分类", status: "ready", count: new Set(signals.map((signal) => signal.topicCluster)).size },
    { id: "score", name: "评分", status: "ready", count: signals.filter((signal) => signal.score.strength === "strong").length },
    { id: "verify", name: "核验", status: "manual", count: signals.filter((signal) => signal.sourceTier === "evidence").length },
  ],
  sections: sectionOrder,
  sources,
  signals,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Generated ${path.relative(root, outputPath)} with ${signals.length} signals from ${sources.length} sources.`);
