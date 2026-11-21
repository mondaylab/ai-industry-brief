#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

const DEFAULT_SITE = "https://mondaylab.github.io/zero-one-signals";
const DEFAULT_WORKER = "https://ai-industry-brief-feishu-push.zelina-ceo-os.workers.dev";
const WORKFLOW = "feishu-brief-push.yml";

async function request(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { "cache-control": "no-cache", ...options.headers },
    signal: AbortSignal.timeout(20000),
  });
}

async function waitForIssue(site, date) {
  const detailPath = `briefs/${date}.html`;
  for (let attempt = 1; attempt <= 18; attempt++) {
    const query = `?post_publish=${Date.now()}`;
    try {
      const [home, detail, data] = await Promise.all([
        request(`${site}/${query}`),
        request(`${site}/${detailPath}${query}`, { method: "HEAD" }),
        request(`${site}/brief-data/${date}.json${query}`),
      ]);
      const html = home.ok ? await home.text() : "";
      const issue = data.ok ? await data.json() : null;
      if (detail.ok && issue?.date === date && issue.opening &&
          (html.includes(detailPath) || html.includes(`reader.html?date=${date}`))) return;
      console.log(`Waiting for ${date}: homepage=${home.status} detail=${detail.status} data=${data.status}`);
    } catch (error) {
      console.log(`Waiting for ${date}: ${error.message}`);
    }
    if (attempt < 18) await sleep(10000);
  }
  throw new Error(`Issue ${date} is not ready on GitHub Pages.`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      date: { type: "string" },
      force: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log("Usage: npm --prefix workers/feishu-brief-push run post-publish-send -- --date YYYY-MM-DD [--force]");
    console.log("Uses MANUAL_TRIGGER_TOKEN / FEISHU_PUSH_TOKEN, or dispatches the GitHub workflow when run locally without a token.");
    return;
  }
  const date = values.date ?? new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD.");
  const token = process.env.MANUAL_TRIGGER_TOKEN || process.env.FEISHU_PUSH_TOKEN;
  if (!token && process.env.GITHUB_ACTIONS === "true") {
    throw new Error("Missing WORKER_MANUAL_TRIGGER_TOKEN repository secret.");
  }
  const site = (process.env.SITE_BASE_URL || DEFAULT_SITE).replace(/\/+$/, "");
  await waitForIssue(site, date);

  if (!token) {
    const repo = process.env.GH_REPO || "mondaylab/zero-one-signals";
    const args = ["workflow", "run", WORKFLOW, "--repo", repo, "--ref", "main", "-f", `date=${date}`];
    if (values.force) args.push("-f", "force=true");
    if (process.env.FEISHU_PUSH_WORKER_URL) args.push("-f", `worker_url=${process.env.FEISHU_PUSH_WORKER_URL}`);
    execFileSync("gh", args, { stdio: "inherit", timeout: 30000 });
    console.log(`Feishu text-card workflow dispatched for ${date}.`);
    return;
  }

  const worker = (process.env.FEISHU_PUSH_WORKER_URL || DEFAULT_WORKER).replace(/\/+$/, "");
  const health = await request(`${worker}/healthz`);
  if (!health.ok || (await health.json()).dailyDelivery !== "text_card") {
    throw new Error("Worker does not advertise text-card delivery; no message was sent.");
  }
  const sendUrl = new URL(`${worker}/send`);
  sendUrl.searchParams.set("date", date);
  if (values.force) sendUrl.searchParams.set("force", "1");
  const response = await request(sendUrl, {
    headers: { authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || `Worker returned HTTP ${response.status}.`);
  if (!values.force && result.skipped && result.reason === "already_sent") {
    console.log(`Feishu brief already sent: ${date}`);
  } else if (result.deliveryMode === "text_card" && result.messageId) {
    console.log(`Feishu text card sent: ${result.messageId}`);
  } else {
    throw new Error(`Feishu text card not delivered: ${result.reason || "unexpected response"}.`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
