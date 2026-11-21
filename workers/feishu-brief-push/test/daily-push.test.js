import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const base = "https://brief.example";
const legacyPublisher = ["星期一", "研究室"].join("");
const sectionNames = ["AI 产品前线", "AI 行业现场", "AI 资本与牌局", "AI 能力底座"];

function makeSections() {
  return sectionNames.map((name, section) => ({
    name,
    subtitle: `Section ${section + 1}`,
    items: Array.from({ length: 3 }, (_, item) => ({
      title: `动态 ${section + 1}-${item + 1}`,
      description: `动态正文 ${section + 1}-${item + 1}`,
      sourceName: "官方来源",
      sourceUrl: `https://source.example/${section + 1}/${item + 1}`,
      sourceDateLabel: date,
    })),
  }));
}

function fixture(t, { ready = true, issueDate = date, reject = false, sections = makeSections() } = {}) {
  const values = new Map();
  const cards = [];
  const env = {
    SITE_BASE_URL: base,
    MANUAL_TRIGGER_TOKEN: "test-trigger",
    FEISHU_APP_ID: "test-app",
    FEISHU_APP_SECRET: "test-secret",
    FEISHU_CHAT_ID: "test-chat",
    BRIEF_PUSH_STATE: {
      get: async (key) => values.get(key),
      put: async (key, data) => values.set(key, JSON.parse(data)),
    },
  };
  const fetchMock = t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url === `${base}/briefs/${date}.html`) {
      assert.equal(options.method, "HEAD");
      return new Response(null, { status: ready ? 200 : 404 });
    }
    if (url === `${base}/brief-data/${date}.json`) {
      return Response.json({
        date: issueDate, opening: `${legacyPublisher}发布今日简报。`,
        homepage: { headline: "今日行业动态" }, insight: "MondayLab 观察。",
        sections,
      });
    }
    if (url === "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal") {
      return Response.json({ code: 0, tenant_access_token: "test-tenant" });
    }
    if (url === "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id") {
      const message = JSON.parse(options.body);
      assert.equal(message.msg_type, "interactive");
      assert.equal(message.receive_id, "test-chat");
      cards.push(JSON.parse(message.content));
      if (reject) return Response.json({ code: 1 });
      return Response.json({ code: 0, data: { message_id: "test-message" } });
    }
    assert.fail(`Unexpected request: ${url}`);
  });
  return {
    cards, values, fetchMock,
    async run(path = "/send", query = `date=${date}`, token = "test-trigger") {
      return worker.fetch(new Request(`https://worker.example${path}?${query}`, {
        headers: { authorization: `Bearer ${token}` },
      }), env);
    },
    async scheduled() {
      let push;
      await worker.scheduled({ cron: "40 22 * * *" }, env, { waitUntil: (work) => { push = work; } });
      return push;
    },
  };
}

