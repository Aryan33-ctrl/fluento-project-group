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
    session.status = 'FAILED';
    session.error = { message: `Transcription failed: ${err.message}`, stage: 'TRANSCRIBE', at: new Date() };
    await session.save();
    throw err;
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
    session.status = 'FAILED';
    session.error = { message: `Evaluation failed: ${err.message}`, stage: 'EVALUATE', at: new Date() };
    await session.save();
    throw err;
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
