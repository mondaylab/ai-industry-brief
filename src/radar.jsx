import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Eye,
  Menu,
  Plus,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import "./radar.css";

const baseUrl = new URL(".", window.location.href);
const storageKey = "ai-brief-radar-editor-state";
const filters = [
  { id: "all", label: "全部" },
  { id: "strong", label: "强信号" },
  { id: "agent", label: "Agent" },
  { id: "tracking", label: "追踪中" },
];

function readEditorState() {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function formatDate(value, withYear = false) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(new Date(value));
}

function scoreLabel(strength) {
  return { strong: "强信号", medium: "观察", weak: "线索" }[strength] || "待评估";
}

function statusLabel(status) {
  return { queued: "已加入", tracking: "追踪中", dismissed: "已忽略", published: "已刊登", new: "待处理" }[status] || "待处理";
}

function sourceTierLabel(tier) {
  return { evidence: "一手证据", primary: "原始来源", explanation: "解释来源", discovery: "发现线索" }[tier] || "来源证据";
}

function statusFor(signal, editorState) {
  return editorState[signal.id] || signal.workflowStatus || "new";
}

function StandaloneHeader({ queueCount, onOpenSources }) {
  return (
    <header className="radar-product-header">
      <a className="radar-product-brand" href="./" aria-label="The AI Industry Brief 首页">
        <span><Radio size={16} strokeWidth={1.8} /></span>
        <span><b>The AI Industry Brief</b><small>INTELLIGENCE TRACKING</small></span>
      </a>
      <nav className="radar-product-tabs" aria-label="追踪中心视图">
        <a className="is-active" href="intelligence.html?view=radar">热点雷达</a>
        <a href="intelligence.html?view=papers">论文观察</a>
      </nav>
      <div className="radar-header-actions">
        <span><b>{queueCount}</b> 编辑队列</span>
        <button className="radar-round-command" type="button" onClick={onOpenSources} aria-label="查看信息来源"><Menu size={18} /></button>
        <a className="radar-round-command" href="./" aria-label="返回首页"><ArrowLeft size={17} /></a>
      </div>
    </header>
  );
}

