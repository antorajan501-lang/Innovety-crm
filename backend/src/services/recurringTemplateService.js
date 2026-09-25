const prisma = require('../utils/db');
const shiftService = require('./shiftService');

const DAY_INDEX = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
};

/**
 * Create a reusable recurring shift template
 */
const createTemplate = async ({
  organizationId,
  name,
  shiftId,
  recurrencePattern,
  config = {}
}) => {
  if (!organizationId || !name || !shiftId || !recurrencePattern) {
    throw new Error('Missing required template fields.');
  }

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, organizationId }
  });
  if (!shift) {
    throw new Error('Shift not found in organization.');
  }

  return await prisma.recurringShiftTemplate.create({
    data: {
      organizationId,
      name: String(name).trim(),
      shiftId,
      recurrencePattern, // WEEKLY, EVERY_WEEKEND, ALTERNATE_SATURDAYS, CUSTOM_ROTATION
      config: config || {}
    },
    include: {
      shift: { select: { id: true, name: true, startTime: true, endTime: true } }
    }
  });
};

/**
 * Get all recurring templates for an organization
 */
const getTemplates = async (organizationId) => {
  return await prisma.recurringShiftTemplate.findMany({
    where: { organizationId, status: 'ACTIVE' },
    include: {
      shift: { select: { id: true, name: true, startTime: true, endTime: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
};

/**
 * Delete a recurring template
 */
const deleteTemplate = async (templateId, organizationId) => {
  return await prisma.recurringShiftTemplate.deleteMany({
    where: { id: templateId, organizationId }
  });
};

/**
 * Apply a recurring template across date range for target users
 */
const applyTemplate = async ({
  templateId,
  userIds = [],
  startDate,
  endDate,
  organizationId,
  actorUserId
}) => {
  if (!templateId || !userIds.length || !startDate || !endDate || !organizationId) {
    throw new Error('Missing parameters to apply recurring template.');
  }

  const template = await prisma.recurringShiftTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: { shift: true }
  });

  if (!template) {
    throw new Error('Recurring template not found.');
  }

  const sDate = new Date(startDate);
  const eDate = new Date(endDate);
  if (sDate > eDate) {
    throw new Error('Start date must be before end date.');
  }

  const pattern = template.recurrencePattern;
  const config = template.config || {};
  const matchedDates = [];

  const cur = new Date(sDate);
  cur.setHours(0, 0, 0, 0);
  const endNormalized = new Date(eDate);
  endNormalized.setHours(23, 59, 59, 999);

  let weekCounter = 0;
  let lastSunday = null;

  while (cur <= endNormalized) {
    const dayOfWeek = cur.getDay(); // 0 = Sunday, 6 = Saturday

    let matches = false;
    if (pattern === 'WEEKLY') {
      const targetDays = config.daysOfWeek || ['MONDAY'];
      const targetIndices = targetDays.map(d => DAY_INDEX[d]).filter(x => x !== undefined);
      if (targetIndices.includes(dayOfWeek)) matches = true;
    } else if (pattern === 'EVERY_WEEKEND') {
      if (dayOfWeek === 0 || dayOfWeek === 6) matches = true; // Saturday & Sunday
    } else if (pattern === 'ALTERNATE_SATURDAYS') {
      if (dayOfWeek === 6) {
        // Compute week number of the month
        const dayOfMonth = cur.getDate();
        const weekNum = Math.ceil(dayOfMonth / 7);
        if (weekNum === 2 || weekNum === 4) matches = true; // 2nd and 4th Saturday
      }
    } else if (pattern === 'CUSTOM_ROTATION') {
      const intervalDays = Number(config.intervalDays) || 3;
      const diffTime = Math.abs(cur - sDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays % intervalDays === 0) matches = true;
    }

    if (matches) {
      matchedDates.push(new Date(cur));
    }

    cur.setDate(cur.getDate() + 1);
  }

  if (matchedDates.length === 0) {
    return { success: true, createdCount: 0, message: 'No matching dates found in the specified range.' };
  }

  let totalCreated = 0;
  const createdSchedules = [];

  for (const uid of userIds) {
    for (const d of matchedDates) {
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      // Check if duplicate or active schedule exists
      const existing = await prisma.shiftSchedule.findFirst({
        where: {
          organizationId,
          userId: uid,
          startDate: { lte: dayEnd },
          endDate: { gte: dayStart },
          status: 'ACTIVE'
        }
      });

      if (!existing) {
        const sched = await prisma.shiftSchedule.create({
          data: {
            organizationId,
            userId: uid,
            shiftId: template.shiftId,
            startDate: dayStart,
            endDate: dayEnd,
            type: 'PLANNED',
            status: 'ACTIVE',
            reason: `Recurring Template: ${template.name}`,
            createdById: actorUserId
          }
        });
        createdSchedules.push(sched);
        totalCreated++;
      }
    }
  }

  // Audit history
  await shiftService.recordShiftHistory({
    shiftId: template.shiftId,
    userId: actorUserId,
    action: 'SHIFT_EDITED',
    details: `Applied recurring template "${template.name}" across ${matchedDates.length} days for ${userIds.length} members (${totalCreated} schedules generated)`
  });

  return {
    success: true,
    createdCount: totalCreated,
    datesCount: matchedDates.length,
    matchedDates: matchedDates.map(d => d.toISOString().split('T')[0])
  };
};

module.exports = {
  createTemplate,
  getTemplates,
  deleteTemplate,
  applyTemplate
};
