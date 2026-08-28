const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createWorkLog,
  updateWorkLog,
  deleteWorkLog,
  getWorkLogs,
  getAdminWorkLogs,
  getTodayStatus,
  uploadAttachment
} = require('../controllers/workLogController');

router.use(authenticate);

// Admin review dashboard route
router.get('/admin', getAdminWorkLogs);

// Today's work log status & auto hours calculation
router.get('/today-status', getTodayStatus);

// List my work logs with metrics
router.get('/', getWorkLogs);

// Create work log (Intern / Employee / Team Leader only)
router.post('/', createWorkLog);

// Upload attachment for work log
router.post('/upload-attachment', upload.single('file'), uploadAttachment);
router.post('/:workLogId/attachments', upload.single('file'), uploadAttachment);

// Update work log
router.put('/:id', updateWorkLog);

// Delete work log
router.delete('/:id', deleteWorkLog);

module.exports = router;
