const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getBackupsList,
  triggerBackup,
  dryRunRestoreAction,
  confirmRestoreAction
} = require('../controllers/backupController');

// All backup and disaster recovery endpoints require SUPER_ADMIN
router.use(authenticate);
router.use(requireRole(['SUPER_ADMIN']));

// GET /api/backups
router.get('/', getBackupsList);

// POST /api/backups/trigger
router.post('/trigger', triggerBackup);

// POST /api/backups/restore/dry-run
router.post('/restore/dry-run', dryRunRestoreAction);

// POST /api/backups/restore/confirm
router.post('/restore/confirm', confirmRestoreAction);

module.exports = router;
