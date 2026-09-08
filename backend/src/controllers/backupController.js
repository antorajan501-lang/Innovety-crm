const { listAllBackups, createFullBackup, verifyBackupIntegrity } = require('../services/backupService');
const { dryRunRestore, executeConfirmedRestore } = require('../services/restoreService');
const { enqueueJob } = require('../services/jobQueueService');

/**
 * GET /api/backups
 */
const getBackupsList = async (req, res, next) => {
  try {
    const manifests = listAllBackups();
    res.json({
      success: true,
      count: manifests.length,
      data: manifests
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/backups/trigger
 * Enqueue manual non-blocking backup creation job
 */
const triggerBackup = async (req, res, next) => {
  try {
    const job = enqueueJob('BACKUP', { type: 'MANUAL' }, async (payload, updateProgress) => {
      updateProgress(30);
      const manifest = await createFullBackup('MANUAL');
      updateProgress(100);
      return manifest;
    });

    res.json({
      success: true,
      message: 'Backup creation job enqueued successfully.',
      jobId: job.id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/backups/restore/dry-run
 */
const dryRunRestoreAction = async (req, res, next) => {
  try {
    const { backupId } = req.body;
    if (!backupId) {
      return res.status(400).json({ success: false, message: 'backupId is required.' });
    }

    const simulation = await dryRunRestore(backupId);
    res.json(simulation);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/backups/restore/confirm
 */
const confirmRestoreAction = async (req, res, next) => {
  try {
    const { backupId } = req.body;
    if (!backupId) {
      return res.status(400).json({ success: false, message: 'backupId is required.' });
    }

    const job = enqueueJob('RESTORE', { backupId }, async (payload, updateProgress) => {
      const result = await executeConfirmedRestore(payload.backupId, updateProgress);
      return result;
    });

    res.json({
      success: true,
      message: 'Restore job enqueued cleanly.',
      jobId: job.id
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBackupsList,
  triggerBackup,
  dryRunRestoreAction,
  confirmRestoreAction
};
