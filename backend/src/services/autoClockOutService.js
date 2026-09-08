const cron = require('node-cron');
const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('./notification');
const { getSystemTimeZone, getZonedParts, createZonedDate } = require('../utils/attendanceUtils');
const { getEffectiveSettings } = require('../utils/settingsResolver');
const { broadcastAttendanceEvent } = require('../socket');

const processAutoClockOut = async () => {
  try {
    const now = new Date();

    // 1. Find ALL active shifts where clockOut is null and clockIn is not null
    const activeAttendances = await prisma.attendance.findMany({
      where: {
        clockOut: null,
        clockIn: { not: null }
      },
      include: {
        user: { select: { id: true, name: true, employeeId: true, role: true, organizationId: true } }
      }
    });

    if (!activeAttendances || activeAttendances.length === 0) {
      return;
    }

    // 2. Group active attendances by organizationId
    const orgGroups = new Map();
    for (const record of activeAttendances) {
      const orgId = record.organizationId || record.user?.organizationId || 'GLOBAL';
      if (!orgGroups.has(orgId)) {
        orgGroups.set(orgId, []);
      }
      orgGroups.get(orgId).push(record);
    }

    console.log(`[AUTO CLOCK OUT] Cron tick at ${now.toISOString()}. Checking ${activeAttendances.length} active attendance record(s) across ${orgGroups.size} organization(s)...`);

    // 3. Process each organization independently using its own settings
    for (const [orgId, records] of orgGroups.entries()) {
      try {
        const settings = await getEffectiveSettings(orgId === 'GLOBAL' ? null : orgId);

        const isAutoClockOutEnabled = settings?.autoClockOutEnabled !== false;
        if (!isAutoClockOutEnabled) {
          continue;
        }

        const timeZone = getSystemTimeZone(settings);
        const clockOutTimeStr = settings?.clockOutTime || '18:00';
        const [endHour, endMin] = clockOutTimeStr.split(':').map(Number);

        for (const record of records) {
          try {
            const recordDate = record.date || record.clockIn;
            const { year, month, day } = getZonedParts(recordDate, timeZone);

            // Effective shiftEndAt is dynamically derived from company's clockOutTime
            const effectiveEnd = createZonedDate(year, month, day, endHour, endMin, timeZone);

            if (now < effectiveEnd) {
              continue;
            }

            console.log(`[AutoClockOutService] Shift expired for ${record.user.name} (${record.id}) [Org: ${orgId}]. ShiftEnd: ${effectiveEnd.toISOString()} <= Now: ${now.toISOString()}. Executing auto clock-out...`);

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

            broadcastAttendanceEvent('attendance_clock_out', {
              userId: record.userId,
              organizationId: orgId !== 'GLOBAL' ? orgId : undefined,
              record: updated,
              autoClockOut: true
            });

            console.log(`[AutoClockOutService] Successfully auto clocked out ${record.user.name} (${record.userId}).`);
          } catch (itemError) {
            console.error(`[AutoClockOutService] Failed to auto clock out record ${record.id}:`, itemError);
          }
        }
      } catch (orgError) {
        console.error(`[AutoClockOutService] Failed to process organization ${orgId}:`, orgError);
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
