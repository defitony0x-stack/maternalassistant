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

// Single-skill tools: tiered by complexity/sensitivity. Bundle covers all
// 25 tools — priced to stay a real discount vs. buying individually.
// The 25 single-skill tools (everything below except the bundle-* and
// full-package keys) sum to $4.60: the original 16 at $3.10 plus the 9
// maternal-specific additions at $1.50. full-package holds the same
// ~29% discount the catalog has always used, so it's priced at $3.25 —
// if PRICES gains or loses a single-skill tool, recompute this sum and
// keep full-package at ~71% of it; don't let the two drift apart.
export const PRICES = {
  report: "$0.10",
  prep: "$0.10",
  letter: "$0.10",
  "action-items": "$0.10",
  questions: "$0.10",
  debrief: "$0.10",
  medication: "$0.10",
  "symptom-timeline": "$0.10",
  "insurance-claim": "$0.10",
  "postpartum-checklist": "$0.10",
  translate: "$0.10",
  "cost-estimate": "$0.25",
  "travel-health": "$0.25",
  insurance: "$0.50",
  "medication-check": "$0.50",
  "lab-results": "$0.50",
  // --- maternal-specific additions (9 tools, sum $1.50) ---
  "trimester-plan": "$0.10",
  "birth-plan": "$0.10",
  "hospital-bag": "$0.10",
  "pelvic-floor": "$0.10",
  "growth-tracker": "$0.10",
  vaccinations: "$0.25",
  nutrition: "$0.25",
  "feeding-support": "$0.25",
  "newborn-care": "$0.25",
  "bundle-student": "$2.99",
  "bundle-senior": "$4.99",
  "bundle-travel": "$3.99",
  "bundle-chronic": "$5.99",
  "bundle-family": "$9.99",
  "full-package": "$3.25",
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
 * OKX wraps every REST response (including its x402 facilitator) in its
 * standard envelope: {"code":0,"data":{...actual x402 payload...}}.
 * @x402/core's HTTPFacilitatorClient expects the plain x402 payload
 * directly — unwrapped — and throws "invalid data" / crashes the whole
 * process on boot when it isn't. This was only reachable once real OKX
 * credentials were in place and the facilitator actually responded,
 * which is exactly why it wasn't caught earlier. Rather than assume the
 * SDK exposes a response-transform hook (unverified without reading its
 * internals), this scopes a fetch patch narrowly to facilitator-URL
 * calls only, so nothing else in the app is affected.
 */
function installFacilitatorEnvelopeUnwrap() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url;
    const response = await originalFetch(input, init);
    if (!url || !url.startsWith(FACILITATOR_URL)) return response;

    let body;
    try {
      body = await response.clone().json();
    } catch {
      return response; // not JSON — pass through untouched
    }

    if (body && typeof body === "object" && "code" in body && "data" in body) {
      return new Response(JSON.stringify(body.data), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    return response;
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

  installFacilitatorEnvelopeUnwrap();

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
    ...routeConfig("medication", PRICES.medication, "Summarize medications/supplements and doses mentioned in recent notes"),
    ...routeConfig("symptom-timeline", PRICES["symptom-timeline"], "Build a chronological symptom timeline with trend reads"),
    ...routeConfig("insurance-claim", PRICES["insurance-claim"], "Summarize care events for an insurance claim or reimbursement request"),
    ...routeConfig("postpartum-checklist", PRICES["postpartum-checklist"], "Build a postpartum recovery checklist grounded in recent notes"),
    ...routeConfig("translate", PRICES.translate, "Translate a health note or provider instructions between English and a target language"),
    ...routeConfig("cost-estimate", PRICES["cost-estimate"], "Organize cost/billing figures already mentioned in recent notes"),
    ...routeConfig("travel-health", PRICES["travel-health"], "Build a vaccination/travel-health prep checklist from recent notes"),
    ...routeConfig("insurance", PRICES.insurance, "Organize care events and questions to ask an insurer for eligibility/claims"),
    ...routeConfig("medication-check", PRICES["medication-check"], "Flag possible duplicate/unclear medication log entries for a pharmacist"),
    ...routeConfig("lab-results", PRICES["lab-results"], "Organize logged lab result values exactly as reported, no independent interpretation"),
    ...routeConfig("trimester-plan", PRICES["trimester-plan"], "Group prenatal notes by the trimester/timing the user mentioned"),
    ...routeConfig("birth-plan", PRICES["birth-plan"], "Draft a birth plan from stated preferences only"),
    ...routeConfig("hospital-bag", PRICES["hospital-bag"], "Build a hospital bag packing checklist"),
    ...routeConfig("pelvic-floor", PRICES["pelvic-floor"], "Organize pelvic floor recovery notes and flag concerns for a specialist"),
    ...routeConfig("growth-tracker", PRICES["growth-tracker"], "Organize logged infant growth measurements, no percentile classification"),
    ...routeConfig("vaccinations", PRICES.vaccinations, "Vaccination checklist for mother and baby, not a live schedule"),
    ...routeConfig("nutrition", PRICES.nutrition, "Pregnancy/postpartum nutrition guide, general public info only"),
    ...routeConfig("feeding-support", PRICES["feeding-support"], "Organize breastfeeding/feeding logs and flag concerns for a lactation consultant"),
    ...routeConfig("newborn-care", PRICES["newborn-care"], "Newborn care checklist grounded in logged notes"),
    ...routeConfig("bundle/student", PRICES["bundle-student"], "Student Health Bundle: report, prep, cost breakdown, insurance eligibility guide"),
    ...routeConfig("bundle/senior", PRICES["bundle-senior"], "Senior Care Bundle: medication summary/check, lab results, insurance eligibility guide"),
    ...routeConfig("bundle/travel", PRICES["bundle-travel"], "Travel Health Bundle: travel guide, cost breakdown, optional translation"),
    ...routeConfig("bundle/chronic", PRICES["bundle-chronic"], "Chronic Care Bundle: report, action items, medication summary/check, lab results"),
    ...routeConfig("bundle/family", PRICES["bundle-family"], "Family Bundle: report, prep, action items for up to 5 members"),
    ...routeConfig(
      "full-package",
      PRICES["full-package"],
      "Run all 25 skills at once and return one combined document (discounted bundle)"
    ),
  };

  return paymentMiddleware(routes, resourceServer);
}
