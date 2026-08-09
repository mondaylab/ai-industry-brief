import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "index.html");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "brief-data", "manifest.json"), "utf8"));
const latestData = JSON.parse(fs.readFileSync(path.join(root, "brief-data", `${manifest.latest}.json`), "utf8"));
const papersManifest = JSON.parse(fs.readFileSync(path.join(root, "papers-data", "manifest.json"), "utf8"));
const papersHealth = JSON.parse(fs.readFileSync(path.join(root, "papers-data", "health.json"), "utf8"));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMd(date) {
  return String(date || "").length >= 10 ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : "--/--";
}

function formatSyncTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近已同步";
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

function issueHref(issue) {
  return issue?.dataUrl ? `reader.html?date=${issue.date}` : issue?.legacyUrl || "reader.html";
}

function buildHomeGateway(issue) {
  const headline = latestData.homepage?.headline || issue?.headline || latestData.opening || "今日 AI 行业简报已更新";
  const itemCount = issue?.itemCount || latestData.sections?.reduce((sum, section) => sum + (section.items?.length || 0), 0) || 0;
  const paperBatch = papersManifest.days?.[0]?.paperCount || 0;
  const paperCount = papersManifest.paperCount || 0;
  const syncTime = formatSyncTime(papersHealth.lastSuccessfulAt || papersManifest.lastSuccessfulAt || papersManifest.generatedAt);
  const healthLabel = papersHealth.status === "healthy" ? "监听正常" : "使用最近快照";

  return `      <!-- HOME_GATEWAY_START -->
      <section class="home-gateway" aria-labelledby="home-title">
        <div class="home-intro">
          <div class="home-kicker">Daily Brief × Paper Observatory</div>
          <h1 id="home-title">看清今天的<br>AI 变化，<br>追踪下一步<br>方向。</h1>
          <p>今日简报压缩行业信号与趋势判断；论文观察室持续监听前沿研究和版本变化。选择你此刻真正需要的入口。</p>
          <div class="home-scope" aria-label="产品范围">
            <span>每日编辑筛选</span>
            <span>近 14 日热点回看</span>
            <span>官方论文源追踪</span>
          </div>
        </div>

        <nav class="paper-stage" data-paper-stage aria-label="核心产品入口">
          <div class="paper-deck">
            <span class="paper-echo echo-one" aria-hidden="true"></span>
            <span class="paper-echo echo-two" aria-hidden="true"></span>

            <a class="paper-sheet brief-sheet" data-route-card="brief" data-latest-brief-link href="${issueHref(issue)}" aria-labelledby="brief-route-title" aria-describedby="brief-route-summary">
              <div class="sheet-head">
                <span class="sheet-label">01 · Today's Brief</span>
                <time class="sheet-state" datetime="${issue.date}">${formatMd(issue.date)} · ${escapeHtml(issue.weekday || latestData.weekday)}</time>
              </div>
              <h2 id="brief-route-title">今日简报</h2>
              <p class="sheet-summary" id="brief-route-summary">${escapeHtml(headline)}</p>
              <div class="sheet-foot">
                <div class="sheet-meta"><span>${itemCount} 条精选信号</span><span>${formatMd(issue.date)} 更新</span><span>含近 14 日热点雷达</span></div>
                <span class="sheet-cta">阅读今日简报<span class="sheet-cta-icon"><img src="assets/icons/arrow-right.svg" alt=""></span></span>
              </div>
            </a>

            <a class="paper-sheet research-sheet" data-route-card="paper" href="papers.html" aria-labelledby="paper-route-title" aria-describedby="paper-route-summary">
              <div class="sheet-head">
                <span class="sheet-label">02 · Paper Observatory</span>
                <span class="sheet-state"><i aria-hidden="true"></i>${healthLabel}</span>
              </div>
              <h2 id="paper-route-title">论文观察室</h2>
              <p class="sheet-summary" id="paper-route-summary">最新批次 ${paperBatch} 篇论文已进入时间线</p>
              <div class="sheet-foot">
                <div class="sheet-meta"><span>${paperCount} 篇已观察</span><span>${syncTime} 已同步</span></div>
                <span class="sheet-cta">进入论文观察室<span class="sheet-cta-icon"><img src="assets/icons/arrow-right.svg" alt=""></span></span>
              </div>
            </a>
          </div>
        </nav>
      </section>
      <!-- HOME_GATEWAY_END -->`;
}

const latestIssue = manifest.issues.find((issue) => issue.date === manifest.latest) || manifest.issues[0];
let html = fs.readFileSync(indexPath, "utf8");
const gatewayPattern = /      <!-- HOME_GATEWAY_START -->[\s\S]*?      <!-- HOME_GATEWAY_END -->/;
if (!gatewayPattern.test(html)) throw new Error("Unable to update homepage gateway.");

html = html
  .replace(/href="intelligence\.html\?view=papers"/g, 'href="papers.html"')
  .replace(/href="(?:intelligence\.html\?view=radar|radar\.html)"/g, 'href="reader.html#radar"')
  .replace(gatewayPattern, buildHomeGateway(latestIssue));

fs.writeFileSync(indexPath, html);
console.log(`Updated product gateway for ${latestIssue.date}: ${papersManifest.days?.[0]?.paperCount || 0} latest papers, ${papersManifest.paperCount || 0} observed.`);
