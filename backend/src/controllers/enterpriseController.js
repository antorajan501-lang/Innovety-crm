const { getEffectiveOrgId } = require('../utils/organizationScope');
const branchService = require('../services/branchService');
const employeeLifecycleService = require('../services/employeeLifecycleService');
const assetService = require('../services/assetService');
const visitorService = require('../services/visitorService');
const documentService = require('../services/documentService');
const organizationCalendarService = require('../services/organizationCalendarService');
const internalTaskService = require('../services/internalTaskService');
const integrationService = require('../services/integrationService');
const brandingService = require('../services/brandingService');
const auditService = require('../services/auditService');

// ================= BRANCH MANAGEMENT =================

const getBranches = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const { search, status, includeArchived } = req.query;
    const branches = await branchService.getBranches({
      organizationId,
      search,
      status,
      includeArchived: includeArchived === 'true'
    });
    res.json({ success: true, branches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createBranch = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const branch = await branchService.createBranch({
      ...req.body,
      organizationId
    });
    res.status(201).json({ success: true, branch });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getBranchById = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const branch = await branchService.getBranchById(req.params.id, organizationId);
    res.json({ success: true, branch });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const branch = await branchService.updateBranch(req.params.id, organizationId, req.body);
    res.json({ success: true, branch });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const archiveBranch = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const branch = await branchService.archiveBranch(req.params.id, organizationId);
    res.json({ success: true, message: 'Branch archived successfully.', branch });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getBranchStats = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const stats = await branchService.getBranchStats(organizationId);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= EMPLOYEE LIFECYCLE =================

const onboardEmployee = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const result = await employeeLifecycleService.onboardEmployee({
      ...req.body,
      organizationId,
      actorId: req.user?.id
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const offboardEmployee = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const result = await employeeLifecycleService.offboardEmployee({
      ...req.body,
      organizationId,
      actorId: req.user?.id
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getLifecycleStatus = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const status = await employeeLifecycleService.getLifecycleStatus(req.params.userId, organizationId);
    res.json({ success: true, status });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

const getLifecycleRoster = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const roster = await employeeLifecycleService.getLifecycleRoster(organizationId);
    res.json({ success: true, roster });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= ASSET MANAGEMENT =================

const getAssets = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const { branchId, category, status, search, assignedToId } = req.query;
    const assets = await assetService.getAssets({
      organizationId,
      branchId,
      category,
      status,
      assignedToId,
      search
    });
    res.json({ success: true, assets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createAsset = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const asset = await assetService.createAsset({
      organizationId,
      ...req.body
    });
    res.status(201).json({ success: true, asset });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const assignAsset = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const asset = await assetService.assignAsset({
      assetId: req.params.id,
      organizationId,
      actorId: req.user?.id,
      ...req.body
    });
    res.json({ success: true, asset });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const returnAsset = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const asset = await assetService.returnAsset({
      assetId: req.params.id,
      organizationId,
      actorId: req.user?.id,
      ...req.body
    });
    res.json({ success: true, asset });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getAssetStats = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const stats = await assetService.getAssetDashboardStats(organizationId);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= VISITOR MANAGEMENT =================

const registerVisitor = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const visitor = await visitorService.registerVisitor({
      organizationId,
      hostId: req.body.hostId || req.user?.id,
      ...req.body
    });
    res.status(201).json({ success: true, visitor });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const approveVisitor = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const visitor = await visitorService.approveVisitor({
      visitorId: req.params.id,
      organizationId,
      hostId: req.user?.id,
      status: req.body.status || 'APPROVED',
      notes: req.body.notes
    });
    res.json({ success: true, visitor });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const checkInVisitor = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const visitor = await visitorService.checkInVisitor({
      visitorId: req.body.visitorId,
      qrCode: req.body.qrCode,
      organizationId,
      badgeNumber: req.body.badgeNumber
    });
    res.json({ success: true, visitor });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const checkOutVisitor = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const visitor = await visitorService.checkOutVisitor({
      visitorId: req.body.visitorId,
      qrCode: req.body.qrCode,
      organizationId
    });
    res.json({ success: true, visitor });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getVisitorPass = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const pass = await visitorService.getVisitorPass(req.params.id, organizationId);
    res.json({ success: true, pass });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

const getVisitorHistory = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const { branchId, status, search } = req.query;
    const history = await visitorService.getVisitorHistory({
      organizationId,
      branchId,
      status,
      search
    });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getVisitorStats = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const stats = await visitorService.getVisitorStats(organizationId);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= DOCUMENT VAULT =================

const uploadDocument = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const doc = await documentService.uploadEmployeeDocument({
      organizationId,
      actorId: req.user?.id,
      ...req.body
    });
    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getUserDocuments = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const documents = await documentService.getUserDocuments({
      userId: req.params.userId || req.user?.id,
      organizationId
    });
    res.json({ success: true, documents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getDocumentVersionHistory = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const history = await documentService.getDocumentVersionHistory(req.params.id, organizationId);
    res.json({ success: true, ...history });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

const verifyDocument = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const document = await documentService.verifyDocument({
      documentId: req.params.id,
      organizationId,
      status: req.body.status || 'VERIFIED',
      notes: req.body.notes,
      actorId: req.user?.id
    });
    res.json({ success: true, document });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getDocumentVaultOverview = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const overview = await documentService.getDocumentVaultOverview(organizationId);
    res.json({ success: true, ...overview });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ================= UNIFIED CALENDAR =================

const getCalendar = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const { branchId, department, startDate, endDate, types } = req.query;
    const parsedTypes = types ? (Array.isArray(types) ? types : types.split(',')) : undefined;

    const events = await organizationCalendarService.getUnifiedCalendar({
      organizationId,
      branchId,
      department,
      startDate,
      endDate,
      types: parsedTypes
    });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createCompanyEvent = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const event = await organizationCalendarService.createCompanyEvent({
      organizationId,
      actorId: req.user?.id,
      ...req.body
    });
    res.status(201).json({ success: true, event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteCompanyEvent = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const result = await organizationCalendarService.deleteCompanyEvent(req.params.id, organizationId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ================= INTERNAL TASK MANAGEMENT =================

const getTasks = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const { assigneeId, status, priority, search } = req.query;
    const tasks = await internalTaskService.getInternalTasks({
      organizationId,
      assigneeId,
      status,
      priority,
      search
    });
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createTask = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const task = await internalTaskService.createInternalTask({
      organizationId,
      creatorId: req.user?.id,
      ...req.body
    });
    res.status(201).json({ success: true, task });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getTaskById = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const task = await internalTaskService.getInternalTaskById(req.params.id, organizationId);
    res.json({ success: true, task });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const task = await internalTaskService.updateInternalTaskStatus({
      taskId: req.params.id,
      organizationId,
      status: req.body.status,
      actorId: req.user?.id
    });
    res.json({ success: true, task });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const addTaskComment = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const comment = await internalTaskService.addInternalTaskComment({
      taskId: req.params.id,
      organizationId,
      userId: req.user?.id,
      text: req.body.text
    });
    res.status(201).json({ success: true, comment });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const result = await internalTaskService.deleteInternalTask(req.params.id, organizationId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ================= EXTERNAL INTEGRATIONS =================

const getIntegrations = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const integrations = await integrationService.getIntegrations(organizationId);
    res.json({ success: true, integrations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const connectIntegration = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const integration = await integrationService.connectIntegration({
      organizationId,
      actorId: req.user?.id,
      ...req.body
    });
    res.json({ success: true, integration });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const disconnectIntegration = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const result = await integrationService.disconnectIntegration({
      organizationId,
      provider: req.body.provider
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const triggerSync = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const result = await integrationService.triggerSync({
      organizationId,
      provider: req.body.provider
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ================= BRANDING CENTER =================

const getBranding = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const branding = await brandingService.getCompanyBranding(organizationId);
    res.json({ success: true, branding });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateBranding = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const branding = await brandingService.updateCompanyBranding(organizationId, req.body, req.user?.id);
    res.json({ success: true, branding });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const resetBranding = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const branding = await brandingService.resetCompanyBranding(organizationId, req.user?.id);
    res.json({ success: true, branding });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ================= ENTERPRISE AUDIT CENTER =================

const getAuditLogs = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const { userId, action, category, startDate, endDate, search, page, limit } = req.query;
    const result = await auditService.getAuditLogs({
      organizationId,
      userId,
      action,
      category,
      startDate,
      endDate,
      search,
      page,
      limit
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const exportAuditCsv = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const { userId, action, category, startDate, endDate, search } = req.query;
    const csv = await auditService.exportAuditLogsToCsv({
      organizationId,
      userId,
      action,
      category,
      startDate,
      endDate,
      search
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="enterprise_audit_log.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAuditStats = async (req, res) => {
  try {
    const organizationId = getEffectiveOrgId(req);
    const stats = await auditService.getAuditStats(organizationId);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  // Branches
  getBranches,
  createBranch,
  getBranchById,
  updateBranch,
  archiveBranch,
  getBranchStats,

  // Lifecycle
  onboardEmployee,
  offboardEmployee,
  getLifecycleStatus,
  getLifecycleRoster,

  // Assets
  getAssets,
  createAsset,
  assignAsset,
  returnAsset,
  getAssetStats,

  // Visitors
  registerVisitor,
  approveVisitor,
  checkInVisitor,
  checkOutVisitor,
  getVisitorPass,
  getVisitorHistory,
  getVisitorStats,

  // Documents
  uploadDocument,
  getUserDocuments,
  getDocumentVersionHistory,
  verifyDocument,
  getDocumentVaultOverview,

  // Calendar
  getCalendar,
  createCompanyEvent,
  deleteCompanyEvent,

  // Tasks
  getTasks,
  createTask,
  getTaskById,
  updateTaskStatus,
  addTaskComment,
  deleteTask,

  // Integrations
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  triggerSync,

  // Branding
  getBranding,
  updateBranding,
  resetBranding,

  // Audit
  getAuditLogs,
  exportAuditCsv,
  getAuditStats
};
