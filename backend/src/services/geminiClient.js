import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

let geminiClient;
export function getGemini() {
  if (!env.GEMINI_API_KEY) throw new AppError(503, 'AI service is not configured (missing GEMINI_API_KEY)', 'AI_NOT_CONFIGURED');
  geminiClient ??= new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return geminiClient;
}
