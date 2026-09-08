const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { getEffectiveOrgId, assertOrganizationAccess } = require('../utils/organizationScope');

// 1. Get Holidays (Organization Scoped)
const getHolidays = async (req, res) => {
  try {
    const targetOrgId = getEffectiveOrgId(req);
    const where = {};
    if (targetOrgId) {
      where.organizationId = targetOrgId;
    }

    const holidays = await prisma.holidayCalendar.findMany({
      where,
      orderBy: { date: 'asc' }
    });
    res.json(holidays);
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({ message: 'Failed to retrieve holiday calendar.' });
  }
};

// 2. Add Holiday (Admin & Super Admin)
const addHoliday = async (req, res) => {
  try {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Administrators can configure the holiday calendar.' });
    }

    const targetOrgId = getEffectiveOrgId(req);
    if (!targetOrgId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Organization context required.' });
    }

    const { title, date, type, isWorkingHoliday, payMultiplier, remarks } = req.body;

    if (!title || !date) {
      return res.status(400).json({ message: 'Holiday title and date are required.' });
    }

    const holidayDate = new Date(date + 'T00:00:00.000Z');

    let holiday;
    if (targetOrgId) {
      holiday = await prisma.holidayCalendar.upsert({
        where: {
          organizationId_date: {
            organizationId: targetOrgId,
            date: holidayDate
          }
        },
        update: {
          title,
          type: type || 'COMPANY',
          isWorkingHoliday: Boolean(isWorkingHoliday),
          payMultiplier: Number(payMultiplier) || 2.0,
          remarks
        },
        create: {
          organizationId: targetOrgId,
          title,
          date: holidayDate,
          type: type || 'COMPANY',
          isWorkingHoliday: Boolean(isWorkingHoliday),
          payMultiplier: Number(payMultiplier) || 2.0,
          remarks
        }
      });
    } else {
      return res.status(400).json({ message: 'Select an organization to add a holiday.' });
    }

    await logActivity({
      userId: req.user.id,
      organizationId: targetOrgId,
      action: 'HOLIDAY_CALENDAR_ADD',
      details: `Added holiday "${title}" on ${date}`
    });

    res.status(201).json(holiday);
  } catch (error) {
    console.error('Add holiday error:', error);
    res.status(500).json({ message: 'Failed to save holiday calendar entry.' });
  }
};

// 3. Delete Holiday (Admin & Super Admin)
const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Administrators can delete holiday calendar entries.' });
    }

    const holiday = await prisma.holidayCalendar.findUnique({ where: { id } });
    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found.' });
    }

    assertOrganizationAccess(holiday, req);

    await prisma.holidayCalendar.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      organizationId: holiday.organizationId,
      action: 'HOLIDAY_CALENDAR_DELETE',
      details: `Deleted holiday "${holiday.title}"`
    });

    res.json({ message: 'Holiday calendar entry deleted.' });
  } catch (error) {
    if (error.statusCode === 403) return res.status(403).json({ message: error.message });
    console.error('Delete holiday error:', error);
    res.status(500).json({ message: 'Failed to delete holiday entry.' });
  }
};

module.exports = {
  getHolidays,
  addHoliday,
  deleteHoliday
};
