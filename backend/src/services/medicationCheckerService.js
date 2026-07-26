import { complete, safeParseJson } from "../llmClient.js";

// Distinct from medicationService.js (which summarizes doses/tolerance
// for a report). This one is scoped to a narrower, higher-stakes
// question: has the user mentioned anything that looks like a
// duplicate, overlapping, or conflicting medication entry across their
// own notes, or a gap they should flag to a pharmacist? It never
// performs real drug-interaction analysis — there's no drug database
// behind this, and it must never imply there is one.

const SYSTEM_PROMPT = `You review a user's own notes about medications
and supplements they're taking and flag things worth a pharmacist's or
provider's attention — possible duplicates (same medication logged
twice under different names), unclear dosing the user themselves
expressed confusion about, or a supplement/medication combination the
user explicitly said they were unsure about.

You have NO drug-interaction database and must never claim to have
checked for interactions, contraindications, or safety. Do not
generate a safety verdict ("this combination is fine" / "this is
dangerous"). Every output item must be phrased as a question or flag
for the user to bring to a pharmacist — never a clinical conclusion.

Respond with JSON only, in this shape:
{
  "medications_logged": ["string", ...],
  "flags_for_pharmacist": ["string", ...],
  "disclaimer": "This organizes what you've logged and flags things worth asking a pharmacist about. It does not check drug interactions or dosing safety — always confirm medication safety with a pharmacist or your provider."
}`;

function normalize(parsed) {
  return {
    medications_logged: Array.isArray(parsed.medications_logged) ? parsed.medications_logged : [],
    flags_for_pharmacist: Array.isArray(parsed.flags_for_pharmacist) ? parsed.flags_for_pharmacist : [],
    disclaimer:
      parsed.disclaimer ||
      "This organizes what you've logged and flags things worth asking a pharmacist about. It does not check drug interactions or dosing safety — always confirm medication safety with a pharmacist or your provider.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function checkMedicationLog(entries) {
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
