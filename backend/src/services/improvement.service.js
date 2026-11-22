import { env } from '../config/env.js';
import { getGemini } from './geminiClient.js';
import { planSchema } from '../validators/schemas.js';

/**
 * Generate a 7‑day improvement plan based on recent session summaries.
 *
 * @param {Array<Object>} summaries – array of objects containing:
 *   practiceType, topic, scores {fluency, grammar, vocabulary, clarity},
 *   weaknesses, grammarMistakes, nextTopics, etc.
 * @returns {Promise<Object>} – validated plan object matching `planSchema`.
 */
export async function generatePlan(summaries) {
  const userPrompt = JSON.stringify({ summaries });

  const model = getGemini().getGenerativeModel({
    model: env.GEMINI_MODEL,
    generationConfig: { temperature: 0.3 },
    responseMimeType: 'application/json',
  });

  const res = await model.generateContent([
    {
      role: 'system',
      parts: [
        {
          text: `You are an expert English coach. Create a concrete 7‑day study plan based on the provided session summaries. Return **only** JSON matching the schema defined in src/validators/schemas.js (planSchema).`,
        },
      ],
    },
    { role: 'user', parts: [{ text: userPrompt }] },
  ]);

  const text = res?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini while generating plan');

  const parsed = planSchema.parse(JSON.parse(text));
  return parsed;
}
