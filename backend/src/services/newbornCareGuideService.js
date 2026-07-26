import { complete, safeParseJson } from "../llmClient.js";

// Mirrors postpartumChecklistService but for the baby. The riskiest
// part of this domain is red-flag/when-to-call guidance, so this
// deliberately does NOT state clinical thresholds itself (e.g. a fever
// cutoff, a wet-diaper count) — those are real numbers with real
// stakes, and this app has no reference data behind them. Instead it
// prompts the user to confirm the actual thresholds with their
// pediatrician or discharge paperwork, the same way labResultService
// never invents a reference range.

const SYSTEM_PROMPT = `You build a newborn care checklist grounded in
the user's own notes — feeding, sleep, diaper counts, temperament, and
any guidance a pediatrician or nurse already gave them.

Base items on what the user actually wrote or clearly implied. Do not
invent generic newborn-care advice unconnected to their notes, and do
not state specific clinical thresholds yourself (e.g. an exact fever
temperature, an exact wet-diaper count, an exact weight-loss
percentage) — those vary by baby and by pediatrician guidance. Instead,
list them as questions to confirm with their pediatrician. If the user
describes something that sounds urgent (baby not feeding, unusually
lethargic, breathing concerns, fever mentioned), include it under
flag_for_pediatrician_now rather than downplaying or normalizing it.

Respond with JSON only, in this shape:
{
  "feeding_and_sleep": ["string", ...],
  "diapering_and_hygiene": ["string", ...],
  "development_and_temperament": ["string", ...],
  "questions_to_confirm_with_pediatrician": ["string", ...],
  "flag_for_pediatrician_now": ["string", ...],
  "disclaimer": "This checklist is based on your own notes. It is not medical advice and does not replace guidance from your pediatrician — for any specific threshold (fever, feeding, weight), confirm the current number with them directly. If something feels urgent, contact your pediatrician or emergency services now rather than waiting on this checklist."
}`;

const KEYS = [
  "feeding_and_sleep",
  "diapering_and_hygiene",
  "development_and_temperament",
  "questions_to_confirm_with_pediatrician",
  "flag_for_pediatrician_now",
];

function normalize(parsed) {
  const out = {};
  for (const key of KEYS) {
    out[key] = Array.isArray(parsed[key]) ? parsed[key] : [];
  }
  out.disclaimer =
    parsed.disclaimer ||
    "This checklist is based on your own notes. It is not medical advice and does not replace guidance from your pediatrician — for any specific threshold (fever, feeding, weight), confirm the current number with them directly. If something feels urgent, contact your pediatrician or emergency services now rather than waiting on this checklist.";
  return out;
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateNewbornCareGuide(entries) {
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
