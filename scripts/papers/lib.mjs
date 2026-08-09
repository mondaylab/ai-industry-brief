const topicRules = [
  {
    id: "agents-reasoning",
    pattern: /\b(agent|agentic|tool[- ]?use|planning|reasoning|computer[- ]?use|multi[- ]?agent|web agent|search agent|long[- ]horizon)\b/i,
  },
  {
    id: "foundation-models",
    pattern: /\b(language model|llm|foundation model|pretrain|pre-training|post-training|transformer|mixture[- ]of[- ]experts|moe|scaling law|alignment)\b/i,
  },
  {
    id: "multimodal",
    pattern: /\b(multimodal|vision[- ]language|visual language|text[- ]to[- ]image|image generation|video generation|audio|speech|diffusion|flow matching|3d generation)\b/i,
  },
  {
    id: "safety-evaluation",
    pattern: /\b(safety|secure|security|alignment|benchmark|evaluation|evals|robust|trust|uncertainty|hallucination|red team|privacy|attack|jailbreak)\b/i,
  },
  {
    id: "robotics-embodied",
    pattern: /\b(robot|robotic|embodied|manipulation|navigation|vision-language-action|vla|autonomous driving)\b/i,
  },
  {
    id: "systems-efficiency",
    pattern: /\b(efficient|efficiency|inference|serving|quantization|compression|sparse|memory|throughput|latency|accelerat|training system|distributed training|kernel)\b/i,
  },
];

const categoryTopicHints = {
  "cs.CL": "foundation-models",
  "cs.CV": "multimodal",
  "cs.RO": "robotics-embodied",
  "cs.CR": "safety-evaluation",
};

const watchReasons = {
  "agents-reasoning": "这项工作直接触及 Agent 的推理、规划或工具使用能力，值得观察它是否改变长任务的可靠性边界。",
  "foundation-models": "这项工作位于基础模型训练或架构主线上，值得跟进它对能力、成本与可扩展性的实际影响。",
  multimodal: "这项工作连接两种以上模态或生成链路，值得观察它是否带来新的交互入口与数据闭环。",
  "safety-evaluation": "这项工作提供安全、评测或可信度证据，适合用来检验前沿能力是否真正可控、可复核。",
  "robotics-embodied": "这项工作把模型能力推进到物理环境，关键观察点是感知、决策与执行能否形成稳定闭环。",
  "systems-efficiency": "这项工作关注训练或推理效率，可能直接改变模型能力进入真实产品的成本结构。",
  other: "这是一条新进入观察范围的研究信号，需要结合方法、实验和后续评审继续判断。",
};

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function cleanText(value = "") {
  return decodeXml(String(value)).replace(/\s+/g, " ").trim();
}

function textTag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return cleanText(match?.[1] || "");
}

