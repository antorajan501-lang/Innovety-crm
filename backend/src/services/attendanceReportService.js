const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const prisma = require('../utils/db');
const { getEffectiveSettings } = require('../utils/settingsResolver');
const { getSystemTimeZone, getTodayZonedDate, getZonedParts } = require('../utils/attendanceUtils');

// Helper to resolve company logo path
const getCompanyLogoPath = (organizationId) => {
  try {
    const brandingFile = path.join(__dirname, '../data/company_branding.json');
    if (fs.existsSync(brandingFile)) {
      const brandingData = JSON.parse(fs.readFileSync(brandingFile, 'utf8'));
      const orgBranding = brandingData[organizationId] || brandingData['GLOBAL'];
      if (orgBranding?.companyLogo) {
        const logoRelative = orgBranding.companyLogo.replace(/^\//, '');
        // Check backend/uploads
        const absUploadPath = path.join(__dirname, '../../', logoRelative);
        if (fs.existsSync(absUploadPath)) return absUploadPath;

        // Check backend/src/uploads
        const absSrcUploadPath = path.join(__dirname, '../', logoRelative);
        if (fs.existsSync(absSrcUploadPath)) return absSrcUploadPath;
      }
    }
  } catch (e) {
    // Quiet fail
  }

  // Fallback to frontend public logo
  const frontendLogo = path.join(__dirname, '../../../frontend/public/logo.png');
  if (fs.existsSync(frontendLogo)) return frontendLogo;

  const frontendVLogo = path.join(__dirname, '../../../frontend/public/v-logo.png');
  if (fs.existsSync(frontendVLogo)) return frontendVLogo;

  return null;
};

// Helper: Format Date to DD-MM-YYYY
const formatDDMMYYYY = (dateInput) => {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Helper: Format Time to 12-hour hh:mm AM/PM
const formatTime12h = (dateInput) => {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Helper: Calculate ISO Week Number
const getISOWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

// Helper: Get Start and End Dates of an ISO Week
const getWeekDatesFromWeekNumber = (week, year) => {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  const ISOweekEnd = new Date(ISOweekStart);
  ISOweekEnd.setUTCDate(ISOweekStart.getUTCDate() + 6);
  return {
    startDate: ISOweekStart.toISOString().split('T')[0],
    endDate: ISOweekEnd.toISOString().split('T')[0]
  };
};

/**
 * 1. Generate Daily Attendance Report
 */
const getDailyAttendanceData = async ({ organizationId, date, teamId, role, employeeName, status }) => {
  const settings = await getEffectiveSettings(organizationId);
  const timeZone = getSystemTimeZone(settings);
  const now = new Date();
  const todayParts = getZonedParts(now, timeZone);

  const targetDateStr = date ? String(date).trim().split('T')[0] : todayParts.dateStr;
  const [tY, tM, tD] = targetDateStr.split('-').map(Number);
  const targetDateObj = new Date(Date.UTC(tY, tM - 1, tD, 0, 0, 0, 0));
  const dayOfWeek = targetDateObj.getUTCDay(); // 0 = Sunday

  // Organization info
  const org = organizationId ? await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true }
  }) : null;
  const companyName = org?.name || 'Innovety Tech';

  // 1. Build User Query
  const userWhere = {
    status: 'ACTIVE',
    role: { in: ['INTERN', 'EMPLOYEE', 'TEAM_LEADER'] }
  };
  if (organizationId) userWhere.organizationId = organizationId;
  if (role && role !== 'ALL') userWhere.role = role;
  if (employeeName && employeeName.trim()) {
    const q = employeeName.trim();
    userWhere.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { employeeId: { contains: q, mode: 'insensitive' } }
    ];
  }

  // Team Filter
  if (teamId && teamId !== 'ALL') {
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true }
    });
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { leaderId: true }
    });
    const allowedUserIds = teamMembers.map(m => m.userId);
    if (team?.leaderId) allowedUserIds.push(team.leaderId);
    userWhere.id = { in: [...new Set(allowedUserIds)] };
  }

  const activeUsers = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      employeeId: true,
      role: true,
      department: true,
      joiningDate: true
    },
    orderBy: { name: 'asc' }
  });

  // Query ranges
  const minDate = new Date(Date.UTC(tY, tM - 1, tD, 0, 0, 0, 0));
  const maxDate = new Date(Date.UTC(tY, tM - 1, tD, 23, 59, 59, 999));
  const userIds = activeUsers.map(u => u.id);

  const [realAttendances, approvedLeaves, calendarOverrides, permanentHolidays] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        date: { gte: minDate, lte: maxDate },
        userId: { in: userIds }
      }
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: maxDate },
        endDate: { gte: minDate },
        userId: { in: userIds }
      }
    }),
    prisma.workCalendar.findMany({
      where: {
        date: { gte: minDate, lte: maxDate },
        ...(organizationId ? {
          OR: [
            { organizationId },
            { organizationId: null, createdBy: { organizationId } }
          ]
        } : {})
      }
    }),
    prisma.workCalendar.findMany({
      where: {
        isPermanent: true,
        status: 'HOLIDAY',
        ...(organizationId ? {
          OR: [
            { organizationId },
            { organizationId: null, createdBy: { organizationId } }
          ]
        } : {})
      }
    })
  ]);

  // Check Holiday status for target date
  let isHoliday = false;
  if (dayOfWeek === 0) {
    const override = calendarOverrides.find(c => c.status === 'WORKING' || c.status === 'WFH');
    isHoliday = !override;
  } else if (calendarOverrides.some(c => c.status === 'HOLIDAY')) {
    isHoliday = true;
  } else if (permanentHolidays.some(h => h.recurrenceMonth === tM && h.recurrenceDay === tD)) {
    isHoliday = true;
  }

  const attendanceMap = new Map();
  realAttendances.forEach(a => attendanceMap.set(a.userId, a));

  const records = [];

  for (const u of activeUsers) {
    // Only include employee if joiningDate <= targetDate
    if (u.joiningDate) {
      const jDateStr = new Date(u.joiningDate).toISOString().split('T')[0];
      if (jDateStr > targetDateStr) continue;
    }

    const att = attendanceMap.get(u.id);
    let attendanceVal = 'Absent';
    let loginTimeVal = '—';
    let loginStatusVal = 'Absent';

    if (att) {
      const isWFH = att.workLocation === 'HOME' || att.status === 'WORK_FROM_HOME';
      const isLate = att.status === 'LATE' || (att.lateMinutes && att.lateMinutes > 0);

      loginTimeVal = att.clockIn ? formatTime12h(att.clockIn) : '—';

      if (isWFH) {
        attendanceVal = 'WFH';
        loginStatusVal = 'WFH';
      } else if (att.status === 'HALF_DAY') {
        attendanceVal = 'Half Day';
        loginStatusVal = isLate ? 'Late' : 'On Time';
      } else if (att.status === 'LATE' || isLate) {
        attendanceVal = 'Present';
        loginStatusVal = 'Late';
      } else if (att.status === 'PRESENT') {
        attendanceVal = 'Present';
        loginStatusVal = 'On Time';
      } else if (att.status === 'LEAVE') {
        attendanceVal = 'On Leave';
        loginStatusVal = 'On Leave';
      } else if (att.status === 'ABSENT') {
        attendanceVal = 'Absent';
        loginStatusVal = 'Absent';
      } else {
        attendanceVal = 'Present';
        loginStatusVal = 'On Time';
      }
    } else {
      // Check Approved Leave
      const leave = approvedLeaves.find(l => l.userId === u.id);
      if (leave) {
        const isLeaveWFH = (leave.leaveType || leave.type) === 'WFH';
        attendanceVal = isLeaveWFH ? 'WFH' : 'On Leave';
        loginStatusVal = isLeaveWFH ? 'WFH' : 'On Leave';
      } else if (isHoliday) {
        attendanceVal = 'Holiday';
        loginStatusVal = 'Holiday';
      } else {
        attendanceVal = 'Absent';
        loginStatusVal = 'Absent';
      }
    }

    // Apply Status filter if passed
    if (status && status !== 'ALL') {
      const filterUpper = status.toUpperCase();
      const matchAtt = attendanceVal.toUpperCase().includes(filterUpper);
      const matchStatus = loginStatusVal.toUpperCase().includes(filterUpper);
      if (!matchAtt && !matchStatus) continue;
    }

    records.push({
      userId: u.id,
      employee: u.name,
      employeeId: u.employeeId,
      role: u.role,
      department: u.department || '—',
      attendance: attendanceVal,
      loginTime: loginTimeVal,
      loginStatus: loginStatusVal
    });
  }

  const [yearNum, monthNum, dayNum] = targetDateStr.split('-');
  const formattedDate = `${dayNum}-${monthNum}-${yearNum}`;

  return {
    companyName,
    reportType: 'Daily',
    date: formattedDate,
    targetDateStr,
    recordsCount: records.length,
    records
  };
};

