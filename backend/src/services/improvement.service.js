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
  const system = 'You are an expert English coach. Create a concrete 7-day study plan based on the provided session summaries. Return only JSON matching this shape: {"goals":["..."],"recommendations":["..."],"tasks":[{"type":"grammar|vocabulary|speaking|interview|fluency|sentence","title":"...","description":"...","estimatedMinutes":10,"dayOfWeek":0}]}';

  try {
    const res = await getGemini().generateContent([
      { role: 'user', parts: [{ text: `${system}\n\nINPUT:\n${userPrompt}` }] },
    ]);
    const text = res?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini while generating plan');
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return planSchema.parse(JSON.parse(cleaned));
  } catch {
    return createFallbackPlan(summaries);
  }
}

function createFallbackPlan(summaries) {
  const scores = summaries.map((s) => s.scores).filter(Boolean);
  const weakest = ['fluency', 'grammar', 'vocabulary', 'clarity']
    .map((key) => ({
      key,
      score: scores.length ? scores.reduce((sum, s) => sum + (Number(s[key]) || 0), 0) / scores.length : 70,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  const taskTypes = weakest.map((item) => (
    item.key === 'clarity' ? 'speaking'
      : item.key === 'vocabulary' ? 'vocabulary'
        : item.key === 'grammar' ? 'grammar'
          : 'fluency'
  ));

  const tasks = [
    { type: taskTypes[0] || 'speaking', title: 'Review your weakest skill', description: 'Review the feedback from your latest completed recording and rewrite one weak sentence clearly.', estimatedMinutes: 15, dayOfWeek: 0 },
    { type: 'vocabulary', title: 'Learn five useful words', description: 'Collect five new words, write one example sentence for each, and use them aloud.', estimatedMinutes: 10, dayOfWeek: 1 },
    { type: 'grammar', title: 'Fix repeated grammar patterns', description: 'Find two repeated grammar mistakes and practice three corrected examples.', estimatedMinutes: 15, dayOfWeek: 2 },
    { type: 'fluency', title: 'Timed speaking practice', description: 'Speak for two minutes about a familiar topic without stopping to edit your sentences.', estimatedMinutes: 12, dayOfWeek: 3 },
    { type: 'interview', title: 'Practice a structured answer', description: 'Prepare a clear 60-second answer and organize it with a beginning, main point, and conclusion.', estimatedMinutes: 15, dayOfWeek: 4 },
    { type: taskTypes[1] || 'sentence', title: 'Compare and improve sentences', description: 'Write three original sentences, revise them for clarity, and say the revised versions aloud.', estimatedMinutes: 15, dayOfWeek: 5 },
    { type: 'speaking', title: 'Record and review', description: 'Record a final two-minute response, identify one strength, and improve one weak area.', estimatedMinutes: 20, dayOfWeek: 6 },
  ];

  return {
    goals: ['Improve the weakest scored speaking skill', 'Build a consistent daily practice habit', 'Use feedback in a real recording'],
    recommendations: ['Practice aloud rather than only reading', 'Record one response each day', 'Review corrections before your next session'],
    tasks,
  };
}
