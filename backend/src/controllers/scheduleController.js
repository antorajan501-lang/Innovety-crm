const scheduleService = require('../services/scheduleService');

const resolveOrganizationId = (req) => {
  if (req.user.role === 'SUPER_ADMIN' && (req.query.organizationId || req.body?.organizationId)) {
    return req.query.organizationId || req.body?.organizationId;
  }
  return req.user.organizationId;
};

/**
 * GET /api/schedules/calendar
 */
const getCalendarData = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate query parameters are required.' });
    }

    const data = await scheduleService.getCalendarData({
      organizationId,
      startDate,
      endDate
    });

    return res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('[scheduleController] Error in getCalendarData:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to retrieve calendar data.' });
  }
};

/**
 * GET /api/schedules/day
 */
const getDaySchedule = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query parameter is required.' });
    }

    const data = await scheduleService.getDaySchedule({
      organizationId,
      date
    });

    return res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('[scheduleController] Error in getDaySchedule:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to retrieve day schedule.' });
  }
};

/**
 * GET /api/schedules/coverage
 */
const checkCoverage = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const date = req.query.date || new Date();
    const data = await scheduleService.checkCoverage({
      organizationId,
      date
    });

    return res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('[scheduleController] Error in checkCoverage:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to check staffing coverage.' });
  }
};

/**
 * POST /api/schedules/plan
 */
const createPlannedSchedule = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { userId, shiftId, startDate, endDate, reason } = req.body;
    const schedule = await scheduleService.createPlannedSchedule({
      organizationId,
      userId,
      shiftId,
      startDate,
      endDate,
      reason,
      actorUserId: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Future shift schedule planned successfully.',
      schedule
    });
  } catch (error) {
    console.error('[scheduleController] Error in createPlannedSchedule:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to plan shift.' });
  }
};

/**
 * POST /api/schedules/override
 */
const createOverride = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { userId, shiftId, startDate, endDate, reason } = req.body;
    const schedule = await scheduleService.createOverride({
      organizationId,
      userId,
      shiftId,
      startDate,
      endDate,
      reason,
      actorUserId: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Temporary shift override created successfully.',
      schedule
    });
  } catch (error) {
    console.error('[scheduleController] Error in createOverride:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to create override.' });
  }
};

/**
 * POST /api/schedules/swap
 */
const swapShifts = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required.' });
    }

    const { userAId, userBId, date, reason } = req.body;
    const result = await scheduleService.swapShifts({
      organizationId,
      userAId,
      userBId,
      date,
      reason,
      actorUserId: req.user.id
    });

    return res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[scheduleController] Error in swapShifts:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to swap shifts.' });
  }
};

/**
 * POST /api/schedules/check-conflict
 */
const checkConflict = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const { userId, startDate, endDate, excludeId } = req.body;

    const result = await scheduleService.detectConflicts({
      organizationId,
      userId,
      startDate,
      endDate,
      excludeId
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[scheduleController] Error in checkConflict:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to check conflict.' });
  }
};

/**
 * DELETE /api/schedules/:id
 */
const cancelSchedule = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const cancelled = await scheduleService.cancelSchedule({
      scheduleId: req.params.id,
      organizationId,
      actorUserId: req.user.id
    });

    return res.json({
      success: true,
      message: 'Shift schedule cancelled successfully.',
      schedule: cancelled
    });
  } catch (error) {
    console.error('[scheduleController] Error in cancelSchedule:', error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to cancel schedule.' });
  }
};

module.exports = {
  getCalendarData,
  getDaySchedule,
  checkCoverage,
  createPlannedSchedule,
  createOverride,
  swapShifts,
  checkConflict,
  cancelSchedule
};