function RadarHero({ snapshot, queueCount, trackingCount, onOpenSources }) {
  const metrics = [
    { value: snapshot.metrics.signalCount, label: "进入编辑观察的信号" },
    { value: snapshot.metrics.strongCount, label: "高优先级强信号" },
    { value: snapshot.metrics.sourceCount, label: "已覆盖信息来源" },
  ];

  return (
    <section className="radar-hero">
      <div className="radar-hero-copy">
        <span className="radar-kicker">LIVE INTELLIGENCE · {snapshot.latestBriefDate}</span>
        <h1>热点进入简报前，<br />先经过这里。</h1>
        <p>把行业动态拆成可验证、可追踪的编辑信号。当前数据来自已收录简报快照，来源抓取和人工核验状态会被明确区分。</p>
        <div className="radar-hero-actions">
          <a className="radar-pill-button primary" href="#radar-stream">查看追踪信号</a>
          <button className="radar-pill-button" type="button" onClick={onOpenSources}>查看来源账本<ChevronRight size={15} /></button>
        </div>
        <div className="radar-hero-metrics" aria-label="热点雷达概览">
          {metrics.map((item) => <div className="radar-hero-metric" key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
        </div>
      </div>
      <aside className="radar-monitor-card" aria-label="热点雷达状态">
        <div className="radar-monitor-top"><span>SIGNAL MONITOR</span><i /></div>
        <div className="radar-monitor-copy">
          <span>BRIEF SNAPSHOT OBSERVED</span>
          <strong>{snapshot.metrics.signalCount}</strong>
          <p>signals in observation</p>
        </div>
        <div className="radar-monitor-ledger">
          <div><span>更新至</span><b>{snapshot.latestBriefDate}</b></div>
          <div><span>强信号</span><b>{snapshot.metrics.strongCount} 条</b></div>
          <div><span>追踪中</span><b>{trackingCount} 条</b></div>
          <div><span>编辑队列</span><b>{queueCount} 条</b></div>
        </div>
      </aside>
    </section>
  );
}

function RadarToolbar({ query, onQueryChange, section, onSectionChange, filter, onFilterChange, sections, resultCount }) {
  return (
    <div className="radar-toolbar">
      <label className="radar-search">
        <Search size={17} />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="搜索公司、产品、主题或来源" />
      </label>
      <label className="radar-section-select">
        <span className="sr-only">选择栏目</span>
        <select value={section} onChange={(event) => onSectionChange(event.target.value)}>
          <option value="all">全部栏目</option>
          {sections.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
      </label>
      <div className="radar-filter-tabs" role="group" aria-label="信号筛选">
        {filters.map((item) => (
          <button type="button" aria-pressed={filter === item.id} className={filter === item.id ? "is-active" : ""} key={item.id} onClick={() => onFilterChange(item.id)}>{item.label}</button>
        ))}
      </div>
      <span className="radar-result-count"><b>{resultCount}</b> SIGNALS</span>
    </div>
  );
}

function SignalCard({ signal, status, selected, onSelect }) {
  return (
    <button className={`radar-signal-card ${selected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <span className="radar-signal-topline">
        <span className={`radar-score-badge ${signal.score.strength}`}><b>{signal.score.total}</b><small>{scoreLabel(signal.score.strength)}</small></span>
        <span className="radar-signal-date"><b>{formatDate(signal.publishedAt)}</b><small>收录于 {formatDate(signal.discoveredAt)}</small></span>
        <span className={`radar-workflow-status ${status}`}>{statusLabel(status)}</span>
      </span>
      <span className="radar-signal-copy">
        <span className="radar-signal-eyebrow">{signal.section} · {sourceTierLabel(signal.sourceTier)}</span>
        <b>{signal.title}</b>
        <span>{signal.description}</span>
      </span>
      <span className="radar-signal-bottom">
        <span className="radar-topic-chip">{signal.company}</span>
        <span className="radar-signal-source"><b>{signal.domain}</b><small>{signal.topicCluster.replaceAll("-", " ")}</small></span>
        <span className="radar-card-arrow"><ChevronRight size={17} /></span>
      </span>
    </button>
  );
}

function RadarSidebar({ snapshot, visibleSignals, onSelect, onOpenSources }) {
  const strongSignals = visibleSignals.filter((signal) => signal.score.strength === "strong").slice(0, 3);
  return (
    <aside className="radar-sidebar">
      <section className="radar-sidebar-card radar-today-card">
        <header><span>TODAY'S STRONG SIGNALS</span><Radio size={16} /></header>
        <h2>今日强信号</h2>
        <div className="radar-watch-list">
          {strongSignals.map((signal, index) => (
            <button type="button" key={signal.id} onClick={() => onSelect(signal)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{signal.title}</b>
              <small>{signal.company} · {signal.score.total} 分</small>
            </button>
          ))}
        </div>
      </section>
      <section className="radar-sidebar-card radar-pipeline-card">
        <header><span>EDITORIAL FLOW</span><Activity size={16} /></header>
        <div className="radar-pipeline-list">
          {snapshot.pipeline.map((stage, index) => (
            <div key={stage.id}><i>{String(index + 1).padStart(2, "0")}</i><span>{stage.name}</span><small>{stage.status === "manual" ? "人工核验" : "已就绪"}</small><b>{stage.count}</b></div>
          ))}
        </div>
      </section>
      <section className="radar-sidebar-card radar-source-summary">
        <header><span>SOURCE LEDGER</span><Database size={16} /></header>
        <h3>{snapshot.metrics.sourceCount} 个来源已进入观察</h3>
        <p>来源新鲜度和证据等级分开记录；快照数据不会被描述成实时抓取。</p>
        <button type="button" onClick={onOpenSources}>打开来源账本<ChevronRight size={14} /></button>
      </section>
    </aside>
  );
}

function SourceSheet({ sources, activeSource, onSelect, onClose }) {
  const total = sources.reduce((sum, source) => sum + source.signalCount, 0);
  return (
    <aside className="radar-source-sheet" role="dialog" aria-modal="true" aria-labelledby="radar-source-title">
      <header className="radar-sheet-header">
        <div><span>SOURCE LEDGER</span><h2 id="radar-source-title">信息来源账本</h2></div>
        <button className="radar-round-command" type="button" onClick={onClose} aria-label="关闭来源列表" autoFocus><X size={18} /></button>
      </header>
      <div className="radar-sheet-scroll">
        <section className="radar-source-principle">
          <ShieldCheck size={20} />
          <div><b>证据等级与新鲜度分开看</b><p>来源负责提供证据，评分负责编辑排序；两者都不等于最终事实判断。</p></div>
        </section>
        <button className={`radar-source-all ${activeSource === "" ? "is-active" : ""}`} type="button" onClick={() => onSelect("")}><span>全部来源</span><b>{total}</b></button>
        <div className="radar-source-list">
          {sources.map((source) => (
            <button className={`radar-source-card ${activeSource === source.domain ? "is-active" : ""}`} type="button" key={source.domain} onClick={() => onSelect(source.domain)}>
              <span className="radar-source-card-top"><b>{source.domain}</b><em>{sourceTierLabel(source.sourceTier)}</em></span>
              <span className="radar-source-card-meta"><i className={source.freshness} />最近发布 {formatDate(source.latestPublishedAt, true)} · {source.signalCount} 条</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function DetailDrawer({ signal, status, onAction, onClose }) {
  const panelRef = useRef(null);
  useEffect(() => { if (panelRef.current) panelRef.current.scrollTop = 0; }, [signal?.id]);
  if (!signal) return null;
  const factors = [
    ["时效", signal.score.factors.freshness, 34],
    ["证据", signal.score.factors.evidence, 24],
    ["元数据", signal.score.factors.metadata, 9],
    ["Agent", signal.score.factors.agentRelevance, 10],
    ["共振", signal.score.factors.resonance, 10],
    ["编辑价值", signal.score.factors.editorial, 14],
  ];

  return (
    <aside className="radar-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="radar-detail-title" ref={panelRef}>
      <header className="radar-sheet-header">
        <div><span>SIGNAL DETAIL</span><b>{signal.id}</b></div>
        <button className="radar-round-command" type="button" onClick={onClose} aria-label="关闭信号详情" autoFocus><X size={18} /></button>
      </header>
      <div className="radar-detail-scroll">
        <section className="radar-detail-intro">
          <div className="radar-detail-meta"><span className={`radar-detail-score ${signal.score.strength}`}>{signal.score.total}</span><span>{scoreLabel(signal.score.strength)} · 编辑优先级</span></div>
          <span className="radar-detail-section">{signal.section} / {sourceTierLabel(signal.sourceTier)}</span>
          <h2 id="radar-detail-title">{signal.title}</h2>
          <p>{signal.description}</p>
          <a href={signal.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />打开原始来源</a>
        </section>
        <section className="radar-detail-card radar-detail-ledger">
          <header><span>SIGNAL LEDGER</span><b>{statusLabel(status)}</b></header>
          <div><span>公司 / 产品</span><b>{signal.company}</b></div>
          <div><span>来源发布</span><b>{signal.publishedAt}</b></div>
          <div><span>简报收录</span><b>{signal.discoveredAt}</b></div>
          <div><span>来源</span><b>{signal.domain}</b></div>
          <div className="radar-ledger-wide"><span>主题簇</span><b>{signal.topicCluster}</b></div>
        </section>
        <section className="radar-detail-card radar-score-breakdown">
          <header><span>PRIORITY BREAKDOWN</span><b>{signal.score.total}/100</b></header>
          {factors.map(([label, value, max]) => <div className="radar-factor" key={label}><span>{label}</span><i><b style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></i><strong>{value}</strong></div>)}
        </section>
        <section className="radar-editor-actions">
          <span>编辑动作 · {statusLabel(status)}</span>
          <button type="button" className={status === "queued" ? "is-active" : ""} onClick={() => onAction("queued")}><Plus size={15} />加入今日简报</button>
          <button type="button" className={status === "tracking" ? "is-active" : ""} onClick={() => onAction("tracking")}><Eye size={15} />持续追踪</button>
          <button type="button" className={status === "dismissed" ? "is-active" : ""} onClick={() => onAction("dismissed")}><X size={15} />忽略</button>
          {status !== signal.workflowStatus && <button type="button" className="radar-reset-action" onClick={() => onAction(null)}><RotateCcw size={14} />恢复初始状态</button>}
        </section>
      </div>
    </aside>
  );
}

export function RadarApp({ embedded = false }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("all");
  const [filter, setFilter] = useState("all");
  const [source, setSource] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editorState, setEditorState] = useState(readEditorState);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const lastTriggerRef = useRef(null);

  useEffect(() => {
    fetch(new URL("radar-data/snapshot.json", baseUrl))
      .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
      .then((value) => { setSnapshot(value); setSelectedId(value.signals[0]?.id || ""); })
      .catch(() => setError("Radar 快照加载失败。"));
  }, []);

  useEffect(() => { window.localStorage.setItem(storageKey, JSON.stringify(editorState)); }, [editorState]);

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
      const dialog = document.querySelector(".radar-source-sheet, .radar-detail-drawer");
      const focusable = [...(dialog?.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])") || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleModalKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleModalKeys);
    };
  }, [sourceOpen, detailOpen]);

  const visibleSignals = useMemo(() => {
    if (!snapshot) return [];
    const normalized = query.trim().toLowerCase();
    return snapshot.signals.filter((signal) => {
      const status = statusFor(signal, editorState);
      if (source && signal.domain !== source) return false;
      if (section !== "all" && signal.section !== section) return false;
      if (filter === "strong" && signal.score.strength !== "strong") return false;
      if (filter === "agent" && signal.score.factors.agentRelevance !== 10) return false;
      if (filter === "tracking" && status !== "tracking") return false;
      if (normalized && !`${signal.title} ${signal.description} ${signal.company} ${signal.domain}`.toLowerCase().includes(normalized)) return false;
      return true;
    });
  }, [snapshot, query, section, filter, source, editorState]);

  const selected = snapshot?.signals.find((signal) => signal.id === selectedId) || visibleSignals[0] || null;
  const queueCount = Object.values(editorState).filter((status) => status === "queued").length;
  const trackingCount = Object.values(editorState).filter((status) => status === "tracking").length;

  function selectSignal(signal) {
    lastTriggerRef.current = document.activeElement;
    setSelectedId(signal.id);
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

  function setAction(nextStatus) {
    if (!selected) return;
    setEditorState((current) => {
      const next = { ...current };
      if (nextStatus) next[selected.id] = nextStatus;
      else delete next[selected.id];
      return next;
    });
  }

  if (error) return <div className="radar-fatal"><b>热点雷达</b><span>{error}</span></div>;
  if (!snapshot) return <div className="radar-loading"><Radio size={24} /><span>正在加载信号</span></div>;

  const radarContent = (
    <main>
      <RadarHero snapshot={snapshot} queueCount={queueCount} trackingCount={trackingCount} onOpenSources={openSources} />
      <section className="radar-stream" id="radar-stream">
        <header className="radar-stream-heading">
          <div><span>CONTINUOUS TRACKING</span><h2>热点追踪</h2></div>
          <p>按信号强度、证据等级和编辑动作连续观察行业变化；新闻信号和论文优先级保持各自独立。</p>
        </header>
        <RadarToolbar
          query={query}
          onQueryChange={setQuery}
          section={section}
          onSectionChange={setSection}
          filter={filter}
          onFilterChange={setFilter}
          sections={snapshot.sections}
          resultCount={visibleSignals.length}
        />
        <div className="radar-stage">
          <div className="radar-signal-list">
            {visibleSignals.map((signal) => <SignalCard key={signal.id} signal={signal} status={statusFor(signal, editorState)} selected={detailOpen && selected?.id === signal.id} onSelect={() => selectSignal(signal)} />)}
            {!visibleSignals.length && <div className="radar-empty"><Search size={24} /><b>没有符合条件的信号</b><span>调整搜索词、栏目或来源筛选。</span></div>}
          </div>
          <RadarSidebar snapshot={snapshot} visibleSignals={visibleSignals} onSelect={selectSignal} onOpenSources={openSources} />
        </div>
      </section>
    </main>
  );

  return (
    <div className={`radar-app ${embedded ? "is-embedded" : ""}`}>
      {embedded ? radarContent : (
        <div className="radar-page"><div className="radar-shell">
          <StandaloneHeader queueCount={queueCount} onOpenSources={openSources} />
          {radarContent}
          <footer className="radar-footer"><span>THE AI INDUSTRY BRIEF · SIGNAL RADAR</span><span>简报快照 · 编辑核验</span></footer>
        </div></div>
      )}
      {sourceOpen && <SourceSheet sources={snapshot.sources} activeSource={source} onSelect={(value) => { setSource(value); setSourceOpen(false); }} onClose={closePanels} />}
      {detailOpen && <DetailDrawer signal={selected} status={selected ? statusFor(selected, editorState) : ""} onAction={setAction} onClose={closePanels} />}
      {(sourceOpen || detailOpen) && <button className="radar-backdrop" type="button" aria-label="关闭面板" onClick={closePanels} />}
    </div>
  );
}

const radarRoot = document.getElementById("root");
if (radarRoot?.dataset.app === "radar") {
  createRoot(radarRoot).render(<React.StrictMode><RadarApp /></React.StrictMode>);
}
