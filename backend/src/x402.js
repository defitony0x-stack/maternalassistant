// Real x402 integration, via the x402 Foundation's reference SDK
// (@x402/core, @x402/express, @x402/evm). There is NOT an OKX-branded npm
// package for this — OKX's own seller quickstart tells you to install the
// standard @x402/* packages and point the facilitator at OKX's endpoint:
// https://web3.okx.com/onchainos/dev-docs/payments/x402-introduction
//
// The SDK intercepts unpaid requests and returns HTTP 402 before any
// business logic runs; only a signature-verified, OKX-settled payment
// ever reaches the route handlers in mcp.js.

import crypto from "crypto";

const NETWORK = "eip155:196"; // X Layer

// OKX's x402 facilitator (HTTP API, "exact" scheme). Base URL + path
// prefix per OKX's docs: https://web3.okx.com/onchainos/dev-docs/payments/api-http-batch
const FACILITATOR_URL = "https://web3.okx.com/api/v6/pay/x402";

const REQUIRED = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE", "PAY_TO_ADDRESS"];

export function isPaymentConfigured() {
  return REQUIRED.every((key) => !!process.env[key]);
}

// Single-skill tools: $0.50 each. Bundle: $2.00 flat (a discount vs. buying
// all 6 individually at $0.50 — that gap is the whole incentive to choose
// the bundle, don't let it drift).
export const PRICES = {
  report: "$0.50",
  prep: "$0.50",
  letter: "$0.50",
  "action-items": "$0.50",
  questions: "$0.50",
  debrief: "$0.50",
  "full-package": "$2.00",
};

// OKX signs every REST call (including the x402 facilitator) with
// OK-ACCESS-* headers: OK-ACCESS-SIGN is a Base64 HMAC-SHA256 of
// timestamp + method + requestPath + body, using the secret key.
// https://web3.okx.com/onchainos/dev-docs/home/api-access-and-usage
//
// CAVEAT (read before going live): this assumes @x402/core's
// createAuthHeaders hook is called fresh for every facilitator request,
// so the timestamp here stays current and, for verify/settle, is signed
// against a body that matches what the SDK actually sends. That's the
// documented shape for a custom-auth facilitator (see the Questflow
// example in @x402/express's docs), but the exact hook signature isn't
// something I could verify without installing the package and reading
// its types — do a real paid /mcp/report call in a staging deploy before
// trusting this in production. If createAuthHeaders turns out to receive
// the request body as an argument, thread it into signOkx below instead
// of the hardcoded "" for verify/settle.
function signOkx(method, requestPath, body = "") {
  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  const sign = crypto.createHmac("sha256", process.env.OKX_SECRET_KEY).update(prehash).digest("base64");
  return {
    "OK-ACCESS-KEY": process.env.OKX_API_KEY,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE,
  };
}

/**
 * Builds the paymentMiddleware instance for the 7 priced /mcp/* routes.
 * Returns null if OKX payment credentials aren't set — caller is
 * responsible for skipping payment gating in that case (dev/local only,
 * never in a real OKX-facing deployment).
 */
export async function buildPaymentMiddleware() {
  if (!isPaymentConfigured()) return null;

  // Dynamic import so a missing/unconfigured deployment never pays the
  // cost of loading the SDK at all, and so this file has zero effect on
  // boot time when payments aren't in play yet (e.g. local dev).
  const { paymentMiddleware, x402ResourceServer } = await import("@x402/express");
  const { ExactEvmScheme } = await import("@x402/evm/exact/server");
  const { HTTPFacilitatorClient } = await import("@x402/core/server");

  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
    createAuthHeaders: async () => ({
      verify: signOkx("POST", "/api/v6/pay/x402/verify"),
      settle: signOkx("POST", "/api/v6/pay/x402/settle"),
      supported: signOkx("GET", "/api/v6/pay/x402/supported"),
      list: signOkx("GET", "/api/v6/pay/x402/list"),
    }),
  });

  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register(NETWORK, new ExactEvmScheme());

  const payTo = process.env.PAY_TO_ADDRESS;

  const routeConfig = (path, price, description) => ({
    [`POST /mcp/${path}`]: {
      accepts: [{ scheme: "exact", network: NETWORK, payTo, price }],
      description,
      mimeType: "application/json",
    },
  });

  const routes = {
    ...routeConfig("report", PRICES.report, "Generate a structured health report from recent notes"),
    ...routeConfig("prep", PRICES.prep, "Generate an appointment prep sheet from recent notes"),
    ...routeConfig("letter", PRICES.letter, "Draft an advocacy letter (leave, accommodation, insurance)"),
    ...routeConfig("action-items", PRICES["action-items"], "Extract prioritized action items from recent notes"),
    ...routeConfig("questions", PRICES.questions, "Generate a categorized appointment question bank"),
    ...routeConfig("debrief", PRICES.debrief, "Turn fresh visit notes into a structured post-visit debrief"),
    ...routeConfig(
      "full-package",
      PRICES["full-package"],
      "Run all 6 skills at once and return one combined document (discounted bundle)"
    ),
  };

  return paymentMiddleware(routes, resourceServer);
}
