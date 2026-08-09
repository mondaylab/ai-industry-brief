import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  ExternalLink,
  Eye,
  FileText,
  LayoutGrid,
  List,
  Menu,
  Palette,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import "../assets/product-header.css";
import "./papers.css";

const baseUrl = new URL(".", window.location.href);
const storageKey = "ai-brief-paper-observatory-state";
const viewStorageKey = "ai-brief-paper-observatory-view";

const filterOptions = [
  { id: "all", label: "全部" },
  { id: "focus", label: "重点观察" },
  { id: "agents", label: "Agent" },
  { id: "code", label: "含代码" },
  { id: "revision", label: "有修订" },
  { id: "tracking", label: "追踪中" },
];

const themes = [
  { id: "mono", name: "Mono", label: "中性灰", color: "#C9C9C9" },
  { id: "lilac", name: "Lilac", label: "淡紫", color: "#D9C7FF" },
  { id: "cobalt", name: "Cobalt", label: "钴蓝", color: "#B8C8FF" },
  { id: "glacier", name: "Glacier", label: "冰川青", color: "#BFE5E7" },
  { id: "mint", name: "Mint", label: "薄荷绿", color: "#C7E3D2" },
  { id: "rose", name: "Rose", label: "柔玫粉", color: "#EEC9DC" },
  { id: "signal", name: "Signal", label: "信号红", color: "#FF6B6B" },
];

const layouts = [
  { id: "magazine", label: "卡片时间线", icon: List },
  { id: "workbench", label: "紧凑列表", icon: LayoutGrid },
];

const themeIds = new Set(themes.map((theme) => theme.id));
const layoutIds = new Set(layouts.map((layout) => layout.id));

const scoreFactorLabels = {
  topicRelevance: ["主题相关", 40],
  evidence: ["来源证据", 20],
  reproducibility: ["可复现性", 15],
  methodSignal: ["方法信号", 12],
  freshness: ["时效", 10],
  multiSource: ["多源核验", 5],
};

function readPaperState() {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function readViewState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(viewStorageKey) || "{}");
    return {
      theme: themeIds.has(stored.theme) ? stored.theme : "mono",
      layout: layoutIds.has(stored.layout) ? stored.layout : "magazine",
    };
  } catch {
    return { theme: "mono", layout: "magazine" };
  }
}