function attributes(fragment = "") {
  const result = {};
  for (const match of fragment.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) result[match[1]] = decodeXml(match[3]);
  return result;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function linksFrom(block) {
  return [...block.matchAll(/<link\s+([^>]*?)(?:\/?>)/gi)].map((match) => attributes(match[1]));
}

function urlsFrom(value = "") {
  return [...String(value).matchAll(/https?:\/\/[^\s<>()\[\]{}"']+/gi)]
    .map((match) => match[0].replace(/[.,;:!?]+$/, ""))
    .map(safeUrl)
    .filter(Boolean);
}

export function classifyPaper(paper) {
  const haystack = `${paper.title || ""} ${paper.abstract || ""}`;
  const topics = topicRules.filter((rule) => rule.pattern.test(haystack)).map((rule) => rule.id);
  for (const category of paper.categories || []) {
    const hint = categoryTopicHints[category];
    if (hint && !topics.includes(hint)) topics.push(hint);
  }
  return topics.length ? topics.slice(0, 3) : ["other"];
}

export function scorePaper(paper, now = new Date()) {
  const topics = paper.topics?.length ? paper.topics : classifyPaper(paper);
  const haystack = `${paper.title || ""} ${paper.abstract || ""}`;
  const ageDays = Math.max(0, (now.getTime() - new Date(paper.updatedAt || paper.publishedAt).getTime()) / 86_400_000);
  const factors = {
    topicRelevance: Math.min(40, 18 + topics.filter((topic) => topic !== "other").length * 7 + (/\b(agent|reasoning|multimodal|benchmark|foundation model|robot)\b/i.test(haystack) ? 6 : 0)),
    evidence: paper.doi || paper.journalRef ? 18 : 12,
    reproducibility: paper.resources?.code ? 15 : paper.resources?.project ? 8 : 0,
    methodSignal: /\b(we introduce|we propose|we present|new benchmark|novel|state[- ]of[- ]the[- ]art|sota)\b/i.test(haystack) ? 12 : 7,
    freshness: ageDays <= 1 ? 10 : ageDays <= 3 ? 8 : ageDays <= 7 ? 5 : 2,
    multiSource: paper.doi || paper.journalRef ? 5 : 0,
  };
  const total = Object.values(factors).reduce((sum, value) => sum + value, 0);
  return {
    total,
    level: total >= 78 ? "focus" : total >= 65 ? "watch" : "new",
    factors,
    note: "编辑观察优先级，不代表论文质量或结论可靠性。",
  };
}

function resourceLinks(comment, summary, links) {
  const urls = [...urlsFrom(comment), ...urlsFrom(summary)];
  const code = urls.find((url) => /github\.com|gitlab\.com|codeberg\.org/i.test(url)) || null;
  const project = urls.find((url) => !/arxiv\.org|github\.com|gitlab\.com|codeberg\.org|huggingface\.co\/datasets/i.test(url)) || null;
  const paper = safeUrl(links.find((link) => link.rel === "alternate")?.href) || null;
  const pdf = safeUrl(links.find((link) => link.title === "pdf" || link.type === "application/pdf")?.href) || null;
  return { paper, pdf, code, project };
}

export function parseArxivFeed(xml, { discoveredAt = new Date().toISOString() } = {}) {
  const papers = [];
  for (const match of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
    const block = match[1];
    const rawId = textTag(block, "id");
    const idMatch = rawId.match(/\/abs\/([^/?#]+)/);
    if (!idMatch) continue;
    const versionMatch = idMatch[1].match(/v(\d+)$/i);
    const arxivId = idMatch[1].replace(/v\d+$/i, "");
    const categories = [...block.matchAll(/<category\s+([^>]*?)\/?>/gi)]
      .map((categoryMatch) => attributes(categoryMatch[1]).term)
      .filter(Boolean);
    const primaryCategory = attributes(block.match(/<arxiv:primary_category\s+([^>]*?)\/?>/i)?.[1] || "").term || categories[0] || "";
    const authors = [...block.matchAll(/<author>([\s\S]*?)<\/author>/gi)].map((authorMatch) => textTag(authorMatch[1], "name")).filter(Boolean);
    const comment = textTag(block, "arxiv:comment");
    const title = textTag(block, "title");
    const abstract = textTag(block, "summary");
    const publishedAt = textTag(block, "published");
    const updatedAt = textTag(block, "updated") || publishedAt;
    const journalRef = textTag(block, "arxiv:journal_ref") || null;
    const doi = textTag(block, "arxiv:doi") || null;
    const paper = {
      id: `arxiv:${arxivId}`,
      identifiers: { arxiv: arxivId, doi, openreview: null },
      version: Number(versionMatch?.[1] || 1),
      title,
      abstract,
      authors,
      categories,
      primaryCategory,
      publishedAt,
      updatedAt,
      firstSeenAt: discoveredAt,
      discoveredAt,
      lastSeenAt: discoveredAt,
      status: "preprint",
      peerReviewStatus: "not-reviewed",
      source: { id: "arxiv", name: "arXiv", tier: "A", evidence: "primary-metadata" },
      journalRef,
      doi,
      comment: comment || null,
      resources: resourceLinks(comment, abstract, linksFrom(block)),
      events: [{ type: "first_seen", occurredAt: publishedAt, observedAt: discoveredAt }],
    };
    paper.topics = classifyPaper(paper);
    paper.whyWatch = watchReasons[paper.topics[0] || "other"];
    paper.score = scorePaper(paper, new Date(discoveredAt));
    papers.push(paper);
  }
  return papers;
}

export function mergePaper(existing, incoming, observedAt = new Date().toISOString()) {
  if (!existing) return incoming;
  const events = [...(existing.events || [])];
  const hasNewRevision = incoming.version > (existing.version || 1) || incoming.updatedAt !== existing.updatedAt;
  if (hasNewRevision && !events.some((event) => event.type === "revision" && event.occurredAt === incoming.updatedAt)) {
    events.push({ type: "revision", occurredAt: incoming.updatedAt, observedAt });
  }
  return {
    ...existing,
    ...incoming,
    firstSeenAt: existing.firstSeenAt || incoming.firstSeenAt,
    discoveredAt: existing.discoveredAt || incoming.discoveredAt,
    lastSeenAt: observedAt,
    events,
  };
}

export function dedupePapers(papers) {
  const result = new Map();
  for (const paper of papers) {
    const current = result.get(paper.id);
    if (!current || paper.version > current.version || paper.updatedAt > current.updatedAt) result.set(paper.id, paper);
  }
  return [...result.values()];
}

export function validatePaper(paper) {
  const errors = [];
  for (const field of ["id", "title", "abstract", "publishedAt", "updatedAt"]) {
    if (!paper[field]) errors.push(`missing ${field}`);
  }
  if (!paper.resources?.paper || !paper.resources?.pdf) errors.push("missing paper resources");
  if (!Array.isArray(paper.authors) || !paper.authors.length) errors.push("missing authors");
  if (!Array.isArray(paper.topics) || !paper.topics.length) errors.push("missing topics");
  return errors;
}

export const paperTopicRules = topicRules.map(({ id }) => id);
