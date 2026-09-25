const prisma = require('../utils/db');
const shiftService = require('./shiftService');

/**
 * Standardize date to midnight UTC
 */
const toMidnightUTC = (dateInput) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Date(d.toISOString().split('T')[0] + 'T00:00:00.000Z');
};

const toEndOfDayUTC = (dateInput) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Date(d.toISOString().split('T')[0] + 'T23:59:59.999Z');
};

/**
 * Detect scheduling conflicts (overlapping dates, invalid ranges)
 */
const detectConflicts = async ({
  organizationId,
  userId,
  startDate,
  endDate,
  excludeId = null,
  client = prisma
}) => {
  const start = toMidnightUTC(startDate);
  const end = toEndOfDayUTC(endDate);

  if (end < start) {
    return {
      hasConflict: true,
      message: 'End date cannot be earlier than start date.'
    };
  }

  const where = {
    organizationId,
    userId,
    status: 'ACTIVE',
    OR: [
      {
        startDate: { lte: end },
        endDate: { gte: start }
      }
    ]
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  const existing = await client.shiftSchedule.findFirst({
    where,
    include: { shift: true }
  });

  if (existing) {
    const sDate = new Date(existing.startDate).toISOString().split('T')[0];
    const eDate = new Date(existing.endDate).toISOString().split('T')[0];
    return {
      hasConflict: true,
      conflict: existing,
      message: `Employee already has an active ${existing.type.toLowerCase()} (${existing.shift.name}) from ${sDate} to ${eDate}.`
    };
  }

  return { hasConflict: false };
};

/**
 * Create a planned future shift assignment
 */
const createPlannedSchedule = async ({
  organizationId,
  userId,
  shiftId,
  startDate,
  endDate,
  reason = '',
  actorUserId = null,
  client = prisma
}) => {
  if (!organizationId || !userId || !shiftId || !startDate || !endDate) {
    throw new Error('organizationId, userId, shiftId, startDate, and endDate are required.');
  }

  // Conflict check
  const conflictCheck = await detectConflicts({
    organizationId,
    userId,
    startDate,
    endDate,
    client
  });

  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.message);
  }

  // Validate shift belongs to org
  const shift = await client.shift.findFirst({
    where: { id: shiftId, organizationId }
  });
  if (!shift) {
    throw new Error('Shift not found in this organization.');
  }

  const user = await client.user.findFirst({
    where: { id: userId, organizationId }
  });
  if (!user) {
    throw new Error('User not found in this organization.');
  }

  const schedule = await client.shiftSchedule.create({
    data: {
      organizationId,
      userId,
      shiftId,
      startDate: toMidnightUTC(startDate),
      endDate: toEndOfDayUTC(endDate),
      type: 'PLANNED',
      status: 'ACTIVE',
      reason: reason ? String(reason).trim() : 'Planned future schedule',
      createdById: actorUserId
    },
    include: {
      shift: true,
      user: {
        select: { id: true, name: true, email: true, employeeId: true }
      }
    }
  });

  // Record audit history
  await shiftService.recordShiftHistory({
    shiftId: shift.id,
    userId: actorUserId,
    action: 'SHIFT_PLANNED',
    details: {
      employeeName: user.name,
      employeeId: user.employeeId,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      reason: schedule.reason
    }
  }, client);

  return schedule;
};

/**
 * Create a temporary shift override
 */
