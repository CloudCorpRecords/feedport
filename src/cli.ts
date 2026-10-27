#!/usr/bin/env node
/**
 * feedport CLI.
 *
 *   feedport fetch-feed <url> [--limit n]
 *   feedport fetch-feed-items <url> [--limit n]
 *   feedport validate-feed <url>
 *   feedport mcp
 *
 * Output is JSON. Exit codes: 0 success, 1 fetch/parse error, 2 usage error.
 */
import { fetchFeed, fetchFeedItems, validateFeed, VERSION } from "./feed.js";
import type { FetchFn } from "./types.js";

function usage(): never {
  console.error(`Usage:
  feedport fetch-feed <url> [--limit n]
  feedport fetch-feed-items <url> [--limit n]
  feedport validate-feed <url>
  feedport mcp
  feedport --version`);
  process.exit(2);
}

function limitFlag(args: string[]): number | undefined {
  const idx = args.indexOf("--limit");
  if (idx < 0 || idx + 1 >= args.length) return undefined;
  const value = Number.parseInt(args[idx + 1], 10);
  return Number.isFinite(value) ? value : undefined;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd) usage();
  const positional = rest.filter((a, i) => a !== "--limit" && rest[i - 1] !== "--limit");
  const [url] = positional;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  try {
    if (cmd === "fetch-feed") {
      if (!url) usage();
      console.log(JSON.stringify(await fetchFeed(fetchFn, { url, limit: limitFlag(rest) }), null, 2));
    } else if (cmd === "fetch-feed-items") {
      if (!url) usage();
      console.log(JSON.stringify(await fetchFeedItems(fetchFn, { url, limit: limitFlag(rest) }), null, 2));
    } else if (cmd === "validate-feed") {
      if (!url) usage();
      console.log(JSON.stringify(await validateFeed(fetchFn, url), null, 2));
    } else {
      usage();
    }
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
