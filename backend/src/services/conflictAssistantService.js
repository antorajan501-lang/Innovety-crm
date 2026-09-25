const prisma = require('../utils/db');

/**
 * Check for potential shift scheduling conflicts before saving
 */
const checkShiftConflicts = async ({
  organizationId,
  userId,
  shiftId,
  startDate,
  endDate,
  excludeScheduleId = null
}) => {
  const conflicts = [];
  const sDate = new Date(startDate);
  const eDate = new Date(endDate);

  const [user, targetShift, holidayCalendar, existingSchedules] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true, name: true, employeeId: true, department: true }
    }),
    prisma.shift.findFirst({
      where: { id: shiftId, organizationId }
    }),
    prisma.holidayCalendar.findMany({
      where: {
        organizationId,
        date: { gte: sDate, lte: eDate }
      }
    }),
    prisma.shiftSchedule.findMany({
      where: {
        organizationId,
        userId,
        status: 'ACTIVE',
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
        startDate: { lte: eDate },
        endDate: { gte: sDate }
      },
      include: { shift: true }
    })
  ]);

  if (!user || !targetShift) {
    return { hasConflict: false, conflicts: [] };
  }

  // 1. Double Booking Conflict
  if (existingSchedules.length > 0) {
    existingSchedules.forEach(sched => {
      conflicts.push({
        type: 'DOUBLE_BOOKING',
        severity: 'ERROR',
        title: 'Double Booking Conflict',
        employeeId: user.id,
        employeeName: user.name,
        message: `${user.name} already has an active schedule (${sched.shift.name}) covering ${sched.startDate.toISOString().split('T')[0]} to ${sched.endDate.toISOString().split('T')[0]}.`,
        suggestion: 'Cancel or adjust the existing schedule date range before reassigning.'
      });
    });
  }

  // 2. Organization Holiday Conflict
  if (holidayCalendar.length > 0) {
    holidayCalendar.forEach(h => {
      conflicts.push({
        type: 'HOLIDAY_CONFLICT',
        severity: 'WARNING',
        title: 'Holiday Schedule Conflict',
        employeeId: user.id,
        employeeName: user.name,
        message: `Scheduled date ${h.date.toISOString().split('T')[0]} coincides with public/company holiday "${h.name}".`,
        suggestion: 'Ensure holiday overtime compensation is approved if working on a holiday.'
      });
    });
  }

  // 3. Back-to-Back Shifts & Insufficient Rest (< 8 Hours)
  // Check day prior to start date
  const priorDay = new Date(sDate);
  priorDay.setDate(priorDay.getDate() - 1);
  const priorDayStart = new Date(priorDay);
  priorDayStart.setHours(0, 0, 0, 0);
  const priorDayEnd = new Date(priorDay);
  priorDayEnd.setHours(23, 59, 59, 999);

  const priorSchedule = await prisma.shiftSchedule.findFirst({
    where: {
      organizationId,
      userId,
      status: 'ACTIVE',
      startDate: { lte: priorDayEnd },
      endDate: { gte: priorDayStart }
    },
    include: { shift: true }
  });

  if (priorSchedule) {
    const priorEndStr = priorSchedule.shift.endTime || '18:00';
    const targetStartStr = targetShift.startTime || '09:00';

    const [pEndH, pEndM] = priorEndStr.split(':').map(Number);
    const [tStartH, tStartM] = targetStartStr.split(':').map(Number);

    // If prior shift was night shift (e.g. ends at 06:00 or 08:00 AM next morning)
    // and target shift starts early morning same day
    let restHours = 24 - pEndH + tStartH;
    if (pEndH < 12 && priorSchedule.shift.startTime > priorSchedule.shift.endTime) {
      // Overnight shift ending in the morning
      restHours = tStartH - pEndH;
    }

    if (restHours < 8 && restHours >= 0) {
      conflicts.push({
        type: 'INSUFFICIENT_REST',
        severity: 'WARNING',
        title: 'Insufficient Rest Period (< 8 Hours)',
        employeeId: user.id,
        employeeName: user.name,
        message: `Employee finishes prior shift (${priorSchedule.shift.name}) at ${priorEndStr} and starts ${targetShift.name} at ${targetStartStr}, leaving only ~${restHours}h turnaround.`,
        suggestion: 'Allow at least 8 to 11 hours rest period between consecutive shifts.'
      });
    }
  }

  // 4. Approved Leave / WFH Conflict
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: 'APPROVED',
      startDate: { lte: eDate },
      endDate: { gte: sDate }
    }
  });

  if (approvedLeaves.length > 0) {
    approvedLeaves.forEach(l => {
      conflicts.push({
        type: 'LEAVE_CONFLICT',
        severity: 'ERROR',
        title: `Approved ${l.type} Leave Conflict`,
        employeeId: user.id,
        employeeName: user.name,
        message: `${user.name} has an approved ${l.type} leave from ${l.startDate.toISOString().split('T')[0]} to ${l.endDate.toISOString().split('T')[0]}.`,
        suggestion: 'Do not assign working shift during approved leave periods.'
      });
    });
  }

  return {
    hasConflict: conflicts.length > 0,
    hasError: conflicts.some(c => c.severity === 'ERROR'),
    conflicts
  };
};

module.exports = {
  checkShiftConflicts
};
