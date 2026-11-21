#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const SITE = "https://mondaylab.github.io/zero-one-signals/";
const ROOT = new URL("../", import.meta.url);
const KEY = "同步 ID";
const VERSION = "同步版本";
const DAY = 86_400_000;
const PAGE_SIZE = 200;
const BATCH_SIZE = 50;
const COLUMNS = ["刊发日期", "栏目", "公司或产品", "主题", "摘要", "来源", "来源日期", "报刊链接", "原文链接"];

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function webUrl(value) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Expected an HTTP(S) URL without credentials.");
  }
  return url;
}

function sourceIdentity(value) {
  const url = webUrl(value);
  for (const name of [...url.searchParams.keys()]) {
    if (/^(?:utm_.*|gclid|fbclid)$/i.test(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  return url.href;
}

export function buildRows(issues, titleField, site = SITE) {
  const seen = new Set();
  return issues.flatMap(({ date, sections }) => sections.flatMap(({ name, items }) => items.map((item) => {
    const title = text(item.title);
    const category = text(name);
    if (!title || !category) throw new Error(`Missing title or category in ${date}.`);
    const original = webUrl(item.sourceUrl).href;
    const id = `brief:${date}:${digest(sourceIdentity(original)).slice(0, 32)}`;
    if (seen.has(id)) throw new Error(`Duplicate article source in ${date}; refusing to sync.`);
    seen.add(id);
    const reader = new URL("reader.html", site);
    reader.searchParams.set("date", date);
    const fields = {
      [titleField]: title,
      "刊发日期": `${date}T00:00:00+08:00`,
      "栏目": [category],
      "公司或产品": text(item.company),
      "主题": text(item.topicCluster),
      "摘要": text(item.description),
      "来源": text(item.sourceName),
      "来源日期": text(item.sourceDateLabel),
      "报刊链接": reader.href,
      "原文链接": original,
      [KEY]: id,
    };
    return { ...fields, [VERSION]: digest(JSON.stringify(fields)) };
  })));
}

export function planSync(rows, existing) {
  const previous = new Map();
  for (const { id, version, recordId } of existing) {
    if (!id.startsWith("brief:")) continue;
    if (previous.has(id)) throw new Error(`Duplicate sync ID in Feishu: ${id}. No records changed.`);
    previous.set(id, { version, recordId });
  }
  const create = [];
  const update = [];
  let unchanged = 0;
  for (const row of rows) {
    const record = previous.get(row[KEY]);
    if (!record) create.push(row);
    else if (record.version !== row[VERSION]) update.push([record.recordId, row]);
    else unchanged++;
  }
  return { create, update, unchanged };
}

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), "utf8"));
}

async function loadIssues(days) {
  const manifest = await readJson("brief-data/manifest.json");
  const latest = manifest.latest;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(latest)) throw new Error("No latest date in the brief manifest.");
  const start = new Date(Date.parse(latest) - (days - 1) * DAY).toISOString().slice(0, 10);
  const entries = manifest.issues.filter(({ date, dataUrl }) =>
    date >= start && date <= latest && dataUrl === `brief-data/${date}.json`);
  const issues = await Promise.all(entries.map(async ({ date, dataUrl }) => {
    const issue = await readJson(dataUrl);
    if (issue.date !== date || !Array.isArray(issue.sections)) throw new Error(`Bad issue data: ${dataUrl}.`);
    return issue;
  }));
  if (!issues.some((issue) => issue.date === latest)) throw new Error("The latest structured issue is missing.");
  return { start, latest, issues };
}

function baseCli(target, identity) {
  return (command, args = []) => {
    const raw = execFileSync("lark-cli", [
      "base", command, "--base-token", target.token, "--table-id", target.table,
      "--as", identity, "--format", "json", ...args,
    ], { encoding: "utf8", timeout: 90_000, maxBuffer: 8 * 1024 * 1024 });
    const response = JSON.parse(raw);
    if (!response.ok || response.identity !== identity) throw new Error(`Feishu rejected ${command}.`);
    return response.data;
  };
}

