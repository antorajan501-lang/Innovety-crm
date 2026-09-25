const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const shiftService = require('./shiftService');

/**
 * Format time from date
 */
const formatTime = (dateObj) => {
  if (!dateObj) return '--:--';
  const d = new Date(dateObj);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Employee Self-Service Dashboard Data
 */
const getEmployeeSelfServiceData = async (userId, organizationId) => {
  if (!userId || !organizationId) throw new Error('userId and organizationId are required');

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId }
  });
  if (!user) throw new Error('Employee not found');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
  const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // 1. TODAY'S SHIFT (Priority: Override/Swap -> Permanent -> Company Default)
  let todayShift = null;
  try {
    todayShift = await shiftService.getEmployeeShift(userId, prisma, today);
  } catch {
    // Fallback if needed
  }

  // 2. TODAY'S ATTENDANCE RECORD
  const attendanceToday = await prisma.attendance.findFirst({
    where: {
      userId,
      date: { gte: todayStart, lte: todayEnd }
    }
  });

  const isClockedIn = Boolean(attendanceToday?.clockIn && !attendanceToday?.clockOut);
  const isClockedOut = Boolean(attendanceToday?.clockOut);

  // Calculate live elapsed working hours if clocked in
  let liveWorkingHours = attendanceToday?.workingHours || 0;
  if (isClockedIn && attendanceToday?.clockIn) {
    const elapsedMs = Date.now() - new Date(attendanceToday.clockIn).getTime();
    liveWorkingHours = Number((elapsedMs / (1000 * 60 * 60)).toFixed(2));
  }

  // Break summary
  const breakSummary = {
    totalBreakMinutes: isClockedIn || isClockedOut ? 30 : 0,
    breakStatus: isClockedIn ? 'Work Resumed' : isClockedOut ? 'Completed' : 'Not Started',
    breakSchedule: '01:00 PM – 01:30 PM (Lunch)'
  };

  // 3. UPCOMING DATA
  // Tomorrow's shift
  let tomorrowShift = null;
  try {
    tomorrowShift = await shiftService.getEmployeeShift(userId, prisma, tomorrow);
  } catch {
    // Fallback
  }

  // Upcoming Leaves
  const upcomingLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: 'APPROVED',
      endDate: { gte: todayStart }
    },
    orderBy: { startDate: 'asc' },
    take: 3
  });

  // Upcoming Holidays
  const upcomingHolidays = await prisma.holidayCalendar.findMany({
    where: {
      organizationId,
      date: { gte: todayStart }
    },
    orderBy: { date: 'asc' },
    take: 3
  });

  // 4. MONTHLY SUMMARY (Current Month)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthAttendances = await prisma.attendance.findMany({
    where: {
      userId,
      date: { gte: monthStart, lte: monthEnd }
    }
  });

  const presentDaysCount = monthAttendances.filter(a => a.clockIn && a.status !== 'ABSENT').length;
  const lateArrivalsCount = monthAttendances.filter(a => (a.lateMinutes || 0) > 0).length;

  let monthOtMinutes = 0;
  monthAttendances.forEach(a => {
    if (a.workingHours && a.workingHours > 8) {
      monthOtMinutes += Math.round((a.workingHours - 8) * 60);
    }
  });
  const monthlyOvertimeHours = Number((monthOtMinutes / 60).toFixed(1));

  // Approx 22 work days/month benchmark
  const daysPassed = Math.max(1, today.getDate());
  const monthlyAttendanceRate = Math.min(100, Math.round((presentDaysCount / Math.min(daysPassed, 22)) * 100));

  // Leave Balances
  const leaveBalances = await prisma.userLeaveBalance.findMany({
    where: { userId }
  });

  // 5. ATTENDANCE TIMELINE PUNCHES
  const timelineEvents = [];
  if (attendanceToday?.clockIn) {
    timelineEvents.push({
      id: 'clock_in',
      time: formatTime(attendanceToday.clockIn),
      title: 'Clocked In',
      subtitle: `Punch captured (${attendanceToday.workLocation || 'Office'})`,
      type: 'CLOCK_IN',
      color: 'text-emerald-500'
    });

    // Standard simulated break steps for visualization if elapsed past mid-day
    const clockInDate = new Date(attendanceToday.clockIn);
    const lunchStart = new Date(clockInDate);
    lunchStart.setHours(13, 0, 0, 0);

    const lunchEnd = new Date(clockInDate);
    lunchEnd.setHours(13, 30, 0, 0);

    if (Date.now() >= lunchStart.getTime()) {
      timelineEvents.push({
        id: 'break_start',
        time: '01:00 PM',
        title: 'Lunch Break Commenced',
        subtitle: '30-minute standard meal pause',
        type: 'BREAK',
        color: 'text-amber-500'
      });
    }

    if (Date.now() >= lunchEnd.getTime()) {
      timelineEvents.push({
        id: 'break_end',
        time: '01:30 PM',
        title: 'Work Shift Resumed',
        subtitle: 'Attendance tracking active',
        type: 'RESUME',
        color: 'text-blue-500'
      });
    }

    if (attendanceToday?.clockOut) {
      timelineEvents.push({
        id: 'clock_out',
        time: formatTime(attendanceToday.clockOut),
        title: 'Clocked Out',
        subtitle: `Shift ended • Total duration ${attendanceToday.workingHours || 8}h`,
        type: 'CLOCK_OUT',
        color: 'text-purple-500'
      });

      if (attendanceToday.workingHours && attendanceToday.workingHours > 8) {
        const otMin = Math.round((attendanceToday.workingHours - 8) * 60);
        timelineEvents.push({
          id: 'overtime',
          time: formatTime(attendanceToday.clockOut),
          title: 'Overtime Registered',
          subtitle: `+${otMin} minutes beyond scheduled shift`,
          type: 'OVERTIME',
          color: 'text-teal-500'
        });
      }
    }
  }

  return {
    employee: {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department || 'General',
      employeeId: user.employeeId
    },
    today: {
      date: todayStr,
      shift: todayShift ? {
        id: todayShift.id,
        name: todayShift.name,
        startTime: todayShift.startTime,
        endTime: todayShift.endTime,
        isCustomSchedule: todayShift.isCustomSchedule || false,
        scheduleType: todayShift.scheduleType || 'PERMANENT'
      } : null,
      clockInStatus: isClockedIn ? 'CLOCKED_IN' : isClockedOut ? 'CLOCKED_OUT' : 'NOT_CLOCKED_IN',
      clockInTime: formatTime(attendanceToday?.clockIn),
      clockOutTime: formatTime(attendanceToday?.clockOut),
      workingHours: liveWorkingHours,
      workLocation: attendanceToday?.workLocation || 'OFFICE',
      breakSummary
    },
    upcoming: {
      tomorrow: {
        date: tomorrowStr,
        shift: tomorrowShift ? {
          name: tomorrowShift.name,
          startTime: tomorrowShift.startTime,
          endTime: tomorrowShift.endTime,
          isCustomSchedule: tomorrowShift.isCustomSchedule || false
        } : null
      },
      leaves: upcomingLeaves.map(l => ({
        id: l.id,
        startDate: l.startDate.toISOString().split('T')[0],
        endDate: l.endDate.toISOString().split('T')[0],
        reason: l.reason,
        status: l.status
      })),
      holidays: upcomingHolidays.map(h => ({
        id: h.id,
        name: h.name,
        date: h.date.toISOString().split('T')[0]
      }))
    },
    monthlySummary: {
      monthLabel: today.toLocaleString('default', { month: 'long', year: 'numeric' }),
      attendanceRate: monthlyAttendanceRate,
      lateArrivalCount: lateArrivalsCount,
      overtimeHours: monthlyOvertimeHours,
      leaveBalances: leaveBalances.map(b => ({
        id: b.id,
        leaveTypeId: b.leaveTypeId,
        allocatedDays: b.allocatedDays,
        usedDays: b.usedDays,
        remainingDays: b.allocatedDays - b.usedDays
      }))
    },
    timeline: timelineEvents
  };
};

module.exports = {
  getEmployeeSelfServiceData
};
