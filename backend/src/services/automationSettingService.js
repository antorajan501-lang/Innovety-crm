const prisma = require('../utils/db');

const DEFAULT_SETTINGS = {
  shiftReminder1h: true,
  tomorrowReminder: true,
  overrideApprovalRequired: false,
  swapApprovalRequired: true,
  weekendApprovalRequired: true,
  holidayApprovalRequired: true,
  lateAlert: true
};

const getAutomationSettings = async (organizationId) => {
  if (!organizationId) throw new Error('organizationId is required.');

  let settings = await prisma.shiftAutomationSetting.findUnique({
    where: { organizationId }
  });

  if (!settings) {
    settings = await prisma.shiftAutomationSetting.create({
      data: {
        organizationId,
        ...DEFAULT_SETTINGS
      }
    });
  }

  return settings;
};

const updateAutomationSettings = async (organizationId, data) => {
  if (!organizationId) throw new Error('organizationId is required.');

  const updatePayload = {};
  const allowedKeys = [
    'shiftReminder1h',
    'tomorrowReminder',
    'overrideApprovalRequired',
    'swapApprovalRequired',
    'weekendApprovalRequired',
    'holidayApprovalRequired',
    'lateAlert'
  ];

  allowedKeys.forEach(k => {
    if (data[k] !== undefined) updatePayload[k] = Boolean(data[k]);
  });

  return await prisma.shiftAutomationSetting.upsert({
    where: { organizationId },
    update: updatePayload,
    create: {
      organizationId,
      ...DEFAULT_SETTINGS,
      ...updatePayload
    }
  });
};

module.exports = {
  getAutomationSettings,
  updateAutomationSettings,
  DEFAULT_SETTINGS
};
