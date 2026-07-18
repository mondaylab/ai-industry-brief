import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const buildDir = path.join(root, ".site-build");
const targetAssets = path.join(root, "assets", "app");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "brief-data", "manifest.json"), "utf8"));

execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "build"], {
  cwd: root,
  stdio: "inherit",
});

let readerHtml = fs.readFileSync(path.join(buildDir, "app.html"), "utf8");
readerHtml = readerHtml.replace(
  "</head>",
  `  <meta name="latest-brief" content="briefs/${manifest.latest}.html">\n  </head>`,
);
const radarHtml = fs.readFileSync(path.join(buildDir, "radar-app.html"), "utf8");

fs.rmSync(targetAssets, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetAssets), { recursive: true });
fs.cpSync(path.join(buildDir, "assets", "app"), targetAssets, { recursive: true });
fs.writeFileSync(path.join(root, "reader.html"), readerHtml);
fs.writeFileSync(path.join(root, "radar.html"), radarHtml);
fs.rmSync(buildDir, { recursive: true, force: true });

console.log(`Built React reader and Radar for ${manifest.latest}.`);
