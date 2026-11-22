import fs from 'node:fs';
import { env } from '../config/env.js';
import { audioPath } from '../storage/privateStorage.js';
import { computeAudioMetrics } from '../utils/audio.js';
import Groq from 'groq-sdk';
import { AppError } from '../utils/AppError.js';

let groqClient;
function getGroq() {
  if (!env.GROQ_API_KEY) throw new AppError(503, 'AI service is not configured (missing GROQ_API_KEY)', 'AI_NOT_CONFIGURED');
  groqClient ??= new Groq({ apiKey: env.GROQ_API_KEY, timeout: 120_000, maxRetries: 1 });
  return groqClient;
}

// Transcribe audio using Groq Whisper‑compatible model
export async function transcribe(storageKey) {
  if (typeof storageKey !== 'string' || !storageKey.trim()) {
    throw new AppError(400, 'Practice recording storage key is missing', 'MISSING_AUDIO');
  }
  const full = audioPath(storageKey);
  if (!fs.existsSync(full)) {
    throw new AppError(404, 'Practice recording file was not found', 'AUDIO_NOT_FOUND');
  }
  const fileStream = fs.createReadStream(full);
  let res;
  try {
    res = await getGroq().audio.transcriptions.create({
      file: fileStream,
      model: env.GROQ_TRANSCRIBE_MODEL,
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      language: 'en',
    });
  } catch (err) {
    if (err?.status === 401) {
      throw new AppError(503, 'Groq API key is invalid or expired. Update GROQ_API_KEY and restart the backend.', 'GROQ_AUTH_INVALID');
    }
    if (err?.status === 429) {
      throw new AppError(503, 'Groq is currently rate-limited. Please try again shortly.', 'GROQ_RATE_LIMITED');
    }
    throw err;
  }
  const text = (res.text || '').trim();
  const duration = Number(res.duration) || 0;
  const words = Array.isArray(res.words) ? res.words : [];
  return { text, duration, audioMetrics: computeAudioMetrics({ words, text, duration }) };
}
