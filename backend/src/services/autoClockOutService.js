const cron = require('node-cron');
const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('./notification');
const { getSystemTimeZone, getZonedParts, createZonedDate } = require('../utils/attendanceUtils');
const { broadcastAttendanceEvent } = require('../socket');

const processAutoClockOut = async () => {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'GLOBAL' }
    });

    const isAutoClockOutEnabled = settings?.autoClockOutEnabled !== undefined ? settings.autoClockOutEnabled : true;
    if (!isAutoClockOutEnabled) {
      return;
    }

    const now = new Date();
    const timeZone = getSystemTimeZone(settings);
    const clockOutTimeStr = settings?.clockOutTime || '18:00';
    const [endHour, endMin] = clockOutTimeStr.split(':').map(Number);

    // Find ALL active shifts where clockOut is null and clockIn is not null
    const activeAttendances = await prisma.attendance.findMany({
      where: {
        clockOut: null,
        clockIn: { not: null }
      },
      include: {
        user: { select: { id: true, name: true, employeeId: true, role: true } }
      }
    });

    if (!activeAttendances || activeAttendances.length === 0) {
      return;
    }

    console.log(`[AUTO CLOCK OUT] Cron tick at ${now.toISOString()} (${now.toLocaleString('en-US', { timeZone })}). Checking ${activeAttendances.length} active attendance record(s)...`);

    for (const record of activeAttendances) {
      try {
        const recordDate = record.date || record.clockIn;
        const { year, month, day } = getZonedParts(recordDate, timeZone);
        
        // Effective shiftEndAt is dynamically derived from company clockOutTime for the record's date
        const effectiveEnd = createZonedDate(year, month, day, endHour, endMin, timeZone);

        // Check if current server time has reached or passed the shift end time
        if (now < effectiveEnd) {
          continue;
        }

        console.log(`[AutoClockOutService] Shift expired for ${record.user.name} (${record.id}). ShiftEnd: ${effectiveEnd.toISOString()} <= Now: ${now.toISOString()}. Executing auto clock-out...`);

        const clockInTime = new Date(record.clockIn);
        const diffMs = Math.max(0, effectiveEnd.getTime() - clockInTime.getTime());
        const workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

        let status = record.status;
        if (workingHours < 4 && status !== 'WORK_FROM_HOME') {
          status = 'HALF_DAY';
        }

        const updated = await prisma.attendance.update({
          where: { id: record.id },
          data: {
            clockOut: effectiveEnd,
            shiftEndAt: effectiveEnd,
            workingHours,
            status,
            autoClockOut: true,
            clockOutReason: 'AUTO_SHIFT_END'
          }
        });

        await logActivity({
          userId: record.userId,
          action: 'AUTO_CLOCK_OUT',
          details: `Automatically clocked out at shift end (${effectiveEnd.toLocaleTimeString('en-US', { timeZone })}). Worked: ${workingHours} hrs. Status: ${status}`
        });

        await createNotification({
          userId: record.userId,
          title: 'Shift Ended 🕒',
          message: 'You were automatically clocked out at the scheduled company clock-out time.',
          type: 'ATTENDANCE_AUTO_CLOCK_OUT'
        }).catch(e => console.warn('Failed to send auto clock-out notification:', e));

        broadcastAttendanceEvent('attendance_clock_out', { userId: record.userId, record: updated, autoClockOut: true });

        console.log(`[AutoClockOutService] Successfully auto clocked out ${record.user.name} (${record.userId}).`);
      } catch (itemError) {
        console.error(`[AutoClockOutService] Failed to auto clock out record ${record.id}:`, itemError);
      }
    }
  } catch (error) {
    console.error('[AutoClockOutService] Cron run error:', error);
  }
};

const initAutoClockOutService = () => {
  console.log('[AutoClockOutService] Initializing scheduled auto clock-out job (every minute: * * * * *)...');
  
  // Schedule every minute
  cron.schedule('* * * * *', async () => {
    await processAutoClockOut();
  });

  // Run immediate check on server boot
  processAutoClockOut().catch(err => console.error('[AutoClockOutService] Initial check error:', err));
};

module.exports = {
  initAutoClockOutService,
  processAutoClockOut
};
