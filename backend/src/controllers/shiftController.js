const shiftService = require('../services/shiftService');
const prisma = require('../utils/db');
const { broadcastShiftUpdate } = require('../socket');

/**
 * Helper to resolve the target organizationId based on role and request
 */
const resolveOrganizationId = (req) => {
  if (req.user.role === 'SUPER_ADMIN' && (req.query.organizationId || req.body?.organizationId)) {
    return req.query.organizationId || req.body?.organizationId;
  }
  return req.user.organizationId;
};

/**
 * GET /api/shifts
 * Get all shifts for the company with member counts.
 */
const getCompanyShifts = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const shifts = await shiftService.getCompanyShifts(organizationId);
    return res.json({
      success: true,
      count: shifts.length,
      shifts
    });
  } catch (error) {
    console.error('[shiftController] Error in getCompanyShifts:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to retrieve shifts.' });
  }
};

/**
 * POST /api/shifts
 * Create a new shift for the organization.
 */
const createShift = async (req, res) => {
  try {
    const organizationId = req.body.organizationId || resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { name, startTime, endTime, workingDays, status } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Shift name is required.' });
    }

    const shift = await shiftService.createShift({
      organizationId,
      name,
      startTime: startTime || '09:00',
      endTime: endTime || '18:00',
      workingDays,
      status: status || 'ACTIVE'
    }, prisma, req.user.id);

    // Broadcast real-time shift update to invalidate stale caches
    broadcastShiftUpdate(organizationId, { action: 'SHIFT_CREATED', shiftId: shift.id });

    return res.status(201).json({
      success: true,
      message: `Shift "${shift.name}" created successfully.`,
      shift
    });
  } catch (error) {
    console.error('[shiftController] Error in createShift:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create shift.' });
  }
};

/**
 * GET /api/shifts/my-shift
 * Get the assigned shift for the logged-in employee (with schedule & next working day).
 * Priority order:
 * 1. Assigned Shift (ShiftMember → Shift or temporary override)
 * 2. Company Default Shift (if no custom assignment)
 * 3. Company Settings (fallback only)
 * Always sets strict no-cache headers.
 */
const getMyShift = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Priority 1 & 2 resolved via shiftService.getEmployeeShiftWithSchedule:
    // (Checks temporary active overrides -> ShiftMember -> Company Default Shift)
    let shift = await shiftService.getEmployeeShiftWithSchedule(req.user.id);

    // Priority 3: Fallback to Company Settings if no shift or incomplete timings
    let fallbackSettings = null;
    const orgId = req.user.organizationId;
    if (orgId && (!shift || !shift.startTime || !shift.endTime)) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true }
      });
      fallbackSettings = org?.settings || null;
    }

    const shiftName = shift?.name || 'Company Default';
    const startTime = shift?.startTime || fallbackSettings?.clockInTime || '09:00';
    const endTime = shift?.endTime || fallbackSettings?.clockOutTime || '18:00';
    const workingDays = shift?.workingDays || shiftService.DEFAULT_WORKING_DAYS;
    const isDefault = shift ? (shift.name === 'Company Default') : true;
    const formattedStart = shiftService.formatTime12h(startTime);
    const formattedEnd = shiftService.formatTime12h(endTime);

    const shiftPayload = {
      id: shift?.id || 'default',
      name: shiftName,
      shiftName,
      startTime,
      endTime,
      workingDays,
      isDefault,
      formattedStart,
      formattedEnd,
      ...(shift || {})
    };

    return res.json({
      success: true,
      shiftName,
      startTime,
      endTime,
      workingDays,
      isDefault,
      formattedStart,
      formattedEnd,
      shift: shiftPayload
    });
  } catch (error) {
    console.error('[shiftController] Error in getMyShift:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to retrieve your shift.' });
  }
};

/**
 * GET /api/shifts/my-schedule
 * Get upcoming schedule (Today, Tomorrow, Next Week) for current user.
 * Always sets strict no-cache headers and returns { success: true, data: schedule, ...schedule }.
 */
const getMyUpcomingSchedule = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const schedule = await shiftService.getEmployeeUpcomingSchedule(req.user.id);
    return res.json({
      success: true,
      data: schedule,
      ...schedule
    });
  } catch (error) {
    console.error('[shiftController] Error in getMyUpcomingSchedule:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to retrieve your upcoming schedule.' });
  }
};

/**
 * GET /api/shifts/analytics
 * Retrieve high-level KPI cards and today's attendance breakdown by shift.
 */
const getShiftAnalytics = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const data = await shiftService.getShiftAnalytics(organizationId);
    return res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('[shiftController] Error in getShiftAnalytics:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to retrieve shift analytics.' });
  }
};

/**
 * GET /api/shifts/export/members
 * Export assigned members across shifts for CSV/Excel generation.
 */
