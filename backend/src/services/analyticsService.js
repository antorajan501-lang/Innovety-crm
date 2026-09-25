const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Helper to get local date boundaries
 */
const getDayBoundaries = (dateObj = new Date()) => {
  const d = new Date(dateObj);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${day}`;
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { dateStr, start, end };
};

/**
 * Format minutes/hours into HH:mm AM/PM string
 */
const formatMinutesToTimeStr = (totalMinutes) => {
  if (isNaN(totalMinutes) || totalMinutes === null) return '--:--';
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.floor(totalMinutes % 60);
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

/**
 * 1. Executive Dashboard KPIs
 */
const getExecutiveDashboardKpis = async (organizationId) => {
  if (!organizationId) throw new Error('organizationId is required');

  const { start: todayStart, end: todayEnd, dateStr: todayDateStr } = getDayBoundaries(new Date());

  // 1. Total Active Employees
  const totalEmployees = await prisma.user.count({
    where: {
      organizationId,
      status: 'ACTIVE',
      role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] }
    }
  });

  // 2. Attendances for Today
  const todayAttendances = await prisma.attendance.findMany({
    where: {
      user: { organizationId },
      date: { gte: todayStart, lte: todayEnd }
    },
    include: {
      user: {
        select: { id: true, name: true, department: true, role: true }
      }
    }
  });

  const presentToday = todayAttendances.filter(a => a.clockIn !== null && a.status !== 'ABSENT').length;
  const lateToday = todayAttendances.filter(a => (a.lateMinutes || 0) > 0).length;
  const wfhToday = todayAttendances.filter(a => a.workLocation === 'HOME').length;

  // 3. Overtime Hours Today
  let overtimeMinutesToday = 0;
  for (const a of todayAttendances) {
    if (a.workingHours && a.workingHours > 8) {
      overtimeMinutesToday += Math.round((a.workingHours - 8) * 60);
    }
  }
  const overtimeHoursToday = Number((overtimeMinutesToday / 60).toFixed(1));

  // 4. Check if today is a company holiday
  const holiday = await prisma.holidayCalendar.findFirst({
    where: {
      organizationId,
      date: { gte: todayStart, lte: todayEnd }
    }
  });
  const holidayToday = Boolean(holiday);

  // 5. Active Shifts Count
  const activeShiftsCount = await prisma.shift.count({
    where: { organizationId, status: 'ACTIVE' }
  });

  // 6. Attendance Rate
  const attendanceRate = totalEmployees > 0 ? Math.min(100, Math.round((presentToday / totalEmployees) * 100)) : 0;

  return {
    organizationId,
    date: todayDateStr,
    totalEmployees,
    presentToday,
    lateToday,
    wfhToday,
    holidayToday,
    holidayName: holiday?.name || null,
    overtimeHoursToday,
    activeShifts: activeShiftsCount,
    attendanceRate
  };
};

/**
 * 2. 30-Day Executive Trends
 */
const getExecutiveTrends = async (organizationId, days = 30) => {
  if (!organizationId) throw new Error('organizationId is required');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const endDate = new Date(`${todayStr}T23:59:59.999Z`);

  const startDate = new Date(`${todayStr}T00:00:00.000Z`);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

  // Fetch attendances in range
  const attendances = await prisma.attendance.findMany({
    where: {
      user: { organizationId },
      date: { gte: startDate, lte: endDate }
    },
    select: {
      date: true,
      clockIn: true,
      clockOut: true,
      status: true,
      workLocation: true,
      lateMinutes: true,
      workingHours: true
    }
  });

  // Fetch approved leaves in range
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      user: { organizationId },
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate }
    },
    select: {
      startDate: true,
      endDate: true
    }
  });

  // Build day map with UTC dates
  const dayMap = {};
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const key = cur.toISOString().split('T')[0];
    dayMap[key] = {
      date: key,
      label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      present: 0,
      late: 0,
      wfh: 0,
      absent: 0,
      overtimeHours: 0,
      leaveCount: 0
    };
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  for (const a of attendances) {
    const key = new Date(a.date).toISOString().split('T')[0];
    if (dayMap[key]) {
      if (a.clockIn && a.status !== 'ABSENT') {
        dayMap[key].present += 1;
        if ((a.lateMinutes || 0) > 0) dayMap[key].late += 1;
        if (a.workLocation === 'HOME') dayMap[key].wfh += 1;
        if (a.workingHours && a.workingHours > 8) {
          dayMap[key].overtimeHours += Number((a.workingHours - 8).toFixed(1));
        }
      } else if (a.status === 'ABSENT') {
        dayMap[key].absent += 1;
      }
    }
  }

  for (const l of leaves) {
    const cur = new Date(Math.max(new Date(l.startDate), startDate));
    const end = new Date(Math.min(new Date(l.endDate), endDate));
    while (cur <= end) {
      const key = cur.toISOString().split('T')[0];
      if (dayMap[key]) {
        dayMap[key].leaveCount += 1;
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return Object.values(dayMap);
};

/**
 * 3. Department Performance Analytics (Side-by-side comparison)
 */
const getDepartmentAnalytics = async (organizationId) => {
  if (!organizationId) throw new Error('organizationId is required');

  const users = await prisma.user.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] }
    },
    select: { id: true, name: true, department: true }
  });

  const departmentsSet = new Set();
  users.forEach(u => {
    if (u.department && u.department.trim()) {
      departmentsSet.add(u.department.trim());
    }
  });

  // If no departments found on users, check DepartmentMaster
  if (departmentsSet.size === 0) {
    const masters = await prisma.departmentMaster.findMany({
      where: { organizationId },
      select: { name: true }
    });
    masters.forEach(m => departmentsSet.add(m.name));
  }

  const deptList = Array.from(departmentsSet);
  if (deptList.length === 0) deptList.push('General');

  // Past 30 days date bounds
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const attendances = await prisma.attendance.findMany({
    where: {
      user: { organizationId },
      date: { gte: thirtyDaysAgo }
    },
    include: {
      user: { select: { id: true, department: true } }
    }
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      user: { organizationId },
      status: 'APPROVED',
      createdAt: { gte: thirtyDaysAgo }
    },
    include: {
      user: { select: { id: true, department: true } }
    }
  });

  const deptStats = deptList.map(deptName => {
    const deptUsers = users.filter(u => (u.department || 'General') === deptName);
    const memberCount = deptUsers.length;
    const userIds = new Set(deptUsers.map(u => u.id));

    const deptAtt = attendances.filter(a => userIds.has(a.userId));
    const totalPresents = deptAtt.filter(a => a.clockIn !== null && a.status !== 'ABSENT').length;
    const totalLates = deptAtt.filter(a => (a.lateMinutes || 0) > 0).length;
    const totalWfh = deptAtt.filter(a => a.workLocation === 'HOME').length;

    let totalOtMinutes = 0;
    deptAtt.forEach(a => {
      if (a.workingHours && a.workingHours > 8) {
        totalOtMinutes += Math.round((a.workingHours - 8) * 60);
      }
    });
    const totalOtHours = Number((totalOtMinutes / 60).toFixed(1));
    const avgOtHours = memberCount > 0 ? Number((totalOtHours / memberCount).toFixed(1)) : 0;

    const deptLeaves = leaves.filter(l => userIds.has(l.userId)).length;

    // Attendance Rate (ratio of actual presents vs expected 30 days * count)
    const expectedSessions = memberCount * 22; // ~22 working days in 30 days
    const attendanceRate = expectedSessions > 0
      ? Math.min(100, Math.round((totalPresents / expectedSessions) * 100))
      : 0;

    const lateArrivalRate = totalPresents > 0 ? Math.round((totalLates / totalPresents) * 100) : 0;
    const wfhDistribution = totalPresents > 0 ? Math.round((totalWfh / totalPresents) * 100) : 0;

    return {
      department: deptName,
      memberCount,
      attendanceRate,
      totalOvertimeHours: totalOtHours,
      avgOvertimeHours: avgOtHours,
      leaveCount: deptLeaves,
      lateArrivalRate,
      wfhDistribution
    };
  });

  return deptStats.sort((a, b) => b.memberCount - a.memberCount);
};

/**
 * 4. Productivity Metrics (Weekly, Monthly, Quarterly)
 */
const getProductivityMetrics = async (organizationId, period = 'MONTHLY') => {
  if (!organizationId) throw new Error('organizationId is required');

  let days = 30;
  if (period === 'WEEKLY') days = 7;
  else if (period === 'QUARTERLY') days = 90;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const attendances = await prisma.attendance.findMany({
    where: {
      user: { organizationId },
      date: { gte: startDate },
      clockIn: { not: null }
    },
    select: {
      clockIn: true,
      clockOut: true,
      workingHours: true,
      workLocation: true
    }
  });

  if (attendances.length === 0) {
    return {
      period,
      days,
      avgWorkingHours: 0,
      avgClockInTime: '--:--',
      avgClockOutTime: '--:--',
      overtimeFrequency: 0,
      wfhDistribution: 0,
      totalSessions: 0
    };
  }

  let totalWorkingHours = 0;
  let clockedOutCount = 0;
  let totalClockInMinutesOfDay = 0;
  let totalClockOutMinutesOfDay = 0;
  let overtimeSessionCount = 0;
  let wfhSessionCount = 0;

  for (const a of attendances) {
    if (a.workingHours) totalWorkingHours += a.workingHours;
    if (a.workingHours && a.workingHours > 8) overtimeSessionCount += 1;
    if (a.workLocation === 'HOME') wfhSessionCount += 1;

    if (a.clockIn) {
      const cin = new Date(a.clockIn);
      totalClockInMinutesOfDay += cin.getHours() * 60 + cin.getMinutes();
    }

    if (a.clockOut) {
      clockedOutCount += 1;
      const cout = new Date(a.clockOut);
      totalClockOutMinutesOfDay += cout.getHours() * 60 + cout.getMinutes();
    }
  }

  const avgWorkingHours = Number((totalWorkingHours / attendances.length).toFixed(1));
  const avgClockInMinutes = Math.round(totalClockInMinutesOfDay / attendances.length);
  const avgClockOutMinutes = clockedOutCount > 0 ? Math.round(totalClockOutMinutesOfDay / clockedOutCount) : 0;
  const overtimeFrequency = Math.round((overtimeSessionCount / attendances.length) * 100);
  const wfhDistribution = Math.round((wfhSessionCount / attendances.length) * 100);

  return {
    period,
    days,
    avgWorkingHours,
    avgClockInTime: formatMinutesToTimeStr(avgClockInMinutes),
    avgClockOutTime: clockedOutCount > 0 ? formatMinutesToTimeStr(avgClockOutMinutes) : '06:00 PM',
    overtimeFrequency,
    wfhDistribution,
    totalSessions: attendances.length
  };
};

module.exports = {
  getExecutiveDashboardKpis,
  getExecutiveTrends,
  getDepartmentAnalytics,
  getProductivityMetrics
};
