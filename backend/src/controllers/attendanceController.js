const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../services/notification');

// Helper to parse User Agent details
const parseUserAgent = (userAgentString) => {
  if (!userAgentString) return { browser: 'Unknown', device: 'Unknown' };

  let browser = 'Unknown Browser';
  let device = 'Desktop';

  const ua = userAgentString.toLowerCase();

  // Simple browser detection
  if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('chrome') && !ua.includes('chromium')) {
    browser = 'Chrome';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('edge') || ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('opr') || ua.includes('opera')) {
    browser = 'Opera';
  }

  // Simple device detection
  if (ua.includes('mobi') || ua.includes('android') || ua.includes('iphone')) {
    device = 'Mobile';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    device = 'Tablet';
  }

  return { browser, device };
};

// Helper to format time into 12-hour AM/PM string
const format12Hour = (dateObj) => {
  return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// Helper to compute clock-in window times based on user role and system settings
const calculateClockInWindow = (role, settings, now = new Date()) => {
  const shiftStartStr = (role === 'TEAM_LEADER' || role === 'ADMIN')
    ? (settings?.tlShiftStart || '09:30')
    : (settings?.internShiftStart || '09:30');

  const earlyWindowMins = settings?.earlyWindowMinutes !== undefined ? settings.earlyWindowMinutes : 30;
  const gracePeriodMins = settings?.gracePeriodMinutes !== undefined ? settings.gracePeriodMinutes : 15;

  const [startHour, startMin] = shiftStartStr.split(':').map(Number);

  const shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMin, 0, 0);
  const windowOpen = new Date(shiftStart.getTime() - earlyWindowMins * 60 * 1000);
  const windowClose = new Date(shiftStart.getTime() + gracePeriodMins * 60 * 1000);

  return {
    shiftStartStr,
    earlyWindowMins,
    gracePeriodMins,
    shiftStart,
    windowOpen,
    windowClose,
    windowOpenFormatted: format12Hour(windowOpen),
    shiftStartFormatted: format12Hour(shiftStart),
    windowCloseFormatted: format12Hour(windowClose)
  };
};

const getClockInStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const localDateStr = now.toLocaleDateString('en-CA');
    const todayDate = new Date(localDateStr + 'T00:00:00.000Z');

    let settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
    const windowInfo = calculateClockInWindow(req.user.role, settings, now);

    // Check existing attendance for today
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: todayDate } }
    });

    // Check if user has an APPROVED WFH/Leave
    const approvedLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: todayDate },
        endDate: { gte: todayDate }
      }
    });

    let state = 'BEFORE_WINDOW';
    if (existing) {
      state = 'ALREADY_CLOCKED_IN';
    } else if (approvedLeave && approvedLeave.type === 'WFH') {
      state = 'APPROVED_WFH';
    } else if (now < windowInfo.windowOpen) {
      state = 'BEFORE_WINDOW';
    } else if (now >= windowInfo.windowOpen && now <= windowInfo.windowClose) {
      state = 'OPEN_ON_TIME';
    } else {
      state = 'OPEN_LATE';
    }

    res.json({
      serverTime: now.toISOString(),
      state,
      existingRecord: existing || null,
      approvedLeave: approvedLeave || null,
      windowOpenTime: windowInfo.windowOpen.toISOString(),
      shiftStartTime: windowInfo.shiftStart.toISOString(),
      windowCloseTime: windowInfo.windowClose.toISOString(),
      windowOpenFormatted: windowInfo.windowOpenFormatted,
      shiftStartFormatted: windowInfo.shiftStartFormatted,
      windowCloseFormatted: windowInfo.windowCloseFormatted,
      earlyWindowMins: windowInfo.earlyWindowMins,
      gracePeriodMins: windowInfo.gracePeriodMins
    });
  } catch (error) {
    console.error('Get clock-in status error:', error);
    res.status(500).json({ message: 'Failed to retrieve clock-in status.' });
  }
};

const clockIn = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const localDateStr = now.toLocaleDateString('en-CA');
    const todayDate = new Date(localDateStr + 'T00:00:00.000Z');

    // Check if user already clocked in today
    const existing = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayDate
        }
      }
    });

    if (existing) {
      if (existing.status === 'ABSENT' && existing.clockInLocation?.includes('Declined')) {
        return res.status(400).json({ 
          message: 'Your leave application letter for today was DECLINED by Admin and your attendance is marked as ABSENT.' 
        });
      }
      return res.status(400).json({ message: 'You have already clocked in today.' });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';
    const { browser, device } = parseUserAgent(userAgent);

    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'GLOBAL' }
    });

    // Check if user has an APPROVED leave/WFH request for today
    const approvedLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: todayDate },
        endDate: { gte: todayDate }
      }
    });

    const windowInfo = calculateClockInWindow(req.user.role, settings, now);

    let status = 'PRESENT';
    let lateMinutes = null;

    if (approvedLeave && approvedLeave.type === 'WFH') {
      status = 'WORK_FROM_HOME';
    } else {
      // 1. Before early window -> Blocked
      if (now < windowInfo.windowOpen) {
        return res.status(400).json({
          message: `Clock-in is available from ${windowInfo.windowOpenFormatted}.`
        });
      }

      // 2. Early window + Shift Start + Grace Period -> PRESENT (On Time)
      if (now <= windowInfo.windowClose) {
        status = 'PRESENT';
        lateMinutes = null;
      } else {
        // 3. After Grace Period -> LATE (lateMinutes = Now - Grace End Time)
        status = 'LATE';
        const diffMs = now.getTime() - windowInfo.windowClose.getTime();
        lateMinutes = Math.floor(diffMs / (1000 * 60));
      }
    }

    const { location } = req.body;

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        date: todayDate,
        clockIn: now,
        ipAddress,
        browser,
        device,
        status,
        clockInLocation: location || null,
        lateMinutes,
        earlyWindowUsed: windowInfo.earlyWindowMins,
        gracePeriodUsed: windowInfo.gracePeriodMins,
        shiftStartUsed: windowInfo.shiftStartStr
      }
    });

    await logActivity({
      userId,
      action: 'CLOCK_IN',
      details: `Clocked in today at ${now.toLocaleTimeString()}. Status: ${status}${lateMinutes ? ` (${lateMinutes} mins late)` : ''}`,
      ipAddress
    });

    if (status === 'LATE') {
      await createNotification({
        userId,
        title: 'Late Attendance Alert ⚠️',
        message: `You clocked in at ${now.toLocaleTimeString()}, which is ${lateMinutes} minute(s) past the grace period end time (${windowInfo.windowCloseFormatted}). Your attendance for today is marked as LATE.`,
        type: 'ATTENDANCE_LATE'
      });
    }

    res.status(201).json(attendance);
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ message: 'Clock in failed.' });
  }
};

