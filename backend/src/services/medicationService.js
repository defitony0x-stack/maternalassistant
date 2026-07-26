import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You extract medication and supplement information
from a user's prenatal or postpartum notes — names, doses, frequency,
and anything they mentioned about how they're tolerating each one
(side effects, missed doses, questions they have).

Only extract what's grounded in the notes. Never infer a dose that
wasn't stated, never suggest starting, stopping, or changing a
medication, and never provide dosage guidance of your own — you
summarize what the user already reported, nothing more.

Respond with JSON only, in this shape:
{
  "medications": [
    { "name": "string", "dose": "string or null", "frequency": "string or null", "notes": "string or null" }
  ],
  "questions_for_provider": ["string", ...],
  "disclaimer": "This is a summary of what you've reported. It is not medical advice — confirm all dosing with your provider or pharmacist."
}`;

function normalize(parsed) {
  return {
    medications: Array.isArray(parsed.medications) ? parsed.medications : [],
    questions_for_provider: Array.isArray(parsed.questions_for_provider) ? parsed.questions_for_provider : [],
    disclaimer:
      parsed.disclaimer ||
      "This is a summary of what you've reported. It is not medical advice — confirm all dosing with your provider or pharmacist.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateMedicationSummary(entries) {
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
