import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import usersRoutes from "./routes/users.js";
import ingestRoutes from "./routes/ingest.js";
import generateRoutes from "./routes/generate.js";
import predictionsRoutes from "./routes/predictions.js";
import anchorRoutes from "./routes/anchor.js";
import demoRoutes from "./routes/demo.js";
import statsRoutes from "./routes/stats.js";
import mcpRoutes from "./routes/mcp.js";
import { mcpProtocolHandler } from "./mcpServer.js";
import { buildPaymentMiddleware, isPaymentConfigured } from "./x402.js";
import { TOOLS } from "./routes/mcp.js";

const app = express();

// Railway auto-injects RAILWAY_ENVIRONMENT (or RAILWAY_ENVIRONMENT_NAME) on
// every deployment, unlike NODE_ENV, which has to be set manually and is
// easy to forget. Relying on NODE_ENV alone let this service boot "clean"
// on Railway with LLM_BASE_URL/LLM_API_KEY/LLM_MODEL missing — the
// REQUIRED_IN_PRODUCTION guard below silently skipped (NODE_ENV wasn't
// "production"), while llmClient.js's own check still fired on every real
// request, producing an instant 500 with no trace of why in the boot log.
// Treating either signal as "deployed" closes that gap even if NODE_ENV
// never gets set.
const IS_DEPLOYED = process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);

// Railway sits in front of this service as a reverse proxy and always
// sets X-Forwarded-For. Without this, express-rate-limit (routes/users.js,
// routes/demo.js) throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on the first
// request that hits a rate-limited route — and since that throw happens
// inside async middleware, Express doesn't catch it, so it becomes an
// unhandled rejection that kills the whole process. `1` trusts exactly one
// hop (Railway's own edge), which is the correct value for this topology.
app.set("trust proxy", 1);

const rawOrigins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);

if (rawOrigins.length === 0) {
  if (IS_DEPLOYED) {
    // Fail loudly at boot instead of silently blocking every request.
    // A missing CORS_ORIGIN used to produce allowedOrigins = [""], which
    // rejects every browser request with no clue why in the response.
    console.error("CORS_ORIGIN is not set. Refusing to start in production without it.");
    process.exit(1);
  }
  console.warn("CORS_ORIGIN is not set, defaulting to http://localhost:3001 for local dev.");
  rawOrigins.push("http://localhost:3001");
}

// Fail fast on anything required for the app to actually work, the same
// way the CORS_ORIGIN check above does. Better a crash-on-boot with a
// clear message in Railway logs than a 500 on a real user's first request.
const REQUIRED_IN_PRODUCTION = ["JWT_SECRET", "DATABASE_URL", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"];
const missingRequired = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
if (missingRequired.length) {
  if (IS_DEPLOYED) {
    console.error(`Missing required env var(s): ${missingRequired.join(", ")}. Refusing to start in production.`);
    process.exit(1);
  }
  // Not a detected deployment (plain local dev) — warn instead of exiting,
  // but say so loudly rather than letting it surface only as a mysterious
  // fast 500 the first time a generation route is hit.
  console.warn(`Missing env var(s): ${missingRequired.join(", ")}. LLM-backed routes will fail until these are set.`);
}

app.use(cors({ origin: rawOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/users", usersRoutes);
app.use("/ingest", ingestRoutes);
app.use("/generate", generateRoutes);
app.use("/predictions", predictionsRoutes);
app.use("/anchor", anchorRoutes);
app.use("/demo", demoRoutes);
app.use("/stats", statsRoutes);

// Build the x402 payment gate up-front. paymentGate is null when OKX
// credentials aren't set (local dev); otherwise it gates the 25 priced
// POST /mcp/<skill> REST routes. Scoped to the /mcp router below — never
// mounted globally — so the MCP initialize/tools/list handshake and the
// free GET /mcp/tools catalog are never intercepted by it.
let paymentGate = null;
try {
  paymentGate = await buildPaymentMiddleware();
} catch (err) {
  // Never let a facilitator-side problem (bad creds, network hiccup, SDK
  // shape mismatch) take the whole app down. Log loud, run unmetered.
  console.error("buildPaymentMiddleware() threw — /mcp/* routes running UNMETERED:", err);
}

// Real MCP protocol layer (initialize / tools/list / tools/call over
// Streamable HTTP) — matches exactly "/mcp" and "/mcp/", so it never
// shadows the priced "/mcp/<skill>" REST routes mounted below. This is
// what makes POST /mcp/ initialize return a real session instead of the
// "Cannot POST /mcp/" 404 an MCP client got before. Mounted ahead of the
// payment gate because payment for tools/call is enforced by the same
// x402 gate one hop downstream, via the loopback call inside
// mcpServer.js — see that file's module docstring.
app.all(["/mcp", "/mcp/"], mcpProtocolHandler);

// Free MCP control surface + catalog (must NOT sit behind the x402 gate):
// OKX's evaluator (and any MCP client) sends POST /mcp/ {initialize} and
// GET/POST tools/list with no payment, and the gate would 404 any path not
// in its priced-route map — which would make the endpoint read as invalid.
// Serve these free, ahead of the gated REST router below.
app.get("/mcp/tools", (_req, res) => {
  res.json({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.invoke?.price ? `${t.description} Price: ${t.invoke.price}.` : t.description,
      inputSchema: t.inputSchema,
    })),
    payment: isPaymentConfigured()
      ? { scheme: "x402", network: "eip155:196" }
      : { scheme: "none", note: "Payment not configured on this deployment — routes are currently unmetered." },
  });
});

// x402 payment gate sits in front of the /mcp REST routes. It only
// intercepts the 25 specific POST /mcp/<skill> routes declared in
// src/x402.js — discovery (above) stays free. If OKX payment credentials
// aren't set, paymentGate is null and every /mcp/* route runs unmetered
// (fine for local dev, never acceptable for a real OKX-facing deploy).
// isPaymentConfigured() is reported by GET /mcp/tools so an unmetered
// deployment is self-documenting to anything calling it, including OKX's
// own review process. NOTE: the gate is scoped to this router only — it is
// NOT mounted globally — so POST /mcp/ (initialize) and GET /mcp/tools are
// never intercepted by it (mounted after the app.all/app.get above).
if (paymentGate) {
  app.use("/mcp", paymentGate, mcpRoutes);
} else {
  app.use("/mcp", mcpRoutes);
}

// /mcp/tools (GET, free) lists all 7 skills including price + invoke path.
// The 6 single-skill routes and /mcp/full-package (the $2 bundle) are the
// paid A2MCP surface OKX AI Marketplace calls once the ASP is registered.
// Same services/* functions as /generate/*, just a different, paid,
// unauthenticated caller — see src/routes/mcp.js and src/x402.js.

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MHC backend listening on ${PORT}`));
