#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");

const ROOT = process.cwd();
const SKILL_DIR = path.resolve(__dirname, "..");
const RECEIVER_ASSET_URL = pathToFileURL(path.join(SKILL_DIR, "assets", "phone-receiver-v1.png")).href;
const ROTARY_ASSET_URL = pathToFileURL(path.join(SKILL_DIR, "assets", "rotary-phone-v1.png")).href;
const BRAND_LAVENDER = "#B7A8E6";
const COLOR_POOL = [
  { accent: "#BFD88A", colorName: "柔和草绿" },
  { accent: "#79B7D8", colorName: "清透天蓝" },
  { accent: "#E8A66D", colorName: "低饱和杏橙" },
  { accent: "#E6D36A", colorName: "柔黄" },
  { accent: "#D9767C", colorName: "灰调珊瑚红" },
  { accent: "#C8CED6", colorName: "雾灰" },
  { accent: "#86D7C5", colorName: "薄荷青" },
];

const PUBLIC_HEADLINES = {
  "2026-06-27": "AI 开始管起工作流程",
  "2026-06-28": "AI 工具开始讲安全感",
  "2026-06-29": "AI Agent 开始算工作量",
  "2026-06-30": "AI 开始真正干活",
  "2026-07-01": "AI 工作要能被检查",
  "2026-07-02": "AI 公司开始卖结果",
  "2026-07-03": "AI 开始算钱和责任",
  "2026-07-04": "AI 开始按结果结账",
  "2026-07-05": "常用软件都在加 AI",
};

const COLUMNS = [
  {
    section: "产品",
    file: "products",
    title: "产品前线",
    headline: "AI 正在进入常用软件",
    deck: "这周最值得看的产品变化：AI 被放进会议、设计、代码、文件和家庭自动化这些日常入口。",
  },
  {
    section: "行业",
    file: "industry",
    title: "行业现场",
    headline: "AI 开始接真实工作",
    deck: "法律、医疗、客服、政府采购和内容分发都在把 AI 从试点带进流程，行业开始关心交付、责任和收费边界。",
  },
  {
    section: "资本",
    file: "capital",
    title: "资本与牌局",
    headline: "钱流向算力和交付",
    deck: "融资故事正在从“模型更强”转向推理平台、芯片、数据中心和能真正接管流程的垂直 Agent。",
  },
  {
    section: "底座",
    file: "infrastructure",
    title: "能力底座",
    headline: "AI Agent 要先可控",
    deck: "权限、评测、成本、上下文和可观测性，是 AI Agent 能不能进入企业系统的底层条件。",
  },
];

function usage() {
  console.log(`Usage:
  node skills/ai-weekly-call-log/scripts/generate-weekly-call-log.js --start YYYY-MM-DD [--out DIR] [--render]

Options:
  --start YYYY-MM-DD   First day of the 7-day week.
  --out DIR            Output directory. Default: output/weekly-call-log-YYYY-MM-DD
  --picks FILE         Optional weekly picks JSON. If omitted, each column uses the first 8 weekly items.
  --color-seed VALUE   Seed for choosing 4 colors from the 7-color pool. Default: --start. Use "random" for a fresh draw.
  --render             Render PNGs with npx playwright screenshot.
  --help               Show this help.`);
}

