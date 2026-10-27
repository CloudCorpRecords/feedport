/**
 * feedport core: fetch and parse RSS 2.0 and Atom feeds.
 *
 * Parsing uses a small deterministic XML reader built on string and
 * regex processing only — enough for the flat, well-known shapes of
 * RSS channels/items and Atom feeds/entries, with CDATA sections and
 * XML entities handled explicitly. All network access goes through an
 * injected FetchFn, so tests run entirely on fixture strings.
 */
import type {
  FetchFeedOptions,
  FetchFn,
  FeedFormat,
  FeedItem,
  FeedResult,
  ValidateFeedResult,
} from "./types.js";

export const VERSION = "0.1.0";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeXmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith("#")) {
      const code = parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

function encodeText(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Replace CDATA sections with their (entity-encoded) literal text. */
function unwrapCdata(xml: string): string {
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, body: string) => encodeText(body));
}

function cleanText(fragment: string): string {
  const withoutTags = fragment.replace(/<[^>]*>/g, " ");
  return decodeXmlEntities(withoutTags).replace(/\s+/g, " ").trim();
}

/** Text of the first <tag>...</tag> in a fragment, or undefined. */
function elementText(fragment: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}\\s*>`, "i");
  const m = re.exec(fragment);
  if (!m) return undefined;
  const text = cleanText(m[1]);
  return text === "" ? undefined : text;
}

/** All <tag>...</tag> blocks in a fragment, in document order. */
function elementBlocks(fragment: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}\\s*>`, "gi");
  return [...fragment.matchAll(re)].map((m) => m[1]);
}

function attrValue(tagText: string, name: string): string | undefined {
  const dq = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(tagText);
  if (dq) return decodeXmlEntities(dq[1]);
  const sq = new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i").exec(tagText);
  return sq ? decodeXmlEntities(sq[1]) : undefined;
}

/** Best link href from an Atom fragment: rel="alternate", else the first link. */
function atomLink(fragment: string): string {
  const tags = [...fragment.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  let fallback = "";
  for (const tag of tags) {
    const href = attrValue(tag, "href");
    if (!href) continue;
    if (!fallback) fallback = href;
    const rel = attrValue(tag, "rel");
    if (rel === "alternate" || rel === undefined) return href;
  }
  return fallback;
}

export function detectFormat(xml: string): FeedFormat {
  if (/<rss\b/i.test(xml) || /<channel\b/i.test(xml)) return "rss";
  if (/<feed\b/i.test(xml)) return "atom";
  return "unknown";
}

function applyLimit<T>(items: T[], limit?: number): T[] {
  if (limit === undefined) return items;
  return items.slice(0, Math.max(0, Math.floor(limit)));
}

function parseRss(xml: string, limit?: number): FeedResult {
  const channelBlocks = elementBlocks(xml, "channel");
  const channel = channelBlocks[0] ?? xml;
  const header = channel.split(/<item\b/i)[0];
  const items: FeedItem[] = elementBlocks(channel, "item").map((block) => {
    const item: FeedItem = {
      title: elementText(block, "title") ?? "",
      link: elementText(block, "link") ?? "",
    };
    const description = elementText(block, "description");
    if (description !== undefined) item.description = description;
    const pubDate = elementText(block, "pubDate");
    if (pubDate !== undefined) item.pubDate = pubDate;
    const guid = elementText(block, "guid");
    if (guid !== undefined) item.guid = guid;
    return item;
  });
  return {
    title: elementText(header, "title") ?? "",
    link: elementText(header, "link") ?? "",
    description: elementText(header, "description") ?? "",
    items: applyLimit(items, limit),
  };
}

function parseAtom(xml: string, limit?: number): FeedResult {
  const header = xml.split(/<entry\b/i)[0];
  const items: FeedItem[] = elementBlocks(xml, "entry").map((block) => {
    const item: FeedItem = {
      title: elementText(block, "title") ?? "",
      link: atomLink(block),
    };
    const description = elementText(block, "summary") ?? elementText(block, "content");
    if (description !== undefined) item.description = description;
    const pubDate = elementText(block, "published") ?? elementText(block, "updated");
    if (pubDate !== undefined) item.pubDate = pubDate;
    const guid = elementText(block, "id");
    if (guid !== undefined) item.guid = guid;
    return item;
  });
  return {
    title: elementText(header, "title") ?? "",
    link: atomLink(header),
    description: elementText(header, "subtitle") ?? "",
    items: applyLimit(items, limit),
  };
}

/** Parse an RSS 2.0 or Atom document into a FeedResult. Throws on unknown formats. */
export function parseFeed(xml: string, limit?: number): FeedResult {
  const doc = unwrapCdata(xml ?? "");
  const format = detectFormat(doc);
  if (format === "rss") return parseRss(doc, limit);
  if (format === "atom") return parseAtom(doc, limit);
  throw new Error("Unsupported feed format: document is neither RSS nor Atom");
}

async function fetchFeedText(fetchFn: FetchFn, url: string): Promise<string> {
  let response;
  try {
    response = await fetchFn(url, {
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
      redirect: "follow",
    });
  } catch (err) {
    throw new Error(
      `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
    );
  }
  return response.text();
}

export async function fetchFeed(fetchFn: FetchFn, options: FetchFeedOptions): Promise<FeedResult> {
  if (!options.url) throw new Error("url is required");
  const body = await fetchFeedText(fetchFn, options.url);
  return parseFeed(body, options.limit);
}

export async function fetchFeedItems(
  fetchFn: FetchFn,
  options: FetchFeedOptions,
): Promise<FeedItem[]> {
  const feed = await fetchFeed(fetchFn, options);
  return feed.items;
}

export async function validateFeed(fetchFn: FetchFn, url: string): Promise<ValidateFeedResult> {
  if (!url) return { valid: false, format: "unknown", item_count: 0, error: "url is required" };
  let body: string;
  try {
    body = await fetchFeedText(fetchFn, url);
  } catch (err) {
    return {
      valid: false,
      format: "unknown",
      item_count: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const format = detectFormat(unwrapCdata(body));
  if (format === "unknown") {
    return {
      valid: false,
      format,
      item_count: 0,
      error: "Unsupported feed format: document is neither RSS nor Atom",
    };
  }
  try {
    const feed = parseFeed(body);
    return { valid: true, format, item_count: feed.items.length };
  } catch (err) {
    return {
      valid: false,
      format,
      item_count: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
