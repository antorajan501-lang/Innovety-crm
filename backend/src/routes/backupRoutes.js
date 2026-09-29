const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getBackupsList,
  takeLiveBackupAction,
  downloadBackupAction,
  deleteBackupAction,
  triggerBackup,
  dryRunRestoreAction,
  confirmRestoreAction,
  validateUploadedBackupAction,
  executeRestoreAction,
  validateUploadedSqlAction,
  executeSqlImportAction
} = require('../controllers/backupController');
const { TEMP_RESTORE_DIR } = require('../services/restoreService');

// Multer storage for uploaded backup ZIP and SQL files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(TEMP_RESTORE_DIR)) {
      fs.mkdirSync(TEMP_RESTORE_DIR, { recursive: true });
    }
    cb(null, TEMP_RESTORE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
    cb(null, safeName);
  }
});

// Multer filter for ZIP backups
const uploadZip = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      return cb(new Error('Invalid Backup File: Only .zip backup archives are accepted.'), false);
    }
    cb(null, true);
  }
});

// Multer filter for SQL dumps (rejects .zip, .txt, .csv, and any other file type)
const uploadSql = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.sql')) {
      return cb(new Error('Invalid SQL File – Only .sql files are allowed.'), false);
    }
    cb(null, true);
  }
});

// Step 1: All backup, restore, and SQL import endpoints require SUPER_ADMIN
router.use(authenticate);
router.use(requireRole(['SUPER_ADMIN']));

// GET /api/backups - List historical backups
router.get('/', getBackupsList);

// POST /api/backups/live - Generate full live production MySQL backup ZIP
router.post('/live', takeLiveBackupAction);

// GET /api/backups/download/:filename - Download backup ZIP or SQL package
router.get('/download/:filename', downloadBackupAction);

// DELETE /api/backups/:filename - Remove a historical backup
router.delete('/:filename', deleteBackupAction);

// RESTORE BACKUP ENDPOINTS (ZIP):
// POST /api/backups/restore/validate - Inspect and validate uploaded ZIP before restore
router.post('/restore/validate', (req, res, next) => {
  uploadZip.single('backupZip')(req, res, (err) => {
    if (err) {
      let friendlyMsg = err.message;
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.message === 'Unexpected field') {
        friendlyMsg = 'Invalid Backup File – Expected upload field "backupZip".';
      } else if (err.code === 'LIMIT_FILE_SIZE') {
        friendlyMsg = 'Invalid Backup File – File size exceeds 500MB.';
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid Backup File',
        errors: [friendlyMsg]
      });
    }
    next();
  });
}, validateUploadedBackupAction);

// POST /api/backups/restore/execute - Execute full confirmed restore with safety backup
router.post('/restore/execute', executeRestoreAction);

// IMPORT SQL ENDPOINTS (DIRECT .SQL FILE):
// POST /api/backups/import-sql/validate - Inspect and validate uploaded .sql file before importing
router.post('/import-sql/validate', (req, res, next) => {
  uploadSql.single('sqlFile')(req, res, (err) => {
    if (err) {
      let friendlyMsg = err.message;
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.message === 'Unexpected field') {
        friendlyMsg = 'Invalid SQL File – Only .sql files are allowed (expected upload field "sqlFile").';
      } else if (err.code === 'LIMIT_FILE_SIZE') {
        friendlyMsg = 'Invalid SQL File – File size exceeds 500MB.';
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid SQL File',
        errors: [friendlyMsg]
      });
    }
    next();
  });
}, validateUploadedSqlAction);

// POST /api/backups/import-sql/execute - Execute full confirmed SQL import with pre-import safety backup
router.post('/import-sql/execute', executeSqlImportAction);

// Legacy job queue routes
router.post('/trigger', triggerBackup);
router.post('/restore/dry-run', dryRunRestoreAction);
router.post('/restore/confirm', confirmRestoreAction);

module.exports = router;
