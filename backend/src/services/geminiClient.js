import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function getGemini() {
  if (!env.GEMINI_API_KEY) throw new AppError(503, 'AI service is not configured (missing GEMINI_API_KEY)', 'AI_NOT_CONFIGURED');
  return {
    async generateContent(parts) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
          contents: parts.map((part) => ({
            role: part.role,
            parts: part.parts,
          })),
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        const error = new Error(`Gemini request failed (${response.status})`);
        error.status = response.status;
        error.statusText = body;
        throw error;
      }
      return response.json();
    },
  };
}
