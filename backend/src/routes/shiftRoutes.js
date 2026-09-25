const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getCompanyShifts,
  createShift,
  getMyShift,
  getMyUpcomingSchedule,
  getShiftAnalytics,
  exportShiftMembers,
  bulkUpdateShifts,
  getShiftById,
  updateShift,
  deleteShift,
  duplicateShift,
  getShiftHistory,
  assignMembers
} = require('../controllers/shiftController');

// All shift endpoints require valid JWT authentication
router.use(authenticate);

// Current user's shift & schedule
router.get('/my-shift', getMyShift);
router.get('/my-schedule', getMyUpcomingSchedule);

// Shift analytics & member exports
router.get('/analytics', getShiftAnalytics);
router.get('/export/members', exportShiftMembers);

// Bulk operations
router.post('/bulk', requireRole(['SUPER_ADMIN', 'ADMIN']), bulkUpdateShifts);

// Shift list & creation
router.get('/', getCompanyShifts);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN']), createShift);

// Specific shift actions (history, duplicate, members)
router.get('/:id/history', getShiftHistory);
router.post('/:id/duplicate', requireRole(['SUPER_ADMIN', 'ADMIN']), duplicateShift);
router.post('/:id/members', requireRole(['SUPER_ADMIN', 'ADMIN']), assignMembers);

// Single shift details, update & delete
router.get('/:id', getShiftById);
router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), updateShift);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), deleteShift);

module.exports = router;
