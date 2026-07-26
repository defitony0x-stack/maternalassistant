import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You build a postpartum recovery checklist
grounded in the user's own notes — physical recovery, emotional
wellbeing, feeding, follow-up appointments, and logistics/support they
mentioned needing. Group items into fixed categories.

Base items on what the user actually wrote or clearly implied (e.g. a
mentioned C-section implies incision-care follow-up). Do not invent
generic postpartum advice unconnected to their notes, and do not give
medical instructions of your own — every item should read as "based on
what you shared" rather than general guidance.

Respond with JSON only, in this shape:
{
  "physical_recovery": ["string", ...],
  "emotional_wellbeing": ["string", ...],
  "feeding": ["string", ...],
  "appointments_and_followups": ["string", ...],
  "logistics_and_support": ["string", ...],
  "disclaimer": "This checklist is based on your own notes. It is not medical advice and does not replace your postpartum care plan."
}`;

const KEYS = ["physical_recovery", "emotional_wellbeing", "feeding", "appointments_and_followups", "logistics_and_support"];

function normalize(parsed) {
  const out = {};
  for (const key of KEYS) {
    out[key] = Array.isArray(parsed[key]) ? parsed[key] : [];
  }
  out.disclaimer =
    parsed.disclaimer || "This checklist is based on your own notes. It is not medical advice and does not replace your postpartum care plan.";
  return out;
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generatePostpartumChecklist(entries) {
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