function parseArgs(argv) {
  const args = { render: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--render") args.render = true;
    else if (arg === "--start") args.start = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--picks") args.picks = argv[++i];
    else if (arg === "--color-seed") args.colorSeed = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.help) return args;
  if (!args.start || !/^\d{4}-\d{2}-\d{2}$/.test(args.start)) {
    throw new Error("Missing or invalid --start YYYY-MM-DD");
  }
  args.out ||= path.join("output", `weekly-call-log-${args.start}`);
  args.colorSeed ||= args.start;
  return args;
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashString(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, seed) {
  const random = seed === "random" ? Math.random : seededRandom(seed);
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function assignColumnColors(columns, seed) {
  const colors = shuffled(COLOR_POOL, seed).slice(0, columns.length);
  return columns.map((column, index) => ({ ...column, ...colors[index] }));
}

function addDays(dateString, offset) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactTitle(title) {
  return String(title)
    .replace(/\s*\|\s*/g, " ")
    .replace(/人工智能/g, "AI")
    .replace(/美元/g, "$")
    .replace(/\s+/g, " ")
    .trim();
}

function displayCopy(value) {
  return String(value ?? "")
    .replace(/AI 代理/g, "AI Agent")
    .replace(/代理式 AI/g, "Agentic AI")
    .replace(/代理 AI/g, "Agentic AI")
    .replace(/代码代理/g, "代码 Agent")
    .replace(/客服代理/g, "客服 Agent")
    .replace(/医疗代理/g, "医疗 Agent")
    .replace(/营销代理/g, "营销 Agent")
    .replace(/理财代理/g, "理财 Agent")
    .replace(/催收代理/g, "催收 Agent")
    .replace(/垂直代理/g, "垂直 Agent")
    .replace(/企业级代理/g, "企业级 Agent")
    .replace(/企业代理/g, "企业 Agent")
    .replace(/开发者代理/g, "开发者 Agent")
    .replace(/外部代理/g, "外部 Agent")
    .replace(/自主代理/g, "自主 Agent")
    .replace(/代理互联网/g, "Agent 互联网")
    .replace(/代理商务/g, "Agent 商务")
    .replace(/代理支付/g, "Agent 支付")
    .replace(/代理经济/g, "Agent 经济")
    .replace(/代理系统/g, "Agent 系统")
    .replace(/代理生态/g, "Agent 生态")
    .replace(/代理训练/g, "Agent 训练")
    .replace(/代理服务/g, "Agent 服务")
    .replace(/代理能力/g, "Agent 能力")
    .replace(/代理效能/g, "Agent 效能")
    .replace(/代理评测/g, "Agent 评测")
    .replace(/代理入口/g, "Agent 入口")
    .replace(/代理行为/g, "Agent 行为")
    .replace(/代理工作/g, "Agent 工作")
    .replace(/代理应用/g, "Agent 应用")
    .replace(/代理流水线/g, "Agent 流水线")
    .replace(/代理运行/g, "Agent 运行")
    .replace(/代理进入/g, "Agent 进入")
    .replace(/代理接入/g, "Agent 接入")
    .replace(/代理访问/g, "Agent 访问")
    .replace(/代理调用/g, "Agent 调用")
    .replace(/代理上岗/g, "Agent 上岗")
    .replace(/代理自动化/g, "Agent 自动化")
    .replace(/代理正在/g, "Agent 正在")
    .replace(/代理被/g, "Agent 被")
    .replace(/代理可/g, "Agent 可")
    .replace(/代理/g, "Agent")
    .replace(/\bagent\b/g, "Agent")
    .replace(/([\u4e00-\u9fff])Agent/g, "$1 Agent")
    .replace(/Agent([\u4e00-\u9fff])/g, "Agent $1")
    .replace(/\s{2,}/g, " ");
}

function sectionLabel(name) {
  return String(name)
    .replace(/^AI\s*/, "")
    .replace("产品前线", "产品")
    .replace("行业现场", "行业")
    .replace("资本与牌局", "资本")
    .replace("能力底座", "底座");
}

function readBrief(date) {
  const file = path.join(ROOT, "brief-data", `${date}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing brief data: ${file}`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const items = data.sections.flatMap((section) =>
    section.items.map((item) => ({
      date,
      weekday: data.weekday,
      section: sectionLabel(section.name),
      title: compactTitle(item.title),
      originalTitle: item.title,
      description: item.description,
      sourceName: item.sourceName,
      sourceDateLabel: item.sourceDateLabel,
    }))
  );
  if (items.length !== 12) throw new Error(`${file} should contain 12 items, got ${items.length}`);
  return { ...data, items };
}

function dailyHeadline(brief) {
  return PUBLIC_HEADLINES[brief.date] || brief.homepage?.headline || brief.opening;
}

function shortDate(date) {
  return date.slice(5).replace("-", ".");
}

function normalizePickKey(value) {
  return displayCopy(compactTitle(value)).toLowerCase().replace(/\s+/g, " ").trim();
}

function loadWeeklyPicks(file) {
  if (!file) return null;
  const resolved = path.resolve(ROOT, file);
  if (!fs.existsSync(resolved)) throw new Error(`Missing weekly picks file: ${resolved}`);
  const data = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const columns = data.columns || data;
  if (!columns || typeof columns !== "object" || Array.isArray(columns)) {
    throw new Error(`Invalid weekly picks file: ${resolved}. Expected an object or { "columns": { ... } }.`);
  }
  return { file: resolved, columns };
}

function columnPickTitles(weeklyPicks, column) {
  if (!weeklyPicks) return [];
  const values = weeklyPicks.columns[column.section] || weeklyPicks.columns[column.title] || weeklyPicks.columns[column.file] || [];
  if (!Array.isArray(values)) {
    throw new Error(`Invalid picks for ${column.title} in ${weeklyPicks.file}. Expected an array of titles.`);
  }
  return values;
}

function selectedColumnItems(briefs, column, weeklyPicks) {
  const allItems = briefs.flatMap((brief) => brief.items).filter((item) => item.section === column.section);
  const index = new Map();
  for (const item of allItems) {
    for (const value of [item.originalTitle, item.title, displayCopy(item.originalTitle), displayCopy(item.title)]) {
      index.set(normalizePickKey(value), item);
    }
  }
  const wanted = columnPickTitles(weeklyPicks, column);
  const missing = [];
  const picked = wanted
    .map((title) => {
      const item = index.get(normalizePickKey(title));
      if (!item) missing.push(title);
      return item;
    })
    .filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Picks not found for ${column.title}: ${missing.join(" / ")}`);
  }
  const pickedTitles = new Set(picked.map((item) => item.originalTitle));
  return [...picked, ...allItems.filter((item) => !pickedTitles.has(item.originalTitle))].slice(0, 8);
}

function assertCopyQuality(label, html) {
  const banned = [
    /不是[^。！？\n<]{0,80}而是/,
    /不再是[^。！？\n<]{0,80}而是/,
    /不只是[^。！？\n<]{0,80}也/,
    /不只[^。！？\n<]{0,80}而/,
  ];
  const text = html.replace(/<[^>]+>/g, " ");
  const hit = banned.map((pattern) => text.match(pattern)?.[0]).find(Boolean);
  if (hit) throw new Error(`Banned copy pattern in ${label}: ${hit}`);
}

function baseStyle(accent) {
  return `
    :root {
      --ink: #08090b;
      --paper: #fbfbf7;
      --muted: #858b97;
      --accent: ${accent};
      --accent-soft: color-mix(in srgb, var(--accent) 28%, transparent);
      --grid: color-mix(in srgb, var(--accent) 22%, transparent);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      min-height: 100%;
      background: #e7e7e0;
      color: var(--ink);
      font-family: Inter, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    }
    .poster {
      position: relative;
      width: 900px;
      height: 1200px;
      margin: 0 auto;
      overflow: hidden;
      background:
        linear-gradient(var(--grid) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid) 1px, transparent 1px),
        radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--accent) 72%, transparent) 0 76px, transparent 77px),
        radial-gradient(circle at 86% 89%, color-mix(in srgb, var(--accent) 62%, transparent) 0 110px, transparent 111px),
        var(--paper);
      background-size: 46px 46px, 46px 46px, auto, auto, auto;
    }
    .poster::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(circle, color-mix(in srgb, var(--accent) 82%, transparent) 0 4px, transparent 5px),
        radial-gradient(circle, color-mix(in srgb, var(--accent) 42%, transparent) 0 3px, transparent 4px);
      background-size: 170px 170px, 250px 250px;
      background-position: 70px 94px, 38px 188px;
      pointer-events: none;
    }
    .brand {
      position: absolute;
      top: 48px;
      left: 56px;
      width: 340px;
      font-size: 18px;
      font-weight: 950;
      text-transform: uppercase;
      line-height: 0.98;
    }
    .brand span {
      display: block;
      margin-top: 7px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 760;
      text-transform: none;
    }
    .date {
      position: absolute;
      top: 42px;
      right: 52px;
      text-align: right;
      font-size: 76px;
      font-weight: 950;
      line-height: 0.86;
    }
    .date small {
      display: block;
      margin-top: 12px;
      color: var(--muted);
      font-size: 21px;
      font-weight: 850;
    }
    .hook {
      position: absolute;
      top: 218px;
      left: 54px;
      width: 760px;
      margin: 0;
      font-size: 66px;
      font-weight: 950;
      line-height: 0.98;
    }
    .hook em {
      display: inline-block;
      margin-top: 10px;
      padding: 0 18px 5px;
      font-style: normal;
      background: var(--accent-soft);
      box-shadow: inset 0 -16px 0 color-mix(in srgb, var(--accent) 82%, transparent);
    }
    .signal {
      position: absolute;
      z-index: 2;
      width: 330px;
      min-height: 58px;
      padding: 12px 14px 12px 15px;
      border: 1.5px solid #101010;
      background: rgba(255,255,255,0.9);
      box-shadow: 7px 7px 0 var(--accent);
      transform: rotate(var(--r));
    }
    .signal .tag {
      display: inline-block;
      margin-right: 8px;
      color: color-mix(in srgb, var(--accent) 70%, #111);
      font-size: 17px;
      font-weight: 950;
      line-height: 1;
    }
    .signal .title {
      font-size: 24px;
      font-weight: 950;
      line-height: 1.06;
    }
    .signal.hot {
      z-index: 4;
      width: 510px;
      padding: 15px 18px 16px;
      background: var(--accent);
      box-shadow: 8px 8px 0 #101010;
    }
    .signal.hot .tag { color: #111; }
    .signal.hot .title { font-size: 30px; }
    .s1 { left: 70px; top: 420px; --r: -2.8deg; }
    .s2 { left: 382px; top: 476px; width: 500px; --r: 3.2deg; }
    .s3 { left: 132px; top: 558px; --r: 2.4deg; }
    .s4 { left: 354px; top: 640px; width: 520px; --r: -2.8deg; }
    .s5 { left: 62px; top: 690px; --r: -4deg; }
    .s6 { left: 530px; top: 748px; --r: 2.2deg; }
    .s7 { left: 126px; top: 810px; --r: 2.9deg; }
    .s8 { left: 470px; top: 828px; --r: -2.4deg; }
    .s9 { left: 74px; top: 960px; --r: -1.4deg; }
    .s10 { left: 390px; top: 952px; --r: 2.8deg; }
    .s11 { left: 590px; top: 300px; --r: -5deg; }
    .s12 { left: 562px; top: 1042px; --r: -2deg; }
    .wire {
      position: absolute;
      z-index: 1;
      left: -50px;
      bottom: 90px;
      width: 1040px;
      height: 74px;
      border-top: 8px solid #050505;
      filter: drop-shadow(0 7px 0 var(--accent));
      transform: rotate(-3deg);
    }
    .wire::before {
      content: "";
      position: absolute;
      inset: -28px 0 0;
      background: repeating-linear-gradient(135deg, transparent 0 18px, #050505 18px 25px, transparent 25px 43px);
      clip-path: polygon(0 50%, 100% 12%, 100% 52%, 0 90%);
      opacity: 0.9;
    }
    .footer {
      position: absolute;
      z-index: 3;
      left: 56px;
      right: 56px;
      bottom: 42px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      font-size: 18px;
      font-weight: 850;
    }
    .footer .note {
      width: 340px;
      color: #68707c;
      font-size: 16px;
      font-weight: 720;
      line-height: 1.25;
    }`;
}

function columnPage(briefs, column, index, weeklyPicks) {
  const start = shortDate(briefs[0].date);
  const end = shortDate(briefs[briefs.length - 1].date);
  const items = selectedColumnItems(briefs, column, weeklyPicks);
  const cards = items
    .map(
      (item, i) => `<article class="pick p${i + 1}">
        <div class="meta"><b>${shortDate(item.date)}</b><span>${esc(item.sourceName || item.weekday)}</span></div>
        <h2>${esc(displayCopy(item.title))}</h2>
        <p>${esc(displayCopy(item.description))}</p>
      </article>`
    )
    .join("\n");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>一周来信 ${esc(column.title)}</title><style>
    ${baseStyle(column.accent)}
    .column-title{position:absolute;left:56px;top:150px;width:770px;margin:0;font-size:78px;font-weight:950;line-height:.92;letter-spacing:0;z-index:3}
    .column-title em{display:inline-block;margin-top:16px;padding:0 18px 9px;background:var(--accent);border:2px solid var(--ink);font-style:normal;transform:rotate(-1.6deg)}
    .deck{position:absolute;left:60px;top:330px;width:720px;margin:0;color:#626a76;font-size:22px;font-weight:820;line-height:1.35;z-index:3}
    .pick-list{position:absolute;left:56px;right:56px;top:450px;display:grid;grid-template-columns:1fr 1fr;gap:14px 18px;z-index:3}
    .pick{min-height:154px;padding:14px 15px 13px;border:1.6px solid #101010;background:rgba(255,255,255,.9);box-shadow:7px 7px 0 var(--accent);transform:rotate(var(--r))}
    .pick:nth-child(1){--r:-1.4deg}.pick:nth-child(2){--r:1.2deg}.pick:nth-child(3){--r:1.1deg}.pick:nth-child(4){--r:-1deg}
    .pick:nth-child(5){--r:-.8deg}.pick:nth-child(6){--r:1.4deg}.pick:nth-child(7){--r:1deg}.pick:nth-child(8){--r:-1.2deg}
    .meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;color:color-mix(in srgb,var(--accent) 66%,#111);font-size:15px;font-weight:950;line-height:1}
    .meta span{min-width:0;color:#7a808a;font-size:12px;font-weight:780;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pick h2{margin:0 0 7px;font-size:22px;font-weight:950;line-height:1.08;letter-spacing:0}
    .pick p{margin:0;color:#4f5662;font-size:14px;font-weight:720;line-height:1.28}
    .column-footer{position:absolute;left:56px;right:56px;bottom:42px;display:flex;align-items:flex-end;justify-content:space-between;color:#68707c;font-size:17px;font-weight:850;z-index:3}
    .column-footer b{color:#111;font-size:20px}
  </style></head><body><main class="poster">
    <div class="brand">一周来信<span>AI Industry Brief · weekly picks</span></div>
    <div class="date">${String(index + 1).padStart(2, "0")}<small>${start} · ${end}</small></div>
    <h1 class="column-title">${esc(column.title)}<br><em>${esc(displayCopy(column.headline))}</em></h1>
    <p class="deck">${esc(displayCopy(column.deck))}</p>
    <section class="pick-list">${cards}</section>
    <div class="column-footer"><b>${items.length} 条精选</b><span>COLUMN ${String(index + 1).padStart(2, "0")} / 04</span></div>
  </main></body></html>`;
}

function coverPage(briefs) {
  const start = briefs[0].date.slice(5).replace("-", ".");
  const end = briefs[6].date.slice(5).replace("-", ".");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>一周来信 Cover</title><style>
    ${baseStyle(BRAND_LAVENDER)}
    .cover-title{position:absolute;left:56px;top:190px;width:780px;font-size:112px;font-weight:950;line-height:.9;letter-spacing:0}
    .cover-title span{display:inline-block;margin-top:18px;padding:0 20px 10px;background:var(--accent);border:2px solid var(--ink);transform:rotate(-2deg)}
    .range{position:absolute;left:60px;top:498px;font-size:30px;font-weight:900;color:#6e7480}
    .phone-asset{position:absolute;left:238px;top:360px;width:640px;height:auto;transform:rotate(-8deg);filter:drop-shadow(12px 15px 0 var(--accent));z-index:2}
    .incoming{position:absolute;left:56px;bottom:64px;width:390px;font-size:34px;font-weight:950;line-height:1.05;z-index:3}
    .incoming small{display:block;margin-top:10px;color:#6e7480;font-size:18px;font-weight:800;line-height:1.18}
  </style></head><body><main class="poster">
    <div class="brand">一周来信<span>AI Industry Brief · weekly signal letters</span></div>
    <div class="date">${start}<small>${end} · 2026</small></div>
    <div class="cover-title">一周<br><span>来信</span></div>
    <div class="range">4 个栏目 · 32 条精选</div>
    <img class="phone-asset" src="${RECEIVER_ASSET_URL}" alt="">
    <div class="incoming">6 张图看完一周<small>${esc(displayCopy(dailyHeadline(briefs[0])))} → ${esc(displayCopy(dailyHeadline(briefs[6])))}</small></div>
  </main></body></html>`;
}

function recapPage(briefs, columns) {
  const lines = columns.map((column) => `<div><b>${esc(column.title)}</b>${esc(displayCopy(column.headline))}</div>`).join("");
  const end = briefs[6].date.slice(5).replace("-", ".");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>一周来信 Recap</title><style>
    ${baseStyle(BRAND_LAVENDER)}
    .end-title{position:absolute;left:56px;top:160px;width:760px;font-size:88px;font-weight:950;line-height:.9}
    .end-title span{display:inline-block;margin-top:18px;padding:0 18px 8px;background:var(--accent);border:2px solid var(--ink);transform:rotate(-1.5deg)}
    .phone-asset{position:absolute;left:218px;top:352px;width:480px;height:auto;filter:drop-shadow(13px 15px 0 var(--accent));z-index:2}
    .log{position:absolute;left:56px;right:56px;bottom:170px;display:grid;grid-template-columns:1fr 1fr;gap:16px 22px;font-size:25px;font-weight:950;line-height:1.08}
    .log b{display:block;margin-bottom:6px;color:color-mix(in srgb,var(--accent) 74%,#111);font-size:17px}
    .main-signal{position:absolute;left:56px;right:56px;bottom:42px;padding:16px 18px;background:var(--accent);border:1.8px solid var(--ink);font-size:24px;font-weight:950;line-height:1.12;box-shadow:8px 8px 0 #111}
  </style></head><body><main class="poster">
    <div class="brand">一周来信<span>end note · weekly synthesis</span></div>
    <div class="date">${end}<small>WEEK CLOSED</small></div>
    <div class="end-title">本周<br><span>留言</span></div>
    <img class="phone-asset" src="${ROTARY_ASSET_URL}" alt="">
    <section class="log">${lines}</section>
    <div class="main-signal">本周主信号：AI 正在进入真实工作的入口、账本、权限和责任里。</div>
  </main></body></html>`;
}

function write(file, html) {
  assertCopyQuality(file, html);
  fs.writeFileSync(file, html);
  return file;
}

function renderPng(htmlFile) {
  const pngFile = htmlFile.replace(/\.html$/, ".png");
  execFileSync("npx", ["playwright", "screenshot", "--viewport-size=900,1200", `file://${path.resolve(htmlFile)}`, pngFile], {
    stdio: "inherit",
  });
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) return usage();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(args.start, i));
  const briefs = dates.map(readBrief);
  const weeklyPicks = loadWeeklyPicks(args.picks);
  const columns = assignColumnColors(COLUMNS, args.colorSeed);
  const outDir = path.resolve(ROOT, args.out);
  fs.mkdirSync(outDir, { recursive: true });

  const files = [
    write(path.join(outDir, "00-cover.html"), coverPage(briefs)),
    ...columns.map((column, i) =>
      write(path.join(outDir, `${String(i + 1).padStart(2, "0")}-${column.file}.html`), columnPage(briefs, column, i, weeklyPicks))
    ),
    write(path.join(outDir, "05-recap.html"), recapPage(briefs, columns)),
  ];

  if (args.render) files.forEach(renderPng);
  console.log(`Generated ${files.length} HTML files${args.render ? " and PNGs" : ""} in ${outDir}`);
  console.log(`Weekly picks: ${weeklyPicks ? weeklyPicks.file : "fallback first 8 items per column"}`);
  console.log(`Column colors: ${columns.map((column) => `${column.title}=${column.accent}(${column.colorName})`).join(", ")}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