function readExisting(run, keyField, versionField) {
  const existing = [];
  for (let offset = 0; ; ) {
    const result = run("+record-list", [
      "--field-id", keyField, "--field-id", versionField,
      "--filter-json", JSON.stringify({ conditions: [[keyField, "non_empty"]] }),
      "--limit", String(PAGE_SIZE), "--offset", String(offset),
    ]);
    const { field_id_list: fields, record_id_list: ids, data, has_more: more } = result;
    const keyCol = fields?.indexOf(keyField) ?? -1;
    const versionCol = fields?.indexOf(versionField) ?? -1;
    if (keyCol < 0 || versionCol < 0 || !Array.isArray(ids) || ids.length !== data?.length) {
      throw new Error("Unexpected Feishu record-list shape; no records changed.");
    }
    for (let i = 0; i < ids.length; i++) {
      const id = data[i][keyCol];
      const version = data[i][versionCol];
      if (typeof id !== "string" || typeof ids[i] !== "string" ||
          (version !== null && typeof version !== "string")) {
        throw new Error("Unexpected Feishu sync metadata; no records changed.");
      }
      existing.push({ id, version, recordId: ids[i] });
    }
    if (!more) return existing;
    if (!ids.length) throw new Error("Feishu returned an empty continuation page; no records changed.");
    offset += ids.length;
  }
}

async function waitForPages(site, issue) {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const response = await fetch(new URL(`brief-data/${issue.date}.json?sync=${Date.now()}`, site), {
        headers: { "cache-control": "no-cache" }, signal: AbortSignal.timeout(8000),
      });
      if (response.ok && JSON.stringify(await response.json()) === JSON.stringify(issue)) return;
    } catch {
      // GitHub Pages may still be serving the previous release.
    }
    if (attempt < 11) await sleep(10000);
  }
  throw new Error(`GitHub Pages has not published the current ${issue.date} data; no records changed.`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      days: { type: "string", default: "30" },
      as: { type: "string", default: "user" },
      apply: { type: "boolean" },
      "wait-for-pages": { type: "boolean" },
    },
  });
  const days = Number(values.days);
  if (!Number.isInteger(days) || days < 1 || days > 120) throw new Error("--days must be 1–120.");
  if (!["user", "bot"].includes(values.as)) throw new Error("--as must be user or bot.");
  const target = { token: process.env.FEISHU_BASE_TOKEN, table: process.env.FEISHU_TABLE_ID };
  if (!target.token || !target.table) throw new Error("Set FEISHU_BASE_TOKEN and FEISHU_TABLE_ID.");
  const site = webUrl(process.env.FEISHU_BRIEF_SITE || SITE);
  site.pathname = site.pathname.replace(/\/?$/, "/");
  site.search = "";
  site.hash = "";
  const { start, latest, issues } = await loadIssues(days);
  const run = baseCli(target, values.as);
  const { fields } = run("+field-list");
  const byName = new Map(fields.map((field) => [field.name, field.id]));
  const titleField = byName.has("标题") ? "标题" : "文本";
  const missing = [titleField, KEY, VERSION, ...COLUMNS].filter((name) => !byName.has(name));
  if (missing.length) throw new Error(`Missing Feishu columns: ${missing.join(", ")}.`);
  const rows = buildRows(issues, titleField, site);
  if (values.apply && values["wait-for-pages"]) {
    await waitForPages(site, issues.find((issue) => issue.date === latest));
  }
  const { create, update, unchanged } = planSync(rows, readExisting(run, byName.get(KEY), byName.get(VERSION)));
  console.log(JSON.stringify({ start, latest, issues: issues.length, records: rows.length,
    create: create.length, update: update.length, unchanged, apply: Boolean(values.apply) }));
  if (!values.apply) return;
  for (let i = 0; i < update.length; i += BATCH_SIZE) {
    const result = run("+record-batch-update", ["--json", JSON.stringify({ update_records: Object.fromEntries(update.slice(i, i + BATCH_SIZE)) })]);
    if (result?.ignored_fields?.length) throw new Error("Feishu ignored fields in a batch update.");
  }
  for (let i = 0; i < create.length; i += BATCH_SIZE) {
    const batch = create.slice(i, i + BATCH_SIZE);
    const result = run("+record-batch-create", ["--json", JSON.stringify({ create_records: batch })]);
    if (result?.record_id_list?.length !== batch.length || result?.ignored_fields?.length) {
      throw new Error("Feishu did not confirm all rows. Re-run a preview before writing again.");
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stderr?.trim() || error.message);
    process.exitCode = error.status || 1;
  });
}
