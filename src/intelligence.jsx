import React, { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  ChevronRight,
  Radio,
  Sparkles,
} from "lucide-react";
import { RadarApp } from "./radar.jsx";
import "../assets/product-header.css";
import "./intelligence.css";

const PaperObservatory = lazy(() => import("./papers.jsx").then((module) => ({ default: module.PaperObservatory })));

function readView() {
  const value = new URL(window.location.href).searchParams.get("view");
  return value === "papers" ? "papers" : "radar";
}

class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.view !== this.props.view && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <section className="intelligence-view-error" role="alert">
          <Sparkles size={22} />
          <b>这个追踪视图暂时没有加载成功</b>
          <span>刷新页面即可重新连接最新快照。</span>
          <button type="button" onClick={() => window.location.reload()}>重新加载</button>
        </section>
      );
    }
    return this.props.children;
  }
}

function ProductHeader({ view, onViewChange }) {
  return (
    <>
      <header className="product-header">
        <a className="product-brand" href="./" aria-label="The AI Industry Brief 首页">
          <span className="product-brand-mark"><Radio size={16} strokeWidth={1.8} /></span>
          <span><b>The AI Industry Brief</b><small>MONDAYLAB EDITORIAL INTELLIGENCE</small></span>
        </a>
        <nav className="product-global-nav" aria-label="产品主导航">
          <a href="./">首页</a>
          <a href="reader.html">进入简报</a>
          <a className="is-active" href="intelligence.html?view=radar" aria-current="page">情报追踪</a>
          <a href="./#archive">往期</a>
        </nav>
        <div className="product-header-status" aria-label="追踪中心状态">
          <i />
          <span>{view === "papers" ? "官方论文源监听正常" : "简报信号快照已就绪"}</span>
        </div>
      </header>
      <div className="intelligence-contextbar">
        <div className="intelligence-context-copy">
          <span>INTELLIGENCE TRACKING</span>
          <b>情报追踪</b>
        </div>
        <nav className="intelligence-view-tabs" aria-label="选择追踪视图">
          <a
            href="intelligence.html?view=radar"
            className={view === "radar" ? "is-active" : ""}
            aria-current={view === "radar" ? "page" : undefined}
            onClick={(event) => { event.preventDefault(); onViewChange("radar"); }}
          >
            <Radio size={15} />
            <span><b>热点雷达</b><small>行业信号与编辑队列</small></span>
            <ChevronRight size={14} />
          </a>
          <a
            href="intelligence.html?view=papers"
            className={view === "papers" ? "is-active" : ""}
            aria-current={view === "papers" ? "page" : undefined}
            onClick={(event) => { event.preventDefault(); onViewChange("papers"); }}
          >
            <BookOpen size={15} />
            <span><b>论文观察室</b><small>官方源与版本时间线</small></span>
            <ChevronRight size={14} />
          </a>
        </nav>
        <p>{view === "papers" ? "论文与版本修订保持独立的研究优先级。" : "热点来自已收录简报快照，不伪装成实时抓取。"}</p>
      </div>
    </>
  );
}

function IntelligenceApp() {
  const [view, setView] = useState(readView);

  useEffect(() => {
    const onPopState = () => setView(readView());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title = `${view === "papers" ? "论文观察室" : "热点雷达"} | The AI Industry Brief`;
  }, [view]);

  function changeView(nextView) {
    if (nextView === view) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("view", nextView);
    window.history.pushState({ view: nextView }, "", nextUrl);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div className="intelligence-app">
      <div className="intelligence-page">
        <div className="intelligence-shell">
          <ProductHeader view={view} onViewChange={changeView} />
          <ViewErrorBoundary view={view}>
            <div className="intelligence-workspace" key={view}>
              {view === "radar" ? (
                <RadarApp embedded />
              ) : (
                <Suspense fallback={<div className="intelligence-loading"><BookOpen size={22} /><span>正在连接论文观察室</span></div>}>
                  <PaperObservatory embedded />
                </Suspense>
              )}
            </div>
          </ViewErrorBoundary>
          <footer className="intelligence-footer">
            <span>THE AI INDUSTRY BRIEF · CONTINUOUS TRACKING</span>
            <span>热点信号与前沿论文，共享一个编辑情报台</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (root?.dataset.app === "intelligence") {
  createRoot(root).render(<React.StrictMode><IntelligenceApp /></React.StrictMode>);
}
