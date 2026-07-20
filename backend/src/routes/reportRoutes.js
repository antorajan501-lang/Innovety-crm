const express = require('express');
const router = express.Router();
const { getAttendanceReport, getTaskReport, getTeamReport, getTicketReport } = require('../controllers/reportController');
const { authenticate, requireRole } = require('../middleware/auth');

// Reports are restricted to Admin and Team Leader roles
router.use(authenticate, requireRole(['ADMIN', 'TEAM_LEADER']));

router.get('/attendance', getAttendanceReport);
router.get('/tasks', getTaskReport);
router.get('/teams', getTeamReport);
router.get('/tickets', getTicketReport);

module.exports = router;
