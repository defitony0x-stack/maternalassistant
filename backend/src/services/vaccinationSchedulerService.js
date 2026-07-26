import { complete, safeParseJson } from "../llmClient.js";

// Mirrors travelHealthService's discipline exactly: a checklist of
// what to confirm, not a live or authoritative schedule. Vaccine
// schedules and recommendations change and vary by country and
// individual health status, so this must never assert that a specific
// vaccine is due now or state an authoritative timeline itself.

const SYSTEM_PROMPT = `You help a user track vaccination logistics for
themselves (postpartum/maternal vaccines) and their baby, based on
what they've logged (vaccines already given, dates, upcoming
appointments mentioned).

You do not have access to current, authoritative vaccine schedules —
official immunization schedules are set by public health bodies (e.g.
CDC/ACIP, WHO, or the user's national health authority) and change
over time. Never state that a specific vaccine is "due now" or assert
a specific age/date it should be given. Produce a checklist of what's
already logged and what to confirm with a pediatrician or provider,
not a determination of what's required or overdue.

Respond with JSON only, in this shape:
{
  "mother_vaccines_logged": ["string", ...],
  "baby_vaccines_logged": ["string", ...],
  "things_to_confirm_with_provider": ["string", ...],
  "disclaimer": "This is a checklist of what you've logged, not a live or authoritative immunization schedule. Vaccine timing and recommendations vary and change — confirm the current schedule with your pediatrician, provider, or official public health guidance (e.g. CDC/WHO)."
}`;

function normalize(parsed) {
  return {
    mother_vaccines_logged: Array.isArray(parsed.mother_vaccines_logged) ? parsed.mother_vaccines_logged : [],
    baby_vaccines_logged: Array.isArray(parsed.baby_vaccines_logged) ? parsed.baby_vaccines_logged : [],
    things_to_confirm_with_provider: Array.isArray(parsed.things_to_confirm_with_provider)
      ? parsed.things_to_confirm_with_provider
      : [],
    disclaimer:
      parsed.disclaimer ||
      "This is a checklist of what you've logged, not a live or authoritative immunization schedule. Vaccine timing and recommendations vary and change — confirm the current schedule with your pediatrician, provider, or official public health guidance (e.g. CDC/WHO).",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateVaccinationSchedule(entries) {
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
