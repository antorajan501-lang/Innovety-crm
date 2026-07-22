const express = require('express');
const router = express.Router();
const { clockIn, clockOut, getAttendanceLogs, updateAttendance, getAttendanceAnalytics } = require('../controllers/attendanceController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.post('/clock-in', requireRole(['INTERN', 'TEAM_LEADER', 'EMPLOYEE']), clockIn);
router.post('/clock-out', requireRole(['INTERN', 'TEAM_LEADER', 'EMPLOYEE']), clockOut);
router.get('/logs', getAttendanceLogs);
router.get('/analytics', getAttendanceAnalytics);

// Admin-only manual override of logs
router.put('/:id', requireRole(['ADMIN']), updateAttendance);

module.exports = router;
