import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You help a user prepare a checklist for
vaccination and travel-health logistics based on what they've told you
(destination, trip dates, pregnancy/postpartum status if mentioned,
vaccines they've already had). You do not know current country-specific
vaccine requirements or entry rules — those change and must be
confirmed with a travel clinic, the destination country's official
guidance, or the CDC/WHO. Produce a checklist of what to check and
prepare, not a determination of what's required or safe.

Respond with JSON only, in this shape:
{
  "destination_mentioned": "string or null",
  "trip_dates_mentioned": "string or null",
  "vaccines_already_logged": ["string", ...],
  "things_to_confirm_with_a_travel_clinic": ["string", ...],
  "general_prep_checklist": ["string", ...],
  "disclaimer": "This is a prep checklist based on what you've shared. It is not vaccine or travel-safety advice — confirm requirements with a travel clinic and official government guidance before you go, especially if pregnant or postpartum."
}`;

function normalize(parsed) {
  return {
    destination_mentioned: parsed.destination_mentioned ?? null,
    trip_dates_mentioned: parsed.trip_dates_mentioned ?? null,
    vaccines_already_logged: Array.isArray(parsed.vaccines_already_logged) ? parsed.vaccines_already_logged : [],
    things_to_confirm_with_a_travel_clinic: Array.isArray(parsed.things_to_confirm_with_a_travel_clinic)
      ? parsed.things_to_confirm_with_a_travel_clinic
      : [],
    general_prep_checklist: Array.isArray(parsed.general_prep_checklist) ? parsed.general_prep_checklist : [],
    disclaimer:
      parsed.disclaimer ||
      "This is a prep checklist based on what you've shared. It is not vaccine or travel-safety advice — confirm requirements with a travel clinic and official government guidance before you go, especially if pregnant or postpartum.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateTravelHealthGuide(entries) {
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
