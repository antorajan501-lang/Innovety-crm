const prisma = require('./db');

/**
 * Resolves the effective runtime settings for a given organization.
 * - Primary Source: `OrganizationSettings` for `organizationId`.
 * - Safe Fallback: `SystemSettings` matching `id: "GLOBAL"`.
 * 
 * @param {string} [organizationId] - Organization ID
 * @returns {Promise<Object>} Normalized settings object
 */
const getEffectiveSettings = async (organizationId) => {
  let globalSettings;
  try {
    globalSettings = await prisma.systemSettings.findUnique({
      where: { id: 'GLOBAL' }
    });
  } catch (e) {
    console.warn('[settingsResolver] Failed to fetch SystemSettings:', e);
  }

  const defaultGlobal = globalSettings || {
    id: 'GLOBAL',
    companyName: 'INNOVEITY',
    senderEmail: 'no-reply@innoveity.com',
    internShiftStart: '09:00',
    internShiftEnd: '18:00',
    tlShiftStart: '09:00',
    tlShiftEnd: '18:00',
    clockInTime: '09:00',
    clockOutTime: '18:00',
    autoClockOutEnabled: true,
    timezone: 'Asia/Kolkata',
    officeLatitude: 12.971598,
    officeLongitude: 77.594562,
    allowedRadiusMeters: 200.0,
    officeLocationName: 'Innoveity Headquarters',
    earlyWindowMinutes: 30,
    gracePeriodMinutes: 15
  };

  if (!organizationId) {
    return defaultGlobal;
  }

  let orgSettings;
  try {
    orgSettings = await prisma.organizationSettings.findUnique({
      where: { organizationId }
    });
  } catch (e) {
    console.warn(`[settingsResolver] Failed to fetch OrganizationSettings for org ${organizationId}:`, e);
  }

  if (!orgSettings) {
    return defaultGlobal;
  }

  return {
    ...defaultGlobal,
    ...orgSettings,
    id: orgSettings.id,
    organizationId: orgSettings.organizationId,
    companyName: orgSettings.companyName || defaultGlobal.companyName,
    logo: orgSettings.logo || null,
    primaryColor: orgSettings.primaryColor || '#10B981',
    timezone: orgSettings.timezone || defaultGlobal.timezone || 'Asia/Kolkata',
    clockInTime: orgSettings.clockInTime || defaultGlobal.clockInTime || '09:00',
    clockOutTime: orgSettings.clockOutTime || defaultGlobal.clockOutTime || '18:00',
    autoClockOutEnabled: orgSettings.autoClockOutEnabled !== false,
    internShiftStart: orgSettings.clockInTime || defaultGlobal.clockInTime || '09:00',
    internShiftEnd: orgSettings.clockOutTime || defaultGlobal.clockOutTime || '18:00',
    tlShiftStart: orgSettings.clockInTime || defaultGlobal.clockInTime || '09:00',
    tlShiftEnd: orgSettings.clockOutTime || defaultGlobal.clockOutTime || '18:00',
    officeLatitude: defaultGlobal.officeLatitude ?? 12.971598,
    officeLongitude: defaultGlobal.officeLongitude ?? 77.594562,
    allowedRadiusMeters: defaultGlobal.allowedRadiusMeters ?? 200.0,
    officeLocationName: defaultGlobal.officeLocationName || 'Innoveity Headquarters',
    earlyWindowMinutes: defaultGlobal.earlyWindowMinutes !== undefined ? defaultGlobal.earlyWindowMinutes : 30,
    gracePeriodMinutes: defaultGlobal.gracePeriodMinutes !== undefined ? defaultGlobal.gracePeriodMinutes : 15
  };
};

module.exports = {
  getEffectiveSettings
};
