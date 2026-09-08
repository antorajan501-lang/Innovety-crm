const { getPlatformHealthMetrics } = require('../services/monitoringService');
const { getAllJobs, getJobStatus } = require('../services/jobQueueService');

/**
 * GET /api/platform/health
 * Public or Super Admin system health endpoint
 */
const getSystemHealth = async (req, res, next) => {
  try {
    const metrics = await getPlatformHealthMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/platform/jobs
 * List background jobs
 */
const getPlatformJobs = async (req, res, next) => {
  try {
    const jobs = getAllJobs();
    res.json({
      success: true,
      count: jobs.length,
      data: jobs
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSystemHealth,
  getPlatformJobs
};
