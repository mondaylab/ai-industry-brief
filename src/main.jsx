import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ExternalLink,
  GitBranch,
  Menu,
  Palette,
  X,
} from "lucide-react";
import "./styles.css";

const themes = [
  { id: "lilac", name: "Lilac", color: "#D9C7FF" },
  { id: "cobalt", name: "Cobalt", color: "#B8C8FF" },
  { id: "glacier", name: "Glacier", color: "#BFE5E7" },
  { id: "mint", name: "Mint", color: "#C7E3D2" },
  { id: "rose", name: "Rose", color: "#EEC9DC" },
  { id: "signal", name: "Signal", color: "#FF6B6B" },
  { id: "mono", name: "Mono", color: "#C9C9C9" },
];

const themeIds = new Set(themes.map((theme) => theme.id));
const baseUrl = new URL(".", window.location.href);
const params = new URLSearchParams(window.location.search);
const captureMode = params.get("capture") === "1";

function initialTheme() {
  if (captureMode) return "lilac";
  const requested = params.get("theme");
  if (themeIds.has(requested)) return requested;
  const stored = window.localStorage.getItem("ai-brief-theme");
  return themeIds.has(stored) ? stored : "lilac";
}

function cleanTitle(title) {
  return String(title || "").replace(/\s*\|\s*/g, " ");
}

function splitDate(date) {
  const [year, month, day] = date.split("-");
  return { year, month, day };
}

function monthLabel(value) {
  const [year, month] = value.split("-");
  return `${year} / ${month}`;
}

function issueLabel(issue) {
  const { month, day } = splitDate(issue.date);
  return `${month}.${day} ${issue.weekday}`;
}

function groupIssues(issues) {
  return issues.reduce((groups, issue) => {
    const key = issue.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(issue);
    return groups;
  }, new Map());
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

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        className="icon-button"
        type="button"
        aria-label="切换主题"
        aria-expanded={open}
        title="切换主题"
        onClick={() => setOpen((value) => !value)}
      >
        <Palette size={18} strokeWidth={1.7} />
      </button>
      {open && (
        <div className="theme-menu" role="menu" aria-label="选择主题">
          <div className="theme-menu-head">
            <span>VISUAL THEME</span>
            <b>{themes.find((item) => item.id === theme)?.name}</b>
          </div>
          <div className="theme-grid">
            {themes.map((item) => (
              <button
                key={item.id}
                type="button"
                className="theme-swatch"
                style={{ "--swatch": item.color }}
                aria-label={`${item.name} ${item.color}`}
                aria-checked={theme === item.id}
                role="menuitemradio"
                title={`${item.name} · ${item.color}`}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
              >
                {theme === item.id && <Check size={14} strokeWidth={2.4} />}
              </button>
            ))}
          </div>
          <div className="theme-code">{themes.find((item) => item.id === theme)?.color}</div>
        </div>
      )}
    </div>
  );
}

