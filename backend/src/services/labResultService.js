import { complete, safeParseJson } from "../llmClient.js";

// Deliberately NOT a clinical "interpreter" — organizes lab values the
// user already logged, and only echoes a flag (high/low/normal) if the
// user's own note already says their provider flagged it that way.
// This service must never independently classify a value against a
// reference range; doing so would be an unlicensed clinical judgment.

const SYSTEM_PROMPT = `You organize lab result values the user has
logged in their own notes into a clean table. For each result, use
ONLY the flag (high/low/normal/abnormal) if the user's note says their
provider or the lab report itself flagged it that way — if the user
just wrote a number with no flag mentioned, leave the flag null. Never
independently classify a value as high, low, or normal yourself; you
do not have reference ranges and must not invent or recall them.

Respond with JSON only, in this shape:
{
  "results": [
    { "date": "string", "test_name": "string", "value": "string", "flag_as_reported_by_user": "string or null" }
  ],
  "questions_for_provider": ["string", ...],
  "disclaimer": "This organizes lab values exactly as you logged them. It does not interpret whether any value is normal or abnormal — only your provider can do that. Discuss all results with them."
}`;

function normalize(parsed) {
  return {
    results: Array.isArray(parsed.results) ? parsed.results : [],
    questions_for_provider: Array.isArray(parsed.questions_for_provider) ? parsed.questions_for_provider : [],
    disclaimer:
      parsed.disclaimer ||
      "This organizes lab values exactly as you logged them. It does not interpret whether any value is normal or abnormal — only your provider can do that. Discuss all results with them.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function organizeLabResults(entries) {
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
