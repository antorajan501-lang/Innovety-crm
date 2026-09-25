const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getCalendarData,
  getDaySchedule,
  checkCoverage,
  createPlannedSchedule,
  createOverride,
  swapShifts,
  checkConflict,
  cancelSchedule
} = require('../controllers/scheduleController');

// All schedule endpoints require valid JWT authentication
router.use(authenticate);

// Calendar, Day, and Coverage Queries
router.get('/calendar', getCalendarData);
router.get('/day', getDaySchedule);
router.get('/coverage', checkCoverage);

// Conflict Detection
router.post('/check-conflict', checkConflict);

// Planning Actions (Super Admin & Admin)
router.post('/plan', requireRole(['SUPER_ADMIN', 'ADMIN']), createPlannedSchedule);
router.post('/override', requireRole(['SUPER_ADMIN', 'ADMIN']), createOverride);
router.post('/swap', requireRole(['SUPER_ADMIN', 'ADMIN']), swapShifts);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), cancelSchedule);

module.exports = router;
