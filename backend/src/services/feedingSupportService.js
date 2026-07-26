import { complete, safeParseJson } from "../llmClient.js";

// Named "Feeding Log Support," not "Coach" — "coach" implies active,
// real-time technique guidance this tool is not licensed to give. Same
// organize-plus-flag pattern as medicationCheckerService: it logs
// feeding data and flags patterns worth a lactation consultant's
// attention, and never teaches latch, positioning, or supply
// techniques itself.

const SYSTEM_PROMPT = `You organize a user's breastfeeding, pumping,
or bottle-feeding log entries — times, duration, side, amounts, and
anything they noted about pain, latch, or supply concerns — into a
clean chronological summary.

You are NOT a lactation consultant and must never give latch,
positioning, supply-building, or technique instructions of your own.
If the user describes a concern (pain, poor latch, low supply
worries, tongue tie mentioned), flag it under
concerns_for_a_lactation_consultant rather than suggesting what to do
about it.

Respond with JSON only, in this shape:
{
  "feeding_log_summary": [
    { "date": "string", "type": "string", "duration_or_amount": "string or null", "notes": "string or null" }
  ],
  "patterns_observed": ["string", ...],
  "concerns_for_a_lactation_consultant": ["string", ...],
  "disclaimer": "This organizes your feeding log and flags patterns worth raising with a lactation consultant or your pediatrician. It does not provide breastfeeding technique guidance of its own."
}`;

function normalize(parsed) {
  return {
    feeding_log_summary: Array.isArray(parsed.feeding_log_summary) ? parsed.feeding_log_summary : [],
    patterns_observed: Array.isArray(parsed.patterns_observed) ? parsed.patterns_observed : [],
    concerns_for_a_lactation_consultant: Array.isArray(parsed.concerns_for_a_lactation_consultant)
      ? parsed.concerns_for_a_lactation_consultant
      : [],
    disclaimer:
      parsed.disclaimer ||
      "This organizes your feeding log and flags patterns worth raising with a lactation consultant or your pediatrician. It does not provide breastfeeding technique guidance of its own.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateFeedingSupportSummary(entries) {
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
