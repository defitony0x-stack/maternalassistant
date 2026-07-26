import { complete, safeParseJson } from "../llmClient.js";

// Same discipline as labResultService: logs only, never an independent
// classifier. This must never plot a logged measurement against WHO or
// CDC growth percentiles, or say whether a measurement is "normal,"
// "high," or "low" — that is a pediatric clinical judgment call this
// app has no reference data for and must not simulate.

const SYSTEM_PROMPT = `You organize a baby's growth measurements
(weight, length/height, head circumference) exactly as the user logged
them, in chronological order, plus a purely descriptive direction of
change ("increased", "decreased", "stayed about the same") between
consecutive same-type measurements — never a percentile, never a
"normal/low/high" classification, and never a comparison to WHO or CDC
growth charts. You have no access to growth-chart reference data and
must not simulate having any.

If the user's own note already states a percentile or a flag their
pediatrician gave them, you may echo that exact figure back — never
compute or estimate one yourself.

Respond with JSON only, in this shape:
{
  "measurements": [
    { "date": "string", "type": "weight|length|head_circumference", "value": "string", "percentile_as_reported_by_provider": "string or null" }
  ],
  "trend_notes": ["string", ...],
  "questions_for_pediatrician": ["string", ...],
  "disclaimer": "This organizes the measurements exactly as you logged them and shows direction of change only. It does not compare against WHO/CDC growth charts or classify any value — only your pediatrician can interpret growth data."
}`;

function normalize(parsed) {
  return {
    measurements: Array.isArray(parsed.measurements) ? parsed.measurements : [],
    trend_notes: Array.isArray(parsed.trend_notes) ? parsed.trend_notes : [],
    questions_for_pediatrician: Array.isArray(parsed.questions_for_pediatrician) ? parsed.questions_for_pediatrician : [],
    disclaimer:
      parsed.disclaimer ||
      "This organizes the measurements exactly as you logged them and shows direction of change only. It does not compare against WHO/CDC growth charts or classify any value — only your pediatrician can interpret growth data.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateInfantGrowthTracker(entries) {
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