const clockOut = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const localDateStr = now.toLocaleDateString('en-CA');
    const todayDate = new Date(localDateStr + 'T00:00:00.000Z');

    const attendance = await prisma.attendance.findUnique({
      where: {
        userId_date: {
          userId,
          date: todayDate
        }
      }
    });

    if (!attendance) {
      return res.status(400).json({ message: 'You have not clocked in today yet.' });
    }

    if (attendance.clockOut) {
      return res.status(400).json({ message: 'You have already clocked out today.' });
    }

    // Calculate working decimal hours
    const diffMs = now - new Date(attendance.clockIn);
    const workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // decimal hours rounded to 2 places

    // Under 4 hours is considered Half Day
    let status = attendance.status;
    if (workingHours < 4) {
      status = 'HALF_DAY';
    }

    const { location } = req.body;

    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: now,
        workingHours,
        status,
        clockOutLocation: location || null
      }
    });

    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    await logActivity({
      userId,
      action: 'CLOCK_OUT',
      details: `Clocked out today at ${now.toLocaleTimeString()}. Worked: ${workingHours} hrs. Status: ${status}`,
      ipAddress: ip
    });

    res.json(updatedAttendance);
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ message: 'Clock out failed.' });
  }
};

const getAttendanceLogs = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;
    const where = {};

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      where.userId = req.user.id;
    } else if (req.user.role === 'TEAM_LEADER') {
      if (userId) {
        // Confirm user is in leader's team
        const member = await prisma.teamMember.findFirst({
          where: {
            userId,
            team: { leaderId: req.user.id }
          }
        });
        if (!member) {
          return res.status(403).json({ message: 'Unauthorized to view this user\'s attendance.' });
        }
        where.userId = userId;
      } else {
        // Get all members of leader's team
        const teamMembers = await prisma.teamMember.findMany({
          where: { team: { leaderId: req.user.id } }
        });
        where.userId = { in: teamMembers.map((m) => m.userId) };
      }
    } else if (req.user.role === 'ADMIN' && userId) {
      where.userId = userId;
    }

    const logs = await prisma.attendance.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, employeeId: true, email: true, department: true } }
      },
      orderBy: { date: 'desc' }
    });

    res.json(logs);
  } catch (error) {
    console.error('Get attendance logs error:', error);
    res.status(500).json({ message: 'Failed to retrieve attendance logs.' });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { clockIn, clockOut, status, workingHours } = req.body;

    const record = await prisma.attendance.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!record) {
      return res.status(404).json({ message: 'Attendance record not found.' });
    }

    const data = {
      status,
      editedBy: req.user.id
    };

    if (clockIn) data.clockIn = new Date(clockIn);
    if (clockOut) data.clockOut = new Date(clockOut);
    if (workingHours !== undefined) data.workingHours = parseFloat(workingHours);

    const updated = await prisma.attendance.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, employeeId: true } } }
    });

    await logActivity({
      userId: req.user.id,
      action: 'ATTENDANCE_EDIT',
      details: `Edited attendance for ${updated.user.name} on ${updated.date.toDateString()}`
    });

    res.json(updated);
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ message: 'Failed to update attendance record.' });
  }
};

const getAttendanceAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const totalMembersCount = await prisma.user.count({
      where: { role: { in: ['INTERN', 'EMPLOYEE'] }, status: 'ACTIVE' }
    });
    
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });

    const presentCount = todayAttendances.filter((a) => a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME').length;
    const lateCount = todayAttendances.filter((a) => a.status === 'LATE').length;
    const halfDayCount = todayAttendances.filter((a) => a.status === 'HALF_DAY').length;
    const absentCount = totalMembersCount - todayAttendances.length;

    res.json({
      totalInterns: totalMembersCount,
      totalMembers: totalMembersCount,
      presentToday: presentCount,
      lateToday: lateCount,
      halfDayToday: halfDayCount,
      absentToday: absentCount >= 0 ? absentCount : 0
    });
  } catch (error) {
    console.error('Attendance analytics error:', error);
    res.status(500).json({ message: 'Failed to retrieve attendance analytics.' });
  }
};

module.exports = {
  getClockInStatus,
  clockIn,
  clockOut,
  getAttendanceLogs,
  updateAttendance,
  getAttendanceAnalytics
};
