import assert from "node:assert/strict";
import test from "node:test";
import { buildPaperRows, buildRows, planSync, selectPaperRows } from "../../scripts/sync-feishu-base.mjs";

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

const paper = {
  id: "arxiv:2608.06377",
  title: "A public paper",
  publishedAt: "2026-08-06T10:00:00Z",
  updatedAt: "2026-08-06T10:00:00Z",
  version: 1,
  primaryCategory: "cs.CL",
  authors: ["Author A", "Author B"],
  topics: ["foundation-models"],
  resources: { paper: "https://arxiv.org/abs/2608.06377v1" },
  score: { total: 50 },
  abstract: "The table does not contain abstracts.",
};

test("arXiv revisions update the same record and only expose selected metadata", () => {
  const [old] = buildPaperRows([paper]);
  const [updated] = buildPaperRows([{ ...paper, id: `${paper.id}v2`, version: 2,
    updatedAt: "2026-08-07T12:00:00Z", resources: { paper: "https://arxiv.org/abs/2608.06377v2" } }]);
  assert.equal(old["同步 ID"], "paper:arxiv:2608.06377");
  assert.equal(updated["同步 ID"], old["同步 ID"]);
  assert.notEqual(updated["同步版本"], old["同步版本"]);
  assert.equal(updated["版本"], 2);
  assert.ok(!JSON.stringify(updated).includes(paper.abstract));
  const existing = [{ id: old["同步 ID"], recordId: "recPaper", version: old["同步版本"] }];
  assert.deepEqual(planSync([updated], existing, "paper:").update, [["recPaper", updated]]);
});

test("limits new papers while still considering existing entries for revisions", () => {
  const lower = { ...paper, id: "arxiv:2608.06378", score: { total: 10 } };
  const higher = { ...paper, id: "arxiv:2608.06379", score: { total: 90 } };
  const [first, middle, last] = buildPaperRows([paper, lower, higher]);
  assert.equal(first["arXiv ID"], "2608.06379");
  assert.deepEqual(selectPaperRows([first, middle, last], [{ id: last["同步 ID"] }], 1), [first, last]);
  assert.throws(() => buildPaperRows([paper, { ...paper, id: `${paper.id}v2` }]), /duplicated paper ID/);
});
