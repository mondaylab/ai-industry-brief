import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  Clock,
  Database,
  ExternalLink,
  Eye,
  Menu,
  Plus,
  Radio,
  RotateCcw,
  Search,
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

function formatDate(value) {
  const date = String(value || "");
  return date ? date.slice(5).replace("-", ".") : "--";
}

function scoreLabel(strength) {
  return { strong: "强", medium: "中", weak: "弱" }[strength] || "--";
}

function statusLabel(status) {
  return { queued: "已加入", tracking: "追踪中", dismissed: "已忽略", published: "已刊登" }[status] || "待处理";
}

function sourceTierLabel(tier) {
  return { evidence: "一手证据", explanation: "解释来源", discovery: "发现线索" }[tier] || "来源证据";
}

function statusFor(signal, editorState) {
  return editorState[signal.id] || signal.workflowStatus || "new";
}

function Header({ snapshot, queueCount, onOpenSources }) {
  return (
    <header className="radar-header">
      <a className="radar-brand" href="./">
        <span className="radar-mark"><Radio size={16} strokeWidth={1.8} /></span>
        <span><b>热点雷达</b><small>The AI Industry Brief</small></span>
      </a>
      <div className="radar-edition">编辑情报台 / {snapshot.latestBriefDate}</div>
      <div className="radar-header-actions">
        <button className="icon-command source-toggle" type="button" onClick={onOpenSources} title="打开来源列表" aria-label="打开来源列表"><Menu size={18} /></button>
        <span className="queue-counter"><b>{queueCount}</b> 编辑队列</span>
        <a className="back-link" href="papers.html"><BookOpen size={15} />论文观察室</a>
        <a className="back-link" href="./"><ArrowLeft size={15} />返回首页</a>
      </div>
    </header>
  );
}