test("scheduled push sends a branded text card and shares deduplication with both manual routes", async (t) => {
  const f = fixture(t);
  assert.equal((await f.scheduled()).deliveryMode, "text_card");
  const [card] = f.cards;
  assert.equal(card.schema, "2.0");
  assert.equal(card.config.width_mode, "fill");
  assert.equal(card.header.subtitle.content, "坐标原点研究室");
  assert.equal(card.header.template, "blue");
  const elements = card.body.elements;
  const rows = elements.filter(({ tag, flex_mode }) => tag === "column_set" && flex_mode === "stretch");
  assert.deepEqual(rows.map(({ flex_mode, columns }) => [flex_mode, columns.map(({ weight }) => weight)]), [
    ["stretch", [1, 1]],
    ["stretch", [1, 1]],
  ]);
  assert.match(elements[0].content, /今日行业动态/);
  assert.match(elements[0].content, /坐标原点研究室发布今日简报/);
  const modules = rows.flatMap(({ columns }) => columns);
  for (const [index, section] of makeSections().entries()) {
    const panel = modules[index];
    assert.equal(panel.padding, "12px");
    assert.ok(card.config.style.color[panel.background_style].light_mode);
    assert.ok(card.config.style.color[panel.background_style].dark_mode);
    const [header, ...items] = panel.elements.map(({ content }) => content);
    assert.ok(header.startsWith(`<text_tag color='blue'>0${index + 1}</text_tag> **${section.name}**<br>`));
    assert.match(header, /SECTION [1-4]/);
    assert.equal(items.length, 3);
    for (const [itemIndex, item] of section.items.entries()) {
      assert.match(items[itemIndex], /\*\*动态 .+\*\*<br>动态正文 .+/);
      assert.ok(items[itemIndex].includes(`[官方来源](${item.sourceUrl})`));
    }
  }
  assert.match(elements.at(-2).content, /今日洞察[\s\S]*坐标原点研究室 观察/);
  assert.ok(!JSON.stringify(card).includes(legacyPublisher));
  assert.doesNotMatch(JSON.stringify(card), /MondayLab|img_key/);
  assert.deepEqual(elements.at(-1).columns.map(({ elements }) => elements[0].behaviors[0].default_url), [
    `${base}/reader.html?date=${date}`, `${base}/`,
  ]);
  assert.equal(f.values.get(`brief-push:${date}`).messageId, "test-message");
  for (const path of ["/send", "/send-link"]) {
    assert.equal((await (await f.run(path)).json()).reason, "already_sent");
  }
  assert.equal(f.cards.length, 1);
  assert.equal(f.fetchMock.mock.callCount(), 4);
});

test("manual push sends without screenshot credentials and rejects unauthorized or invalid requests", async (t) => {
  const f = fixture(t);
  assert.equal((await f.run("/send", `date=${date}`, "invalid")).status, 401);
  assert.equal((await f.run("/send", "date=bad")).status, 400);
  assert.equal((await f.run("/send-image-url")).status, 404);
  assert.equal(f.fetchMock.mock.callCount(), 0);
  assert.equal((await (await f.run()).json()).deliveryMode, "text_card");
});

test("unpublished issue is recorded for retry without contacting Feishu", async (t) => {
  const f = fixture(t, { ready: false });
  assert.equal((await f.scheduled()).reason, "page_not_ready");
  assert.equal(f.values.get(`brief-push:${date}`).status, "waiting_for_page");
  assert.equal(f.fetchMock.mock.callCount(), 2);
});

test("mismatched issue data is not sent", async (t) => {
  const f = fixture(t, { issueDate: "2000-01-01" });
  assert.equal((await (await f.run()).json()).reason, "page_not_ready");
  assert.equal(f.cards.length, 0);
});

test("an incomplete issue is retried rather than sending fewer than twelve items", async (t) => {
  const sections = makeSections();
  sections[2].items.pop();
  const f = fixture(t, { sections });
  assert.equal((await (await f.run()).json()).reason, "page_not_ready");
  assert.equal(f.values.get(`brief-push:${date}`).status, "waiting_for_page");
  assert.equal(f.cards.length, 0);
});

test("source links keep URL delimiters out of the markdown and reject non-web protocols", async (t) => {
  const sections = makeSections();
  sections[0].items[0].sourceUrl = "https://source.example/article_(1)";
  sections[0].items[1].sourceUrl = "javascript:alert(1)";
  const f = fixture(t, { sections });
  assert.equal((await (await f.run()).json()).deliveryMode, "text_card");
  const content = f.cards[0].body.elements[1].columns[0].elements[1].content;
  assert.match(content, /article_%281%29/);
  assert.doesNotMatch(content, /javascript:/);
});

test("Feishu rejection is recorded as failed and does not trigger an image fallback", async (t) => {
  const f = fixture(t, { reject: true });
  assert.equal((await f.run()).status, 500);
  assert.equal(f.values.get(`brief-push:${date}`).status, "failed");
  assert.equal(f.fetchMock.mock.callCount(), 4);
});
