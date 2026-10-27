# feedport

feedport reads web feeds for you. Give it the address of an RSS 2.0 or
Atom document and it hands back the feed's title, link and description
plus a clean list of its items — titles, links, descriptions, dates and
ids — without you having to look at raw XML. It can also check an
address first and tell you whether what lives there really is a feed.

## Install

```bash
npx @reneturcios/feedport validate-feed https://example.com/feed.xml
```

Or run the container image:

```bash
docker run -i ghcr.io/cloudcorprecords/feedport
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

All commands print JSON.

```bash
# Whole feed: channel metadata plus items
feedport fetch-feed https://example.com/feed.xml

# Just the items, at most five of them
feedport fetch-feed-items https://example.com/feed.xml --limit 5

# Is this address actually a feed?
feedport validate-feed https://example.com/feed.xml
# {"valid": true, "format": "rss", "item_count": 12}

feedport --version
```

Exit codes: `0` on success, `1` when a feed cannot be fetched or
parsed (the error names the problem), `2` for usage errors.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio MCP
server:

```bash
npx -y @reneturcios/feedport mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "feedport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/feedport", "mcp"]
    }
  }
}
```

### Tools

| Tool | Input | What it returns |
| --- | --- | --- |
| `fetch_feed` | `url` (string, required), `limit` (integer, optional) | The feed's `title`, `link` and `description`, plus `items` — each with `title`, `link`, and `description`, `pubDate` and `guid` when the document carries them. |
| `fetch_feed_items` | `url` (string, required), `limit` (integer, optional) | Only the item list, in the same shape as `fetch_feed`'s `items`. |
| `validate_feed` | `url` (string, required) | `valid`, the detected `format` (`rss`, `atom` or `unknown`), the `item_count`, and an `error` string when the address is not a usable feed. |

RSS 2.0 items come from `<item>` elements and Atom entries from
`<entry>` elements; for Atom, an entry's summary (or content) becomes
its description, its published (or updated) date becomes `pubDate`,
and its id becomes `guid`. CDATA sections and XML entities are decoded.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
