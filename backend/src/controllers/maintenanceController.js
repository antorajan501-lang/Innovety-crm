const path = require('path');
const fs = require('fs');
const { recalculateAllStorage, clearOrphanUploads, rebuildOrganizationStatistics, setTenantMaintenanceMode } = require('../services/maintenanceService');
const { generateAuditExport } = require('../services/auditExportService');
const { enqueueJob } = require('../services/jobQueueService');

/**
 * POST /api/maintenance/run
 */
const runMaintenanceRoutine = async (req, res, next) => {
  try {
    const { action } = req.body; // 'STORAGE_RECALCULATION' | 'ORPHAN_CLEANUP' | 'REBUILD_STATS'

    if (action === 'STORAGE_RECALCULATION') {
      const job = enqueueJob('STORAGE_RECALCULATION', {}, async (payload, updateProgress) => {
        return await recalculateAllStorage(updateProgress);
      });
      return res.json({ success: true, message: 'Storage recalculation job enqueued.', jobId: job.id });
    }

    if (action === 'ORPHAN_CLEANUP') {
      const job = enqueueJob('CLEANUP', {}, async (payload, updateProgress) => {
        updateProgress(30);
        const res = await clearOrphanUploads();
        updateProgress(100);
        return res;
      });
      return res.json({ success: true, message: 'Orphan cleanup job enqueued.', jobId: job.id });
    }

    if (action === 'REBUILD_STATS') {
      const result = await rebuildOrganizationStatistics();
      return res.json({ success: true, message: 'Organization statistics rebuilt.', data: result });
    }

    return res.status(400).json({ success: false, message: 'Invalid maintenance action specified.' });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/maintenance/tenant/:id
 */
const toggleTenantMaintenance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { enabled, message } = req.body;

    const result = await setTenantMaintenanceMode(id, enabled, message);
    res.json({
      success: true,
      message: `Maintenance mode ${result.maintenanceMode ? 'enabled' : 'disabled'} for ${result.name}.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/maintenance/export
 */
const exportAuditData = async (req, res, next) => {
  try {
    const { targetType, organizationId, format } = req.body;

    const job = enqueueJob('EXPORT', { targetType, organizationId, format }, async (payload, updateProgress) => {
      updateProgress(30);
      const exportResult = await generateAuditExport(payload.targetType, payload.organizationId, payload.format);
      updateProgress(100);
      return exportResult;
    });

    res.json({
      success: true,
      message: 'Audit export job enqueued successfully.',
      jobId: job.id
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/maintenance/exports/download/:fileName
 */
const downloadExportFile = async (req, res, next) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(__dirname, '../../../backups/exports', fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Export file not found.' });
    }

    res.download(filePath, fileName);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  runMaintenanceRoutine,
  toggleTenantMaintenance,
  exportAuditData,
  downloadExportFile
};
