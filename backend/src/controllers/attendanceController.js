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

// Helper to check if shift/attendance day has ended for a given target date
const isShiftEndedForDate = (targetDateObj, now, settings) => {
  const timeZone = getSystemTimeZone(settings);
  const todayZoned = getTodayZonedDate(now, timeZone);

  // If target date is strictly in the past, day has ended
  if (targetDateObj.getTime() < todayZoned.getTime()) {
    return true;
  }
  // If target date is in the future, shift has not ended
  if (targetDateObj.getTime() > todayZoned.getTime()) {
    return false;
  }

  // If target date is today, check if current time is past shift end window (default 18:00 IST)
  const shiftEndHour = settings?.shiftEndHour !== undefined ? settings.shiftEndHour : 18;
  const shiftEndMinute = settings?.shiftEndMinute !== undefined ? settings.shiftEndMinute : 0;

  const currentH = now.getHours();
  const currentM = now.getMinutes();

  if (currentH > shiftEndHour || (currentH === shiftEndHour && currentM >= shiftEndMinute)) {
    return true;
  }

  return false;
};

const getAttendanceLogs = async (req, res) => {
  try {
    const { userId, status, startDate, endDate } = req.query;
    const settings = await getOrCreateSystemSettings();
    const timeZone = getSystemTimeZone(settings);
    const now = new Date();
    const todayZoned = getTodayZonedDate(now, timeZone);

    // 1. Determine Date Range (Clamped to TODAY maximum)
    let minDate = startDate ? new Date(startDate) : todayZoned;
    let maxDate = endDate ? new Date(endDate) : todayZoned;

    if (minDate > maxDate) {
      const temp = minDate;
      minDate = maxDate;
      maxDate = temp;
    }

    // STRICT RULE: Attendance Audit Maximum Date = TODAY
    if (maxDate > todayZoned) {
      maxDate = todayZoned;
    }

    // If requested range is entirely in the future, return empty list immediately
    if (minDate > todayZoned) {
      return res.json([]);
    }

    // Generate array of distinct dates within [minDate, maxDate], excluding future dates
    const dateList = [];
    const curr = new Date(minDate);
    while (curr <= maxDate && curr <= todayZoned) {
      dateList.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    // 2. Determine Active Users Scope (Strictly Attendance-Eligible Roles ONLY)
    let userWhere = {
      status: 'ACTIVE',
      role: { in: ['INTERN', 'EMPLOYEE', 'TEAM_LEADER'] }
    };
    if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      userWhere.id = req.user.id;
    } else if (req.user.role === 'TEAM_LEADER') {
      if (userId && userId !== 'ALL' && userId !== '') {
        userWhere.id = userId;
      } else {
        const teamMembers = await prisma.teamMember.findMany({
          where: { team: { leaderId: req.user.id } }
        });
        const allowedIds = teamMembers.map((m) => m.userId);
        allowedIds.push(req.user.id);
        userWhere.id = { in: allowedIds };
      }
    } else if ((req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') && userId && userId !== 'ALL' && userId !== '') {
      userWhere.id = userId;
    }

    const activeUsers = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        employeeId: true,
        email: true,
        department: true,
        profilePic: true,
        role: true
      },
      orderBy: { name: 'asc' }
    });

    const userIds = activeUsers.map(u => u.id);

    // 3. Fetch Real Attendance & Approved Leaves for the date range & users
    const realAttendances = await prisma.attendance.findMany({
      where: {
        date: { gte: minDate, lte: maxDate },
        userId: { in: userIds }
      },
      include: {
        user: { select: { id: true, name: true, employeeId: true, email: true, department: true, profilePic: true } }
      }
    });

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: maxDate },
        endDate: { gte: minDate },
        userId: { in: userIds }
      }
    });

    // Build lookup maps for fast matching
    const attendanceMap = new Map();
    realAttendances.forEach(att => {
      const dateStr = att.date.toISOString().split('T')[0];
      attendanceMap.set(`${att.userId}_${dateStr}`, att);
    });

    // 4. Merge into View Model
    const mergedLogs = [];

    for (const dObj of dateList) {
      const dateStr = dObj.toISOString().split('T')[0];
      const dayEnded = isShiftEndedForDate(dObj, now, settings);

      for (const u of activeUsers) {
        const key = `${u.id}_${dateStr}`;
        const realAtt = attendanceMap.get(key);

        if (realAtt) {
          mergedLogs.push(realAtt);
          continue;
        }

        // Check if user has an approved leave spanning dObj
        const leave = approvedLeaves.find(l => {
          if (l.userId !== u.id) return false;
          const lStart = new Date(l.startDate).toISOString().split('T')[0];
          const lEnd = new Date(l.endDate).toISOString().split('T')[0];
          return dateStr >= lStart && dateStr <= lEnd;
        });

        if (leave) {
          const leaveTypeName = leave.leaveType || leave.type || 'LEAVE';
          const leaveStatusStr = leaveTypeName.toUpperCase().endsWith('LEAVE') || leaveTypeName.toUpperCase() === 'WFH'
            ? leaveTypeName.toUpperCase()
            : `${leaveTypeName.toUpperCase()} LEAVE`;

          mergedLogs.push({
            id: `leave_${u.id}_${dateStr}`,
            isSynthetic: true,
            userId: u.id,
            date: dObj,
            clockIn: null,
            clockOut: null,
            workingHours: null,
            status: leaveStatusStr,
            leaveType: leaveTypeName,
            user: u
          });
          continue;
        }

        // No attendance & No approved leave
        const targetStatus = dayEnded ? 'ABSENT' : 'PENDING';
        mergedLogs.push({
          id: `pending_${u.id}_${dateStr}`,
          isSynthetic: true,
          userId: u.id,
          date: dObj,
          clockIn: null,
          clockOut: null,
          workingHours: null,
          status: targetStatus,
          user: u
        });
      }
    }

    // 5. Apply Status Filter
    let filtered = mergedLogs;
    if (status && status !== 'ALL' && status !== '') {
      const targetS = status.toUpperCase();
      filtered = mergedLogs.filter(log => {
        if (targetS === 'LEAVE') {
          return log.status === 'LEAVE' || log.status.includes('LEAVE') || log.status === 'SICK' || log.status === 'CASUAL';
        }
        if (targetS === 'ABSENT') {
          return log.status === 'ABSENT';
        }
        if (targetS === 'PENDING') {
          return log.status === 'PENDING';
        }
        return log.status === targetS;
      });
    }

    // 6. Sort View Model: date DESC, clockIn DESC (nulls last), user name ASC
    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;

      const timeA = a.clockIn ? new Date(a.clockIn).getTime() : null;
      const timeB = b.clockIn ? new Date(b.clockIn).getTime() : null;

      if (timeA !== null && timeB !== null) {
        if (timeA !== timeB) return timeB - timeA;
      } else if (timeA !== null && timeB === null) {
        return -1;
      } else if (timeA === null && timeB !== null) {
        return 1;
      }

      return (a.user?.name || '').localeCompare(b.user?.name || '');
    });

    res.json(filtered);
  } catch (error) {
    console.error('Get attendance logs error:', error);
    res.status(500).json({ message: 'Failed to retrieve attendance logs.' });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: bodyUserId, date: bodyDate, clockIn, clockOut, status, workingHours: clientWorkingHours } = req.body;

    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Administrators can edit attendance records.' });
    }

    let record = null;
    let targetUserId = bodyUserId;
    let targetDate = bodyDate ? new Date(bodyDate) : null;

    // Check if real record exists in DB
    if (id && !id.startsWith('pending_') && !id.startsWith('leave_') && !id.startsWith('synthetic_')) {
      record = await prisma.attendance.findUnique({
        where: { id },
        include: { user: true }
      });
    } else if (id && (id.startsWith('pending_') || id.startsWith('leave_'))) {
      const parts = id.split('_');
      if (parts.length >= 3) {
        targetUserId = parts[1];
        targetDate = new Date(`${parts[2]}T00:00:00.000Z`);
      }
    }

    if (!record && (!targetUserId || !targetDate)) {
      return res.status(404).json({ message: 'Attendance record or user/date context not found.' });
    }

    // Rule: Protect Leave Management integration for DB LEAVE records
    if (record && record.status === 'LEAVE' && status && status !== 'LEAVE') {
      return res.status(400).json({ message: 'Approved Leave records are managed via Leave Management. Please resolve leave applications in Leave Management rather than changing Attendance logs directly.' });
    }

    const newStatus = status || (record ? record.status : 'PRESENT');
    const data = {
      status: newStatus,
      editedBy: req.user.id
    };

    if (newStatus === 'LEAVE' || newStatus === 'ABSENT') {
      data.clockIn = null;
      data.clockOut = null;
      data.workingHours = 0;
    } else {
      const newClockIn = clockIn ? new Date(clockIn) : (record ? record.clockIn : null);
      const newClockOut = clockOut ? new Date(clockOut) : (record ? record.clockOut : null);

      if (!newClockIn && newStatus !== 'WORK_FROM_HOME') {
        return res.status(400).json({ message: `Clock In time is required for ${newStatus} status.` });
      }

      if (newClockIn && newClockOut) {
        if (new Date(newClockOut).getTime() < new Date(newClockIn).getTime()) {
          return res.status(400).json({ message: 'Clock Out cannot be earlier than Clock In.' });
        }
        const diffMs = new Date(newClockOut).getTime() - new Date(newClockIn).getTime();
        data.workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      } else if (clientWorkingHours !== undefined && clientWorkingHours !== null) {
        data.workingHours = parseFloat(clientWorkingHours);
      }

      data.clockIn = newClockIn || null;
      data.clockOut = newClockOut || null;

      if (newStatus === 'LATE' && newClockIn) {
        const settings = await getOrCreateSystemSettings();
        const userObj = record ? record.user : await prisma.user.findUnique({ where: { id: targetUserId } });
        const shiftStartStr = (userObj?.role === 'TEAM_LEADER' || userObj?.role === 'ADMIN')
          ? (settings?.tlShiftStart || '09:30')
          : (settings?.internShiftStart || '09:30');
        const [shiftH, shiftM] = shiftStartStr.split(':').map(Number);

        const shiftTimeObj = new Date(newClockIn);
        shiftTimeObj.setHours(shiftH, shiftM, 0, 0);

        const diffMins = Math.floor((newClockIn.getTime() - shiftTimeObj.getTime()) / 60000);
        data.lateMinutes = diffMins > 0 ? diffMins : null;
      } else if (newStatus !== 'LATE') {
        data.lateMinutes = null;
      }
    }

    let updated;
    if (record) {
      updated = await prisma.attendance.update({
        where: { id: record.id },
        data,
        include: { user: { select: { id: true, name: true, employeeId: true } } }
      });
    } else {
      updated = await prisma.attendance.upsert({
        where: { userId_date: { userId: targetUserId, date: targetDate } },
        update: data,
        create: {
          userId: targetUserId,
          date: targetDate,
          ...data
        },
        include: { user: { select: { id: true, name: true, employeeId: true } } }
      });
    }

    const prevClockInStr = record && record.clockIn ? record.clockIn.toISOString() : 'NULL';
    const newClockInStr = updated.clockIn ? updated.clockIn.toISOString() : 'NULL';
    const prevClockOutStr = record && record.clockOut ? record.clockOut.toISOString() : 'NULL';
    const newClockOutStr = updated.clockOut ? updated.clockOut.toISOString() : 'NULL';

    await logActivity({
      userId: req.user.id,
      action: 'ATTENDANCE_EDIT',
      details: `Admin (${req.user.name}) edited attendance for ${updated.user.name} (${updated.user.employeeId}) on ${updated.date.toISOString().split('T')[0]}: Status [${record ? record.status : 'PENDING'} -> ${updated.status}], ClockIn [${prevClockInStr} -> ${newClockInStr}], ClockOut [${prevClockOutStr} -> ${newClockOutStr}]`
    });

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
    const settings = await getOrCreateSystemSettings();
    const timeZone = getSystemTimeZone(settings);

    const startOfToday = getTodayZonedDate(now, timeZone);
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

    const activeUsers = await prisma.user.findMany({
      where: { role: { in: ['INTERN', 'EMPLOYEE', 'TEAM_LEADER'] }, status: 'ACTIVE' },
      select: { id: true }
    });
    const totalMembersCount = activeUsers.length;
    const userIds = activeUsers.map(u => u.id);

    const todayAttendances = await prisma.attendance.findMany({
      where: {
        date: { gte: startOfToday, lte: endOfToday },
        userId: { in: userIds }
      }
    });

    const todayApprovedLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: endOfToday },
        endDate: { gte: startOfToday },
        userId: { in: userIds }
      }
    });

    const dayEnded = isShiftEndedForDate(startOfToday, now, settings);

    const presentCount = todayAttendances.filter((a) => a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME').length;
    const lateCount = todayAttendances.filter((a) => a.status === 'LATE').length;
    const halfDayCount = todayAttendances.filter((a) => a.status === 'HALF_DAY').length;

    let absentCount = 0;
    if (dayEnded) {
      const usersWithActivity = new Set([
        ...todayAttendances.map(a => a.userId),
        ...todayApprovedLeaves.map(l => l.userId)
      ]);
      absentCount = userIds.filter(id => !usersWithActivity.has(id)).length;
    }

    res.json({
      totalInterns: totalMembersCount,
      totalMembers: totalMembersCount,
      presentToday: presentCount,
      lateToday: lateCount,
      halfDayToday: halfDayCount,
      absentToday: absentCount
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