/**
 * 2. Generate Weekly Attendance Report
 */
const getWeeklyAttendanceData = async ({ organizationId, week, year, date, teamId, role, employeeName, status }) => {
  const settings = await getEffectiveSettings(organizationId);
  const timeZone = getSystemTimeZone(settings);
  const now = new Date();
  const todayParts = getZonedParts(now, timeZone);

  let targetYear = year ? parseInt(year, 10) : todayParts.year;
  let targetWeek = week ? parseInt(week, 10) : null;

  if (!targetWeek) {
    const baseDate = date ? new Date(date) : now;
    targetWeek = getISOWeekNumber(baseDate);
    targetYear = baseDate.getFullYear();
  }

  const { startDate, endDate } = getWeekDatesFromWeekNumber(targetWeek, targetYear);
  const startObj = new Date(`${startDate}T00:00:00.000Z`);
  const endObj = new Date(`${endDate}T23:59:59.999Z`);

  // Organization info
  const org = organizationId ? await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true }
  }) : null;
  const companyName = org?.name || 'Innovety Tech';

  // Build User Query
  const userWhere = {
    status: 'ACTIVE',
    role: { in: ['INTERN', 'EMPLOYEE', 'TEAM_LEADER'] }
  };
  if (organizationId) userWhere.organizationId = organizationId;
  if (role && role !== 'ALL') userWhere.role = role;
  if (employeeName && employeeName.trim()) {
    const q = employeeName.trim();
    userWhere.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { employeeId: { contains: q, mode: 'insensitive' } }
    ];
  }

  // Team Filter
  if (teamId && teamId !== 'ALL') {
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true }
    });
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { leaderId: true }
    });
    const allowedUserIds = teamMembers.map(m => m.userId);
    if (team?.leaderId) allowedUserIds.push(team.leaderId);
    userWhere.id = { in: [...new Set(allowedUserIds)] };
  }

  const activeUsers = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      employeeId: true,
      role: true,
      department: true,
      joiningDate: true
    },
    orderBy: { name: 'asc' }
  });

  const userIds = activeUsers.map(u => u.id);

  // Fetch attendances, leaves & holidays for the week
  const [attendances, approvedLeaves, calendarOverrides, permanentHolidays] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        date: { gte: startObj, lte: endObj },
        userId: { in: userIds }
      }
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endObj },
        endDate: { gte: startObj },
        userId: { in: userIds }
      }
    }),
    prisma.workCalendar.findMany({
      where: {
        date: { gte: startObj, lte: endObj },
        ...(organizationId ? {
          OR: [
            { organizationId },
            { organizationId: null, createdBy: { organizationId } }
          ]
        } : {})
      }
    }),
    prisma.workCalendar.findMany({
      where: {
        isPermanent: true,
        status: 'HOLIDAY',
        ...(organizationId ? {
          OR: [
            { organizationId },
            { organizationId: null, createdBy: { organizationId } }
          ]
        } : {})
      }
    })
  ]);

  // Construct dates of the week
  const daysInWeek = [];
  const cur = new Date(startObj);
  while (cur <= endObj) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth() + 1;
    const d = cur.getUTCDate();
    const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow = cur.getUTCDay();

    // Check holiday
    let isHol = false;
    if (dow === 0) {
      const override = calendarOverrides.find(c => c.date && new Date(c.date).toISOString().split('T')[0] === dStr && (c.status === 'WORKING' || c.status === 'WFH'));
      isHol = !override;
    } else if (calendarOverrides.some(c => c.date && new Date(c.date).toISOString().split('T')[0] === dStr && c.status === 'HOLIDAY')) {
      isHol = true;
    } else if (permanentHolidays.some(h => h.recurrenceMonth === m && h.recurrenceDay === d)) {
      isHol = true;
    }

    daysInWeek.push({ dateStr: dStr, isHoliday: isHol, dayOfWeek: dow });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const workingDaysInWeekCount = daysInWeek.filter(d => !d.isHoliday).length || 5;

  let totalLateCountAll = 0;
  let totalPresentCountAll = 0;
  const records = [];

  for (const u of activeUsers) {
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let wfhCount = 0;
    let totalWorkingHours = 0;

    const uJoiningStr = u.joiningDate ? new Date(u.joiningDate).toISOString().split('T')[0] : null;

    for (const { dateStr, isHoliday } of daysInWeek) {
      if (uJoiningStr && dateStr < uJoiningStr) continue; // Skip days prior to joining
      if (dateStr > todayParts.dateStr) continue; // Skip future days

      const att = attendances.find(a => a.userId === u.id && new Date(a.date).toISOString().split('T')[0] === dateStr);

      if (att) {
        const isWFH = att.workLocation === 'HOME' || att.status === 'WORK_FROM_HOME';
        const isLate = att.status === 'LATE' || (att.lateMinutes && att.lateMinutes > 0);

        if (att.workingHours) {
          totalWorkingHours += att.workingHours;
        }

        if (isWFH) {
          wfhCount++;
        } else if (att.status === 'ABSENT') {
          absentCount++;
        } else if (att.status === 'LEAVE') {
          // Counted as leave or skip
        } else {
          presentCount++;
          if (isLate) lateCount++;
        }
      } else {
        // Check Leave
        const leave = approvedLeaves.find(l => {
          if (l.userId !== u.id) return false;
          const lStart = new Date(l.startDate).toISOString().split('T')[0];
          const lEnd = new Date(l.endDate).toISOString().split('T')[0];
          return dateStr >= lStart && dateStr <= lEnd;
        });

        if (leave) {
          if ((leave.leaveType || leave.type) === 'WFH') {
            wfhCount++;
          }
        } else if (isHoliday) {
          // Holiday, ignore
        } else {
          absentCount++;
        }
      }
    }

    // Apply status filter if passed
    if (status && status !== 'ALL') {
      const sUpper = status.toUpperCase();
      if (sUpper === 'LATE' && lateCount === 0) continue;
      if (sUpper === 'PRESENT' && presentCount === 0) continue;
      if (sUpper === 'ABSENT' && absentCount === 0) continue;
      if (sUpper === 'WFH' && wfhCount === 0) continue;
    }

    totalLateCountAll += lateCount;
    totalPresentCountAll += (presentCount + wfhCount);

    records.push({
      userId: u.id,
      employee: u.name,
      employeeId: u.employeeId,
      role: u.role,
      department: u.department || '—',
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      wfh: wfhCount,
      totalHours: Number(totalWorkingHours.toFixed(1))
    });
  }

  // Summary Metrics
  const totalEmployees = records.length;
  const potentialTotalAttendance = totalEmployees * workingDaysInWeekCount;
  const avgAttendancePercent = potentialTotalAttendance > 0
    ? `${Math.min(100, Math.round((totalPresentCountAll / potentialTotalAttendance) * 1000) / 10)}%`
    : '0%';

  const weekLabel = `Week ${targetWeek}, ${targetYear}`;

  return {
    companyName,
    reportType: 'Weekly',
    week: targetWeek,
    year: targetYear,
    weekLabel,
    startDate,
    endDate,
    formattedRange: `${formatDDMMYYYY(startDate)} to ${formatDDMMYYYY(endDate)}`,
    summary: {
      totalEmployees,
      averageAttendance: avgAttendancePercent,
      totalLateCount: totalLateCountAll
    },
    records
  };
};

