const express = require('express');
const router = express.Router();
const { authenticate, requireRole, optionalAuthenticate } = require('../middleware/auth');
const systemController = require('../controllers/systemController');

// 1. Health Ping (Unprotected & Protected)
router.get('/health', systemController.getHealth);

// 2. Client Crash Reporting (Receives frontend UI exceptions)
router.post('/errors/client', optionalAuthenticate, systemController.reportClientError);

// 3. Launch Certification & Checklist (Super Admin & Admin access)
router.get('/certification', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), systemController.getCertification);
router.get('/launch-checklist', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), systemController.getLaunchChecklist);
router.get('/metrics', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), systemController.getMetrics);

// 4. Advanced System Control (Strict Super Admin access)
router.get('/config', authenticate, requireRole(['SUPER_ADMIN']), systemController.getProductionConfig);
router.get('/security/audit', authenticate, requireRole(['SUPER_ADMIN']), systemController.getSecurityAudit);
router.post('/security/revoke-token', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), systemController.revokeToken);

// 5. Backup & Disaster Recovery
router.get('/backups', authenticate, requireRole(['SUPER_ADMIN']), systemController.getBackups);
router.post('/backups/create', authenticate, requireRole(['SUPER_ADMIN']), systemController.createBackup);
router.post('/backups/:id/verify', authenticate, requireRole(['SUPER_ADMIN']), systemController.verifyBackup);
router.post('/backups/:id/restore-dry-run', authenticate, requireRole(['SUPER_ADMIN']), systemController.restoreDryRun);

// 6. Deployment Readiness
router.get('/deployment/check', authenticate, requireRole(['SUPER_ADMIN']), systemController.getDeploymentReadiness);

// 7. Error Tracking & Analytics
router.get('/errors', authenticate, requireRole(['SUPER_ADMIN']), systemController.getErrorLogs);
router.post('/errors/clear', authenticate, requireRole(['SUPER_ADMIN']), systemController.clearErrorLogs);

module.exports = router;
