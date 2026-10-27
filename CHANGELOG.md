# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `feedport fetch-feed <url> [--limit n]`, `feedport fetch-feed-items
  <url> [--limit n]`, and `feedport validate-feed <url>` print feed data
  as JSON.
- MCP server (`feedport mcp`, stdio) with three tools: `fetch_feed`,
  `fetch_feed_items`, and `validate_feed`.
- RSS 2.0 and Atom documents are parsed with a small built-in XML reader;
  no runtime dependencies beyond the MCP SDK and no network use in tests.