const createOverride = async ({
  organizationId,
  userId,
  shiftId,
  startDate,
  endDate,
  reason = 'Temporary shift override',
  actorUserId = null,
  client = prisma
}) => {
  if (!organizationId || !userId || !shiftId || !startDate || !endDate) {
    throw new Error('organizationId, userId, shiftId, startDate, and endDate are required.');
  }

  const conflictCheck = await detectConflicts({
    organizationId,
    userId,
    startDate,
    endDate,
    client
  });

  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.message);
  }

  const shift = await client.shift.findFirst({
    where: { id: shiftId, organizationId }
  });
  if (!shift) {
    throw new Error('Shift not found in this organization.');
  }

  const user = await client.user.findFirst({
    where: { id: userId, organizationId }
  });
  if (!user) {
    throw new Error('User not found in this organization.');
  }

  const schedule = await client.shiftSchedule.create({
    data: {
      organizationId,
      userId,
      shiftId,
      startDate: toMidnightUTC(startDate),
      endDate: toEndOfDayUTC(endDate),
      type: 'OVERRIDE',
      status: 'ACTIVE',
      reason: String(reason).trim(),
      createdById: actorUserId
    },
    include: {
      shift: true,
      user: {
        select: { id: true, name: true, email: true, employeeId: true }
      }
    }
  });

  await shiftService.recordShiftHistory({
    shiftId: shift.id,
    userId: actorUserId,
    action: 'SHIFT_OVERRIDE_CREATED',
    details: {
      employeeName: user.name,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      reason: schedule.reason
    }
  }, client);

  return schedule;
};

/**
 * Swap shifts between two employees for a specified date
 */
const swapShifts = async ({
  organizationId,
  userAId,
  userBId,
  date,
  reason = 'Peer shift swap',
  actorUserId = null,
  client = prisma
}) => {
  if (!organizationId || !userAId || !userBId || !date) {
    throw new Error('organizationId, userAId, userBId, and date are required.');
  }

  if (userAId === userBId) {
    throw new Error('Cannot swap shift with the same employee.');
  }

  const targetStart = toMidnightUTC(date);
  const targetEnd = toEndOfDayUTC(date);

  // Verify both users belong to the organization
  const [userA, userB] = await Promise.all([
    client.user.findFirst({ where: { id: userAId, organizationId } }),
    client.user.findFirst({ where: { id: userBId, organizationId } })
  ]);

  if (!userA || !userB) {
    throw new Error('Both employees must belong to the same organization.');
  }

  // Resolve shifts for date
  const [shiftA, shiftB] = await Promise.all([
    shiftService.getEmployeeShift(userAId, client, targetStart),
    shiftService.getEmployeeShift(userBId, client, targetStart)
  ]);

  if (!shiftA || !shiftB) {
    throw new Error('Could not resolve shifts for both employees.');
  }

  // Create two matching SWAP schedules
  const [scheduleA, scheduleB] = await client.$transaction([
    client.shiftSchedule.create({
      data: {
        organizationId,
        userId: userAId,
        shiftId: shiftB.id,
        startDate: targetStart,
        endDate: targetEnd,
        type: 'SWAP',
        status: 'ACTIVE',
        reason: String(reason).trim(),
        swapWithUserId: userBId,
        createdById: actorUserId
      },
      include: { shift: true, user: true }
    }),
    client.shiftSchedule.create({
      data: {
        organizationId,
        userId: userBId,
        shiftId: shiftA.id,
        startDate: targetStart,
        endDate: targetEnd,
        type: 'SWAP',
        status: 'ACTIVE',
        reason: String(reason).trim(),
        swapWithUserId: userAId,
        createdById: actorUserId
      },
      include: { shift: true, user: true }
    })
  ]);

  // Record audit history
  await Promise.all([
    shiftService.recordShiftHistory({
      shiftId: shiftB.id,
      userId: actorUserId,
      action: 'SHIFT_SWAP_COMPLETED',
      details: {
        employee: userA.name,
        swappedWith: userB.name,
        originalShift: shiftA.name,
        newShift: shiftB.name,
        date: targetStart.toISOString().split('T')[0]
      }
    }, client),
    shiftService.recordShiftHistory({
      shiftId: shiftA.id,
      userId: actorUserId,
      action: 'SHIFT_SWAP_COMPLETED',
      details: {
        employee: userB.name,
        swappedWith: userA.name,
        originalShift: shiftB.name,
        newShift: shiftA.name,
        date: targetStart.toISOString().split('T')[0]
      }
    }, client)
  ]);

  return {
    success: true,
    date: targetStart.toISOString().split('T')[0],
    userASwap: scheduleA,
    userBSwap: scheduleB,
    message: `Successfully swapped shifts between ${userA.name} and ${userB.name}.`
  };
};

