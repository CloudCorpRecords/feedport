# feedport — Build Report

Wave Tier A, MCP Rebuild 100. Clean-room rebuild of the "rss-feed" MCP
server, built from the public tool spec in
`harness/fixtures/rss-feed-tools-original.json` only (that fixture is
docs-derived, not hand-probed — see its `_source`). Local build only —
nothing pushed or published.

Identity: repo `feedport`, npm `@reneturcios/feedport`,
MCP name `io.github.CloudCorpRecords/feedport`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `feedport: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Fetch and parse RSS or Atom feeds from
  a URL." = **45 chars** (≤100 ✓); npm entry carries `version: 0.1.0`;
  OCI entry `ghcr.io/cloudcorprecords/feedport:0.1.0` carries **no**
  `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/feedport"`
- `tsconfig.json` (copied unchanged from clockport), `.gitignore`,
  `LICENSE` (copied from clockport, MIT © 2026 Rene Turcios),
  `README.md` (fresh text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (`mcp`, `fetch-feed`,
  `fetch-feed-items`, `validate-feed`, `--version`; exit 2 usage /
  1 fetch error), `src/mcp.ts`, `src/types.ts`, `src/feed.ts`
  (core logic, `VERSION = "0.1.0"`)
- `test/feed.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (copied from clockport; image name and smoke-test server name changed)

## Implementation notes

- Core parses RSS 2.0 and Atom with a small deterministic XML reader
  (string/regex only): CDATA unwrapping, entity decoding, RSS
  `<item>` and Atom `<entry>` extraction, Atom link-rel handling.
  No runtime dependencies beyond the MCP SDK + zod.
- All network access goes through an injectable `FetchFn`
  (pageport pattern); every test uses a fake fetch returning fixture
  XML strings. **No live feed call was made or is claimed.**
- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals (clockport pattern), so tools/list matches the
  spec exactly; zod still validates every tools/call.

## Verification (exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc_exit=0
```
`dist/` produced (cli.js with `#!/usr/bin/env node` shebang, feed.js,
mcp.js, index.js, types.js, plus .d.ts/.js.map).

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 11
ℹ pass 11
ℹ fail 0
```
Covers: format detection, RSS channel/item parsing, CDATA + entity
decoding, optional-field omission, limit handling, Atom entry parsing
(summary/content, published/updated, id→guid, alternate links),
unknown-format errors, HTTP/network failures via fake fetch, and
validate_feed's valid/invalid/down outcomes without throwing.

### 3. CLI smoke
`--version` → `0.1.0`; unknown command exits 2 with Usage.

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
Original is tools-file mode, so the harness records
`fixture_results: SKIPPED-TOOLS-FILE-MODE` — expected semantics.
```
$ python3 parity.py --original fixtures/rss-feed-tools-original.json \
    --rebuild "stdio:node /home/hatch/workspace/mcp-rebuild-100/builds/feedport/dist/cli.js mcp" \
    --out /home/hatch/workspace/mcp-rebuild-100/builds/feedport/parity-out
verdict=PASS parity_pct=100.0 original_tools=3 rebuild_tools=3 missing=[] extra=[] schema_diffs=[]
(exit 0)
```

## Lockfile status

`package-lock.json` was copied from clockport's and edited with the
file edit tool: top-level `name`, root package `name`, and root package
`bin` key changed clockport → feedport (dependency ranges are
identical, so the tree is unchanged). Per TEMPLATE.md §2 item 6, a
lockfile must be generated clean (no `node_modules` present) before
first publish — **clean regeneration is FLAGGED and deferred to the
publish wave**; do not publish from this lockfile as-is.
`node_modules` in this build dir is a `cp -a` copy of clockport's
(local build only, gitignored).

## Gaps / blockers

None for the local build. Notes:
- No live upstream feed was fetched during this build; behaviour is
  verified only against fixture documents in the documented RSS 2.0 /
  Atom shapes.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.
- Clean lockfile regeneration outstanding (above).
