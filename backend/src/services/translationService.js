import { complete } from "../llmClient.js";

const SUPPORTED_LANGUAGES = ["Chinese", "Japanese", "Korean", "Spanish", "Portuguese", "Hindi", "Thai", "Vietnamese", "Bahasa Indonesia"];

const SYSTEM_PROMPT = `You translate a user's health note (or a
provider's written instructions the user pasted in) between English
and the target language they specify. Translate faithfully — do not
add, remove, or reinterpret medical content, and do not offer your
own medical opinion. If a term has no exact equivalent, translate as
closely as possible and note the ambiguity in brackets rather than
guessing at meaning.

Return plain translated text only, no JSON, no commentary before or
after the translation itself.`;

/**
 * Shared by the web app and the OKX A2MCP handler.
 * @param {string} text — the text to translate
 * @param {string} targetLanguage — e.g. "Spanish"
 * @param {"to_target"|"to_english"} direction
 */
export async function translateMedicalText(text, targetLanguage, direction = "to_target") {
  if (!text || !String(text).trim()) throw new Error("text is required");
  if (!targetLanguage) throw new Error("targetLanguage is required");
  if (!SUPPORTED_LANGUAGES.includes(targetLanguage)) {
    throw new Error(`targetLanguage must be one of: ${SUPPORTED_LANGUAGES.join(", ")}`);
  }

  const instruction =
    direction === "to_english"
      ? `Translate the following text from ${targetLanguage} into English.`
      : `Translate the following text from English into ${targetLanguage}.`;

  const translated = await complete([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `${instruction}\n\n${text}` },
  ]);

  return {
    translated_text: translated.trim(),
    target_language: targetLanguage,
    direction,
    disclaimer: "Machine translation of a medical note. For anything high-stakes (consent forms, medication instructions), confirm with a qualified human interpreter.",
  };
}

export { SUPPORTED_LANGUAGES };
