const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const enterpriseController = require('../controllers/enterpriseController');

// Protect all enterprise routes with authentication
router.use(authenticate);

// ================= BRANCH ROUTES =================
router.get('/branches', enterpriseController.getBranches);
router.get('/branches/stats', enterpriseController.getBranchStats);
router.get('/branches/:id', enterpriseController.getBranchById);
router.post('/branches', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.createBranch);
router.patch('/branches/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.updateBranch);
router.delete('/branches/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.archiveBranch);

// ================= EMPLOYEE LIFECYCLE ROUTES =================
router.post('/lifecycle/onboard', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.onboardEmployee);
router.post('/lifecycle/offboard', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.offboardEmployee);
router.get('/lifecycle/status/:userId', enterpriseController.getLifecycleStatus);
router.get('/lifecycle/roster', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.getLifecycleRoster);

// ================= ASSET ROUTES =================
router.get('/assets', enterpriseController.getAssets);
router.get('/assets/stats', enterpriseController.getAssetStats);
router.post('/assets', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.createAsset);
router.post('/assets/:id/assign', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.assignAsset);
router.post('/assets/:id/return', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.returnAsset);

// ================= VISITOR ROUTES =================
router.post('/visitors/register', enterpriseController.registerVisitor);
router.patch('/visitors/:id/review', enterpriseController.approveVisitor);
router.post('/visitors/check-in', enterpriseController.checkInVisitor);
router.post('/visitors/check-out', enterpriseController.checkOutVisitor);
router.get('/visitors/:id/pass', enterpriseController.getVisitorPass);
router.get('/visitors/history', enterpriseController.getVisitorHistory);
router.get('/visitors/stats', enterpriseController.getVisitorStats);

// ================= DOCUMENT VAULT ROUTES =================
router.post('/documents/upload', enterpriseController.uploadDocument);
router.get('/documents/user/:userId', enterpriseController.getUserDocuments);
router.get('/documents/:id/history', enterpriseController.getDocumentVersionHistory);
router.patch('/documents/:id/verify', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.verifyDocument);
router.get('/documents/overview', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.getDocumentVaultOverview);

// ================= UNIFIED CALENDAR ROUTES =================
router.get('/calendar', enterpriseController.getCalendar);
router.post('/calendar/events', requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEADER']), enterpriseController.createCompanyEvent);
router.delete('/calendar/events/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.deleteCompanyEvent);

// ================= INTERNAL TASK ROUTES =================
router.get('/tasks', enterpriseController.getTasks);
router.post('/tasks', enterpriseController.createTask);
router.get('/tasks/:id', enterpriseController.getTaskById);
router.patch('/tasks/:id/status', enterpriseController.updateTaskStatus);
router.post('/tasks/:id/comments', enterpriseController.addTaskComment);
router.delete('/tasks/:id', enterpriseController.deleteTask);

// ================= EXTERNAL INTEGRATIONS ROUTES =================
router.get('/integrations', enterpriseController.getIntegrations);
router.post('/integrations/connect', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.connectIntegration);
router.post('/integrations/disconnect', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.disconnectIntegration);
router.post('/integrations/sync', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.triggerSync);

// ================= BRANDING ROUTES =================
router.get('/branding', enterpriseController.getBranding);
router.put('/branding', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.updateBranding);
router.post('/branding/reset', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.resetBranding);

// ================= AUDIT CENTER ROUTES =================
router.get('/audit', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.getAuditLogs);
router.get('/audit/export-csv', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.exportAuditCsv);
router.get('/audit/stats', requireRole(['SUPER_ADMIN', 'ADMIN']), enterpriseController.getAuditStats);

module.exports = router;
