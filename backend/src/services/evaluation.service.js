import { env } from '../config/env.js';
import { getGemini } from './geminiClient.js';
import { evaluationSchema } from '../validators/schemas.js';

export const RUBRIC = `Score each dimension 0-100 using these anchors:
90-100 near-native / professionally polished; 75-89 clear with minor issues; 60-74 understandable with noticeable errors; 40-59 frequent errors hinder understanding; 0-39 very limited.
- grammar: tense, agreement, articles, prepositions, word order (count and severity of errors).
- vocabulary: range, precision, collocations, repetition.
- fluency: smooth flow, sentence linking, hesitation, fillers and pauses (use the MEASURED delivery metrics provided).
- clarity: how easily a listener follows the message and structure.
- sentenceConstruction: variety and well-formedness of sentences.
- relevance: how well the answer addresses the topic/question.`;

const SYSTEM = `You are an expert English speaking coach evaluating a TRANSCRIPT of spoken English.
Rules:
- You only see the transcript and measured delivery metrics. You CANNOT hear audio, so never comment on accent, intonation or phonetic accuracy, and never invent pronunciation judgements.
- Quote "original" text exactly from the transcript. Only list real mistakes found in the transcript; return empty arrays if none.
- Be encouraging, specific and concise. These scores are coaching estimates, not an official proficiency certification.
${RUBRIC}
Return ONLY JSON with keys: fluencyScore, grammarScore, vocabularyScore, clarityScore, sentenceConstructionScore, relevanceScore, summary, strengths[], weaknesses[], grammarMistakes[{original,corrected,explanation}], vocabularySuggestions[{original,suggestion,reason}], sentenceImprovements[{original,improved,explanation}], recommendations[], nextPracticeTopics[].`;

export const WEIGHTS = { grammarScore: 0.25, fluencyScore: 0.25, vocabularyScore: 0.2, clarityScore: 0.15, relevanceScore: 0.15 };
export function computeOverall(e) {
  return Math.round(Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + e[k] * w, 0));
}

// Assemble the stored evaluation: validated model output + server-computed fields.
export function finalizeEvaluation(parsed, { transcript, audioMetrics }) {
  const valid = evaluationSchema.parse(parsed);
  return {
    ...valid,
    overallScore: computeOverall(valid),
    pronunciationScore: null,
    transcript,
    deliveryMetrics: audioMetrics,
    basis: {
      measured: ['durationSeconds', 'wordsPerMinute', 'pauseCount', 'fillerWordCount'],
      estimated: ['fluencyScore', 'grammarScore', 'vocabularyScore', 'clarityScore', 'sentenceConstructionScore', 'relevanceScore', 'overallScore'],
      notMeasured: ['pronunciationScore'],
    },
  };
}

export async function evaluateSpeech({ transcript, practiceType, topic, difficulty, audioMetrics }) {
  const user = JSON.stringify({ practiceType, topic: topic || 'free speaking', difficulty, measuredDeliveryMetrics: audioMetrics, transcript });
  const model = getGemini().getGenerativeModel({ model: env.GEMINI_MODEL, generationConfig: { temperature: 0.2 }, responseMimeType: 'application/json' });
  const res = await model.generateContent([
    { role: 'system', parts: [{ text: SYSTEM }] },
    { role: 'user', parts: [{ text: user }] },
  ]);
  const text = res?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return finalizeEvaluation(JSON.parse(text), { transcript, audioMetrics });
}
