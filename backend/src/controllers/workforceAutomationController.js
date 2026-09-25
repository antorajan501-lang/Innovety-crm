const notificationService = require('../services/notificationService');
const approvalService = require('../services/approvalService');
const recurringTemplateService = require('../services/recurringTemplateService');
const exceptionService = require('../services/exceptionService');
const conflictAssistantService = require('../services/conflictAssistantService');
const complianceService = require('../services/complianceService');
const shiftReportService = require('../services/shiftReportService');
const automationSettingService = require('../services/automationSettingService');
const { getEffectiveOrgId } = require('../utils/organizationScope');
const prisma = require('../utils/db');

const getTargetOrgId = (req) => {
  return getEffectiveOrgId(req);
};

// 1. NOTIFICATIONS
const getNotifications = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const { unreadOnly } = req.query;
    const result = await notificationService.getUserShiftNotifications(req.user.id, orgId, {
      unreadOnly: unreadOnly === 'true'
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    await notificationService.markShiftNotificationRead(req.params.id, req.user.id);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const count = await notificationService.markAllShiftNotificationsRead(req.user.id, orgId);
    res.json({ success: true, count, message: 'All shift notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const trigger1HourReminders = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const result = await notificationService.send1HourReminders(orgId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const triggerTomorrowSummaries = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const result = await notificationService.sendTomorrowShiftSummaries(orgId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 2. APPROVALS
const requestApproval = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const { requestType, reason, details } = req.body;
    const approval = await approvalService.requestApproval({
      organizationId: orgId,
      requesterId: req.user.id,
      requestType,
      reason,
      details
    });
    res.status(201).json({ success: true, approval });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getApprovals = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const { status, requestType } = req.query;
    const approvals = await approvalService.getApprovals({
      organizationId: orgId,
      user: req.user,
      status,
      requestType
    });
    res.json({ success: true, approvals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const reviewApproval = async (req, res) => {
  try {
    const { action, note } = req.body;
    const result = await approvalService.reviewApproval({
      approvalId: req.params.id,
      actorUser: req.user,
      action,
      note
    });
    res.json({ success: true, approval: result, message: `Request ${action.toLowerCase()}d successfully.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// 3. RECURRING TEMPLATES
const createTemplate = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const { name, shiftId, recurrencePattern, config } = req.body;
    const template = await recurringTemplateService.createTemplate({
      organizationId: orgId,
      name,
      shiftId,
      recurrencePattern,
      config
    });
    res.status(201).json({ success: true, template });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getTemplates = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const templates = await recurringTemplateService.getTemplates(orgId);
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    await recurringTemplateService.deleteTemplate(req.params.id, orgId);
    res.json({ success: true, message: 'Recurring template deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const applyTemplate = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const { userIds, startDate, endDate } = req.body;
    const result = await recurringTemplateService.applyTemplate({
      templateId: req.params.id,
      userIds,
      startDate,
      endDate,
      organizationId: orgId,
      actorUserId: req.user.id
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// 4. CONFLICT ASSISTANT
const checkConflicts = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const { userId, shiftId, startDate, endDate, excludeScheduleId } = req.body;
    const result = await conflictAssistantService.checkShiftConflicts({
      organizationId: orgId,
      userId,
      shiftId,
      startDate,
      endDate,
      excludeScheduleId
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. ATTENDANCE EXCEPTIONS
const getExceptions = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const { type, status, department, startDate, endDate } = req.query;
    const result = await exceptionService.getExceptions({
      organizationId: orgId,
      type,
      status,
      department,
      startDate,
      endDate
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const scanExceptions = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const { date } = req.body;
    const detected = await exceptionService.detectExceptionsForDate(orgId, date ? new Date(date) : new Date());
    res.json({ success: true, scannedCount: detected.length, detected });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const resolveException = async (req, res) => {
  try {
    const { action, resolutionNote } = req.body;
    const resolved = await exceptionService.resolveException({
      exceptionId: req.params.id,
      actorUserId: req.user.id,
      action: action || 'RESOLVE',
      resolutionNote
    });
    res.json({ success: true, exception: resolved, message: 'Exception updated.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// 6. COMPLIANCE METRICS
const getCompliance = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const { department, startDate, endDate } = req.query;
    const result = await complianceService.getComplianceMetrics({
      organizationId: orgId,
      department,
      startDate,
      endDate
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 7. REPORTS
const getReport = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const { reportType, format = 'json', startDate, endDate, department } = req.query;
    if (!reportType) {
      return res.status(400).json({ success: false, message: 'reportType is required.' });
    }

    const reportData = await shiftReportService.generateShiftReport({
      organizationId: orgId,
      reportType,
      startDate,
      endDate,
      department
    });

    if (format === 'csv') {
      const csv = shiftReportService.convertToCsv(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${reportType.toLowerCase()}_report.csv`);
      return res.send(csv);
    }

    res.json({ success: true, reportType, count: reportData.length, data: reportData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 8. AUTOMATION SETTINGS
const getSettings = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const settings = await automationSettingService.getAutomationSettings(orgId);
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const settings = await automationSettingService.updateAutomationSettings(orgId, req.body);
    res.json({ success: true, settings, message: 'Automation settings updated.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// 9. EMPLOYEE SHIFT TIMELINE
const getEmployeeShiftTimeline = async (req, res) => {
  try {
    const orgId = getTargetOrgId(req);
    const targetUserId = req.params.userId || req.user.id;

    // Collect historical events for user:
    // 1. Shift assignments / reassignments from ShiftHistory or ShiftMember
    // 2. Overrides & Swaps from ShiftSchedule
    // 3. Approvals from ShiftApproval
    const [schedules, approvals, memberAssignment] = await Promise.all([
      prisma.shiftSchedule.findMany({
        where: { userId: targetUserId, organizationId: orgId },
        include: { shift: true, createdBy: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.shiftApproval.findMany({
        where: { requesterId: targetUserId, organizationId: orgId },
        include: { approver: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.shiftMember.findFirst({
        where: { userId: targetUserId },
        include: { shift: true }
      })
    ]);

    const timeline = [];

    // Permanent assignment
    if (memberAssignment) {
      timeline.push({
        id: `perm_${memberAssignment.id}`,
        type: 'PERMANENT_ASSIGNED',
        title: 'Permanent Shift Assigned',
        shiftName: memberAssignment.shift.name,
        timings: `${memberAssignment.shift.startTime} – ${memberAssignment.shift.endTime}`,
        actor: 'Admin',
        reason: 'Organization Shift Assignment',
        date: memberAssignment.createdAt
      });
    }

    // Schedules
    schedules.forEach(s => {
      timeline.push({
        id: `sched_${s.id}`,
        type: s.type, // PLANNED, OVERRIDE, SWAP
        title: s.type === 'SWAP' ? 'Shift Swap Executed' : s.type === 'OVERRIDE' ? 'Temporary Shift Override' : 'Planned Shift Schedule',
        shiftName: s.shift.name,
        timings: `${s.shift.startTime} – ${s.shift.endTime}`,
        actor: s.createdBy ? `${s.createdBy.name} (${s.createdBy.role})` : 'System',
        reason: s.reason || 'Scheduled adjustment',
        date: s.createdAt,
        startDate: s.startDate.toISOString().split('T')[0],
        endDate: s.endDate.toISOString().split('T')[0],
        status: s.status
      });
    });

    // Approvals
    approvals.forEach(a => {
      timeline.push({
        id: `appr_${a.id}`,
        type: `APPROVAL_${a.status}`,
        title: `${a.requestType.replace(/_/g, ' ')} (${a.status.replace(/_/g, ' ')})`,
        shiftName: a.details?.shiftName || 'Custom Shift',
        timings: a.details?.startTime ? `${a.details.startTime} – ${a.details.endTime}` : '--',
        actor: a.approver ? `${a.approver.name} (${a.approver.role})` : 'Pending Review',
        reason: a.reason || 'Request workflow',
        date: a.updatedAt || a.createdAt,
        status: a.status
      });
    });

    // Sort by timestamp descending
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, timeline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
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
};