const exportShiftMembers = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const shifts = await shiftService.getCompanyShifts(organizationId);
    const rows = [];

    shifts.forEach(shift => {
      if (shift.members && Array.isArray(shift.members)) {
        shift.members.forEach(m => {
          const user = m.user;
          if (user) {
            rows.push({
              employeeId: user.employeeId || '',
              name: user.name || '',
              email: user.email || '',
              role: user.role || '',
              department: user.departmentRef?.name || user.department || 'General',
              shiftId: shift.id,
              shiftName: shift.name,
              shiftTiming: `${shift.startTime} – ${shift.endTime}`,
              shiftStatus: shift.status
            });
          }
        });
      }
    });

    if (req.query.format === 'csv') {
      const headers = ['Employee ID', 'Name', 'Email', 'Role', 'Department', 'Shift Name', 'Shift Timing', 'Shift Status'];
      const csvLines = [headers.join(',')];
      rows.forEach(r => {
        csvLines.push([
          `"${r.employeeId}"`,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${r.email}"`,
          `"${r.role}"`,
          `"${r.department.replace(/"/g, '""')}"`,
          `"${r.shiftName.replace(/"/g, '""')}"`,
          `"${r.shiftTiming}"`,
          `"${r.shiftStatus}"`
        ].join(','));
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="shift_members_export.csv"');
      return res.status(200).send(csvLines.join('\n'));
    }

    return res.json({
      success: true,
      count: rows.length,
      members: rows
    });
  } catch (error) {
    console.error('[shiftController] Error in exportShiftMembers:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to export shift members.' });
  }
};

/**
 * POST /api/shifts/bulk
 * Bulk activate or deactivate shifts.
 */
const bulkUpdateShifts = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const { shiftIds, action } = req.body;

    if (!Array.isArray(shiftIds) || !action) {
      return res.status(400).json({ success: false, message: 'shiftIds array and action are required.' });
    }

    const result = await shiftService.bulkUpdateShifts(shiftIds, organizationId, action, req.user.id);
    broadcastShiftUpdate(organizationId, { action: 'BULK_UPDATE', shiftIds, bulkAction: action });
    return res.json(result);
  } catch (error) {
    console.error('[shiftController] Error in bulkUpdateShifts:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to bulk update shifts.' });
  }
};

/**
 * GET /api/shifts/:id
 * Retrieve details of a single shift.
 */
const getShiftById = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const shift = await shiftService.getShiftById(req.params.id, organizationId);

    if (!shift) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }

    return res.json({
      success: true,
      shift
    });
  } catch (error) {
    console.error('[shiftController] Error in getShiftById:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to retrieve shift.' });
  }
};

/**
 * PUT /api/shifts/:id
 * Update shift timings, name, workingDays, or status.
 */
const updateShift = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const updated = await shiftService.updateShift(req.params.id, organizationId, req.body, prisma, req.user.id);

    broadcastShiftUpdate(organizationId, { action: 'SHIFT_UPDATED', shiftId: req.params.id, shift: updated });

    return res.json({
      success: true,
      message: 'Shift updated successfully.',
      shift: updated
    });
  } catch (error) {
    console.error('[shiftController] Error in updateShift:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update shift.' });
  }
};

/**
 * DELETE /api/shifts/:id
 * Safe deletion of a custom shift.
 */
const deleteShift = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const result = await shiftService.deleteShift(req.params.id, organizationId, prisma, req.user.id);

    broadcastShiftUpdate(organizationId, { action: 'SHIFT_DELETED', shiftId: req.params.id });

    return res.json({
      success: true,
      message: result.message,
      reassignedCount: result.reassignedCount
    });
  } catch (error) {
    console.error('[shiftController] Error in deleteShift:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete shift.' });
  }
};

/**
 * POST /api/shifts/:id/duplicate
 * Duplicate a shift configuration.
 */
const duplicateShift = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const duplicated = await shiftService.duplicateShift(req.params.id, organizationId, req.user.id);

    broadcastShiftUpdate(organizationId, { action: 'SHIFT_DUPLICATED', shiftId: duplicated.id });

    return res.status(201).json({
      success: true,
      message: `Shift duplicated as "${duplicated.name}".`,
      shift: duplicated
    });
  } catch (error) {
    console.error('[shiftController] Error in duplicateShift:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to duplicate shift.' });
  }
};

/**
 * GET /api/shifts/:id/history
 * Audit trail timeline for a shift.
 */
const getShiftHistory = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const history = await shiftService.getShiftHistory(req.params.id, organizationId);

    return res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    console.error('[shiftController] Error in getShiftHistory:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to retrieve shift history.' });
  }
};

/**
 * POST /api/shifts/:id/members
 * Assign members to a shift.
 */
const assignMembers = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ success: false, message: 'userIds array is required.' });
    }

    const result = await shiftService.assignMembers(req.params.id, userIds, organizationId, prisma, req.user.id);

    broadcastShiftUpdate(organizationId, { action: 'MEMBERS_ASSIGNED', shiftId: req.params.id, userIds });

    return res.json({
      success: true,
      message: `Successfully assigned ${result.assignedCount} member(s) to shift.`,
      result
    });
  } catch (error) {
    console.error('[shiftController] Error in assignMembers:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to assign members.' });
  }
};

module.exports = {
  getCompanyShifts,
  createShift,
  getMyShift,
  getMyUpcomingSchedule,
  getShiftAnalytics,
  exportShiftMembers,
  bulkUpdateShifts,
  getShiftById,
  updateShift,
  deleteShift,
  duplicateShift,
  getShiftHistory,
  assignMembers
};
