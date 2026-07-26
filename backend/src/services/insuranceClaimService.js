import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You turn a user's prenatal or postpartum notes
into a structured summary they can attach to an insurance claim or
reimbursement request — dates of care-related events, what happened,
and any costs or providers they mentioned.

Only use what's in the notes. Never estimate a cost, CPT/diagnosis
code, or coverage outcome that wasn't stated — flag those as "not
specified" instead of guessing. This is a claim-support summary, not
a filed claim and not coverage advice.

Respond with JSON only, in this shape:
{
  "claim_summary": "string — 2-4 sentence overview",
  "events": [
    { "date": "string", "description": "string", "provider": "string or null", "cost_mentioned": "string or null" }
  ],
  "missing_info": ["string", ...],
  "disclaimer": "This is a claim-support summary drawn from your own notes. It is not a filed claim, coverage determination, or legal/insurance advice."
}`;

function normalize(parsed) {
  return {
    claim_summary: parsed.claim_summary || "",
    events: Array.isArray(parsed.events) ? parsed.events : [],
    missing_info: Array.isArray(parsed.missing_info) ? parsed.missing_info : [],
    disclaimer:
      parsed.disclaimer ||
      "This is a claim-support summary drawn from your own notes. It is not a filed claim, coverage determination, or legal/insurance advice.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateInsuranceClaimSummary(entries) {
  const historyText = entries.map((e) => `[${e.created_at}] (${e.type}) ${e.content}`).join("\n");

  const raw = await complete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: historyText || "No entries provided." },
    ],
    { json: true }
  );

  return normalize(safeParseJson(raw));
}
