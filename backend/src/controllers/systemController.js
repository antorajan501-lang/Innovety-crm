const healthService = require('../services/healthService');
const monitoringService = require('../services/monitoringService');
const securityService = require('../services/securityService');
const backupService = require('../services/backupService');
const deploymentService = require('../services/deploymentService');
const errorTrackingService = require('../services/errorTrackingService');
const cacheService = require('../services/cacheService');

/**
 * Controller for System, Production Readiness, Security, Monitoring & Launch Certification
 */

const getHealth = async (req, res) => {
  try {
    const health = await healthService.getSystemHealth();
    return res.json({ success: true, ...health });
  } catch (err) {
    return res.status(500).json({ success: false, status: 'CRITICAL', message: err.message });
  }
};

const getMetrics = async (req, res) => {
  try {
    const data = await monitoringService.getMonitoringData();
    const cache = cacheService.getCacheTelemetry();
    return res.json({ success: true, ...data, cache });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getProductionConfig = (req, res) => {
  try {
    const config = deploymentService.getProductionConfiguration();
    return res.json({ success: true, config });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getSecurityAudit = (req, res) => {
  try {
    const posture = securityService.getSecurityPostureReport();
    const logs = securityService.getSecurityAuditLogs(req.query.limit || 50);
    return res.json({ success: true, posture, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const revokeToken = (req, res) => {
  try {
    const { token, reason } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required to revoke.' });
    }
    const success = securityService.revokeToken(token, 86400 * 30, {
      reason,
      userId: req.user?.id,
      ip: req.ip
    });
    return res.json({ success, message: 'Token successfully revoked and invalidated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getBackups = (req, res) => {
  try {
    const backups = backupService.getBackupList();
    const checklist = backupService.getDisasterRecoveryChecklist();
    return res.json({ success: true, backups, checklist });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const createBackup = async (req, res) => {
  try {
    const actor = req.user ? `${req.user.name} (${req.user.role})` : 'SuperAdmin';
    const backup = await backupService.createFullDatabaseBackup(actor);
    return res.json({ success: true, message: 'Database backup snapshot created successfully.', backup });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const verifyBackup = (req, res) => {
  try {
    const { id } = req.params;
    const result = backupService.verifyBackupIntegrity(id);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const restoreDryRun = (req, res) => {
  try {
    const { id } = req.params;
    const result = backupService.dryRunRestore(id);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const getDeploymentReadiness = async (req, res) => {
  try {
    const report = await deploymentService.checkDeploymentReadiness();
    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getLaunchChecklist = async (req, res) => {
  try {
    const checklist = await deploymentService.getLaunchChecklist();
    return res.json({ success: true, ...checklist });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getCertification = async (req, res) => {
  try {
    const cert = await deploymentService.getProductionCertification();
    return res.json({ success: true, certification: cert });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getErrorLogs = (req, res) => {
  try {
    const { limit, type, search } = req.query;
    const logs = errorTrackingService.getErrorLogs({ limit, type, search });
    const stats = errorTrackingService.getErrorStats();
    return res.json({ success: true, stats, logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const reportClientError = (req, res) => {
  try {
    const { message, stack, componentStack, url } = req.body;
    const recorded = errorTrackingService.recordClientCrash({
      message,
      stack,
      componentStack,
      url,
      userId: req.user?.id,
      organizationId: req.user?.organizationId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    return res.json({ success: true, errorId: recorded.id });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const clearErrorLogs = (req, res) => {
  try {
    const result = errorTrackingService.clearErrors();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getHealth,
  getMetrics,
  getProductionConfig,
  getSecurityAudit,
  revokeToken,
  getBackups,
  createBackup,
  verifyBackup,
  restoreDryRun,
  getDeploymentReadiness,
  getLaunchChecklist,
  getCertification,
  getErrorLogs,
  reportClientError,
  clearErrorLogs
};
