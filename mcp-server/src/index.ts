import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SubmitEventsInput, SubmitEventsOutput } from "./schema.js";
import { InMemoryEventStore, type EventStore } from "./store.js";

const PORT = Number(process.env.PORT ?? 3000);
const store: EventStore = new InMemoryEventStore();

/**
 * TODO(auth): per-user OAuth. Do NOT add a shared API key: every colleague would get the same
 * secret in the plugin files, and the server couldn't tell users apart.
 *
 * claude.ai connects to remote connectors with OAuth 2.1 (authorization code + PKCE, with
 * dynamic client registration). To add it:
 *   1. Serve protected-resource metadata at /.well-known/oauth-protected-resource pointing at
 *      your authorization server (the SDK's `mcpAuthMetadataRouter` helps), and return
 *      401 + WWW-Authenticate on /mcp when no valid token is present.
 *   2. Validate the bearer token on /mcp (the SDK's `requireBearerAuth` middleware with a
 *      token verifier for your IdP), then read the user from `req.auth`.
 *   3. Replace `resolveUserId` below with the verified subject from the token.
 * Until then, every request is treated as one anonymous user.
 */
function resolveUserId(_req: Request): string {
  return "anonymous";
}

function buildServer(userId: string): McpServer {
  const server = new McpServer({ name: "calendar-sync-api", version: "0.1.0" });

  server.registerTool(
    "submit_events",
    {
      title: "Submit calendar events",
      description:
        "Submit the user's finished calendar events from the sync window (the past days). Call exactly once per " +
        "run with the full array; call with an empty array when there are no events so the run is still recorded. " +
        "Only meetings that have already ended are stored: events that end in the future and cancelled events " +
        "are refused. Events already stored (same event_id on the same day) are ignored, so resending is safe.",
      inputSchema: SubmitEventsInput,
      outputSchema: SubmitEventsOutput,
      annotations: { idempotentHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ events }) => {
      // Never sync a meeting before it has happened, even if the task sends one by mistake.
      const now = Date.now();
      const cancelled = events.filter((e) => e.status === "cancelled").length;
      const notFinished = events.filter((e) => e.status !== "cancelled" && Date.parse(e.end) > now).length;
      const finished = events.filter((e) => e.status !== "cancelled" && Date.parse(e.end) <= now);
      const result = {
        ...(await store.ingest(userId, finished)),
        received: events.length,
        not_finished: notFinished,
        cancelled,
      };
      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          msg: "submit_events",
          user: userId,
          ...result,
          payload: events,
        }),
      );
      return {
        content: [
          {
            type: "text",
            text:
              `Received ${result.received} events: ${result.new} new, ${result.duplicates} already synced` +
              (result.not_finished ? `, ${result.not_finished} not finished yet (skipped)` : "") +
              (result.cancelled ? `, ${result.cancelled} cancelled (skipped)` : "") +
              ".",
          },
        ],
        structuredContent: { ...result },
      };
    },
  );

  return server;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

// Stateless Streamable HTTP: a fresh server and transport per request, so any instance can serve any call.
app.post("/mcp", async (req: Request, res: Response) => {
  const server = buildServer(resolveUserId(req));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// No server-initiated streams or sessions in stateless mode.
const methodNotAllowed = (_req: Request, res: Response) => {
  res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.listen(PORT, () => {
  console.log(`calendar-sync-api MCP server listening on http://localhost:${PORT}/mcp`);
});
