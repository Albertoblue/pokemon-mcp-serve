/**
 * Pokemon MCP Server — Entry Point
 *
 * Transport: Streamable HTTP (modern MCP transport, NOT SSE)
 *   POST   /mcp      → JSON-RPC requests (initialize + tool/resource/prompt calls)
 *   DELETE /mcp      → terminates a session
 *   GET    /health   → ALB / Docker healthcheck (includes activeSessions)
 *
 * Session model:
 *   - Each session owns its own McpServer + StreamableHTTPServerTransport
 *   - Sessions are keyed by the `Mcp-Session-Id` header
 *   - A new session's first request MUST be an `initialize` request
 *   - Sessions are removed from the Map when the transport closes
 *
 * Architecture (strict layering):
 *   Express ──→ StreamableHTTP Transport ──→ McpServer ──→ Tools / Resources / Prompts
 *   This file only ORCHESTRATES — no business logic lives here.
 *
 * Auth: x-api-key header on every route except /health.
 */

// Load .env BEFORE any other import: middleware/auth.ts reads
// process.env.MCP_API_KEY at module-evaluation time, so dotenv must run first.
import "dotenv/config";

import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { authMiddleware } from "./middleware/auth";
import { registerTools } from "./tools/index";
import { registerResources } from "./resources/index";
import { registerPrompts } from "./prompts/index";

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "8000", 10);
const SERVER_NAME = "pokemon-mcp-server";
const SERVER_VERSION = "1.0.0";

// ─── Session registry ─────────────────────────────────────────────────────────

/**
 * In-memory map of active sessions.
 * Key: sessionId assigned during the initialize handshake.
 * Each client gets its own McpServer + transport instance.
 */
const activeSessions = new Map<string, StreamableHTTPServerTransport>();

/**
 * Build a fresh McpServer with all capabilities registered.
 * A new server is created per session so state never leaks between clients.
 */
function buildServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
  registerTools(server);
  registerResources(server);
  registerPrompts(server);
  return server;
}

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(authMiddleware);

// ── GET /health ───────────────────────────────────────────────────────────────
// Used by ALB target group health checks and Docker HEALTHCHECK.
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    server: SERVER_NAME,
    version: SERVER_VERSION,
    activeSessions: activeSessions.size,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /mcp ─────────────────────────────────────────────────────────────────
// Single endpoint for the whole protocol. Routing:
//   - Existing session  → reuse its transport (Mcp-Session-Id header)
//   - New session        → only allowed if the body is an initialize request
app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  let transport: StreamableHTTPServerTransport | undefined =
    sessionId ? activeSessions.get(sessionId) : undefined;

  if (!transport) {
    // No existing session: this MUST be an initialize request.
    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message:
            "Bad Request: no valid session ID provided and body is not an initialize request",
        },
        id: null,
      });
      return;
    }

    const server = buildServer();
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id: string) => {
        activeSessions.set(id, transport!);
        console.log(
          `[MCP] Nueva sesión: ${id} (sesiones activas: ${activeSessions.size})`
        );
      },
    });

    // Remove the session from the registry when the transport closes.
    transport.onclose = () => {
      const id = transport!.sessionId;
      if (id && activeSessions.has(id)) {
        activeSessions.delete(id);
        console.log(
          `[MCP] Sesión cerrada: ${id} (sesiones activas: ${activeSessions.size})`
        );
      }
    };

    await server.connect(transport);
  }

  // Delegate the request to the transport (parses body + writes response).
  await transport.handleRequest(req, res, req.body);
});

// ── DELETE /mcp ───────────────────────────────────────────────────────────────
// Explicit session termination requested by the client.
app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? activeSessions.get(sessionId) : undefined;

  if (!transport) {
    res.status(404).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Session not found" },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res);
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔══════════════════════════════════════════╗
║      Pokémon MCP Server  v${SERVER_VERSION}        ║
╠══════════════════════════════════════════╣
║  Transport : Streamable HTTP             ║
║  Port      : ${String(PORT).padEnd(28)}║
║  Health    : GET    /health              ║
║  MCP       : POST   /mcp                 ║
║  Close     : DELETE /mcp                 ║
╠══════════════════════════════════════════╣
║  Tools     : 5                           ║
║  Resources : 4 (2 static + 2 templates)  ║
║  Prompts   : 3                           ║
╚══════════════════════════════════════════╝
  `);
});
