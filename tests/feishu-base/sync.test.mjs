import assert from "node:assert/strict";
import test from "node:test";
import { buildRows, planSync } from "../../scripts/sync-feishu-base.mjs";

const site = "https://example.com/site/";
const date = "2026-11-21";
const one = { title: "Headline", description: "Public summary", sourceUrl: "https://example.com/post?b=2&a=1", privateNote: "not for Base" };

function issue(item = one, issueDate = date, category = "AI 产品前线") {
  return { date: issueDate, sections: [{ name: category, items: [item] }] };
}

test("projects only published columns and links to the right issue", () => {
  const [row] = buildRows([issue()], "文本", site);
  assert.equal(row["文本"], one.title);
  assert.equal(row["摘要"], one.description);
  assert.deepEqual(row["栏目"], ["AI 产品前线"]);
  assert.equal(row["刊发日期"], "2026-11-21T00:00:00+08:00");
  assert.equal(row["报刊链接"], `${site}reader.html?date=${date}`);
  assert.equal(row["公司或产品"], null);
  assert.ok(!JSON.stringify(row).includes(one.privateNote));
});

test("copy, category and tracking edits keep the same ID; edition changes do not", () => {
  const first = issue();
  const edit = issue({ ...one, title: "Corrected", sourceUrl: "https://example.com/post?a=1&b=2&utm_source=email" }, date, "AI 行业现场");
  const later = issue(one, "2026-11-22");
  const [before] = buildRows([first], "文本", site);
  const [after, separate] = buildRows([edit, later], "文本", site);
  assert.equal(before["同步 ID"], after["同步 ID"]);
  assert.notEqual(before["同步版本"], after["同步版本"]);
  assert.notEqual(before["同步 ID"], separate["同步 ID"]);
});

test("updates changed entries by record ID, leaves unchanged and unrelated rows untouched", () => {
  const [first, second, third] = buildRows([
    issue(), issue(one, "2026-11-20"), issue(one, "2026-11-19"),
  ], "文本", site);
  const existing = [
    { id: first["同步 ID"], version: first["同步版本"], recordId: "recSame" },
    { id: second["同步 ID"], version: "old", recordId: "recUpdate" },
    { id: "manual:unrelated", version: null, recordId: "recUnrelated" },
  ];
  assert.deepEqual(planSync([first, second, third], existing), {
    create: [third], update: [["recUpdate", second]], unchanged: 1,
  });
});

test("blocks duplicate identity on either side before a write", () => {
  const dup = issue({ ...one, sourceUrl: `${one.sourceUrl}&gclid=tracking` });
  assert.throws(() => buildRows([issue(), dup], "文本", site), /Duplicate article source/);
  const [row] = buildRows([issue()], "文本", site);
  const record = { id: row["同步 ID"], version: row["同步版本"], recordId: "recA" };
  assert.throws(() => planSync([row], [record, { ...record, recordId: "recB" }]), /Duplicate sync ID/);
});
