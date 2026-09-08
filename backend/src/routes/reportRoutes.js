const express = require('express');
const router = express.Router();
const {
  getAttendanceReport,
  getTaskReport,
  getTeamReport,
  getTicketReport,
  getLeaveReport,
  getPayrollReport,
  getAssetReport,
  getWorkLogReport
} = require('../controllers/reportController');
const { authenticate, requireRole } = require('../middleware/auth');

// Reports are restricted to Admin, Team Leader, and Super Admin roles
router.use(authenticate, requireRole(['ADMIN', 'TEAM_LEADER', 'SUPER_ADMIN']));

router.get('/attendance', getAttendanceReport);
router.get('/tasks', getTaskReport);
router.get('/teams', getTeamReport);
router.get('/tickets', getTicketReport);
router.get('/leaves', getLeaveReport);
router.get('/payroll', getPayrollReport);
router.get('/assets', getAssetReport);
router.get('/worklogs', getWorkLogReport);

module.exports = router;
