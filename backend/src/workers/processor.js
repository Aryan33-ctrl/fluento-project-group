import { env } from '../config/env.js';
import { PracticeSession } from '../models/PracticeSession.js';
import { transcribe } from '../services/transcription.service.js';
import { evaluateSpeech } from '../services/evaluation.service.js';
import { AppError } from '../utils/AppError.js';

export async function processSession(job) {
  const { sessionId } = job.data;
  const session = await PracticeSession.findById(sessionId).select('+audioStorageKey');
  if (!session) {
    throw new AppError(404, `Practice session ${sessionId} not found`, 'SESSION_NOT_FOUND');
  }
  if (!session.audioStorageKey) {
    throw new AppError(400, 'Practice recording is missing', 'MISSING_AUDIO');
  }

  // ---- Transcribe with Groq ----
  let transcriptionResult;
  try {
    session.status = 'TRANSCRIBING';
    session.processingMetadata.startedAt ??= new Date();
    session.processingMetadata.attempts = (session.processingMetadata.attempts || 0) + 1;
    await session.save();
    transcriptionResult = await transcribe(session.audioStorageKey);
  } catch (err) {
    let message = 'Speech transcription is temporarily unavailable.';
    if (err?.code === 'AI_NOT_CONFIGURED' || err?.code === 'GROQ_AUTH_INVALID') {
      message = 'Speech transcription is not configured with a valid Groq API key.';
    } else if (err?.code === 'GROQ_RATE_LIMITED') {
      message = 'The transcription service is currently rate-limited. Please try again shortly.';
    } else if (err?.status === 401 || err?.statusCode === 401) {
      message = 'The transcription service rejected its API key.';
    }
    session.status = 'FAILED';
    session.error = { message, stage: 'TRANSCRIBE', at: new Date() };
    await session.save();
    throw Object.assign(new Error(message), { unrecoverable: err?.code === 'AI_NOT_CONFIGURED' || err?.code === 'GROQ_AUTH_INVALID' });
  }
  if (!transcriptionResult.text) {
    const err = Object.assign(new Error('No speech detected in the recording'), { unrecoverable: true });
    session.status = 'FAILED';
    session.error = { message: err.message, stage: 'TRANSCRIBE', at: new Date() };
    await session.save();
    throw err;
  }

  // ---- Evaluate with Gemini ----
  let evaluationResult;
  try {
    session.status = 'EVALUATING';
    await session.save();
    evaluationResult = await evaluateSpeech({
      transcript: transcriptionResult.text,
      practiceType: session.practiceType,
      topic: session.topic,
      difficulty: session.difficulty,
      audioMetrics: transcriptionResult.audioMetrics,
    });
  } catch (err) {
    let message = 'Speech evaluation is temporarily unavailable.';
    if (err?.code === 'AI_NOT_CONFIGURED') {
      message = 'Speech evaluation is not configured with a valid Gemini API key.';
    } else if (err?.status === 401 || err?.statusCode === 401) {
      message = 'The evaluation service rejected its API key.';
    } else if (err?.status === 429 || err?.statusCode === 429) {
      message = 'The evaluation service is currently rate-limited. Please try again shortly.';
    }
    session.status = 'FAILED';
    session.error = { message, stage: 'EVALUATE', at: new Date() };
    await session.save();
    throw Object.assign(new Error(message), { unrecoverable: err?.code === 'AI_NOT_CONFIGURED' });
  }

  // ---- Persist results ----
  session.transcript   = transcriptionResult.text;
  if (transcriptionResult.duration > 0) {
    session.duration = Math.round(transcriptionResult.duration);
  }
  session.evaluation   = evaluationResult;
  session.processingMetadata.audioMetrics = transcriptionResult.audioMetrics;
  session.processingMetadata.transcribeModel = env.GROQ_TRANSCRIBE_MODEL;
  session.processingMetadata.evaluationModel = env.GEMINI_MODEL;
  session.status       = 'COMPLETED';
  session.completedAt  = new Date();

  await session.save();
  return session;
}