/**
 * 3. Generate Monthly Attendance Report
 */
const getMonthlyAttendanceData = async ({ organizationId, month, year, teamId, role, employeeName, status }) => {
  const settings = await getEffectiveSettings(organizationId);
  const timeZone = getSystemTimeZone(settings);
  const now = new Date();
  const todayParts = getZonedParts(now, timeZone);

  const targetMonth = month ? parseInt(month, 10) : todayParts.month;
  const targetYear = year ? parseInt(year, 10) : todayParts.year;

  const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
  // Last day of month
  const endOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));
  const daysInMonthTotal = endOfMonth.getUTCDate();

  // Organization info
  const org = organizationId ? await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true }
  }) : null;
  const companyName = org?.name || 'Innovety Tech';

  // Build User Query
  const userWhere = {
    status: 'ACTIVE',
    role: { in: ['INTERN', 'EMPLOYEE', 'TEAM_LEADER'] }
  };
  if (organizationId) userWhere.organizationId = organizationId;
  if (role && role !== 'ALL') userWhere.role = role;
  if (employeeName && employeeName.trim()) {
    const q = employeeName.trim();
    userWhere.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { employeeId: { contains: q, mode: 'insensitive' } }
    ];
  }

  // Team Filter
  if (teamId && teamId !== 'ALL') {
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true }
    });
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { leaderId: true }
    });
    const allowedUserIds = teamMembers.map(m => m.userId);
    if (team?.leaderId) allowedUserIds.push(team.leaderId);
    userWhere.id = { in: [...new Set(allowedUserIds)] };
  }

  const activeUsers = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      employeeId: true,
      role: true,
      department: true,
      joiningDate: true
    },
    orderBy: { name: 'asc' }
  });

  const userIds = activeUsers.map(u => u.id);

  const [attendances, approvedLeaves, calendarOverrides, permanentHolidays] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        date: { gte: startOfMonth, lte: endOfMonth },
        userId: { in: userIds }
      }
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
        userId: { in: userIds }
      }
    }),
    prisma.workCalendar.findMany({
      where: {
        date: { gte: startOfMonth, lte: endOfMonth },
        ...(organizationId ? {
          OR: [
            { organizationId },
            { organizationId: null, createdBy: { organizationId } }
          ]
        } : {})
      }
    }),
    prisma.workCalendar.findMany({
      where: {
        isPermanent: true,
        status: 'HOLIDAY',
        ...(organizationId ? {
          OR: [
            { organizationId },
            { organizationId: null, createdBy: { organizationId } }
          ]
        } : {})
      }
    })
  ]);

  // Construct dates of the month
  const calendarDays = [];
  let monthWorkingDaysCount = 0;

  for (let day = 1; day <= daysInMonthTotal; day++) {
    const dObj = new Date(Date.UTC(targetYear, targetMonth - 1, day, 0, 0, 0, 0));
    const dStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = dObj.getUTCDay();

    let isHol = false;
    if (dow === 0) {
      const override = calendarOverrides.find(c => c.date && new Date(c.date).toISOString().split('T')[0] === dStr && (c.status === 'WORKING' || c.status === 'WFH'));
      isHol = !override;
    } else if (calendarOverrides.some(c => c.date && new Date(c.date).toISOString().split('T')[0] === dStr && c.status === 'HOLIDAY')) {
      isHol = true;
    } else if (permanentHolidays.some(h => h.recurrenceMonth === targetMonth && h.recurrenceDay === day)) {
      isHol = true;
    }

    if (!isHol) monthWorkingDaysCount++;
    calendarDays.push({ dateStr: dStr, isHoliday: isHol, dayOfWeek: dow });
  }

  let totalAttendedCountAll = 0;
  let totalPossibleDaysAll = 0;
  const records = [];

  for (const u of activeUsers) {
    let presentCount = 0;
    let lateCount = 0;
    let leaveCount = 0;
    let wfhCount = 0;
    let employeeWorkingDays = 0;

    const uJoiningStr = u.joiningDate ? new Date(u.joiningDate).toISOString().split('T')[0] : null;

    for (const { dateStr, isHoliday } of calendarDays) {
      if (uJoiningStr && dateStr < uJoiningStr) continue; // Skip days prior to joining
      if (!isHoliday) employeeWorkingDays++;

      if (dateStr > todayParts.dateStr) continue; // Skip future days

      const att = attendances.find(a => a.userId === u.id && new Date(a.date).toISOString().split('T')[0] === dateStr);

      if (att) {
        const isWFH = att.workLocation === 'HOME' || att.status === 'WORK_FROM_HOME';
        const isLate = att.status === 'LATE' || (att.lateMinutes && att.lateMinutes > 0);

        if (isWFH) {
          wfhCount++;
        } else if (att.status === 'LEAVE') {
          leaveCount++;
        } else if (att.status === 'ABSENT') {
          // Absent
        } else {
          presentCount++;
          if (isLate) lateCount++;
        }
      } else {
        // Check Leave
        const leave = approvedLeaves.find(l => {
          if (l.userId !== u.id) return false;
          const lStart = new Date(l.startDate).toISOString().split('T')[0];
          const lEnd = new Date(l.endDate).toISOString().split('T')[0];
          return dateStr >= lStart && dateStr <= lEnd;
        });

        if (leave) {
          if ((leave.leaveType || leave.type) === 'WFH') {
            wfhCount++;
          } else {
            leaveCount++;
          }
        }
      }
    }

    // Apply status filter if passed
    if (status && status !== 'ALL') {
      const sUpper = status.toUpperCase();
      if (sUpper === 'LATE' && lateCount === 0) continue;
      if (sUpper === 'PRESENT' && presentCount === 0) continue;
      if (sUpper === 'LEAVE' && leaveCount === 0) continue;
      if (sUpper === 'WFH' && wfhCount === 0) continue;
    }

    totalAttendedCountAll += (presentCount + wfhCount);
    totalPossibleDaysAll += employeeWorkingDays;

    records.push({
      userId: u.id,
      employee: u.name,
      employeeId: u.employeeId,
      role: u.role,
      department: u.department || '—',
      workingDays: employeeWorkingDays,
      present: presentCount,
      late: lateCount,
      leave: leaveCount,
      wfh: wfhCount
    });
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[targetMonth - 1] || 'Month';
  const avgAttendancePercent = totalPossibleDaysAll > 0
    ? `${Math.min(100, Math.round((totalAttendedCountAll / totalPossibleDaysAll) * 1000) / 10)}%`
    : '0%';

  return {
    companyName,
    reportType: 'Monthly',
    month: targetMonth,
    monthName,
    year: targetYear,
    monthYearLabel: `${monthName} ${targetYear}`,
    summary: {
      totalWorkingDays: monthWorkingDaysCount,
      averageAttendancePercent: avgAttendancePercent
    },
    records
  };
};

