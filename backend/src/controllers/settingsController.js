const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { getSystemTimeZone, getTodayZonedDate, getZonedParts, createZonedDate } = require('../utils/attendanceUtils');
const { broadcastAttendanceEvent } = require('../socket');

const getSettings = async (req, res) => {
  try {
    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'GLOBAL' }
    });

    if (!settings) {
      // Self-heal: Create default settings if not exists
      settings = await prisma.systemSettings.create({
        data: {
          id: 'GLOBAL',
          companyName: 'INNOVEITY',
          senderEmail: 'somusuraj72@gmail.com',
          internShiftStart: '09:00',
          internShiftEnd: '18:00',
          tlShiftStart: '09:00',
          tlShiftEnd: '18:00',
          clockInTime: '09:00',
          clockOutTime: '18:00',
          autoClockOutEnabled: true,
          officeLocationName: 'Innoveity Headquarters',
          earlyWindowMinutes: 30,
          gracePeriodMinutes: 15
        }
      });
    }

    res.json({
      ...settings,
      clockInTime: settings.clockInTime || settings.internShiftStart || '09:00',
      clockOutTime: settings.clockOutTime || settings.internShiftEnd || '18:00',
      autoClockOutEnabled: settings.autoClockOutEnabled !== undefined ? settings.autoClockOutEnabled : true
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Failed to retrieve system settings.' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const {
      companyName,
      senderEmail,
      internShiftStart,
      internShiftEnd,
      tlShiftStart,
      tlShiftEnd,
      officeLocationName,
      clockInTime,
      clockOutTime,
      autoClockOutEnabled
    } = req.body;

    const officeLatitude = req.body.officeLatitude !== undefined ? parseFloat(req.body.officeLatitude) : undefined;
    const officeLongitude = req.body.officeLongitude !== undefined ? parseFloat(req.body.officeLongitude) : undefined;
    const allowedRadiusMeters = req.body.allowedRadiusMeters !== undefined ? parseFloat(req.body.allowedRadiusMeters) : undefined;

    const earlyWindowMinutes = req.body.earlyWindowMinutes !== undefined ? parseInt(req.body.earlyWindowMinutes, 10) : undefined;
    const gracePeriodMinutes = req.body.gracePeriodMinutes !== undefined ? parseInt(req.body.gracePeriodMinutes, 10) : undefined;

    // Validate 0-120 minutes range for time window settings
    if (earlyWindowMinutes !== undefined && (isNaN(earlyWindowMinutes) || earlyWindowMinutes < 0 || earlyWindowMinutes > 120)) {
      return res.status(400).json({ message: 'Early Clock-In Window must be between 0 and 120 minutes.' });
    }
    if (gracePeriodMinutes !== undefined && (isNaN(gracePeriodMinutes) || gracePeriodMinutes < 0 || gracePeriodMinutes > 120)) {
      return res.status(400).json({ message: 'Grace Period must be between 0 and 120 minutes.' });
    }

    // Validate geofence location settings
    if (officeLatitude !== undefined && (isNaN(officeLatitude) || officeLatitude < -90 || officeLatitude > 90)) {
      return res.status(400).json({ message: 'Office Latitude must be a valid coordinate between -90 and 90.' });
    }
    if (officeLongitude !== undefined && (isNaN(officeLongitude) || officeLongitude < -180 || officeLongitude > 180)) {
      return res.status(400).json({ message: 'Office Longitude must be a valid coordinate between -180 and 180.' });
    }
    if (allowedRadiusMeters !== undefined && (isNaN(allowedRadiusMeters) || allowedRadiusMeters <= 0)) {
      return res.status(400).json({ message: 'Allowed Radius must be a positive number greater than 0 meters.' });
    }

    // Validate time format & Clock-Out > Clock-In
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const effectiveClockIn = clockInTime || internShiftStart || '09:00';
    const effectiveClockOut = clockOutTime || internShiftEnd || '18:00';

    if (clockInTime !== undefined && !timeRegex.test(clockInTime)) {
      return res.status(400).json({ message: 'Clock In Time must be in valid HH:MM 24-hour format (e.g. 09:00).' });
    }
    if (clockOutTime !== undefined && !timeRegex.test(clockOutTime)) {
      return res.status(400).json({ message: 'Clock Out Time must be in valid HH:MM 24-hour format (e.g. 18:00).' });
    }

    const [inH, inM] = effectiveClockIn.split(':').map(Number);
    const [outH, outM] = effectiveClockOut.split(':').map(Number);
    if (outH * 60 + outM <= inH * 60 + inM) {
      return res.status(400).json({ message: 'Clock-Out Time must be chronologically later than Clock-In Time.' });
    }

    const autoClockOutBool = autoClockOutEnabled !== undefined ? Boolean(autoClockOutEnabled) : undefined;

    const updated = await prisma.systemSettings.upsert({
      where: { id: 'GLOBAL' },
      update: {
        companyName,
        senderEmail,
        internShiftStart: internShiftStart || clockInTime,
        internShiftEnd: internShiftEnd || clockOutTime,
        tlShiftStart: tlShiftStart || clockInTime,
        tlShiftEnd: tlShiftEnd || clockOutTime,
        clockInTime: clockInTime || internShiftStart,
        clockOutTime: clockOutTime || internShiftEnd,
        autoClockOutEnabled: autoClockOutBool,
        officeLatitude,
        officeLongitude,
        allowedRadiusMeters,
        officeLocationName,
        earlyWindowMinutes,
        gracePeriodMinutes
      },
      create: {
        id: 'GLOBAL',
        companyName: companyName || 'INNOVEITY',
        senderEmail: senderEmail || 'somusuraj72@gmail.com',
        internShiftStart: internShiftStart || clockInTime || '09:00',
        internShiftEnd: internShiftEnd || clockOutTime || '18:00',
        tlShiftStart: tlShiftStart || clockInTime || '09:00',
        tlShiftEnd: tlShiftEnd || clockOutTime || '18:00',
        clockInTime: clockInTime || '09:00',
        clockOutTime: clockOutTime || '18:00',
        autoClockOutEnabled: autoClockOutBool !== undefined ? autoClockOutBool : true,
        officeLatitude: officeLatitude || 12.971598,
        officeLongitude: officeLongitude || 77.594562,
        allowedRadiusMeters: allowedRadiusMeters || 200.0,
        officeLocationName: officeLocationName || 'Innoveity Headquarters',
        earlyWindowMinutes: earlyWindowMinutes !== undefined ? earlyWindowMinutes : 30,
        gracePeriodMinutes: gracePeriodMinutes !== undefined ? gracePeriodMinutes : 15
      }
    });

    // Synchronize today's active attendance records with the new shiftEndAt
    const timeZone = getSystemTimeZone(updated);
    const now = new Date();
    const todayDate = getTodayZonedDate(now, timeZone);
    const { year, month, day } = getZonedParts(now, timeZone);
    const newShiftEndAt = createZonedDate(year, month, day, outH, outM, timeZone);

    await prisma.attendance.updateMany({
      where: {
        clockOut: null,
        date: todayDate
      },
      data: {
        shiftEndAt: newShiftEndAt
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'SYSTEM_SETTINGS_UPDATE',
      details: `Updated settings. Clock In: ${updated.clockInTime}, Clock Out: ${updated.clockOutTime}, Auto Clock-Out: ${updated.autoClockOutEnabled ? 'ON' : 'OFF'}`
    });

    broadcastAttendanceEvent('settings_updated', updated);
    broadcastAttendanceEvent('attendance_updated', { shiftEndAt: newShiftEndAt, clockOutTime: updated.clockOutTime });

    res.json(updated);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Failed to update system settings.' });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
