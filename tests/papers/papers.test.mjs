import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyPaper,
  dedupePapers,
  mergePaper,
  parseArxivFeed,
  validatePaper,
} from "../../scripts/papers/lib.mjs";

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2608.01234v2</id>
    <title>Reliable Tool-Use Agents with Verifiable Planning</title>
    <updated>2026-08-08T10:00:00Z</updated>
    <published>2026-08-07T10:00:00Z</published>
    <summary>We introduce a benchmark for long-horizon agents. Code is available at https://github.com/example/agent.</summary>
    <category term="cs.AI"/><category term="cs.CL"/>
    <arxiv:primary_category term="cs.AI"/>
    <arxiv:comment>Project page https://example.org/project and code https://github.com/example/agent</arxiv:comment>
    <author><name>Ada Researcher</name></author>
    <link href="https://arxiv.org/abs/2608.01234v2" rel="alternate" type="text/html"/>
    <link href="https://arxiv.org/pdf/2608.01234v2" rel="related" type="application/pdf" title="pdf"/>
  </entry>
</feed>`;

test("parses authoritative arXiv metadata and resources", () => {
  const [paper] = parseArxivFeed(atom, { discoveredAt: "2026-08-09T00:00:00Z" });
  assert.equal(paper.id, "arxiv:2608.01234");
  assert.equal(paper.version, 2);
  assert.deepEqual(paper.authors, ["Ada Researcher"]);
  assert.equal(paper.resources.code, "https://github.com/example/agent");
  assert.equal(paper.resources.project, "https://example.org/project");
  assert.ok(paper.topics.includes("agents-reasoning"));
  assert.deepEqual(validatePaper(paper), []);
});

test("classifies domain hints without treating categories as review status", () => {
  const topics = classifyPaper({ title: "A Vision-Language Policy for Robot Manipulation", abstract: "", categories: ["cs.RO", "cs.CV"] });
  assert.ok(topics.includes("robotics-embodied"));
  assert.ok(topics.includes("multimodal"));
});

test("deduplicates arXiv versions and records revisions", () => {
  const first = parseArxivFeed(atom.replaceAll("v2", "v1").replace("2026-08-08T10:00:00Z", "2026-08-07T10:00:00Z"), { discoveredAt: "2026-08-07T12:00:00Z" })[0];
  const second = parseArxivFeed(atom, { discoveredAt: "2026-08-09T00:00:00Z" })[0];
  const deduped = dedupePapers([first, second]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].version, 2);
  const merged = mergePaper(first, second, "2026-08-09T00:00:00Z");
  assert.equal(merged.firstSeenAt, "2026-08-07T12:00:00Z");
  assert.ok(merged.events.some((event) => event.type === "revision"));
});
