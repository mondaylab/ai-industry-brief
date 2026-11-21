import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const base = "https://brief.example";
const legacyPublisher = ["星期一", "研究室"].join("");

function fixture(t, { ready = true, issueDate = date, reject = false } = {}) {
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
  assert.equal(card.header.subtitle.content, "坐标原点研究室");
  assert.deepEqual(card.elements.map(({ tag }) => tag), ["markdown", "action"]);
  assert.match(card.elements[0].content, /今日行业动态/);
  assert.match(card.elements[0].content, /坐标原点研究室发布今日简报/);
  assert.match(card.elements[0].content, /今日洞察[\s\S]*坐标原点研究室 观察/);
  assert.ok(!JSON.stringify(card).includes(legacyPublisher));
  assert.doesNotMatch(JSON.stringify(card), /MondayLab|img_key/);
  assert.equal(card.elements[1].actions[0].url, `${base}/briefs/${date}.html`);
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

test("Feishu rejection is recorded as failed and does not trigger an image fallback", async (t) => {
  const f = fixture(t, { reject: true });
  assert.equal((await f.run()).status, 500);
  assert.equal(f.values.get(`brief-push:${date}`).status, "failed");
  assert.equal(f.fetchMock.mock.callCount(), 4);
});
