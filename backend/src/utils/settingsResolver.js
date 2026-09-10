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
  let globalSettings = null;
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

  let orgSettings = null;
  let sysSettingsForOrg = null;

  try {
    [orgSettings, sysSettingsForOrg] = await Promise.all([
      prisma.organizationSettings.findUnique({ where: { organizationId } }).catch(() => null),
      prisma.systemSettings.findFirst({ where: { organizationId } }).catch(() => null)
    ]);
  } catch (e) {
    console.warn(`[settingsResolver] Failed to fetch settings for org ${organizationId}:`, e);
  }

  if (!orgSettings && !sysSettingsForOrg) {
    return defaultGlobal;
  }

  const effectiveClockIn = orgSettings?.clockInTime || sysSettingsForOrg?.clockInTime || defaultGlobal.clockInTime || '09:00';
  const effectiveClockOut = orgSettings?.clockOutTime || sysSettingsForOrg?.clockOutTime || defaultGlobal.clockOutTime || '18:00';

  const effectiveAutoClockOut = orgSettings?.autoClockOutEnabled !== undefined
    ? orgSettings.autoClockOutEnabled
    : (sysSettingsForOrg?.autoClockOutEnabled !== undefined ? sysSettingsForOrg.autoClockOutEnabled : defaultGlobal.autoClockOutEnabled !== false);

  return {
    ...defaultGlobal,
    ...(sysSettingsForOrg || {}),
    ...(orgSettings || {}),
    id: orgSettings?.id || sysSettingsForOrg?.id || defaultGlobal.id,
    organizationId,
    companyName: orgSettings?.companyName || sysSettingsForOrg?.companyName || defaultGlobal.companyName,
    clockInTime: effectiveClockIn,
    clockOutTime: effectiveClockOut,
    internShiftStart: effectiveClockIn,
    internShiftEnd: effectiveClockOut,
    tlShiftStart: effectiveClockIn,
    tlShiftEnd: effectiveClockOut,
    autoClockOutEnabled: Boolean(effectiveAutoClockOut),
    officeLatitude: sysSettingsForOrg?.officeLatitude ?? defaultGlobal.officeLatitude ?? 12.971598,
    officeLongitude: sysSettingsForOrg?.officeLongitude ?? defaultGlobal.officeLongitude ?? 77.594562,
    allowedRadiusMeters: sysSettingsForOrg?.allowedRadiusMeters ?? defaultGlobal.allowedRadiusMeters ?? 200.0,
    officeLocationName: sysSettingsForOrg?.officeLocationName || defaultGlobal.officeLocationName || 'Innoveity Headquarters',
    earlyWindowMinutes: sysSettingsForOrg?.earlyWindowMinutes ?? defaultGlobal.earlyWindowMinutes ?? 30,
    gracePeriodMinutes: sysSettingsForOrg?.gracePeriodMinutes ?? defaultGlobal.gracePeriodMinutes ?? 15
  };
};

module.exports = {
  getEffectiveSettings
};
