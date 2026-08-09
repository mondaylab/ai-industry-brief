import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const buildDir = path.join(root, ".site-build");
const targetAssets = path.join(root, "assets", "app");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "brief-data", "manifest.json"), "utf8"));

function legacyRedirectHtml(kind, title) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="data:," />
    <meta name="robots" content="noindex" />
    <title>${title} | The AI Industry Brief</title>
  </head>
  <body>
    <p>正在进入${title}……</p>
    <script>
      const current = new URL(window.location.href);
      const isPaperView = "${kind}" === "intelligence" && current.searchParams.get("view") === "papers";
      const target = new URL(isPaperView || "${kind}" === "papers" ? "./papers.html" : "./reader.html", current);
      for (const [key, value] of new URLSearchParams(window.location.search)) {
        if (key !== "view") target.searchParams.append(key, value);
      }
      target.hash = isPaperView || "${kind}" === "papers" ? current.hash : "#radar";
      window.location.replace(target.href);
    <\/script>
    <noscript><a href="${kind === "papers" ? "papers.html" : "reader.html#radar"}">进入${title}</a></noscript>
  </body>
</html>\n`;
}

execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "build"], {
  cwd: root,
  stdio: "inherit",
});

let readerHtml = fs.readFileSync(path.join(buildDir, "app.html"), "utf8");
readerHtml = readerHtml.replace(
  "</head>",
  `  <meta name="latest-brief" content="briefs/${manifest.latest}.html">\n  </head>`,
);
fs.accessSync(path.join(buildDir, "radar-app.html"), fs.constants.R_OK);
fs.accessSync(path.join(buildDir, "papers-app.html"), fs.constants.R_OK);
fs.accessSync(path.join(buildDir, "intelligence-app.html"), fs.constants.R_OK);
const papersHtml = fs.readFileSync(path.join(buildDir, "papers-app.html"), "utf8");

fs.rmSync(targetAssets, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetAssets), { recursive: true });
fs.cpSync(path.join(buildDir, "assets", "app"), targetAssets, { recursive: true });
fs.writeFileSync(path.join(root, "reader.html"), readerHtml);
fs.writeFileSync(path.join(root, "papers.html"), papersHtml);
fs.writeFileSync(path.join(root, "radar.html"), legacyRedirectHtml("radar", "今日简报的热点雷达"));
fs.writeFileSync(path.join(root, "intelligence.html"), legacyRedirectHtml("intelligence", "对应页面"));
fs.rmSync(buildDir, { recursive: true, force: true });

console.log(`Built React reader and canonical Paper Observatory for ${manifest.latest}; legacy Intelligence and Radar URLs remain compatible redirects.`);
