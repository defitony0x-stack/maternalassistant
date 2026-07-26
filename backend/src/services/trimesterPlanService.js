import { complete, safeParseJson } from "../llmClient.js";

// Organize-only, same discipline as symptomTimelineService and
// postpartumChecklistService: this groups the user's own notes by the
// trimester or gestational week THEY mentioned. It never infers a due
// date, never calculates gestational age from scratch, and never adds
// a generic "what to expect this trimester" list — that would be
// unlicensed prenatal-care content, not organization of the user's data.

const SYSTEM_PROMPT = `You group a user's prenatal notes into trimesters
based ONLY on dates, gestational weeks, or trimester labels the user
themselves mentioned in their notes (e.g. "week 22", "second
trimester", "32 weeks along"). If an entry gives no timing information,
put it in an "unspecified_timing" bucket rather than guessing which
trimester it belongs to.

Do not calculate or estimate a due date, current gestational age, or
trimester boundary yourself. Do not add general "what to expect" or
milestone content that isn't grounded in what the user wrote — this is
an organizer for their own notes, not a prenatal education guide.

Respond with JSON only, in this shape:
{
  "first_trimester": [ { "date": "string", "note": "string" } ],
  "second_trimester": [ { "date": "string", "note": "string" } ],
  "third_trimester": [ { "date": "string", "note": "string" } ],
  "unspecified_timing": [ { "date": "string", "note": "string" } ],
  "questions_for_provider": ["string", ...],
  "disclaimer": "This organizes your own notes by the timing you mentioned. It does not calculate due dates or gestational age, and it is not a prenatal care plan — confirm timing and care schedule with your provider."
}`;

function normalize(parsed) {
  const bucket = (v) => (Array.isArray(v) ? v : []);
  return {
    first_trimester: bucket(parsed.first_trimester),
    second_trimester: bucket(parsed.second_trimester),
    third_trimester: bucket(parsed.third_trimester),
    unspecified_timing: bucket(parsed.unspecified_timing),
    questions_for_provider: bucket(parsed.questions_for_provider),
    disclaimer:
      parsed.disclaimer ||
      "This organizes your own notes by the timing you mentioned. It does not calculate due dates or gestational age, and it is not a prenatal care plan — confirm timing and care schedule with your provider.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateTrimesterPlan(entries) {
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
