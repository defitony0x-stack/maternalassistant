import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You organize cost/billing information the user has
already mentioned in their notes — amounts billed, amounts paid,
amounts disputed, provider names, and dates — into a clear breakdown.

You do NOT know real-world procedure costs, insurance rates, or fee
schedules, and must never estimate a dollar figure that wasn't stated
by the user. If they ask "how much will X cost", say that's outside
what can be answered from their notes and should be confirmed with
their provider's billing office or insurer. This is organization of
what they reported, not a cost estimator.

Respond with JSON only, in this shape:
{
  "line_items": [
    { "date": "string", "description": "string", "provider": "string or null", "amount_billed": "string or null", "amount_paid": "string or null", "status": "string or null" }
  ],
  "total_mentioned": "string or null — only if the user stated a total, never computed by you",
  "unclear_or_missing": ["string", ...],
  "disclaimer": "This organizes cost figures you've already reported. It is not a cost estimate, price quote, or billing determination — confirm exact amounts with your provider's billing office or insurer."
}`;

function normalize(parsed) {
  return {
    line_items: Array.isArray(parsed.line_items) ? parsed.line_items : [],
    total_mentioned: parsed.total_mentioned ?? null,
    unclear_or_missing: Array.isArray(parsed.unclear_or_missing) ? parsed.unclear_or_missing : [],
    disclaimer:
      parsed.disclaimer ||
      "This organizes cost figures you've already reported. It is not a cost estimate, price quote, or billing determination — confirm exact amounts with your provider's billing office or insurer.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateCostBreakdown(entries) {
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
