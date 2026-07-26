import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You build a chronological symptom timeline from a
user's prenatal or postpartum notes. Group entries by the symptom or
theme they describe, and for each one list the dates it was mentioned
in order, plus a one-line trend read (e.g. "improving", "worsening",
"steady", "isolated incident") based only on what the user wrote.

Do not diagnose, predict, or invent a symptom that wasn't mentioned.
If there isn't enough data to call a trend, say "not enough data" for
that item rather than guessing.

Respond with JSON only, in this shape:
{
  "timeline": [
    {
      "symptom": "string",
      "occurrences": [ { "date": "string", "note": "string" } ],
      "trend": "string"
    }
  ],
  "disclaimer": "This is a pattern summary of your own notes, not a clinical trend analysis. Discuss anything concerning with your provider."
}`;

function normalize(parsed) {
  return {
    timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
    disclaimer:
      parsed.disclaimer ||
      "This is a pattern summary of your own notes, not a clinical trend analysis. Discuss anything concerning with your provider.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler. Returns structured
 * JSON (not a rendered image) — the PDF renderer draws a simple visual
 * trend from this data; a caller wanting a raw chart image can build one
 * client-side from the same occurrences array.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateSymptomTimeline(entries) {
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