/**
 * 4. Generate Professional ExcelJS Workbook
 */
const generateExcelReport = async ({ type, organizationId, params }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Innovety CRM';
  workbook.lastModifiedBy = 'Innovety CRM';
  workbook.created = new Date();
  workbook.modified = new Date();

  const logoPath = getCompanyLogoPath(organizationId);

  // Palette: Innovety Orange
  const ORANGE_HEX = 'FFEA580C'; // Primary Orange
  const ORANGE_LIGHT = 'FFFFF7ED'; // Light warm zebra
  const BORDER_COLOR = 'FFE5E7EB'; // Subtle grey border

  if (type === 'daily') {
    const data = await getDailyAttendanceData({ organizationId, ...params });
    const sheet = workbook.addWorksheet('Daily Attendance', {
      pageSetup: { fitToPage: true, fitToWidth: 1 }
    });

    // Set row heights for branding (Rows 1-5)
    sheet.getRow(1).height = 16;
    sheet.getRow(2).height = 16;
    sheet.getRow(3).height = 16;
    sheet.getRow(4).height = 24;
    sheet.getRow(5).height = 20;

    // Add Logo if available in Rows 1-3
    if (logoPath) {
      try {
        const imageId = workbook.addImage({
          filename: logoPath,
          extension: logoPath.endsWith('.jpg') || logoPath.endsWith('.jpeg') ? 'jpeg' : 'png'
        });
        sheet.addImage(imageId, {
          tl: { col: 0.1, row: 0.2 },
          ext: { width: 130, height: 38 }
        });
      } catch (err) {
        console.warn('Failed to insert logo into Excel:', err);
      }
    }

    // Row 4: Company Title
    const titleRow = sheet.getRow(4);
    titleRow.values = [data.companyName];
    titleRow.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: ORANGE_HEX } };
    sheet.mergeCells('A4:D4');

    // Row 5: Report Subtitle & Date
    const subRow = sheet.getRow(5);
    subRow.values = [`Daily Attendance Report  |  Date: ${data.date}`];
    subRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF475569' } };
    sheet.mergeCells('A5:D5');

    // Row 6: Table Headers
    const headerRow = sheet.getRow(6);
    headerRow.values = ['Employee', 'Attendance', 'Login Time', 'Login Status'];
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ORANGE_HEX }
      };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: ORANGE_HEX } },
        bottom: { style: 'thin', color: { argb: ORANGE_HEX } },
        left: { style: 'thin', color: { argb: ORANGE_HEX } },
        right: { style: 'thin', color: { argb: ORANGE_HEX } }
      };
    });
    // Align Employee header left
    sheet.getCell('A6').alignment = { vertical: 'middle', horizontal: 'left' };

    // Data Rows start at Row 7
    let currentRow = 7;
    data.records.forEach((rec, idx) => {
      const row = sheet.getRow(currentRow);
      row.values = [
        rec.employee,
        rec.attendance,
        rec.loginTime,
        rec.loginStatus
      ];
      row.height = 22;

      const isEven = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNum === 1 ? 'left' : 'center'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: BORDER_COLOR } },
          bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
          left: { style: 'thin', color: { argb: BORDER_COLOR } },
          right: { style: 'thin', color: { argb: BORDER_COLOR } }
        };
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ORANGE_LIGHT }
          };
        }
      });
      currentRow++;
    });

    // Auto-fit Column Widths
    sheet.columns = [
      { key: 'A', width: 28 },
      { key: 'B', width: 18 },
      { key: 'C', width: 18 },
      { key: 'D', width: 18 }
    ];

    // Frozen Table Header at Row 6
    sheet.views = [
      {
        state: 'frozen',
        ySplit: 6,
        topLeftCell: 'A7'
      }
    ];

    return {
      workbook,
      filename: `Attendance_Daily_${data.date}.xlsx`
    };
  }

  if (type === 'weekly') {
    const data = await getWeeklyAttendanceData({ organizationId, ...params });
    const sheet = workbook.addWorksheet('Weekly Attendance', {
      pageSetup: { fitToPage: true, fitToWidth: 1 }
    });

    // Set row heights for branding (Rows 1-5)
    sheet.getRow(1).height = 16;
    sheet.getRow(2).height = 16;
    sheet.getRow(3).height = 16;
    sheet.getRow(4).height = 24;
    sheet.getRow(5).height = 20;

    // Add Logo in Rows 1-3
    if (logoPath) {
      try {
        const imageId = workbook.addImage({
          filename: logoPath,
          extension: logoPath.endsWith('.jpg') || logoPath.endsWith('.jpeg') ? 'jpeg' : 'png'
        });
        sheet.addImage(imageId, {
          tl: { col: 0.1, row: 0.2 },
          ext: { width: 130, height: 38 }
        });
      } catch (err) {
        console.warn('Failed to insert logo into Excel:', err);
      }
    }

    // Row 4: Company Title
    const titleRow = sheet.getRow(4);
    titleRow.values = [data.companyName];
    titleRow.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: ORANGE_HEX } };
    sheet.mergeCells('A4:F4');

    // Row 5: Report Subtitle, Date & Summary
    const subRow = sheet.getRow(5);
    subRow.values = [
      `Weekly Attendance Report  |  ${data.weekLabel} (${data.formattedRange})  |  Total: ${data.summary.totalEmployees}  |  Avg Attendance: ${data.summary.averageAttendance}  |  Late: ${data.summary.totalLateCount}`
    ];
    subRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };
    sheet.mergeCells('A5:F5');

    // Row 6: Table Headers
    const headerRow = sheet.getRow(6);
    headerRow.values = ['Employee', 'Present', 'Late', 'Absent', 'WFH', 'Total Hours'];
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ORANGE_HEX }
      };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: ORANGE_HEX } },
        bottom: { style: 'thin', color: { argb: ORANGE_HEX } },
        left: { style: 'thin', color: { argb: ORANGE_HEX } },
        right: { style: 'thin', color: { argb: ORANGE_HEX } }
      };
    });
    sheet.getCell('A6').alignment = { vertical: 'middle', horizontal: 'left' };

    // Data Rows start at Row 7
    let currentRow = 7;
    data.records.forEach((rec, idx) => {
      const row = sheet.getRow(currentRow);
      row.values = [
        rec.employee,
        rec.present,
        rec.late,
        rec.absent,
        rec.wfh,
        rec.totalHours
      ];
      row.height = 22;

      const isEven = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNum === 1 ? 'left' : 'center'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: BORDER_COLOR } },
          bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
          left: { style: 'thin', color: { argb: BORDER_COLOR } },
          right: { style: 'thin', color: { argb: BORDER_COLOR } }
        };
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ORANGE_LIGHT }
          };
        }
      });
      currentRow++;
    });

    sheet.columns = [
      { key: 'A', width: 28 },
      { key: 'B', width: 14 },
      { key: 'C', width: 14 },
      { key: 'D', width: 14 },
      { key: 'E', width: 14 },
      { key: 'F', width: 16 }
    ];

    // Frozen Table Header at Row 6
    sheet.views = [
      {
        state: 'frozen',
        ySplit: 6,
        topLeftCell: 'A7'
      }
    ];

    const formattedWeekStr = String(data.week).padStart(2, '0');
    return {
      workbook,
      filename: `Attendance_Weekly_Week${formattedWeekStr}_${data.year}.xlsx`
    };
  }

  if (type === 'monthly') {
    const data = await getMonthlyAttendanceData({ organizationId, ...params });
    const sheet = workbook.addWorksheet('Monthly Attendance', {
      pageSetup: { fitToPage: true, fitToWidth: 1 }
    });

    // Set row heights for branding (Rows 1-5)
    sheet.getRow(1).height = 16;
    sheet.getRow(2).height = 16;
    sheet.getRow(3).height = 16;
    sheet.getRow(4).height = 24;
    sheet.getRow(5).height = 20;

    // Add Logo in Rows 1-3
    if (logoPath) {
      try {
        const imageId = workbook.addImage({
          filename: logoPath,
          extension: logoPath.endsWith('.jpg') || logoPath.endsWith('.jpeg') ? 'jpeg' : 'png'
        });
        sheet.addImage(imageId, {
          tl: { col: 0.1, row: 0.2 },
          ext: { width: 130, height: 38 }
        });
      } catch (err) {
        console.warn('Failed to insert logo into Excel:', err);
      }
    }

    // Row 4: Company Title
    const titleRow = sheet.getRow(4);
    titleRow.values = [data.companyName];
    titleRow.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: ORANGE_HEX } };
    sheet.mergeCells('A4:F4');

    // Row 5: Report Subtitle, Date & Summary
    const subRow = sheet.getRow(5);
    subRow.values = [
      `Monthly Attendance Report  |  ${data.monthYearLabel}  |  Total Working Days: ${data.summary.totalWorkingDays}  |  Average Attendance: ${data.summary.averageAttendancePercent}`
    ];
    subRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF475569' } };
    sheet.mergeCells('A5:F5');

    // Row 6: Table Headers
    const headerRow = sheet.getRow(6);
    headerRow.values = ['Employee', 'Working Days', 'Present', 'Late', 'Leave', 'WFH'];
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ORANGE_HEX }
      };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: ORANGE_HEX } },
        bottom: { style: 'thin', color: { argb: ORANGE_HEX } },
        left: { style: 'thin', color: { argb: ORANGE_HEX } },
        right: { style: 'thin', color: { argb: ORANGE_HEX } }
      };
    });
    sheet.getCell('A6').alignment = { vertical: 'middle', horizontal: 'left' };

    // Data Rows start at Row 7
    let currentRow = 7;
    data.records.forEach((rec, idx) => {
      const row = sheet.getRow(currentRow);
      row.values = [
        rec.employee,
        rec.workingDays,
        rec.present,
        rec.late,
        rec.leave,
        rec.wfh
      ];
      row.height = 22;

      const isEven = idx % 2 === 1;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNum === 1 ? 'left' : 'center'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: BORDER_COLOR } },
          bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
          left: { style: 'thin', color: { argb: BORDER_COLOR } },
          right: { style: 'thin', color: { argb: BORDER_COLOR } }
        };
        if (isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: ORANGE_LIGHT }
          };
        }
      });
      currentRow++;
    });

    sheet.columns = [
      { key: 'A', width: 28 },
      { key: 'B', width: 16 },
      { key: 'C', width: 14 },
      { key: 'D', width: 14 },
      { key: 'E', width: 14 },
      { key: 'F', width: 14 }
    ];

    // Frozen Table Header at Row 6
    sheet.views = [
      {
        state: 'frozen',
        ySplit: 6,
        topLeftCell: 'A7'
      }
    ];

    return {
      workbook,
      filename: `Attendance_Monthly_${data.monthName}_${data.year}.xlsx`
    };
  }

  throw new Error(`Unsupported report type: ${type}`);
};

module.exports = {
  getDailyAttendanceData,
  getWeeklyAttendanceData,
  getMonthlyAttendanceData,
  generateExcelReport
};
