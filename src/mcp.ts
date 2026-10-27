/**
 * feedport MCP server. Tools: fetch_feed, fetch_feed_items, validate_feed.
 *
 * Why the low-level Server instead of McpServer: the high-level helper
 * converts zod schemas to JSON Schema and injects two keys that are not
 * in this tool's public spec ("$schema" and "additionalProperties"),
 * which breaks exact tool-list/schema parity with the spec. This file
 * therefore serves tools/list with the spec's exact input schemas,
 * while zod still validates every tools/call argument set.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { fetchFeed, fetchFeedItems, validateFeed, VERSION } from "./feed.js";
import type { FetchFn } from "./types.js";

const FeedArgs = z.object({
  url: z.string().describe("Feed URL"),
  limit: z.number().int().optional().describe("Maximum number of items to return"),
});

const ValidateArgs = z.object({
  url: z.string().describe("Feed URL"),
});

const TOOLS = [
  {
    name: "fetch_feed",
    description: "Fetch and parse an RSS or Atom feed from a URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Feed URL" },
        limit: { type: "integer", description: "Maximum number of items to return" },
      },
      required: ["url"],
    },
  },
  {
    name: "fetch_feed_items",
    description: "Fetch only the items from an RSS or Atom feed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Feed URL" },
        limit: { type: "integer", description: "Maximum number of items to return" },
      },
      required: ["url"],
    },
  },
  {
    name: "validate_feed",
    description: "Check whether a URL returns a valid RSS or Atom feed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Feed URL" },
      },
      required: ["url"],
    },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "feedport", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  try {
    if (name === "fetch_feed") {
      const parsed = FeedArgs.parse(args ?? {});
      return textResult(await fetchFeed(fetchFn, parsed));
    }
    if (name === "fetch_feed_items") {
      const parsed = FeedArgs.parse(args ?? {});
      return textResult(await fetchFeedItems(fetchFn, parsed));
    }
    if (name === "validate_feed") {
      const parsed = ValidateArgs.parse(args ?? {});
      return textResult(await validateFeed(fetchFn, parsed.url));
    }
  } catch (err) {
    return errorResult(err);
  }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
