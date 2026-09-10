const prisma = require('../utils/db');

// Helper to parse HH:MM time into minutes from midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
};

/**
 * GET /api/organizations/:id/settings
 * Retrieves organization-specific settings. Auto-creates default settings if missing.
 */
const getOrganizationSettings = async (req, res) => {
  try {
    const { id: organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({ message: 'Organization ID is required.' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!org) {
      return res.status(404).json({ message: 'Organization not found.' });
    }

    let settings = await prisma.organizationSettings.findUnique({
      where: { organizationId }
    });

    if (!settings) {
      settings = await prisma.organizationSettings.create({
        data: {
          organizationId,
          companyName: org.name,
          logo: org.logo || null,
          primaryColor: '#10B981',
          timezone: org.timezone || 'Asia/Kolkata',
          clockInTime: '09:00',
          clockOutTime: '18:00',
          autoClockOutEnabled: true
        }
      });
    }

    return res.json({
      id: settings.id,
      organizationId: settings.organizationId,
      companyName: settings.companyName,
      logo: settings.logo,
      primaryColor: settings.primaryColor,
      timezone: settings.timezone,
      clockInTime: settings.clockInTime,
      clockOutTime: settings.clockOutTime,
      autoClockOutEnabled: settings.autoClockOutEnabled,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    });
  } catch (error) {
    console.error('Error fetching organization settings:', error);
    return res.status(500).json({ message: 'Failed to retrieve organization settings.', error: error.message });
  }
};

/**
 * PUT /api/organizations/:id/settings
 * Updates organization-specific settings. Restricted to SUPER_ADMIN.
 */
const updateOrganizationSettings = async (req, res) => {
  try {
    const { id: organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({ message: 'Organization ID is required.' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId }
    });

    if (!org) {
      return res.status(404).json({ message: 'Organization not found.' });
    }

    const {
      companyName,
      primaryColor,
      timezone,
      clockInTime,
      clockOutTime,
      autoClockOutEnabled
    } = req.body;

    // Time HH:MM validation
    if (clockInTime !== undefined) {
      const inMins = timeToMinutes(clockInTime);
      if (inMins === null) {
        return res.status(400).json({ message: 'Invalid Clock In time format. Must be HH:MM (e.g. 09:00).' });
      }
    }

    if (clockOutTime !== undefined) {
      const outMins = timeToMinutes(clockOutTime);
      if (outMins === null) {
        return res.status(400).json({ message: 'Invalid Clock Out time format. Must be HH:MM (e.g. 18:00).' });
      }
    }

    // Time order validation
    const effectiveClockIn = clockInTime || '09:00';
    const effectiveClockOut = clockOutTime || '18:00';
    const inMins = timeToMinutes(effectiveClockIn);
    const outMins = timeToMinutes(effectiveClockOut);

    if (inMins !== null && outMins !== null && outMins <= inMins) {
      return res.status(400).json({ message: 'Clock-out time must be later than clock-in time.' });
    }

    // Handle uploaded logo file if present
    let logoUrl;
    if (req.file) {
      logoUrl = `/uploads/logos/${req.file.filename}`;
    } else if (req.body.logo !== undefined) {
      logoUrl = req.body.logo;
    }

    const updateData = {};
    if (companyName !== undefined) updateData.companyName = String(companyName).trim();
    if (primaryColor !== undefined) updateData.primaryColor = String(primaryColor).trim();
    if (timezone !== undefined) updateData.timezone = String(timezone).trim();
    if (clockInTime !== undefined) updateData.clockInTime = String(clockInTime).trim();
    if (clockOutTime !== undefined) updateData.clockOutTime = String(clockOutTime).trim();
    if (autoClockOutEnabled !== undefined) {
      updateData.autoClockOutEnabled = autoClockOutEnabled === true || autoClockOutEnabled === 'true';
    }
    if (logoUrl !== undefined) updateData.logo = logoUrl;

    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId },
      update: updateData,
      create: {
        organizationId,
        companyName: companyName ? String(companyName).trim() : org.name,
        logo: logoUrl || org.logo || null,
        primaryColor: primaryColor ? String(primaryColor).trim() : '#10B981',
        timezone: timezone ? String(timezone).trim() : 'Asia/Kolkata',
        clockInTime: clockInTime ? String(clockInTime).trim() : '09:00',
        clockOutTime: clockOutTime ? String(clockOutTime).trim() : '18:00',
        autoClockOutEnabled: autoClockOutEnabled === undefined ? true : (autoClockOutEnabled === true || autoClockOutEnabled === 'true')
      }
    });

    // Also update parent organization company name & logo if changed
    if (companyName || logoUrl) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          ...(companyName ? { name: String(companyName).trim() } : {}),
          ...(logoUrl ? { logo: logoUrl } : {})
        }
      }).catch(() => {});
    }

    // Synchronize SystemSettings for this organization
    const { getSystemTimeZone, getZonedParts, createZonedDate } = require('../utils/attendanceUtils');
    const { broadcastAttendanceEvent } = require('../socket');

    const effectiveIn = settings.clockInTime || '09:00';
    const effectiveOut = settings.clockOutTime || '18:00';

    const existingSysSettings = await prisma.systemSettings.findFirst({ where: { organizationId } }).catch(() => null);
    if (existingSysSettings) {
      await prisma.systemSettings.update({
        where: { id: existingSysSettings.id },
        data: {
          companyName: settings.companyName || org.name,
          clockInTime: effectiveIn,
          clockOutTime: effectiveOut,
          internShiftStart: effectiveIn,
          internShiftEnd: effectiveOut,
          tlShiftStart: effectiveIn,
          tlShiftEnd: effectiveOut,
          autoClockOutEnabled: settings.autoClockOutEnabled !== false
        }
      }).catch(e => console.warn('Sync SystemSettings error:', e));
    }

    // Synchronize active attendance records
    const timeZone = getSystemTimeZone(settings);
    const now = new Date();
    const [outH, outM] = effectiveOut.split(':').map(Number);
    const { year, month, day } = getZonedParts(now, timeZone);
    const newShiftEndAt = createZonedDate(year, month, day, outH, outM, timeZone);

    await prisma.attendance.updateMany({
      where: {
        clockOut: null,
        clockIn: { not: null },
        user: { organizationId }
      },
      data: {
        shiftEndAt: newShiftEndAt
      }
    }).catch(e => console.warn('Sync attendance shiftEndAt error:', e));

    broadcastAttendanceEvent('settings_updated', settings);
    broadcastAttendanceEvent('attendance_updated', { shiftEndAt: newShiftEndAt, clockOutTime: effectiveOut });

    return res.json({
      message: 'Organization settings updated successfully.',
      settings
    });
  } catch (error) {
    console.error('Error updating organization settings:', error);
    return res.status(500).json({ message: 'Failed to update organization settings.', error: error.message });
  }
};

module.exports = {
  getOrganizationSettings,
  updateOrganizationSettings
};
