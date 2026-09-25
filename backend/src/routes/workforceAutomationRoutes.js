const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  trigger1HourReminders,
  triggerTomorrowSummaries,
  requestApproval,
  getApprovals,
  reviewApproval,
  createTemplate,
  getTemplates,
  deleteTemplate,
  applyTemplate,
  checkConflicts,
  getExceptions,
  scanExceptions,
  resolveException,
  getCompliance,
  getReport,
  getSettings,
  updateSettings,
  getEmployeeShiftTimeline
} = require('../controllers/workforceAutomationController');

// All workforce routes require authentication
router.use(authenticate);

// 1. Shift Notifications
router.get('/notifications', getNotifications);
router.put('/notifications/read-all', markAllNotificationsRead);
router.put('/notifications/:id/read', markNotificationRead);
router.post('/notifications/trigger-1h', requireRole(['SUPER_ADMIN', 'ADMIN']), trigger1HourReminders);
router.post('/notifications/trigger-tomorrow', requireRole(['SUPER_ADMIN', 'ADMIN']), triggerTomorrowSummaries);

// 2. Approvals
router.post('/approvals', requestApproval);
router.get('/approvals', getApprovals);
router.put('/approvals/:id/review', requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER']), reviewApproval);

// 3. Recurring Templates
router.get('/templates', getTemplates);
router.post('/templates', requireRole(['SUPER_ADMIN', 'ADMIN']), createTemplate);
router.delete('/templates/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), deleteTemplate);
router.post('/templates/:id/apply', requireRole(['SUPER_ADMIN', 'ADMIN']), applyTemplate);

// 4. Conflict Assistant
router.post('/conflicts/check', checkConflicts);

// 5. Attendance Exceptions
router.get('/exceptions', requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER']), getExceptions);
router.post('/exceptions/scan', requireRole(['SUPER_ADMIN', 'ADMIN']), scanExceptions);
router.put('/exceptions/:id/resolve', requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER']), resolveException);

// 6. Compliance Metrics
router.get('/compliance', requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER']), getCompliance);

// 7. Reports
router.get('/reports', requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER']), getReport);

// 8. Automation Settings
router.get('/settings', requireRole(['SUPER_ADMIN', 'ADMIN']), getSettings);
router.put('/settings', requireRole(['SUPER_ADMIN', 'ADMIN']), updateSettings);

// 9. Employee Shift Timeline
router.get('/timeline/:userId?', getEmployeeShiftTimeline);

module.exports = router;
