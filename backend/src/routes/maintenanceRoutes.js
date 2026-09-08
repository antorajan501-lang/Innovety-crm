const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  runMaintenanceRoutine,
  toggleTenantMaintenance,
  exportAuditData,
  downloadExportFile
} = require('../controllers/maintenanceController');

// All maintenance endpoints require SUPER_ADMIN
router.use(authenticate);
router.use(requireRole(['SUPER_ADMIN']));

// POST /api/maintenance/run
router.post('/run', runMaintenanceRoutine);

// PATCH /api/maintenance/tenant/:id
router.patch('/tenant/:id', toggleTenantMaintenance);

// POST /api/maintenance/export
router.post('/export', exportAuditData);

// GET /api/maintenance/exports/download/:fileName
router.get('/exports/download/:fileName', downloadExportFile);

module.exports = router;
