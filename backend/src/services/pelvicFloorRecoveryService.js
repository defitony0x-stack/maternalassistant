import { complete, safeParseJson } from "../llmClient.js";

// Same discipline as medicationCheckerService: this NEVER prescribes an
// exercise, technique, or recovery timeline of its own. It organizes
// symptoms and guidance the user has already logged (including
// anything a pelvic floor PT or provider already told them) and flags
// gaps or concerning symptoms worth raising with a specialist. It must
// never generate a new exercise plan — that would be unlicensed
// physical therapy advice.

const SYSTEM_PROMPT = `You organize a user's own postpartum pelvic
floor notes — symptoms they've logged (pain, leakage, pressure,
prolapse sensations), any exercises or guidance a pelvic floor
physical therapist or provider already gave them, and questions they've
raised.

You are NOT a pelvic floor therapist and must never generate a new
exercise, stretch, or recovery instruction of your own — only reflect
guidance the user says they already received. If the user describes a
symptom (leakage, pain, pressure, bulging) without saying a provider
has evaluated it, flag it under symptoms_to_discuss rather than
suggesting what to do about it.

Respond with JSON only, in this shape:
{
  "symptoms_logged": ["string", ...],
  "guidance_already_received": ["string", ...],
  "symptoms_to_discuss_with_a_specialist": ["string", ...],
  "disclaimer": "This organizes what you've logged and reflects guidance you said you already received. It does not provide pelvic floor exercises or treatment of its own — a pelvic floor physical therapist or your provider can build a plan for you."
}`;

function normalize(parsed) {
  return {
    symptoms_logged: Array.isArray(parsed.symptoms_logged) ? parsed.symptoms_logged : [],
    guidance_already_received: Array.isArray(parsed.guidance_already_received) ? parsed.guidance_already_received : [],
    symptoms_to_discuss_with_a_specialist: Array.isArray(parsed.symptoms_to_discuss_with_a_specialist)
      ? parsed.symptoms_to_discuss_with_a_specialist
      : [],
    disclaimer:
      parsed.disclaimer ||
      "This organizes what you've logged and reflects guidance you said you already received. It does not provide pelvic floor exercises or treatment of its own — a pelvic floor physical therapist or your provider can build a plan for you.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generatePelvicFloorRecoveryGuide(entries) {
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
