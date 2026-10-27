/**
 * feedport types.
 *
 * A feed lookup returns the channel-level metadata plus a flat list of
 * items. Optional item fields are omitted entirely when the source
 * document does not carry them, so callers can tell "absent" apart
 * from "present but empty".
 */

export interface FeedItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  guid?: string;
}

export interface FeedResult {
  title: string;
  link: string;
  description: string;
  items: FeedItem[];
}

export type FeedFormat = "rss" | "atom" | "unknown";

export interface ValidateFeedResult {
  valid: boolean;
  format: FeedFormat;
  item_count: number;
  error?: string;
}

export interface FetchFeedOptions {
  url: string;
  /** Maximum number of items to return. When omitted, all items are returned. */
  limit?: number;
}

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: { headers?: Record<string, string>; redirect?: string },
) => Promise<HttpResponse>;
