const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');

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
          internShiftStart: '09:30',
          internShiftEnd: '18:30',
          tlShiftStart: '09:30',
          tlShiftEnd: '18:30',
          officeLocationName: 'MRF Headquarters',
          earlyWindowMinutes: 30,
          gracePeriodMinutes: 15
        }
      });
    }

    res.json(settings);
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
      officeLocationName
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

    const updated = await prisma.systemSettings.upsert({
      where: { id: 'GLOBAL' },
      update: {
        companyName,
        senderEmail,
        internShiftStart,
        internShiftEnd,
        tlShiftStart,
        tlShiftEnd,
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
        internShiftStart: internShiftStart || '09:30',
        internShiftEnd: internShiftEnd || '18:30',
        tlShiftStart: tlShiftStart || '09:30',
        tlShiftEnd: tlShiftEnd || '18:30',
        officeLatitude: officeLatitude || 12.971598,
        officeLongitude: officeLongitude || 77.594562,
        allowedRadiusMeters: allowedRadiusMeters || 200.0,
        officeLocationName: officeLocationName || 'MRF Headquarters',
        earlyWindowMinutes: earlyWindowMinutes !== undefined ? earlyWindowMinutes : 30,
        gracePeriodMinutes: gracePeriodMinutes !== undefined ? gracePeriodMinutes : 15
      }
    });

    await logActivity({
      userId: req.user.id,
      action: 'SYSTEM_SETTINGS_UPDATE',
      details: `Updated settings. Shift timings: Intern (${internShiftStart}-${internShiftEnd}), Admin (${tlShiftStart}-${tlShiftEnd}), Early Window: ${updated.earlyWindowMinutes}m, Grace Period: ${updated.gracePeriodMinutes}m`
    });

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
