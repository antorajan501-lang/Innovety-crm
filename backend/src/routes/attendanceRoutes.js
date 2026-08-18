const express = require('express');
const router = express.Router();
const { getClockInStatus, clockIn, clockOut, getAttendanceLogs, updateAttendance, getAttendanceAnalytics, getAttendanceHistory } = require('../controllers/attendanceController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/status', requireRole(['INTERN', 'TEAM_LEADER', 'EMPLOYEE', 'ADMIN']), getClockInStatus);
router.post('/clock-in', requireRole(['INTERN', 'TEAM_LEADER', 'EMPLOYEE']), clockIn);
router.post('/clock-out', requireRole(['INTERN', 'TEAM_LEADER', 'EMPLOYEE']), clockOut);
router.get('/logs', getAttendanceLogs);
router.get('/history', getAttendanceHistory);
router.get('/analytics', getAttendanceAnalytics);

// Admin & Super Admin manual override of logs
router.put('/:id', requireRole(['ADMIN', 'SUPER_ADMIN']), updateAttendance);

module.exports = router;
