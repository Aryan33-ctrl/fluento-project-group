import { processSession } from '../workers/processor.js';
import { PracticeSession } from '../models/PracticeSession.js';

export const QUEUE_NAME = 'speech-processing';

const jobs = new Map();
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

function runJob(job) {
  processSession(job).catch((err) => {
    const retryable = !err.unrecoverable && job.attemptsMade + 1 < MAX_ATTEMPTS;
    if (retryable && jobs.has(job.id)) {
      job.attemptsMade += 1;
      setTimeout(() => runJob(job), RETRY_DELAY_MS * (2 ** (job.attemptsMade - 1)));
      return;
    }
    jobs.delete(job.id);
  });
}

// The session id is the job id, preserving duplicate protection without Redis.
export const enqueueSession = async (sessionId) => {
  const id = String(sessionId);
  if (jobs.has(id)) return jobs.get(id);
  const job = { id, data: { sessionId: id }, attemptsMade: 0, opts: { attempts: MAX_ATTEMPTS } };
  jobs.set(id, job);
  setImmediate(() => runJob(job));
  return job;
};

export async function removeJob(sessionId) {
  jobs.delete(String(sessionId));
}

export const queueHealthy = async () => true;

export async function recoverPendingSessions() {
  const sessions = await PracticeSession.find({ $or: [{ status: 'UPLOADED' }, { status: 'QUEUED' }] }).select('_id').lean();
  await Promise.all(sessions.map(({ _id }) => enqueueSession(_id)));
}
