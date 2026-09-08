const crypto = require('crypto');

const jobsMap = new Map();

/**
 * Enqueues a non-blocking background job and executes it asynchronously
 */
function enqueueJob(type, payload = {}, handlerFn) {
  const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const job = {
    id: jobId,
    type, // 'BACKUP' | 'EXPORT' | 'RESTORE' | 'STORAGE_RECALCULATION' | 'CLEANUP'
    status: 'QUEUED', // 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
    progress: 0,
    payload,
    result: null,
    error: null,
    queuedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null
  };

  jobsMap.set(jobId, job);

  // Execute handler function asynchronously on next event loop tick
  setImmediate(async () => {
    try {
      job.status = 'RUNNING';
      job.startedAt = new Date().toISOString();
      job.progress = 10;

      const updateProgress = (pct) => {
        job.progress = Math.min(99, Math.max(0, pct));
      };

      const result = await handlerFn(payload, updateProgress);
      job.status = 'COMPLETED';
      job.progress = 100;
      job.result = result;
      job.completedAt = new Date().toISOString();
    } catch (err) {
      console.error(`[JobQueue] Error executing job ${jobId} (${type}):`, err);
      job.status = 'FAILED';
      job.error = err.message || String(err);
      job.completedAt = new Date().toISOString();
    }
  });

  return job;
}

function getJobStatus(jobId) {
  return jobsMap.get(jobId) || null;
}

function getAllJobs() {
  return Array.from(jobsMap.values()).sort((a, b) => new Date(b.queuedAt) - new Date(a.queuedAt));
}

module.exports = {
  enqueueJob,
  getJobStatus,
  getAllJobs
};