function formatDate(value, options = {}) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    ...(options.weekday ? { weekday: "short" } : {}),
    ...(options.year ? { year: "numeric" } : {}),
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function formatSyncTime(value) {
  if (!value) return "尚未同步";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function levelLabel(level) {
  return { focus: "重点", watch: "观察", new: "新到" }[level] || "新到";
}

function reviewLabel(status) {
  return { "not-reviewed": "预印本", under_review: "在审", accepted: "已接收", published: "已发表" }[status] || "待核验";
}

function paperStatus(paper, state) {
  if (state?.tracking) return "持续追踪";
  if (state?.read) return "已读";
  if (paper.events?.some((event) => event.type === "revision")) return `修订 v${paper.version}`;
  return `新论文 v${paper.version}`;
}

function ThemePicker({ theme, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function close(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const activeTheme = themes.find((item) => item.id === theme) || themes[0];

  return (
    <div className="paper-theme-picker" ref={rootRef}>
      <button
        className="round-command"
        type="button"
        aria-label="选择页面色板"
        aria-expanded={open}
        title="选择页面色板"
        onClick={() => setOpen((value) => !value)}
      >
        <Palette size={17} strokeWidth={1.8} />
      </button>
      {open && (
        <div className="paper-theme-menu" role="menu" aria-label="选择论文观察室色板">
          <div className="theme-menu-title">
            <span>VISUAL PALETTE</span>
            <b>{activeTheme.name}</b>
          </div>
          <p>默认保持黑白灰，也可以沿用 AI 早报的七色阅读系统。</p>
          <div className="paper-theme-grid">
            {themes.map((item) => (
              <button
                key={item.id}
                type="button"
                className="paper-theme-swatch"
                style={{ "--swatch": item.color }}
                aria-label={`${item.name} · ${item.label} · ${item.color}`}
                aria-checked={theme === item.id}
                role="menuitemradio"
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
              >
                {theme === item.id && <Check size={14} strokeWidth={2.5} />}
              </button>
            ))}
          </div>
          <div className="theme-menu-meta"><span>{activeTheme.label}</span><code>{activeTheme.color}</code></div>
        </div>
      )}
    </div>
  );
}

function Header({ health }) {
  const healthy = health?.status === "healthy";
  return (
    <header className="product-header">
      <a className="product-brand" href="./" aria-label="The AI Industry Brief 首页">
        <span className="product-brand-mark"><Radio size={16} strokeWidth={1.8} /></span>
        <span><b>The AI Industry Brief</b><small>MONDAYLAB EDITORIAL INTELLIGENCE</small></span>
      </a>
      <nav className="product-global-nav" aria-label="产品主导航">
        <a href="./">首页</a>
        <a href="reader.html">今日简报</a>
        <a className="is-active" href="papers.html" aria-current="page">论文观察室</a>
      </nav>
      <div className={`product-header-status ${healthy ? "is-live" : "is-degraded"}`} aria-label="论文观察室状态">
        <i />
        <span>{healthy ? "官方论文源监听正常" : "论文数据暂有延迟"}</span>
      </div>
    </header>
  );
}

function StreamControls({ health, trackedCount, layout, theme, onLayoutChange, onThemeChange, onOpenSources, onRefresh, refreshing }) {
  const healthy = health?.status === "healthy";
  return (
    <div className="paper-stream-controls" aria-label="论文列表显示设置">
      <div className="paper-stream-status">
        <span className={`monitor-pill ${healthy ? "is-live" : "is-degraded"}`} aria-live="polite">
          <i />
          <span>{healthy ? "论文监听正常" : "使用成功快照"}</span>
        </span>
        <span className="tracked-pill"><Eye size={14} /><b>{trackedCount}</b><span>追踪中</span></span>
      </div>
      <div className="layout-switch" role="group" aria-label="选择论文列表版式">
        {layouts.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            aria-pressed={layout === id}
            className={layout === id ? "is-active" : ""}
            key={id}
            onClick={() => onLayoutChange(id)}
          >
            <Icon size={14} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="paper-stream-actions">
        <ThemePicker theme={theme} onChange={onThemeChange} />
        <button className="round-command" type="button" onClick={onOpenSources} title="查看优质信源" aria-label="查看优质信源"><Menu size={18} /></button>
        <button className="round-command" type="button" onClick={onRefresh} disabled={refreshing} title="检查论文快照" aria-label="检查论文快照">
          <RefreshCw size={16} className={refreshing ? "is-spinning" : ""} />
        </button>
      </div>
    </div>
  );
}

function SourceSheet({ config, health, onClose }) {
  const liveHealth = new Map((health?.sources || []).map((source) => [source.id, source]));
  return (
    <aside className="paper-source-sheet" role="dialog" aria-modal="true" aria-labelledby="source-sheet-title">
      <header className="sheet-header">
        <div><span>SOURCE LEDGER</span><h2 id="source-sheet-title">优质信源账本</h2></div>
        <button className="round-command" type="button" onClick={onClose} aria-label="关闭信源列表" autoFocus><X size={18} /></button>
      </header>
      <div className="sheet-scroll">
        <section className="source-principle">
          <ShieldCheck size={20} />
          <div><b>原始来源优先</b><p>发现、同行评审和社区热度分层处理，不把一种信号误当成全部证据。</p></div>
        </section>
        <div className="paper-source-list">
          {config.sources.map((source) => {
            const sourceHealth = liveHealth.get(source.id);
            return (
              <a className={`paper-source-card ${source.availability === "live" ? "is-live" : ""}`} href={source.url} target="_blank" rel="noreferrer" key={source.id}>
                <span className="source-card-top"><b>{source.name}</b><em>{source.tier} · {source.role}</em></span>
                <p>{source.description}</p>
                <span className="source-card-foot"><i className={`source-health ${sourceHealth?.status || source.availability}`} />{sourceHealth?.status === "healthy" ? "正在监听" : "按需核验"}<ExternalLink size={12} /></span>
              </a>
            );
          })}
        </div>
        <section className="source-policy">
          <span>EDITORIAL SOURCE POLICY</span>
          {config.sourcePolicy.map((item, index) => <p key={item}><b>{String(index + 1).padStart(2, "0")}</b>{item}</p>)}
        </section>
      </div>
    </aside>
  );
}

function Hero({ manifest, health, papers, trackedCount, onOpenSources }) {
  const latestCount = manifest.days?.[0]?.paperCount || 0;
  const focusCount = papers.filter((paper) => paper.score.level === "focus").length;
  const metrics = [
    { value: papers.length, label: "近 30 天论文快照" },
    { value: latestCount, label: "最新批次新到" },
    { value: focusCount, label: "重点观察信号" },
  ];
  const healthy = health?.status === "healthy";

  return (
    <section className="papers-hero">
      <div className="papers-hero-copy">
        <span className="editorial-kicker">AI PAPER OBSERVATORY · {manifest.latestPaperDate || "--"}</span>
        <h1>追踪真正改变<br />AI 方向的论文。</h1>
        <p>从官方原始来源开始，按时间线观察新论文、版本修订和评审状态。优先级只帮助编辑筛选，不替代同行评审。</p>
        <div className="hero-actions">
          <a className="pill-button primary" href="#paper-stream">开始阅读</a>
          <button className="pill-button" type="button" onClick={onOpenSources}>查看信源标准<ChevronRight size={15} /></button>
        </div>
        <div className="hero-metrics" aria-label="论文观察室概览">
          {metrics.map((item) => <div className="hero-metric" key={item.label}><strong>{String(item.value).padStart(2, "0")}</strong><span>{item.label}</span></div>)}
        </div>
      </div>
      <aside className="hero-monitor-card">
        <div className="monitor-card-top">
          <span>LIVE MONITOR</span>
          <i className={healthy ? "is-live" : "is-degraded"} />
        </div>
        <div className="monitor-card-copy">
          <span>{healthy ? "OFFICIAL DATA SYNCED" : "LAST GOOD SNAPSHOT"}</span>
          <strong>{manifest.paperCount}</strong>
          <p>papers observed</p>
        </div>
        <div className="monitor-card-ledger">
          <div><span>最近同步</span><b>{formatSyncTime(manifest.lastSuccessfulAt)}</b></div>
          <div><span>更新频率</span><b>{manifest.cadence}</b></div>
          <div><span>主监听源</span><b>{manifest.liveSourceCount} · arXiv</b></div>
          <div><span>个人追踪</span><b>{trackedCount} 篇</b></div>
        </div>
      </aside>
    </section>
  );
}

function FilterToolbar({ query, onQueryChange, topic, onTopicChange, filter, onFilterChange, topics, resultCount }) {
  return (
    <div className="paper-toolbar">
      <label className="paper-search">
        <Search size={17} />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索标题、摘要、作者或 arXiv 分类" />
      </label>
      <label className="topic-select">
        <span className="sr-only">选择研究主题</span>
        <select value={topic} onChange={(event) => onTopicChange(event.target.value)}>
          <option value="all">全部研究主题</option>
          {topics.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>
      </label>
      <div className="paper-filter-tabs" role="group" aria-label="论文筛选">
        {filterOptions.map((item) => (
          <button
            type="button"
            aria-pressed={filter === item.id}
            className={filter === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => onFilterChange(item.id)}
          >{item.label}</button>
        ))}
      </div>
      <span className="result-count"><b>{resultCount}</b> RESULTS</span>
    </div>
  );
}

function PaperCard({ paper, selected, state, topicLabels, onSelect }) {
  const hasRevision = paper.events?.some((event) => event.type === "revision");
  return (
    <button className={`paper-card ${selected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <span className="paper-card-rail" aria-hidden="true" />
      <span className="paper-card-topline">
        <span className={`score-badge ${paper.score.level}`}><b>{paper.score.total}</b><small>{levelLabel(paper.score.level)}</small></span>
        <span className="paper-card-time"><b>{formatTime(paper.publishedAt)}</b><small>{hasRevision ? `更新于 ${formatDate(paper.updatedAt)}` : `首次发布 · v${paper.version}`}</small></span>
        <span className={`paper-workflow ${state?.tracking ? "tracking" : state?.read ? "read" : hasRevision ? "revision" : "new"}`}>{paperStatus(paper, state)}</span>
      </span>
      <span className="paper-card-copy">
        <span className="paper-card-eyebrow">{paper.primaryCategory} · {paper.source.name} · {reviewLabel(paper.peerReviewStatus)}</span>
        <b className="paper-card-title">{paper.title}</b>
        <span className="paper-card-abstract">{paper.abstract}</span>
      </span>
      <span className="paper-card-bottom">
        <span className="topic-chips">{paper.topics.map((topic) => <em key={topic}>{topicLabels.get(topic) || topic}</em>)}</span>
        <span className="paper-card-author"><b>{paper.authors[0]}</b><small>{paper.authors.length > 1 ? `等 ${paper.authors.length} 位作者` : "单一作者"}</small></span>
        <span className="paper-card-arrow"><ChevronRight size={17} /></span>
      </span>
    </button>
  );
}

function ObservatorySidebar({ manifest, health, papers, trackedCount, topicLabels, onSelect, onOpenSources }) {
  const focusPapers = papers.filter((paper) => paper.score.level === "focus").slice(0, 3);
  const stages = [
    ["发现", manifest.paperCount],
    ["归类", new Set(papers.flatMap((paper) => paper.topics || [])).size],
    ["重点", papers.filter((paper) => paper.score.level === "focus").length],
    ["追踪", trackedCount],
  ];
  return (
    <aside className="observatory-sidebar">
      <section className="sidebar-card watch-card">
        <header><span>TODAY'S WATCH</span><Sparkles size={16} /></header>
        <h2>今日观察</h2>
        <div className="sidebar-watch-list">
          {focusPapers.map((paper, index) => (
            <button type="button" onClick={() => onSelect(paper)} key={paper.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{paper.title}</b>
              <small>{topicLabels.get(paper.topics[0]) || paper.primaryCategory}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="sidebar-card pipeline-card">
        <header><span>OBSERVATION FLOW</span><Activity size={16} /></header>
        <div className="sidebar-pipeline">
          {stages.map(([label, value], index) => <div key={label}><i>{String(index + 1).padStart(2, "0")}</i><span>{label}</span><b>{value}</b></div>)}
        </div>
      </section>
      <section className="sidebar-card source-card">
        <header><span>SOURCE HEALTH</span><span className={`source-status-dot ${health.status}`} /></header>
        <h3>{health.status === "healthy" ? "官方数据监听正常" : "当前使用成功快照"}</h3>
        <p>以 arXiv 官方元数据为主监听，OpenReview 和官方论文集用于评审状态核验。</p>
        <button className="text-command" type="button" onClick={onOpenSources}>查看完整信源账本<ChevronRight size={14} /></button>
      </section>
    </aside>
  );
}

function DetailPanel({ paper, state, topicLabels, onClose, onToggleTracking, onToggleRead }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [paper?.id]);

  if (!paper) return null;
  return (
    <aside className="paper-detail" role="dialog" aria-modal="true" aria-labelledby="paper-detail-title" ref={panelRef}>
      <header className="sheet-header paper-detail-head">
        <div><span>PAPER DETAIL</span><b>{paper.identifiers.arxiv}</b></div>
        <button className="round-command" type="button" onClick={onClose} aria-label="关闭论文详情" autoFocus><X size={18} /></button>
      </header>
      <div className="detail-scroll">
        <section className="detail-intro">
          <div className="detail-intro-meta">
            <span className={`detail-score ${paper.score.level}`}>{paper.score.total}</span>
            <span>{levelLabel(paper.score.level)} · 观察优先级</span>
          </div>
          <span className="paper-detail-topics">{paper.topics.map((topic) => topicLabels.get(topic) || topic).join(" / ")}</span>
          <h2 id="paper-detail-title">{paper.title}</h2>
          <div className="watch-reason"><Eye size={17} /><p>{paper.whyWatch}</p></div>
          <p className="paper-abstract">{paper.abstract}</p>
          <div className="resource-links">
            <a href={paper.resources.paper} target="_blank" rel="noreferrer"><FileText size={15} />论文原页<ExternalLink size={12} /></a>
            <a href={paper.resources.pdf} target="_blank" rel="noreferrer"><BookOpen size={15} />PDF<ExternalLink size={12} /></a>
            {paper.resources.code && <a href={paper.resources.code} target="_blank" rel="noreferrer"><Code2 size={15} />代码<ExternalLink size={12} /></a>}
            {paper.resources.project && <a href={paper.resources.project} target="_blank" rel="noreferrer"><LayoutGrid size={15} />项目页<ExternalLink size={12} /></a>}
          </div>
        </section>
        <section className="detail-card paper-ledger">
          <header><span>PAPER LEDGER</span><b>{reviewLabel(paper.peerReviewStatus)}</b></header>
          <div className="authors-cell"><span>作者</span><b>{paper.authors.join(" · ")}</b></div>
          <div><span>首次发布</span><b>{formatDate(paper.publishedAt, { year: true })}</b></div>
          <div><span>最近更新</span><b>{formatDate(paper.updatedAt, { year: true })} · v{paper.version}</b></div>
          <div><span>主分类</span><b>{paper.primaryCategory}</b></div>
          <div><span>来源</span><b>{paper.source.name}</b></div>
        </section>
        <section className="detail-card paper-events">
          <header><span>TIMELINE EVENTS</span><b>{paper.events.length}</b></header>
          {paper.events.slice().reverse().map((event, index) => (
            <div className="event-row" key={`${event.type}-${event.occurredAt}-${index}`}>
              <i />
              <div><b>{event.type === "revision" ? `版本更新至 v${paper.version}` : "首次进入观察室"}</b><span>{formatSyncTime(event.occurredAt)}</span></div>
            </div>
          ))}
        </section>
        <section className="detail-card paper-score-breakdown">
          <header><span>PRIORITY BREAKDOWN</span><b>{paper.score.total}/100</b></header>
          {Object.entries(paper.score.factors).map(([factor, value]) => {
            const [label, max] = scoreFactorLabels[factor] || [factor, 20];
            return <div className="paper-factor" key={factor}><span>{label}</span><i><b style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></i><strong>{value}</strong></div>;
          })}
          <p>{paper.score.note}</p>
        </section>
        <section className="paper-actions">
          <span>个人观察状态仅保存在当前浏览器</span>
          <button type="button" className={state?.tracking ? "is-active" : ""} onClick={onToggleTracking}><Eye size={16} />{state?.tracking ? "取消持续追踪" : "持续追踪"}</button>
          <button type="button" className={state?.read ? "is-active" : ""} onClick={onToggleRead}><Check size={16} />{state?.read ? "标记为未读" : "标记已读"}</button>
        </section>
      </div>
    </aside>
  );
}

export function PaperObservatory({ embedded = false }) {
  const [config, setConfig] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [health, setHealth] = useState(null);
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [paperState, setPaperState] = useState(readPaperState);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [initialView] = useState(readViewState);
  const [theme, setTheme] = useState(initialView.theme);
  const [layout, setLayout] = useState(initialView.layout);
  const requestId = useRef(0);
  const lastTriggerRef = useRef(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const stamp = Date.now();
      const [configResponse, manifestResponse, healthResponse] = await Promise.all([
        fetch(new URL(`papers-data/config.json?v=${stamp}`, baseUrl)),
        fetch(new URL(`papers-data/manifest.json?v=${stamp}`, baseUrl)),
        fetch(new URL(`papers-data/health.json?v=${stamp}`, baseUrl)),
      ]);
      if (![configResponse, manifestResponse, healthResponse].every((response) => response.ok)) throw new Error("metadata");
      const [nextConfig, nextManifest, nextHealth] = await Promise.all([configResponse.json(), manifestResponse.json(), healthResponse.json()]);
      const dayPayloads = await Promise.all(nextManifest.days.map(async (day) => {
        const response = await fetch(new URL(`${day.dataUrl}?v=${stamp}`, baseUrl));
        if (!response.ok) throw new Error(day.dataUrl);
        return response.json();
      }));
      if (requestId.current !== currentRequest) return;
      const nextPapers = dayPayloads.flatMap((day) => day.papers || []).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      setConfig(nextConfig);
      setManifest(nextManifest);
      setHealth(nextHealth);
      setPapers(nextPapers);
      setSelectedId((current) => current && nextPapers.some((paper) => paper.id === current) ? current : nextPapers[0]?.id || "");
      setError("");
    } catch {
      if (requestId.current === currentRequest) setError("论文时间线暂时无法加载，请稍后重试。");
    } finally {
      if (requestId.current === currentRequest) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!config) return undefined;
    const interval = window.setInterval(() => loadData({ silent: true }), config.clientRefreshMinutes * 60_000);
    const onVisibility = () => { if (document.visibilityState === "visible") loadData({ silent: true }); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [config, loadData]);

  useEffect(() => { window.localStorage.setItem(storageKey, JSON.stringify(paperState)); }, [paperState]);
  useEffect(() => { window.localStorage.setItem(viewStorageKey, JSON.stringify({ theme, layout })); }, [theme, layout]);
  useEffect(() => { setVisibleLimit(60); }, [query, topic, filter]);

  useEffect(() => {
    if (!sourceOpen && !detailOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleModalKeys(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSourceOpen(false);
        setDetailOpen(false);
        window.requestAnimationFrame(() => lastTriggerRef.current?.focus?.());
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector(".paper-source-sheet, .paper-detail");
      const focusable = [...(dialog?.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])") || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleModalKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleModalKeys);
    };
  }, [sourceOpen, detailOpen]);

  const topicLabels = useMemo(() => new Map((config?.topics || []).map((item) => [item.id, item.label])), [config]);
  const visiblePapers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return papers.filter((paper) => {
      const state = paperState[paper.id] || {};
      if (topic !== "all" && !paper.topics.includes(topic)) return false;
      if (filter === "focus" && paper.score.level !== "focus") return false;
      if (filter === "agents" && !paper.topics.includes("agents-reasoning")) return false;
      if (filter === "code" && !paper.resources?.code) return false;
      if (filter === "revision" && !paper.events?.some((event) => event.type === "revision")) return false;
      if (filter === "tracking" && !state.tracking) return false;
      if (normalized && !`${paper.title} ${paper.abstract} ${paper.authors.join(" ")} ${paper.categories.join(" ")}`.toLowerCase().includes(normalized)) return false;
      return true;
    });
  }, [papers, paperState, query, topic, filter]);

  const renderedPapers = visiblePapers.slice(0, visibleLimit);
  const groupedPapers = useMemo(() => renderedPapers.reduce((groups, paper) => {
    const day = paper.publishedAt.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(paper);
    return groups;
  }, new Map()), [renderedPapers]);
  const visibleDayCounts = useMemo(() => visiblePapers.reduce((counts, paper) => {
    const day = paper.publishedAt.slice(0, 10);
    counts.set(day, (counts.get(day) || 0) + 1);
    return counts;
  }, new Map()), [visiblePapers]);
  const selected = papers.find((paper) => paper.id === selectedId) || visiblePapers[0] || null;
  const trackedCount = Object.values(paperState).filter((state) => state.tracking).length;

  function updateSelectedState(patch) {
    if (!selected) return;
    setPaperState((current) => ({ ...current, [selected.id]: { ...(current[selected.id] || {}), ...patch } }));
  }

  function selectPaper(paper) {
    lastTriggerRef.current = document.activeElement;
    setSelectedId(paper.id);
    setSourceOpen(false);
    setDetailOpen(true);
  }

  function openSources() {
    lastTriggerRef.current = document.activeElement;
    setDetailOpen(false);
    setSourceOpen(true);
  }

  function closePanels() {
    setSourceOpen(false);
    setDetailOpen(false);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus?.());
  }

  if (loading && !manifest) return <div className="papers-loading"><BookOpen size={24} /><span>正在连接论文时间线</span></div>;
  if (error && !manifest) return <div className="papers-fatal"><BookOpen size={24} /><b>论文观察室</b><span>{error}</span><button type="button" onClick={() => loadData()}>重新加载</button></div>;

  const observatoryContent = (
    <main>
      <Hero manifest={manifest} health={health} papers={papers} trackedCount={trackedCount} onOpenSources={openSources} />
      <section className="paper-stream" id="paper-stream">
        <header className="stream-heading">
          <div><span>CONTINUOUS TIMELINE</span><h2>论文时间线</h2></div>
          <p>新的论文和版本修订会依照首次发布时间进入这里。点击任意卡片查看来源、观察理由与版本事件。</p>
        </header>
        <StreamControls
          health={health}
          trackedCount={trackedCount}
          layout={layout}
          theme={theme}
          onLayoutChange={setLayout}
          onThemeChange={setTheme}
          onOpenSources={openSources}
          onRefresh={() => loadData({ silent: true })}
          refreshing={refreshing}
        />
        <FilterToolbar
          query={query}
          onQueryChange={setQuery}
          topic={topic}
          onTopicChange={setTopic}
          filter={filter}
          onFilterChange={setFilter}
          topics={config.topics}
          resultCount={visiblePapers.length}
        />
        <div className="paper-stage">
          <div className="paper-list">
            {[...groupedPapers.entries()].map(([day, dayPapers]) => (
              <section className="timeline-group" key={day} aria-labelledby={`day-${day}`}>
                <header className="timeline-day" id={`day-${day}`}>
                  <span>{formatDate(day, { weekday: true })}</span>
                  <b>{formatDate(day, { year: true })}</b>
                  <small>{visibleDayCounts.get(day) || dayPapers.length} PAPERS</small>
                </header>
                <div className="timeline-cards">
                  {dayPapers.map((paper) => (
                    <PaperCard
                      key={paper.id}
                      paper={paper}
                      selected={detailOpen && selected?.id === paper.id}
                      state={paperState[paper.id]}
                      topicLabels={topicLabels}
                      onSelect={() => selectPaper(paper)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {!visiblePapers.length && <div className="paper-empty"><Search size={24} /><b>没有符合条件的论文</b><span>调整关键词、主题或观察状态。</span></div>}
            {visibleLimit < visiblePapers.length && <button className="load-more" type="button" onClick={() => setVisibleLimit((current) => current + 60)}>继续加载 · 尚有 {visiblePapers.length - visibleLimit} 篇</button>}
          </div>
          <ObservatorySidebar
            manifest={manifest}
            health={health}
            papers={papers}
            trackedCount={trackedCount}
            topicLabels={topicLabels}
            onSelect={selectPaper}
            onOpenSources={openSources}
          />
        </div>
      </section>
    </main>
  );

  return (
    <div className={`papers-app ${embedded ? "is-embedded" : ""}`} data-theme={theme} data-layout={layout}>
      {embedded ? observatoryContent : (
        <div className="papers-page">
          <div className="papers-shell">
          <Header health={health} />
          {observatoryContent}
          <footer className="papers-footer">
            <span>THE AI INDUSTRY BRIEF · PAPER OBSERVATORY</span>
            <span>官方来源优先 · 时间线持续更新</span>
          </footer>
        </div>
        </div>
      )}
      {sourceOpen && <SourceSheet config={config} health={health} onClose={closePanels} />}
      {detailOpen && (
        <DetailPanel
          paper={selected}
          state={selected ? paperState[selected.id] : null}
          topicLabels={topicLabels}
          onClose={closePanels}
          onToggleTracking={() => updateSelectedState({ tracking: !paperState[selected.id]?.tracking })}
          onToggleRead={() => updateSelectedState({ read: !paperState[selected.id]?.read })}
        />
      )}
      {(sourceOpen || detailOpen) && <button className="paper-backdrop" type="button" aria-label="关闭面板" onClick={closePanels} />}
    </div>
  );
}

const papersRoot = document.getElementById("root");
if (papersRoot?.dataset.app === "papers") {
  createRoot(papersRoot).render(<React.StrictMode><PaperObservatory /></React.StrictMode>);
}