function DateIndex({ issues, activeDate, onSelect, open, onClose }) {
  const groups = useMemo(() => groupIssues(issues), [issues]);
  return (
    <aside className={`date-index ${open ? "is-open" : ""}`} aria-label="往期简报">
      <div className="date-index-head">
        <div>
          <span>ARCHIVE</span>
          <b>{issues.length} ISSUES</b>
        </div>
        <button className="icon-button mobile-only" type="button" onClick={onClose} aria-label="关闭往期">
          <X size={19} />
        </button>
      </div>
      <div className="date-index-scroll">
        {[...groups.entries()].map(([month, monthIssues]) => (
          <section className="date-group" key={month}>
            <h2>{monthLabel(month)}</h2>
            {monthIssues.map((issue) => (
              <button
                type="button"
                className={`date-row ${issue.date === activeDate ? "is-active" : ""}`}
                key={issue.date}
                onClick={() => onSelect(issue.date)}
              >
                <span>{issue.date.slice(5).replace("-", ".")}</span>
                <b>{issue.headline}</b>
              </button>
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

function SignalItem({ item, index }) {
  const marks = ["◆", "◇", "◈"];
  return (
    <article className="signal-item">
      <div className="signal-index" aria-hidden="true">{marks[index] || "◆"}</div>
      <div className="signal-body">
        <h3>{cleanTitle(item.title)}</h3>
        <p>{item.description}</p>
        <div className="signal-meta">
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
            {item.sourceName}
            <ExternalLink size={12} strokeWidth={1.8} />
          </a>
          <span>{item.sourceDateLabel}</span>
        </div>
      </div>
    </article>
  );
}

function BriefCanvas({ data, issueNumber }) {
  const { year, month, day } = splitDate(data.date);
  return (
    <main className="brief-canvas" id="brief">
      <header className="issue-masthead">
        <div className="issue-brand">
          <span>DAILY AI INDUSTRY INTELLIGENCE</span>
          <h1>The AI Industry Brief</h1>
        </div>
        <div className="issue-publisher">
          <b>星期一研究室</b>
          <span>ISSUE {String(issueNumber).padStart(3, "0")}</span>
        </div>
      </header>

      <section className="lead-grid">
        <div className="date-block" aria-label={`${data.date} ${data.weekday}`}>
          <span>{year}</span>
          <b>{month}.{day}</b>
          <em>{data.weekday}</em>
        </div>
        <div className="lead-statement">
          <span>EDITOR'S LEAD</span>
          <h2>{data.opening}</h2>
        </div>
        <div className="lead-signal" aria-hidden="true">
          <div className="signal-axis"><i /><i /><i /><i /></div>
          <span>GLOBAL SIGNALS / {data.sections?.length || 0} DESKS</span>
        </div>
      </section>

      <div className="sections-grid">
        {(data.sections || []).map((section, sectionIndex) => (
          <section className="brief-section" key={`${section.name}-${sectionIndex}`}>
            <header className="section-head">
              <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
              <div>
                <h2>{section.name}</h2>
                <p>{section.subtitle}</p>
              </div>
            </header>
            <div className="section-signals">
              {(section.items || []).map((item, itemIndex) => (
                <SignalItem item={item} index={itemIndex} key={`${item.sourceUrl}-${itemIndex}`} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="editorial-note">
        <div className="note-label">
          <span>EDITORIAL NOTE</span>
          <b>今日洞察</b>
        </div>
        <div className="note-copy">
          <p>{data.insight}</p>
          <small>{data.methodNote}</small>
        </div>
      </section>

      <footer className="issue-footer">
        <b>星期一研究室出品</b>
        <span>The AI Industry Brief</span>
      </footer>
    </main>
  );
}

function App() {
  const [manifest, setManifest] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(initialTheme);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const requestedDate = params.get("date");
  const [activeDate, setActiveDate] = useState(requestedDate || "");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!captureMode) window.localStorage.setItem("ai-brief-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch(new URL("brief-data/manifest.json", baseUrl))
      .then((response) => {
        if (!response.ok) throw new Error(`Manifest ${response.status}`);
        return response.json();
      })
      .then((value) => {
        setManifest(value);
        const validDate = value.issues.some((issue) => issue.date === requestedDate && issue.dataUrl);
        setActiveDate(validDate ? requestedDate : value.latest);
      })
      .catch(() => setError("简报索引加载失败，请稍后重试。"));
  }, []);

  useEffect(() => {
    if (!manifest || !activeDate) return;
    const issue = manifest.issues.find((item) => item.date === activeDate);
    if (!issue) return;
    let cancelled = false;
    setLoading(true);
    fetch(new URL(issue.dataUrl, baseUrl))
      .then((response) => {
        if (!response.ok) throw new Error(`Brief ${response.status}`);
        return response.json();
      })
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError("");
        setLoading(false);
        document.title = `The AI Industry Brief | ${issueLabel(issue)} | 星期一研究室`;
        const nextParams = new URLSearchParams(window.location.search);
        nextParams.set("date", activeDate);
        if (!captureMode) nextParams.delete("capture");
        const nextUrl = `${window.location.pathname}?${nextParams.toString()}`;
        window.history.replaceState({}, "", nextUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setError("这期简报暂时无法加载。请切换其他日期重试。");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [manifest, activeDate]);

  const activeIndex = manifest?.issues.findIndex((issue) => issue.date === activeDate) ?? -1;
  const newerIssue = activeIndex > 0 ? manifest.issues[activeIndex - 1] : null;
  const olderIssue = activeIndex >= 0 ? manifest?.issues[activeIndex + 1] : null;
  const issueNumber = manifest && activeIndex >= 0 ? manifest.issues.length - activeIndex : 0;

  function selectDate(date) {
    const issue = manifest?.issues.find((item) => item.date === date);
    if (issue?.legacyOnly) {
      window.location.assign(new URL(issue.legacyUrl, baseUrl));
      return;
    }
    setArchiveOpen(false);
    setActiveDate(date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (error && !data) {
    return <div className="fatal-state"><b>The AI Industry Brief</b><p>{error}</p></div>;
  }

  return (
    <div className={`site ${captureMode ? "capture-mode" : ""}`}>
      {!captureMode && (
        <header className="site-header">
          <a className="site-brand" href="./" aria-label="The AI Industry Brief 首页">
            <i />
            <span>The AI Industry Brief</span>
          </a>
          <div className="site-edition">DAILY / GLOBAL / VERIFIED</div>
          <div className="header-actions">
            <button className="icon-button archive-toggle" type="button" aria-label="打开往期" title="打开往期" onClick={() => setArchiveOpen(true)}>
              <Menu size={19} strokeWidth={1.7} />
            </button>
            <ThemePicker theme={theme} onChange={setTheme} />
            <a className="icon-button" href="papers.html" aria-label="论文观察室" title="论文观察室">
              <BookOpen size={18} strokeWidth={1.7} />
            </a>
            <a className="icon-button" href="https://github.com/mondaylab/ai-industry-brief" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub">
              <GitBranch size={18} strokeWidth={1.7} />
            </a>
            <span className="publisher-name">星期一研究室</span>
          </div>
        </header>
      )}

      <div className="reader-grid">
        {!captureMode && manifest && (
          <DateIndex
            issues={manifest.issues}
            activeDate={activeDate}
            onSelect={selectDate}
            open={archiveOpen}
            onClose={() => setArchiveOpen(false)}
          />
        )}

        <div className="reader-main">
          {!captureMode && manifest && (
            <nav className="issue-toolbar" aria-label="简报日期导航">
              <button type="button" className="nav-command" disabled={!olderIssue} onClick={() => olderIssue && selectDate(olderIssue.date)}>
                <ArrowLeft size={17} />
                <span>前一期</span>
              </button>
              <label className="date-select-wrap">
                <span className="sr-only">选择简报日期</span>
                <select value={activeDate} onChange={(event) => selectDate(event.target.value)}>
                  {manifest.issues.map((issue) => <option value={issue.date} key={issue.date}>{issueLabel(issue)} · {issue.headline}</option>)}
                </select>
              </label>
              <button type="button" className="nav-command" disabled={!newerIssue} onClick={() => newerIssue && selectDate(newerIssue.date)}>
                <span>后一期</span>
                <ArrowRight size={17} />
              </button>
            </nav>
          )}

          <div className={`brief-stage ${loading ? "is-loading" : ""}`} aria-live="polite">
            {data ? <BriefCanvas data={data} issueNumber={issueNumber} /> : <div className="loading-state">LOADING ISSUE</div>}
          </div>
        </div>
      </div>
      {archiveOpen && <button className="archive-backdrop" type="button" aria-label="关闭往期" onClick={() => setArchiveOpen(false)} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
