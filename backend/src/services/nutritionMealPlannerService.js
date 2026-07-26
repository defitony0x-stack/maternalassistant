import { complete, safeParseJson } from "../llmClient.js";

// The one service in this batch allowed to add generic content beyond
// what the user logged — but strictly capped to well-established,
// non-personalized public-health nutrition guidance (folate, iron,
// common pregnancy food-safety advice like avoiding unpasteurized soft
// cheeses or raw fish). It must never produce calorie targets, a
// personalized meal plan, or dietary instructions for a medical
// condition the user mentions (e.g. gestational diabetes) — those
// require a dietitian, and the prompt routes to that explicitly.

const SYSTEM_PROMPT = `You help a user think through pregnancy or
postpartum nutrition, combining what they've logged (foods, symptoms
like nausea or aversions, any dietary restrictions they mentioned)
with well-established, non-personalized public-health nutrition
guidance that's common across mainstream prenatal nutrition resources
(e.g. folate/iron-rich foods, hydration, common food-safety advice such
as avoiding unpasteurized soft cheeses, raw fish, or deli meats unless
heated).

Do not give calorie targets, macronutrient targets, or a personalized
meal plan. If the user mentions a medical condition that affects diet
(gestational diabetes, preeclampsia, an eating disorder, a GI
condition), do not give dietary instructions for managing it — flag it
under "discuss_with_a_dietitian_or_provider" instead, since that needs
individualized medical nutrition therapy, not general guidance.

Respond with JSON only, in this shape:
{
  "foods_logged": ["string", ...],
  "general_nutrition_notes": ["string", ...],
  "food_safety_reminders": ["string", ...],
  "discuss_with_a_dietitian_or_provider": ["string", ...],
  "disclaimer": "This offers general, non-personalized pregnancy/postpartum nutrition information alongside what you've logged. It is not medical nutrition therapy or a meal plan — for any medical condition affecting your diet, work with a dietitian or your provider."
}`;

const KEYS = ["foods_logged", "general_nutrition_notes", "food_safety_reminders", "discuss_with_a_dietitian_or_provider"];

function normalize(parsed) {
  const out = {};
  for (const key of KEYS) {
    out[key] = Array.isArray(parsed[key]) ? parsed[key] : [];
  }
  out.disclaimer =
    parsed.disclaimer ||
    "This offers general, non-personalized pregnancy/postpartum nutrition information alongside what you've logged. It is not medical nutrition therapy or a meal plan — for any medical condition affecting your diet, work with a dietitian or your provider.";
  return out;
}

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {Array<{content: string, type: string, created_at: string}>} entries
 */
export async function generateNutritionGuide(entries) {
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
