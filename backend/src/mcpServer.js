/**
 * Real MCP protocol server for MHC, mounted at exactly /mcp/ (and /mcp) in
 * server.js, in front of routes/mcp.js's REST routes.
 *
 * Why this file exists: routes/mcp.js already implements every skill as a
 * priced REST route (POST /mcp/report, POST /mcp/prep, etc.) plus a free
 * GET /mcp/tools catalog. That is enough for a direct REST caller, but it
 * is NOT an MCP server — an MCP-speaking buyer (or the OKX marketplace's
 * own evaluator) sends JSON-RPC over the Streamable HTTP transport and
 * expects POST /mcp/ { method: "initialize" } to return a session and
 * POST /mcp/ { method: "tools/list" } to return the tool set, not a 404.
 *
 * Design: this is a protocol ADAPTER, not a second implementation of the
 * business logic. tools/list is generated straight from routes/mcp.js's
 * TOOLS catalog (same names, same JSON-Schema inputSchema, same prices).
 * tools/call forwards the request in-process, over loopback HTTP, to the
 * exact REST route TOOLS already declares in each tool's `invoke.path` —
 * so there remains exactly one implementation of each skill regardless of
 * whether a caller used the REST route directly or an MCP tools/call.
 *
 * Payment: the REST routes are already x402-gated by the paymentMiddleware
 * mounted in server.js (see src/x402.js) in front of routes/mcp.js. Rather
 * than re-implement verify/settle here, a tools/call forwards the caller's
 * X-PAYMENT header (if the transport exposes it) straight through to the
 * loopback REST call, and reuses whatever that route returns — including
 * a 402 with the x402 payment-required challenge, which gets surfaced back
 * to the MCP caller as a tool error carrying that same challenge. A buyer
 * (or OKX's evaluator) retries tools/call with X-PAYMENT set, exactly as
 * it would retry a plain REST call.
 */

import { randomUUID } from "crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOLS } from "./routes/mcp.js";

const PORT = process.env.PORT || 3000;
// Loopback, not the public URL: this call never leaves the container, so
// it works the same in every environment without needing a PUBLIC_URL env
// var, and never counts as "external traffic" against anything metering
// inbound requests.
const SELF_BASE = `http://127.0.0.1:${PORT}`;

function toolByName(name) {
  return TOOLS.find((t) => t.name === name);
}

function buildServer() {
  const server = new Server(
    { name: "maternal-health-companion", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.invoke?.price ? `${t.description} Price: ${t.invoke.price}.` : t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const tool = toolByName(name);
    if (!tool) {
      return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }

    const headers = { "Content-Type": "application/json" };
    // Different SDK versions surface inbound HTTP headers at different
    // paths on `extra` — check the common ones rather than assuming one.
    const incomingPayment =
      extra?.requestInfo?.headers?.["x-payment"] ??
      extra?.requestInfo?.headers?.["X-PAYMENT"] ??
      extra?.headers?.["x-payment"];
    if (incomingPayment) headers["X-PAYMENT"] = incomingPayment;

    let res;
    try {
      res = await fetch(`${SELF_BASE}${tool.invoke.path}`, {
        method: tool.invoke.method,
        headers,
        body: JSON.stringify(args ?? {}),
      });
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `Internal call to ${tool.invoke.path} failed: ${err.message}` }] };
    }

    const body = await res.json().catch(() => ({ error: `Non-JSON response (status ${res.status})` }));

    if (!res.ok) {
      // Covers both the 402 payment-required challenge and any real 4xx/5xx
      // from the underlying route — same payload either way, so an agent
      // parsing tool errors doesn't need two different shapes.
      return { isError: true, content: [{ type: "text", text: JSON.stringify(body) }] };
    }

    return { content: [{ type: "text", text: JSON.stringify(body) }] };
  });

  return server;
}

// One transport per MCP session, keyed by the session id the SDK assigns
// on initialize. Sessions are in-memory only — fine for a single Railway
// instance; if this service is ever scaled to multiple instances, session
// affinity (sticky routing) or a shared session store would be needed.
const transports = new Map();

export async function mcpProtocolHandler(req, res) {
  const sessionId = req.headers["mcp-session-id"];
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    if (req.method !== "POST") {
      // No session, and not a fresh initialize — nothing to attach a GET
      // (SSE resume) or DELETE (session close) to.
      res.status(400).json({ error: "Missing or unknown mcp-session-id" });
      return;
    }

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => transports.set(id, transport),
    });
    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId);
    };

    const server = buildServer();
    await server.connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
}
