import { complete, safeParseJson } from "../llmClient.js";

// Logistics, not medicine — same "organize what's logged, plus
// well-established generic public checklist items" pattern as
// travelHealthService's general_prep_checklist, not a medical
// recommendation engine. A mentioned C-section or multiples pregnancy
// can imply specific items; nothing here is dosing, treatment, or a
// clinical judgment call.

const SYSTEM_PROMPT = `You build a hospital bag packing checklist for
labor and delivery, grounded in the user's own notes plus well-known,
non-personalized packing categories (comfort items, documents,
toiletries, going-home outfit, phone charger, snacks) that any
mainstream hospital-bag guide would list.

Base anything specific on what the user actually wrote or clearly
implied (e.g. a mentioned scheduled C-section implies packing for a
longer stay; mentioned multiples implies extra newborn items). Do not
give medical instructions, do not recommend specific brands or
products, and do not state hospital-specific policies (rules on food,
visitors, or photography vary by hospital) — flag those as "confirm
with your hospital" instead of asserting them.

Respond with JSON only, in this shape:
{
  "for_you": ["string", ...],
  "for_baby": ["string", ...],
  "for_support_person": ["string", ...],
  "documents_and_logistics": ["string", ...],
  "confirm_with_your_hospital": ["string", ...],
  "disclaimer": "This is a general packing checklist based on common practice and what you've shared. It is not medical guidance — confirm any hospital-specific policies with your provider or hospital in advance."
}`;

const KEYS = ["for_you", "for_baby", "for_support_person", "documents_and_logistics", "confirm_with_your_hospital"];

function normalize(parsed) {
  const out = {};
  for (const key of KEYS) {
    out[key] = Array.isArray(parsed[key]) ? parsed[key] : [];
  }
  out.disclaimer =
    parsed.disclaimer ||
    "This is a general packing checklist based on common practice and what you've shared. It is not medical guidance — confirm any hospital-specific policies with your provider or hospital in advance.";
  return out;
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateHospitalBagChecklist(entries) {
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