/**
 * Retrieves calendar summary data (Working, WFH, Holiday, Overrides) across a date range
 */
const getCalendarData = async ({
  organizationId,
  startDate,
  endDate,
  client = prisma
}) => {
  const start = toMidnightUTC(startDate);
  const end = toEndOfDayUTC(endDate);

  // Fetch all active employees
  const users = await client.user.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: { id: true, name: true }
  });

  // Fetch all active schedules in range
  const schedules = await client.shiftSchedule.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      startDate: { lte: end },
      endDate: { gte: start }
    },
    include: { shift: true }
  });

  // Fetch all permanent shifts with members
  const shifts = await shiftService.getCompanyShifts(organizationId, client);
  const userPermanentShiftMap = new Map();
  shifts.forEach(s => {
    if (s.members) {
      s.members.forEach(m => {
        userPermanentShiftMap.set(m.userId, s);
      });
    }
  });

  const defaultShift = shifts.find(s => s.name === shiftService.DEFAULT_SHIFT_DATA.name);

  // Iterate each day from start to end
  const days = [];
  const curr = new Date(start);
  const timeZone = 'Asia/Kolkata';

  while (curr <= end) {
    const dayDateStr = curr.toISOString().split('T')[0];
    const dayName = shiftService.getDayName(curr, timeZone);
    const dayStart = new Date(`${dayDateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dayDateStr}T23:59:59.999Z`);

    let workingCount = 0;
    let wfhCount = 0;
    let holidayCount = 0;
    let overrideCount = 0;

    // Filter schedules active on this day
    const activeSchedulesOnDay = schedules.filter(
      s => s.startDate <= dayEnd && s.endDate >= dayStart
    );
    const userOverrideMap = new Map();
    activeSchedulesOnDay.forEach(s => {
      userOverrideMap.set(s.userId, s);
      if (s.type === 'OVERRIDE' || s.type === 'SWAP') {
        overrideCount++;
      }
    });

    users.forEach(u => {
      const activeSched = userOverrideMap.get(u.id);
      const effectiveShift = activeSched?.shift || userPermanentShiftMap.get(u.id) || defaultShift;
      const dayStatus = shiftService.getShiftDayStatus(effectiveShift, dayName, curr);

      if (dayStatus === 'Working') {
        workingCount++;
      } else if (dayStatus === 'WFH') {
        wfhCount++;
      } else {
        holidayCount++;
      }
    });

    days.push({
      date: dayDateStr,
      dayName,
      totalEmployees: users.length,
      working: workingCount,
      wfh: wfhCount,
      holiday: holidayCount,
      overrides: overrideCount
    });

    curr.setDate(curr.getDate() + 1);
  }

  return { days };
};

/**
 * Detailed roster breakdown for a single day
 */
