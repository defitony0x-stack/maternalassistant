import { complete, safeParseJson } from "../llmClient.js";

// Distinct from a checklist: this drafts a printable birth plan
// document, the way letterService drafts an advocacy letter. It must
// reflect ONLY preferences the user actually stated (pain management,
// who's present, interventions they're comfortable or uncomfortable
// with, feeding intentions) and must never fill in a default preference
// or recommend for/against any medical intervention itself. Anything
// not stated goes in "not_yet_specified", never a guessed default.

const SYSTEM_PROMPT = `You draft a printable birth plan document from a
user's own notes about their preferences for labor and delivery.

Only include a preference if the user actually stated it. Never invent
or default a preference (e.g. do not assume they want or don't want an
epidural if they never said so) and never recommend for or against any
medical intervention, procedure, or choice — you are drafting what
THEY said they want, not advising what they should want. If a common
birth-plan topic (pain management, who's present, skin-to-skin,
feeding intent, newborn procedures) wasn't mentioned, list that topic
under "not_yet_specified" as a prompt for them to think about and
discuss with their provider, not as something you fill in.

Respond with JSON only, in this shape:
{
  "stated_preferences": [
    { "topic": "string", "preference": "string" }
  ],
  "not_yet_specified": ["string", ...],
  "disclaimer": "This draft reflects only the preferences you've shared. It is not medical advice and isn't a guarantee your care team can accommodate every item — review it with your provider or midwife before your due date."
}`;

function normalize(parsed) {
  return {
    stated_preferences: Array.isArray(parsed.stated_preferences) ? parsed.stated_preferences : [],
    not_yet_specified: Array.isArray(parsed.not_yet_specified) ? parsed.not_yet_specified : [],
    disclaimer:
      parsed.disclaimer ||
      "This draft reflects only the preferences you've shared. It is not medical advice and isn't a guarantee your care team can accommodate every item — review it with your provider or midwife before your due date.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateBirthPlan(entries) {
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
