import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectFormat,
  fetchFeed,
  fetchFeedItems,
  parseFeed,
  validateFeed,
} from "../src/feed.js";
import type { FetchFn } from "../src/types.js";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Example News</title><link>https://example.com/</link>
<description>News from Example</description>
<item><title>First Post</title><link>https://example.com/1</link>
<description>About &amp; around the first post</description>
<pubDate>Mon, 26 Oct 2026 08:00:00 GMT</pubDate><guid>post-1</guid></item>
<item><title><![CDATA[Second <Post>]]></title><link>https://example.com/2</link>
<pubDate>Tue, 27 Oct 2026 08:00:00 GMT</pubDate><guid>post-2</guid></item>
<item><title>Third Post</title><link>https://example.com/3</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Atom Blog</title><link rel="alternate" href="https://blog.example.com/"/>
<subtitle>Posts from the blog</subtitle>
<entry><title>Entry One</title><link rel="alternate" href="https://blog.example.com/e1"/>
<summary>Summary one</summary><published>2026-10-26T08:00:00Z</published><id>urn:e1</id></entry>
<entry><title>Entry Two</title><link href="https://blog.example.com/e2"/>
<content>Content two</content><updated>2026-10-27T08:00:00Z</updated><id>urn:e2</id></entry>
</feed>`;

function fakeFetch(body: string, ok = true, status = 200): FetchFn {
  return async () => ({
    ok,
    status,
    statusText: ok ? "OK" : "Not Found",
    headers: { get: () => "application/xml" },
    text: async () => body,
  });
}

const failingFetch: FetchFn = async () => {
  throw new Error("connection refused");
};

describe("detectFormat", () => {
  it("detects rss, atom and unknown documents", () => {
    assert.equal(detectFormat(RSS), "rss");
    assert.equal(detectFormat(ATOM), "atom");
    assert.equal(detectFormat("<html><body>hi</body></html>"), "unknown");
  });
});

describe("parseFeed RSS", () => {
  it("parses channel metadata and items", () => {
    const feed = parseFeed(RSS);
    assert.equal(feed.title, "Example News");
    assert.equal(feed.link, "https://example.com/");
    assert.equal(feed.description, "News from Example");
    assert.equal(feed.items.length, 3);
    assert.deepEqual(feed.items[0], {
      title: "First Post",
      link: "https://example.com/1",
      description: "About & around the first post",
      pubDate: "Mon, 26 Oct 2026 08:00:00 GMT",
      guid: "post-1",
    });
  });

  it("unwraps CDATA and omits absent optional fields", () => {
    const feed = parseFeed(RSS);
    assert.equal(feed.items[1].title, "Second <Post>");
    assert.equal(feed.items[1].description, undefined);
    assert.equal(feed.items[2].guid, undefined);
  });

  it("applies limit", () => {
    assert.equal(parseFeed(RSS, 2).items.length, 2);
    assert.equal(parseFeed(RSS, 0).items.length, 0);
  });
});

describe("parseFeed Atom", () => {
  it("parses feed metadata and entries", () => {
    const feed = parseFeed(ATOM);
    assert.equal(feed.title, "Atom Blog");
    assert.equal(feed.link, "https://blog.example.com/");
    assert.equal(feed.description, "Posts from the blog");
    assert.equal(feed.items.length, 2);
    assert.deepEqual(feed.items[0], {
      title: "Entry One",
      link: "https://blog.example.com/e1",
      description: "Summary one",
      pubDate: "2026-10-26T08:00:00Z",
      guid: "urn:e1",
    });
    assert.equal(feed.items[1].description, "Content two");
    assert.equal(feed.items[1].pubDate, "2026-10-27T08:00:00Z");
  });

  it("throws on unknown formats", () => {
    assert.throws(() => parseFeed("<html></html>"), /neither RSS nor Atom/);
  });
});

describe("fetchFeed / fetchFeedItems with fake fetch", () => {
  it("fetches and parses via the injected fetch", async () => {
    const feed = await fetchFeed(fakeFetch(RSS), { url: "https://example.com/feed.xml" });
    assert.equal(feed.title, "Example News");
    assert.equal(feed.items.length, 3);
  });

  it("returns items only, honouring limit", async () => {
    const items = await fetchFeedItems(fakeFetch(ATOM), {
      url: "https://blog.example.com/feed",
      limit: 1,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "Entry One");
  });

  it("throws on HTTP errors and network failures", async () => {
    await assert.rejects(
      () => fetchFeed(fakeFetch("nope", false, 404), { url: "https://x.example/feed" }),
      /HTTP 404/,
    );
    await assert.rejects(
      () => fetchFeed(failingFetch, { url: "https://x.example/feed" }),
      /connection refused/,
    );
  });
});

describe("validateFeed", () => {
  it("reports valid rss and atom feeds with item counts", async () => {
    assert.deepEqual(await validateFeed(fakeFetch(RSS), "https://example.com/feed.xml"), {
      valid: true,
      format: "rss",
      item_count: 3,
    });
    assert.deepEqual(await validateFeed(fakeFetch(ATOM), "https://blog.example.com/feed"), {
      valid: true,
      format: "atom",
      item_count: 2,
    });
  });

  it("reports invalid documents and fetch failures without throwing", async () => {
    const bad = await validateFeed(fakeFetch("<html>hi</html>"), "https://x.example/");
    assert.equal(bad.valid, false);
    assert.equal(bad.format, "unknown");
    assert.equal(bad.item_count, 0);
    assert.match(bad.error ?? "", /neither RSS nor Atom/);
    const down = await validateFeed(failingFetch, "https://x.example/feed");
    assert.equal(down.valid, false);
    assert.match(down.error ?? "", /connection refused/);
  });
});
