const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Helper to compute date range
 */
const getDateRange = (startDateStr, endDateStr, defaultWeeks = 26) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const endStr = endDateStr || todayStr;
  const endDate = new Date(`${endStr}T23:59:59.999Z`);

  let startDate;
  if (startDateStr) {
    startDate = new Date(`${startDateStr}T00:00:00.000Z`);
  } else {
    startDate = new Date(`${endStr}T00:00:00.000Z`);
    startDate.setUTCDate(startDate.getUTCDate() - (defaultWeeks * 7));
  }

  return { startDate, endDate };
};

/**
 * Generates Attendance Heatmap Matrix
 */
const getAttendanceHeatmap = async ({
  organizationId,
  view = 'company', // 'individual' | 'department' | 'company'
  userId = null,
  department = null,
  startDate: customStart = null,
  endDate: customEnd = null
}) => {
  if (!organizationId) throw new Error('organizationId is required');

  const { startDate, endDate } = getDateRange(customStart, customEnd, 26);

  // Fetch holidays in range
  const holidays = await prisma.holidayCalendar.findMany({
    where: {
      organizationId,
      date: { gte: startDate, lte: endDate }
    }
  });
  const holidayDateSet = new Set(
    holidays.map(h => new Date(h.date).toISOString().split('T')[0])
  );

  // 1. INDIVIDUAL VIEW
  if (view === 'individual') {
    let targetUser;
    if (userId) {
      targetUser = await prisma.user.findFirst({
        where: { id: userId, organizationId }
      });
    } else {
      // Pick first active employee as default
      targetUser = await prisma.user.findFirst({
        where: { organizationId, status: 'ACTIVE', role: 'EMPLOYEE' }
      });
    }

    if (!targetUser) {
      return {
        view: 'individual',
        user: null,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        days: []
      };
    }

    // Fetch user attendances
    const attendances = await prisma.attendance.findMany({
      where: {
        userId: targetUser.id,
        date: { gte: startDate, lte: endDate }
      }
    });
    const attMap = {};
    attendances.forEach(a => {
      const k = new Date(a.date).toISOString().split('T')[0];
      attMap[k] = a;
    });

    // Fetch user approved leaves
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        userId: targetUser.id,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      }
    });
    const leaveDateSet = new Set();
    leaves.forEach(l => {
      const cur = new Date(Math.max(new Date(l.startDate), startDate));
      const end = new Date(Math.min(new Date(l.endDate), endDate));
      while (cur <= end) {
        leaveDateSet.add(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }
    });

    const days = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dateStr = cur.toISOString().split('T')[0];
      const dayOfWeek = cur.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const att = attMap[dateStr];
      const isHoliday = holidayDateSet.has(dateStr);
      const isLeave = leaveDateSet.has(dateStr);

      let status = 'DAY_OFF';
      let hours = 0;
      let lateMinutes = 0;
      let label = 'Day Off';

      if (isHoliday) {
        status = 'HOLIDAY';
        label = 'Public Holiday';
      } else if (isLeave) {
        status = 'LEAVE';
        label = 'Approved Leave';
      } else if (att) {
        hours = att.workingHours || 0;
        lateMinutes = att.lateMinutes || 0;
        if (att.clockIn) {
          if (att.workLocation === 'HOME') {
            status = 'WFH';
            label = `WFH (${hours}h)`;
          } else if (lateMinutes > 0) {
            status = 'LATE';
            label = `Late by ${lateMinutes}m (${hours}h)`;
          } else {
            status = 'PRESENT';
            label = `Present (${hours}h)`;
          }
        } else if (att.status === 'ABSENT') {
          status = 'ABSENT';
          label = 'Absent';
        }
      } else if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Weekday without attendance
        status = cur > new Date() ? 'FUTURE' : 'ABSENT';
        label = status === 'FUTURE' ? 'Scheduled' : 'Absent / No Punch';
      }

      days.push({
        date: dateStr,
        dayOfWeek,
        status,
        hours,
        lateMinutes,
        label,
        shiftName: att?.shiftName || 'Standard Shift'
      });

      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return {
      view: 'individual',
      user: { id: targetUser.id, name: targetUser.name, department: targetUser.department },
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      days
    };
  }

  // 2. DEPARTMENT VIEW
  if (view === 'department') {
    const deptUsers = await prisma.user.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] },
        ...(department ? { department } : {})
      },
      select: { id: true }
    });

    const userIds = deptUsers.map(u => u.id);
    const totalMembers = userIds.length;

    const attendances = await prisma.attendance.findMany({
      where: {
        userId: { in: userIds },
        date: { gte: startDate, lte: endDate }
      },
      select: {
        date: true,
        clockIn: true,
        status: true,
        workLocation: true,
        lateMinutes: true
      }
    });

    const dayCounts = {};
    attendances.forEach(a => {
      const k = new Date(a.date).toISOString().split('T')[0];
      if (!dayCounts[k]) dayCounts[k] = { present: 0, late: 0, wfh: 0 };
      if (a.clockIn && a.status !== 'ABSENT') {
        dayCounts[k].present += 1;
        if ((a.lateMinutes || 0) > 0) dayCounts[k].late += 1;
        if (a.workLocation === 'HOME') dayCounts[k].wfh += 1;
      }
    });

    const days = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const dateStr = cur.toISOString().split('T')[0];
      const dayOfWeek = cur.getDay();
      const counts = dayCounts[dateStr] || { present: 0, late: 0, wfh: 0 };
      const isHoliday = holidayDateSet.has(dateStr);

      let rate = totalMembers > 0 ? Math.round((counts.present / totalMembers) * 100) : 0;
      let level = 0;
      if (rate >= 85) level = 4;
      else if (rate >= 60) level = 3;
      else if (rate >= 35) level = 2;
      else if (rate > 0) level = 1;

      days.push({
        date: dateStr,
        dayOfWeek,
        level,
        rate,
        presentCount: counts.present,
        totalMembers,
        lateCount: counts.late,
        wfhCount: counts.wfh,
        isHoliday,
        status: isHoliday ? 'HOLIDAY' : level === 0 ? 'LOW' : 'ACTIVE',
        label: `${dateStr}: ${counts.present}/${totalMembers} Present (${rate}%)`
      });

      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return {
      view: 'department',
      department: department || 'All Departments',
      totalMembers,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      days
    };
  }

  // 3. COMPANY VIEW (Default)
  const totalEmployees = await prisma.user.count({
    where: {
      organizationId,
      status: 'ACTIVE',
      role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] }
    }
  });

  const attendances = await prisma.attendance.findMany({
    where: {
      user: { organizationId },
      date: { gte: startDate, lte: endDate }
    },
    select: {
      date: true,
      clockIn: true,
      status: true,
      workLocation: true,
      lateMinutes: true
    }
  });

  const dayCounts = {};
  attendances.forEach(a => {
    const k = new Date(a.date).toISOString().split('T')[0];
    if (!dayCounts[k]) dayCounts[k] = { present: 0, late: 0, wfh: 0 };
    if (a.clockIn && a.status !== 'ABSENT') {
      dayCounts[k].present += 1;
      if ((a.lateMinutes || 0) > 0) dayCounts[k].late += 1;
      if (a.workLocation === 'HOME') dayCounts[k].wfh += 1;
    }
  });

  const days = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const dateStr = cur.toISOString().split('T')[0];
    const dayOfWeek = cur.getUTCDay();
    const counts = dayCounts[dateStr] || { present: 0, late: 0, wfh: 0 };
    const isHoliday = holidayDateSet.has(dateStr);

    let rate = totalEmployees > 0 ? Math.round((counts.present / totalEmployees) * 100) : 0;
    let level = 0;
    if (rate >= 80) level = 4;
    else if (rate >= 55) level = 3;
    else if (rate >= 30) level = 2;
    else if (rate > 0) level = 1;

    days.push({
      date: dateStr,
      dayOfWeek,
      level,
      rate,
      presentCount: counts.present,
      totalEmployees,
      lateCount: counts.late,
      wfhCount: counts.wfh,
      isHoliday,
      status: isHoliday ? 'HOLIDAY' : level === 0 ? 'LOW' : 'ACTIVE',
      label: `${dateStr}: ${counts.present}/${totalEmployees} Present (${rate}%)`
    });

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return {
    view: 'company',
    totalEmployees,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    days
  };
};

module.exports = {
  getAttendanceHeatmap
};