function SourceRail({ sources, activeSource, onSelect, open, onClose }) {
  return (
    <aside className={`source-rail ${open ? "is-open" : ""}`} aria-label="信息来源">
      <div className="source-rail-head">
        <div><span>信息源账本</span><b>{sources.length} 个来源</b></div>
        <button className="icon-command source-close" type="button" onClick={onClose} aria-label="关闭来源列表"><X size={18} /></button>
      </div>
      <button className={`source-all ${activeSource === "" ? "is-active" : ""}`} type="button" onClick={() => onSelect("")}>
        <span>全部来源</span><b>{sources.reduce((sum, source) => sum + source.signalCount, 0)}</b>
      </button>
      <div className="source-list">
        {sources.map((source) => (
          <button className={`source-row ${activeSource === source.domain ? "is-active" : ""}`} type="button" key={source.domain} onClick={() => onSelect(source.domain)}>
            <span className={`freshness-dot ${source.freshness}`} aria-hidden="true" />
            <span className="source-copy"><b>{source.domain}</b><small>{formatDate(source.latestPublishedAt)} · {source.signalCount} 条</small></span>
            <span className="source-age">{source.ageDays}d</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function Pipeline({ pipeline }) {
  return (
    <section className="pipeline" aria-label="Agent 流水线">
      <div className="pipeline-title"><Bot size={17} /><span>Agent 流水线</span></div>
      <div className="pipeline-stages">
        {pipeline.map((stage, index) => (
          <div className="pipeline-stage" key={stage.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><b>{stage.name}</b><small>{stage.status === "manual" ? "人工确认" : "已就绪"}</small></div>
            <strong>{stage.count}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metrics({ snapshot, queueCount, trackingCount }) {
  const items = [
    { label: "信号", value: snapshot.metrics.signalCount, icon: Activity },
    { label: "强信号", value: snapshot.metrics.strongCount, icon: Radio },
    { label: "来源", value: snapshot.metrics.sourceCount, icon: Database },
    { label: "追踪中", value: trackingCount, icon: Eye },
    { label: "待编队列", value: queueCount, icon: Plus },
  ];
  return <div className="metrics-strip">{items.map(({ label, value, icon: Icon }) => <div className="metric" key={label}><Icon size={15} /><span>{label}</span><b>{String(value).padStart(2, "0")}</b></div>)}</div>;
}

function SignalRow({ signal, status, selected, onSelect }) {
  return (
    <button className={`signal-row-button ${selected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <span className={`score-cell ${signal.score.strength}`}><b>{signal.score.total}</b><small>{scoreLabel(signal.score.strength)}</small></span>
      <span className="signal-date"><b>{formatDate(signal.publishedAt)}</b><small>收录 {formatDate(signal.discoveredAt)}</small></span>
      <span className="signal-copy"><b>{signal.title}</b><small>{signal.description}</small></span>
      <span className="signal-section">{signal.section.replace(/^AI\s*/, "")}</span>
      <span className="signal-source"><b>{signal.domain}</b><small>{sourceTierLabel(signal.sourceTier)}</small></span>
      <span className={`workflow-status ${status}`}>{statusLabel(status)}</span>
    </button>
  );
}

function DetailPanel({ signal, status, onAction, mobileOpen, onClose }) {
  if (!signal) return <aside className="detail-panel empty"><Radio size={28} /><b>选择一条信号</b><span>查看来源、评分依据和编辑动作。</span></aside>;
  const factors = [
    ["时效", signal.score.factors.freshness, 34],
    ["证据", signal.score.factors.evidence, 24],
    ["元数据", signal.score.factors.metadata, 9],
    ["Agent", signal.score.factors.agentRelevance, 10],
    ["共振", signal.score.factors.resonance, 10],
    ["编辑价值", signal.score.factors.editorial, 14],
  ];
  return (
    <aside className={`detail-panel ${mobileOpen ? "is-open" : ""}`} aria-label="信号详情">
      <header className="detail-head">
        <div><span>信号详情</span><b>{signal.id}</b></div>
        <button className="icon-command detail-close" type="button" onClick={onClose} aria-label="关闭详情"><X size={18} /></button>
      </header>
      <div className={`detail-score ${signal.score.strength}`}><b>{signal.score.total}</b><span>{scoreLabel(signal.score.strength)}信号</span></div>
      <div className="detail-body">
        <span className="detail-section">{signal.section}</span>
        <h2>{signal.title}</h2>
        <p>{signal.description}</p>
        <a className="source-link" href={signal.sourceUrl} target="_blank" rel="noreferrer">打开原始来源 <ExternalLink size={14} /></a>
      </div>
      <div className="detail-ledger">
        <div><span>公司 / 产品</span><b>{signal.company}</b></div>
        <div><span>来源发布</span><b>{signal.publishedAt}</b></div>
        <div><span>简报收录</span><b>{signal.discoveredAt}</b></div>
        <div><span>主题簇</span><b>{signal.topicCluster}</b></div>
      </div>
      <div className="score-breakdown">
        <div className="breakdown-head"><span>评分明细</span><b>{signal.score.total}/100</b></div>
        {factors.map(([label, value, max]) => <div className="factor" key={label}><span>{label}</span><i><b style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></i><strong>{value}</strong></div>)}
      </div>
      <div className="editor-actions">
        <span>编辑动作 · {statusLabel(status)}</span>
        <button type="button" className={status === "queued" ? "is-active" : ""} onClick={() => onAction("queued")}><Plus size={15} />加入今日简报</button>
        <button type="button" className={status === "tracking" ? "is-active" : ""} onClick={() => onAction("tracking")}><Eye size={15} />持续追踪</button>
        <button type="button" className={status === "dismissed" ? "is-active" : ""} onClick={() => onAction("dismissed")}><X size={15} />忽略</button>
        {status !== signal.workflowStatus && <button type="button" className="reset-action" onClick={() => onAction(null)}><RotateCcw size={14} />恢复初始状态</button>}
      </div>
    </aside>
  );
}

function RadarApp() {
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

  useEffect(() => {
    fetch(new URL("radar-data/snapshot.json", baseUrl))
      .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
      .then((value) => { setSnapshot(value); setSelectedId(value.signals[0]?.id || ""); })
      .catch(() => setError("Radar 快照加载失败。"));
  }, []);

  useEffect(() => { window.localStorage.setItem(storageKey, JSON.stringify(editorState)); }, [editorState]);

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

  function selectSignal(signal) { setSelectedId(signal.id); setDetailOpen(true); }
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

  return (
    <div className="radar-app">
      <Header snapshot={snapshot} queueCount={queueCount} onOpenSources={() => setSourceOpen(true)} />
      <div className="radar-layout">
        <SourceRail sources={snapshot.sources} activeSource={source} onSelect={(value) => { setSource(value); setSourceOpen(false); }} open={sourceOpen} onClose={() => setSourceOpen(false)} />
        <main className="radar-main">
          <section className="radar-intro">
            <div><span>AI 信号观察站</span><h1>热点进入简报前，先经过这里。</h1></div>
            <p>{snapshot.modeNote}</p>
          </section>
          <Pipeline pipeline={snapshot.pipeline} />
          <Metrics snapshot={snapshot} queueCount={queueCount} trackingCount={trackingCount} />
          <section className="signal-workbench">
            <div className="workbench-tools">
              <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、产品、主题或来源" /></label>
              <label className="section-select"><span className="sr-only">选择栏目</span><select value={section} onChange={(event) => setSection(event.target.value)}><option value="all">全部栏目</option>{snapshot.sections.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
              <div className="filter-tabs" role="tablist" aria-label="信号筛选">{filters.map((item) => <button type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? "is-active" : ""} key={item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
            </div>
            <div className="table-head"><span>评分</span><span>时间</span><span>新闻信号</span><span>栏目</span><span>来源</span><span>状态</span></div>
            <div className="signal-list">
              {visibleSignals.map((signal) => <SignalRow key={signal.id} signal={signal} status={statusFor(signal, editorState)} selected={selected?.id === signal.id} onSelect={() => selectSignal(signal)} />)}
              {!visibleSignals.length && <div className="empty-results"><Search size={22} /><b>没有符合条件的信号</b><span>调整搜索词、栏目或来源筛选。</span></div>}
            </div>
          </section>
        </main>
        <DetailPanel signal={selected} status={selected ? statusFor(selected, editorState) : ""} onAction={setAction} mobileOpen={detailOpen} onClose={() => setDetailOpen(false)} />
      </div>
      {(sourceOpen || detailOpen) && <button className="mobile-backdrop" type="button" aria-label="关闭面板" onClick={() => { setSourceOpen(false); setDetailOpen(false); }} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><RadarApp /></React.StrictMode>);
