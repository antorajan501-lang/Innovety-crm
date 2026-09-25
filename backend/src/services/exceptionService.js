const prisma = require('../utils/db');
const shiftService = require('./shiftService');

/**
 * Scan and detect attendance exceptions for an organization on a given date (or date range)
 */
const detectExceptionsForDate = async (organizationId, targetDate = new Date()) => {
  const d = new Date(targetDate);
  const startOfDay = new Date(d);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);

  // Get active users in organization
  const users = await prisma.user.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      department: true
    }
  });

  // Get all attendance logs for that day
  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: startOfDay, lte: endOfDay },
      user: { organizationId }
    }
  });

  const attMap = new Map();
  attendances.forEach(a => attMap.set(a.userId, a));

  const detectedExceptions = [];

  for (const user of users) {
    const shift = await shiftService.getEmployeeShift(user.id, prisma, d);
    if (!shift) continue;

    const isWorkingDay = shift.todayStatus === 'Working';
    const isHolidayDay = shift.todayStatus === 'Holiday';
    const att = attMap.get(user.id);

    if (isWorkingDay) {
      if (!att) {
        // Missed Clock-In if day is in past or shift has started
        const [sHour, sMin] = (shift.startTime || '09:00').split(':').map(Number);
        const shiftStart = new Date(d);
        shiftStart.setHours(sHour, sMin + 30, 0, 0); // 30 min grace

        if (new Date() > shiftStart) {
          detectedExceptions.push({
            organizationId,
            userId: user.id,
            attendanceId: null,
            type: 'MISSED_CLOCK_IN',
            date: startOfDay,
            status: 'OPEN',
            resolutionNote: `Scheduled for ${shift.name} (${shift.startTime}) but no check-in recorded.`
          });
        }
      } else {
        // Record exists
        // Check Late Arrival
        if (att.clockIn && shift.startTime) {
          const [sHour, sMin] = shift.startTime.split(':').map(Number);
          const expectedStart = new Date(d);
          expectedStart.setHours(sHour, sMin + 15, 0, 0); // 15 min grace

          const actualClockIn = new Date(att.clockIn);
          if (actualClockIn > expectedStart) {
            detectedExceptions.push({
              organizationId,
              userId: user.id,
              attendanceId: att.id,
              type: 'LATE_ARRIVAL',
              date: startOfDay,
              status: 'OPEN',
              resolutionNote: `Clocked in late at ${actualClockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Shift start: ${shift.startTime}).`
            });
          }
        }

        // Check Missed Clock-Out
        if (att.clockIn && !att.clockOut && shift.endTime) {
          const [eHour, eMin] = shift.endTime.split(':').map(Number);
          const expectedEnd = new Date(d);
          expectedEnd.setHours(eHour + 1, eMin, 0, 0); // 1 hour past end

          if (new Date() > expectedEnd) {
            detectedExceptions.push({
              organizationId,
              userId: user.id,
              attendanceId: att.id,
              type: 'MISSED_CLOCK_OUT',
              date: startOfDay,
              status: 'OPEN',
              resolutionNote: `Active clock-in without checkout 1hr past scheduled end (${shift.endTime}).`
            });
          }
        }

        // Check Unauthorized Overtime (> 2 hours overtime without approved schedule)
        if (att.workingHours && att.workingHours > 10.5) {
          detectedExceptions.push({
            organizationId,
            userId: user.id,
            attendanceId: att.id,
            type: 'UNAUTHORIZED_OVERTIME',
            date: startOfDay,
            status: 'OPEN',
            resolutionNote: `Logged ${att.workingHours.toFixed(1)} hours (exceeded 10h threshold without overtime schedule).`
          });
        }
      }
    } else if (isHolidayDay) {
      // If clocked in on a holiday
      if (att && att.clockIn) {
        detectedExceptions.push({
          organizationId,
          userId: user.id,
          attendanceId: att.id,
          type: 'HOLIDAY_ATTENDANCE',
          date: startOfDay,
          status: 'OPEN',
          resolutionNote: `Clocked in on designated holiday without prior approved holiday schedule.`
        });
      }
    }
  }

  // Upsert into ShiftException table
  for (const exc of detectedExceptions) {
    const existing = await prisma.shiftException.findFirst({
      where: {
        organizationId: exc.organizationId,
        userId: exc.userId,
        type: exc.type,
        date: exc.date
      }
    });

    if (!existing) {
      await prisma.shiftException.create({ data: exc });
    }
  }

  return detectedExceptions;
};

/**
 * Get aggregated attendance exceptions with filter counts
 */
const getExceptions = async ({
  organizationId,
  type = null,
  status = null,
  department = null,
  startDate = null,
  endDate = null
}) => {
  const where = { organizationId };
  if (type) where.type = type;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  if (department) {
    where.user = { department };
  }

  const [exceptions, countsByType, totalOpen] = await Promise.all([
    prisma.shiftException.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            employeeId: true,
            department: true,
            profilePic: true
          }
        },
        resolvedBy: {
          select: { id: true, name: true, role: true }
        }
      },
      orderBy: { date: 'desc' }
    }),
    prisma.shiftException.groupBy({
      by: ['type'],
      where: { organizationId, status: 'OPEN' },
      _count: { id: true }
    }),
    prisma.shiftException.count({
      where: { organizationId, status: 'OPEN' }
    })
  ]);

  const summary = {
    TOTAL_OPEN: totalOpen,
    LATE_ARRIVAL: 0,
    MISSED_CLOCK_IN: 0,
    MISSED_CLOCK_OUT: 0,
    HOLIDAY_ATTENDANCE: 0,
    UNAUTHORIZED_OVERTIME: 0
  };

  countsByType.forEach(c => {
    if (summary[c.type] !== undefined) {
      summary[c.type] = c._count.id;
    }
  });

  return {
    summary,
    exceptions
  };
};

/**
 * Resolve or dismiss an attendance exception
 */
const resolveException = async ({
  exceptionId,
  actorUserId,
  action, // 'RESOLVE' | 'DISMISS'
  resolutionNote
}) => {
  const exc = await prisma.shiftException.findUnique({
    where: { id: exceptionId }
  });

  if (!exc) {
    throw new Error('Attendance exception not found.');
  }

  return await prisma.shiftException.update({
    where: { id: exceptionId },
    data: {
      status: action === 'RESOLVE' ? 'RESOLVED' : 'DISMISSED',
      resolutionNote: resolutionNote || (action === 'RESOLVE' ? 'Resolved by Manager' : 'Dismissed'),
      resolvedById: actorUserId
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, role: true } }
    }
  });
};

module.exports = {
  detectExceptionsForDate,
  getExceptions,
  resolveException
};
