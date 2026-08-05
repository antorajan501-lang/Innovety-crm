const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../services/notification');
const { broadcastAttendanceEvent } = require('../socket');
const {
  getSystemTimeZone,
  getTodayZonedDate,
  validateAttendanceWindow
} = require('../utils/attendanceUtils');

// Helper to parse User Agent details
const parseUserAgent = (userAgentString) => {
  if (!userAgentString) return { browser: 'Unknown', device: 'Unknown' };

  let browser = 'Unknown Browser';
  let device = 'Desktop';

  const ua = userAgentString.toLowerCase();

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

  if (ua.includes('mobi') || ua.includes('android') || ua.includes('iphone')) {
    device = 'Mobile';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    device = 'Tablet';
  }

  return { browser, device };
};

const getOrCreateSystemSettings = async () => {
  let settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        id: 'GLOBAL',
        companyName: 'INNOVEITY',
        senderEmail: 'somusuraj72@gmail.com',
        internShiftStart: '09:30',
        internShiftEnd: '18:30',
        tlShiftStart: '09:30',
        tlShiftEnd: '18:30',
        officeLocationName: 'Innoveity Headquarters',
        earlyWindowMinutes: 30,
        gracePeriodMinutes: 15
      }
    });
  }
  return settings;
};

const getClockInStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const settings = await getOrCreateSystemSettings();
    const timeZone = getSystemTimeZone(settings);
    const todayDate = getTodayZonedDate(now, timeZone);

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

    const validation = validateAttendanceWindow({
      userRole: req.user.role,
      settings,
      attendanceRecord: existing,
      approvedLeave,
      now
    });

    res.json({
      ...validation,
      existingRecord: existing || null,
      approvedLeave: approvedLeave || null
    });
  } catch (error) {
    console.error('Get clock-in status error:', error);
    res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Failed to retrieve clock-in status.' });
  }
};

const clockIn = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const settings = await getOrCreateSystemSettings();
    const timeZone = getSystemTimeZone(settings);
    const todayDate = getTodayZonedDate(now, timeZone);

    // Check if user already clocked in today
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: todayDate } }
    });

    if (existing) {
      if (existing.status === 'ABSENT' && existing.clockInLocation?.includes('Declined')) {
        return res.status(400).json({ 
          success: false,
          reason: 'DECLINED_LEAVE_ABSENT',
          message: 'Your leave application letter for today was DECLINED by Admin and your attendance is marked as ABSENT.' 
        });
      }
      return res.status(400).json({
        success: false,
        reason: 'ALREADY_CLOCKED_IN',
        message: 'You have already clocked in today.'
      });
    }

    // Check if user has an APPROVED leave/WFH request for today
    const approvedLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: 'APPROVED',
        startDate: { lte: todayDate },
        endDate: { gte: todayDate }
      }
    });

    const validation = validateAttendanceWindow({
      userRole: req.user.role,
      settings,
      attendanceRecord: existing,
      approvedLeave,
      now
    });

    if (!validation.canClockIn) {
      let msg = `Clock-in is prohibited at this time.`;
      if (validation.reason === 'SHIFT_NOT_STARTED') {
        msg = `Clock-in is available from ${validation.windowOpenFormatted}.`;
      } else if (validation.reason === 'ALREADY_CLOCKED_IN') {
        msg = `You have already clocked in today.`;
      } else if (validation.reason === 'ALREADY_CLOCKED_OUT') {
        msg = `You have already clocked out today.`;
      }

      console.warn(`[ClockIn 400 Rejected] User: ${userId} (${req.user.role}) | Reason: ${validation.reason} | WindowOpen: ${validation.windowOpenFormatted} | CurrentTime: ${validation.currentTimeFormatted}`);

      return res.status(400).json({
        success: false,
        reason: validation.reason || 'CLOCK_IN_PROHIBITED',
        message: msg,
        windowOpenFormatted: validation.windowOpenFormatted,
        shiftStartFormatted: validation.shiftStartFormatted,
        windowCloseFormatted: validation.windowCloseFormatted
      });
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';
    const { browser, device } = parseUserAgent(userAgent);
    const { location } = req.body;

    let finalStatus = 'PRESENT';
    let lateMinutes = validation.lateMinutes;

    if (approvedLeave && approvedLeave.type === 'WFH') {
      finalStatus = 'WORK_FROM_HOME';
      lateMinutes = null;
    } else if (validation.state === 'OPEN_LATE') {
      finalStatus = 'LATE';
    } else {
      finalStatus = 'PRESENT';
      lateMinutes = null;
    }

    const shiftStartStr = (req.user.role === 'TEAM_LEADER' || req.user.role === 'ADMIN')
      ? (settings?.tlShiftStart || '09:30')
      : (settings?.internShiftStart || '09:30');

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        date: todayDate,
        clockIn: now,
        ipAddress,
        browser,
        device,
        status: finalStatus,
        clockInLocation: location || null,
        lateMinutes,
        earlyWindowUsed: settings?.earlyWindowMinutes !== undefined ? settings.earlyWindowMinutes : 30,
        gracePeriodUsed: settings?.gracePeriodMinutes !== undefined ? settings.gracePeriodMinutes : 15,
        shiftStartUsed: shiftStartStr
      }
    });

    await logActivity({
      userId,
      action: 'CLOCK_IN',
      details: `Clocked in today at ${validation.currentTimeFormatted}. Status: ${finalStatus}${lateMinutes ? ` (${lateMinutes} mins late)` : ''}`,
      ipAddress
    });

    if (finalStatus === 'LATE') {
      await createNotification({
        userId,
        title: 'Late Attendance Alert ⚠️',
        message: `You clocked in at ${validation.currentTimeFormatted}, which is ${lateMinutes} minute(s) past the grace period end time (${validation.windowCloseFormatted}). Your attendance for today is marked as LATE.`,
        type: 'ATTENDANCE_LATE'
      });
    }

    // Broadcast real-time Socket.IO event
    broadcastAttendanceEvent('attendance_clock_in', { userId, record: attendance });
    broadcastAttendanceEvent('attendance_updated', { userId, record: attendance });

    res.status(201).json(attendance);
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Clock in failed.' });
  }
};

const clockOut = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
    const timeZone = getSystemTimeZone(settings);
    const todayDate = getTodayZonedDate(now, timeZone);

    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: todayDate } }
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        reason: 'NOT_CLOCKED_IN',
        message: 'You have not clocked in today yet.'
      });
    }

    if (attendance.clockOut) {
      return res.status(400).json({
        success: false,
        reason: 'ALREADY_CLOCKED_OUT',
        message: 'You have already clocked out today.'
      });
    }

    // Calculate working decimal hours
    const diffMs = now.getTime() - new Date(attendance.clockIn).getTime();
    const workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

    let status = attendance.status;
    if (workingHours < 4 && status !== 'WORK_FROM_HOME') {
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

    // Broadcast real-time Socket.IO event
    broadcastAttendanceEvent('attendance_clock_out', { userId, record: updatedAttendance });
    broadcastAttendanceEvent('attendance_updated', { userId, record: updatedAttendance });

    res.json(updatedAttendance);
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Clock out failed.' });
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

    // Broadcast real-time Socket.IO event
    broadcastAttendanceEvent('attendance_updated', { userId: updated.userId, record: updated });

    res.json(updated);
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ message: 'Failed to update attendance record.' });
  }
};

const getAttendanceAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
    const timeZone = getSystemTimeZone(settings);

    const startOfToday = getTodayZonedDate(now, timeZone);
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

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