const getDaySchedule = async ({
  organizationId,
  date,
  client = prisma
}) => {
  const targetStart = toMidnightUTC(date);
  const targetEnd = toEndOfDayUTC(date);
  const timeZone = 'Asia/Kolkata';
  const dayName = shiftService.getDayName(targetStart, timeZone);

  const users = await client.user.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      role: true,
      department: true,
      departmentRef: {
        select: { id: true, name: true }
      }
    }
  });

  const activeSchedules = await client.shiftSchedule.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      startDate: { lte: targetEnd },
      endDate: { gte: targetStart }
    },
    include: {
      shift: true,
      swapWithUser: {
        select: { id: true, name: true }
      }
    }
  });

  const scheduleMap = new Map();
  activeSchedules.forEach(s => scheduleMap.set(s.userId, s));

  const shifts = await shiftService.getCompanyShifts(organizationId, client);
  const permMap = new Map();
  shifts.forEach(s => {
    s.members?.forEach(m => permMap.set(m.userId, s));
  });
  const defaultShift = shifts.find(s => s.name === shiftService.DEFAULT_SHIFT_DATA.name);

  const roster = users.map(user => {
    const sched = scheduleMap.get(user.id);
    const effectiveShift = sched?.shift || permMap.get(user.id) || defaultShift;
    const scheduleStatus = shiftService.getShiftDayStatus(effectiveShift, dayName, date);

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role,
      department: user.departmentRef?.name || user.department || 'General',
      shiftId: effectiveShift?.id,
      shiftName: effectiveShift?.name || 'Company Default',
      startTime: effectiveShift?.startTime || '09:00',
      endTime: effectiveShift?.endTime || '18:00',
      scheduleStatus, // Working | WFH | Holiday
      scheduleType: sched?.type || 'PERMANENT', // PERMANENT | OVERRIDE | SWAP | PLANNED
      scheduleReason: sched?.reason || null,
      swappedWith: sched?.swapWithUser?.name || null
    };
  });

  return {
    date: targetStart.toISOString().split('T')[0],
    dayName,
    roster
  };
};

/**
 * Evaluates department staffing coverage
 */
const checkCoverage = async ({
  organizationId,
  date = new Date(),
  client = prisma
}) => {
  const daySchedule = await getDaySchedule({ organizationId, date, client });
  const deptMap = new Map();

  daySchedule.roster.forEach(item => {
    const dept = item.department || 'General';
    if (!deptMap.has(dept)) {
      deptMap.set(dept, {
        departmentName: dept,
        totalMembers: 0,
        workingMembers: 0,
        wfhMembers: 0,
        holidayMembers: 0
      });
    }

    const data = deptMap.get(dept);
    data.totalMembers++;
    if (item.scheduleStatus === 'Working') data.workingMembers++;
    else if (item.scheduleStatus === 'WFH') data.wfhMembers++;
    else data.holidayMembers++;
  });

  const departments = Array.from(deptMap.values()).map(dept => {
    const activeStaff = dept.workingMembers + dept.wfhMembers;
    let status = 'Fully Staffed';

    if (dept.totalMembers > 0 && activeStaff === 0) {
      status = 'Understaffed';
    } else if (dept.totalMembers > 1 && activeStaff / dept.totalMembers < 0.4) {
      status = 'Understaffed';
    } else if (dept.totalMembers >= 3 && activeStaff === dept.totalMembers) {
      status = 'Fully Staffed';
    }

    return {
      ...dept,
      status
    };
  });

  return {
    date: daySchedule.date,
    dayName: daySchedule.dayName,
    departments
  };
};

/**
 * Cancel an active schedule / override
 */
const cancelSchedule = async ({
  scheduleId,
  organizationId,
  actorUserId = null,
  client = prisma
}) => {
  const schedule = await client.shiftSchedule.findFirst({
    where: { id: scheduleId, organizationId },
    include: { shift: true, user: true }
  });

  if (!schedule) {
    throw new Error('Schedule not found.');
  }

  const updated = await client.shiftSchedule.update({
    where: { id: scheduleId },
    data: { status: 'CANCELLED' }
  });

  await shiftService.recordShiftHistory({
    shiftId: schedule.shiftId,
    userId: actorUserId,
    action: 'SHIFT_SCHEDULE_CANCELLED',
    details: {
      type: schedule.type,
      employee: schedule.user.name,
      startDate: schedule.startDate,
      endDate: schedule.endDate
    }
  }, client);

  return updated;
};

module.exports = {
  detectConflicts,
  createPlannedSchedule,
  createOverride,
  swapShifts,
  getCalendarData,
  getDaySchedule,
  checkCoverage,
  cancelSchedule
};
