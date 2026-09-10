const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { getEffectiveOrgId } = require('../utils/organizationScope');
const { getSystemTimeZone, getTodayZonedDate, getZonedParts, createZonedDate } = require('../utils/attendanceUtils');
const { broadcastAttendanceEvent } = require('../socket');

const getSettings = async (req, res) => {
  try {
    const targetOrgId = getEffectiveOrgId(req);

    let settings = null;
    if (targetOrgId) {
      settings = await prisma.systemSettings.findFirst({
        where: { organizationId: targetOrgId }
      });
    }

    if (!settings) {
      const org = targetOrgId ? await prisma.organization.findUnique({ where: { id: targetOrgId } }) : null;
      const companyName = org?.name || 'Company Workspace';
      const senderEmail = org?.email || 'no-reply@enterprise-crm.com';
      const officeLocationName = org?.name ? `${org.name} Headquarters` : 'Company Headquarters';

      if (targetOrgId) {
        settings = await prisma.systemSettings.create({
          data: {
            organizationId: targetOrgId,
            companyName,
            senderEmail,
            clockInTime: '09:00',
            clockOutTime: '18:00',
            internShiftStart: '09:00',
            internShiftEnd: '18:00',
            tlShiftStart: '09:00',
            tlShiftEnd: '18:00',
            autoClockOutEnabled: true,
            officeLocationName,
            earlyWindowMinutes: 30,
            gracePeriodMinutes: 15
          }
        });
      } else {
        settings = (await prisma.systemSettings.findFirst()) || (await prisma.systemSettings.create({
          data: { companyName: 'Company Workspace' }
        }));
      }
    }

    res.json({
      ...settings,
      clockInTime: settings.clockInTime || settings.internShiftStart || '09:00',
      clockOutTime: settings.clockOutTime || settings.internShiftEnd || '18:00',
      autoClockOutEnabled: settings.autoClockOutEnabled !== undefined ? settings.autoClockOutEnabled : true
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Failed to retrieve system settings.', reason: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const targetOrgId = getEffectiveOrgId(req);

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

    // Load org name if companyName not explicitly supplied
    let resolvedCompanyName = companyName;
    if (!resolvedCompanyName && targetOrgId) {
      const org = await prisma.organization.findUnique({ where: { id: targetOrgId } });
      resolvedCompanyName = org?.name || 'Company Workspace';
    }

    const dataPayload = {
      companyName: resolvedCompanyName || 'Company Workspace',
      senderEmail: senderEmail || 'no-reply@enterprise-crm.com',
      internShiftStart: internShiftStart || clockInTime || '09:00',
      internShiftEnd: internShiftEnd || clockOutTime || '18:00',
      tlShiftStart: tlShiftStart || clockInTime || '09:00',
      tlShiftEnd: tlShiftEnd || clockOutTime || '18:00',
      clockInTime: clockInTime || internShiftStart || '09:00',
      clockOutTime: clockOutTime || internShiftEnd || '18:00',
      autoClockOutEnabled: autoClockOutBool !== undefined ? autoClockOutBool : true,
      officeLatitude: officeLatitude || 12.971598,
      officeLongitude: officeLongitude || 77.594562,
      allowedRadiusMeters: allowedRadiusMeters || 200.0,
      officeLocationName: officeLocationName || 'Company Headquarters',
      earlyWindowMinutes: earlyWindowMinutes !== undefined ? earlyWindowMinutes : 30,
      gracePeriodMinutes: gracePeriodMinutes !== undefined ? gracePeriodMinutes : 15
    };

    let updated = null;
    if (targetOrgId) {
      const existing = await prisma.systemSettings.findFirst({ where: { organizationId: targetOrgId } });
      if (existing) {
        updated = await prisma.systemSettings.update({
          where: { id: existing.id },
          data: dataPayload
        });
      } else {
        updated = await prisma.systemSettings.create({
          data: {
            organizationId: targetOrgId,
            ...dataPayload
          }
        });
      }

      // Synchronize OrganizationSettings if present for this org
      const existingOrgSet = await prisma.organizationSettings.findUnique({ where: { organizationId: targetOrgId } }).catch(() => null);
      if (existingOrgSet) {
        await prisma.organizationSettings.update({
          where: { organizationId: targetOrgId },
          data: {
            companyName: dataPayload.companyName,
            clockInTime: effectiveClockIn,
            clockOutTime: effectiveClockOut,
            autoClockOutEnabled: autoClockOutBool !== undefined ? autoClockOutBool : true
          }
        }).catch(e => console.warn('Sync OrganizationSettings error:', e));
      }
    } else {
      const existingFirst = await prisma.systemSettings.findFirst();
      if (existingFirst) {
        updated = await prisma.systemSettings.update({
          where: { id: existingFirst.id },
          data: dataPayload
        });
      } else {
        updated = await prisma.systemSettings.create({ data: dataPayload });
      }
    }

    // Synchronize today's active attendance records with the new shiftEndAt
    const timeZone = getSystemTimeZone(updated);
    const now = new Date();
    const { year, month, day } = getZonedParts(now, timeZone);
    const newShiftEndAt = createZonedDate(year, month, day, outH, outM, timeZone);

    await prisma.attendance.updateMany({
      where: {
        clockOut: null,
        clockIn: { not: null },
        ...(targetOrgId ? { user: { organizationId: targetOrgId } } : {})
      },
      data: {
        shiftEndAt: newShiftEndAt
      }
    });

    await logActivity({
      userId: req.user.id,
      organizationId: targetOrgId,
      action: 'ATTENDANCE_SETTINGS_UPDATE',
      details: `Updated attendance settings for organization ${targetOrgId || 'Global'}. Clock In: ${updated.clockInTime}, Clock Out: ${updated.clockOutTime}, Auto Clock-Out: ${updated.autoClockOutEnabled ? 'ON' : 'OFF'}`
    });

    broadcastAttendanceEvent('settings_updated', updated);
    broadcastAttendanceEvent('attendance_updated', { shiftEndAt: newShiftEndAt, clockOutTime: updated.clockOutTime });

    res.json(updated);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Failed to update system settings.', reason: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
