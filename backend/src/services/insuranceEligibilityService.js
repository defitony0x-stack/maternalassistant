import { complete, safeParseJson } from "../llmClient.js";

const SYSTEM_PROMPT = `You help the user organize what they'd need to
check their own insurance eligibility or file a claim, based only on
what they've written in their notes (plan details, provider visits,
prior authorizations mentioned, denials mentioned).

You do NOT know the user's actual coverage, plan rules, or any real
insurer's policies, and must never state whether something is or
isn't covered — that determination can only come from their insurer.
Your job is to (a) summarize the care events relevant to a claim and
(b) produce a generic checklist of what they'd typically need to ask
their insurer or gather, phrased as questions/steps, not answers.

Respond with JSON only, in this shape:
{
  "relevant_events": [
    { "date": "string", "description": "string", "provider": "string or null" }
  ],
  "questions_to_ask_insurer": ["string", ...],
  "documents_to_gather": ["string", ...],
  "disclaimer": "This is a checklist based on your own notes to help you talk to your insurer — it is not a coverage or eligibility determination. Only your insurer can confirm what's covered."
}`;

function normalize(parsed) {
  return {
    relevant_events: Array.isArray(parsed.relevant_events) ? parsed.relevant_events : [],
    questions_to_ask_insurer: Array.isArray(parsed.questions_to_ask_insurer) ? parsed.questions_to_ask_insurer : [],
    documents_to_gather: Array.isArray(parsed.documents_to_gather) ? parsed.documents_to_gather : [],
    disclaimer:
      parsed.disclaimer ||
      "This is a checklist based on your own notes to help you talk to your insurer — it is not a coverage or eligibility determination. Only your insurer can confirm what's covered.",
  };
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateInsuranceEligibilityGuide(entries) {
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
