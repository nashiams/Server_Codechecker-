const { GoogleGenAI, Type } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

/**
 * Clean up common JSON issues from AI-generated output:
 * - Removes trailing commas (before `]` or `}`)
 */
function sanitizeJsonString(str) {
  return str.replace(/,\s*([\]}])/g, "$1");
}

/**
 * Prompt Gemini with a structured schema and return parsed JSON.
 * @param {string} promptText - The prompt combining requirements and code chunk.
 * @param {object} responseSchema - JSON schema describing expected structure.
 * @returns {Promise<any>} - Parsed JSON response.
 */
async function generateStructured(promptText, responseSchema) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: promptText,
    config: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const raw = response.text;

  try {
    return JSON.parse(sanitizeJsonString(raw));
  } catch (err) {
    console.error("❌ Failed to parse Gemini response:", raw);
    throw {
      name: "GeminiOutputParseError",
      message: "Gemini returned invalid JSON format. Could not parse.",
      original: err,
    };
  }
}

module.exports = { generateStructured };
