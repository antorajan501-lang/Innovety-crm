const prisma = require('../utils/db');

/**
 * Helper to format Date object or components into YYYY-MM-DD string
 */
const formatDateStr = (year, month, day) => {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

/**
 * Resolves calendar statuses for a given month and year for a specific user.
 * 
 * Resolution Order:
 * 1. Sunday -> HOLIDAY (isSunday = true, fixed & locked)
 * 2. Company Holiday -> HOLIDAY (date override or recurring permanent rule)
 * 3. User Approved Leave -> MY_LEAVE (for non-admin users on working/WFH days)
 * 4. Manual Override -> WFH / WORKING_DAY (specific date admin override)
 * 5. Saturday Default -> WFH
 * 6. Weekday Default -> WORKING_DAY
 */
const resolveMonthlyCalendar = async ({ user, month, year }) => {
  const targetYear = parseInt(year, 10);
  const targetMonth = parseInt(month, 10); // 1-12

  // Determine number of days in the month
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

  const startDateStr = formatDateStr(targetYear, targetMonth, 1);
  const endDateStr = formatDateStr(targetYear, targetMonth, daysInMonth);

  const startRange = new Date(`${startDateStr}T00:00:00.000Z`);
  const endRange = new Date(`${endDateStr}T23:59:59.999Z`);

  // 1. Fetch all specific date overrides for this month
  const dateOverrides = await prisma.workCalendar.findMany({
    where: {
      date: {
        gte: startRange,
        lte: endRange
      }
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  // Map specific date overrides by YYYY-MM-DD
  const specificOverridesMap = new Map();
  dateOverrides.forEach((item) => {
    if (item.date) {
      const dStr = item.date.toISOString().split('T')[0];
      specificOverridesMap.set(dStr, item);
    }
  });

  // 2. Fetch all permanent recurring rules for this month
  const permanentHolidays = await prisma.workCalendar.findMany({
    where: {
      isPermanent: true,
      recurrenceMonth: targetMonth
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true }
      }
    }
  });

  // Map permanent rules by day of month (1-31)
  const permanentRulesMap = new Map();
  permanentHolidays.forEach((item) => {
    if (item.recurrenceDay) {
      permanentRulesMap.set(item.recurrenceDay, item);
    }
  });

  // 3. Fetch user approved leaves if user role has personal leaves (INTERN, EMPLOYEE, TEAM_LEADER)
  const isNonAdminUser = ['INTERN', 'EMPLOYEE', 'TEAM_LEADER'].includes(user.role);
  let approvedLeaves = [];
  
  if (isNonAdminUser && user.id) {
    approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        userId: user.id,
        status: 'APPROVED',
        startDate: { lte: endRange },
        endDate: { gte: startRange }
      }
    });
  }

  const isAdminOrSuperAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

  const resolvedDays = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateStr(targetYear, targetMonth, day);
    const currentDate = new Date(targetYear, targetMonth - 1, day);
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday

    const specificOverride = specificOverridesMap.get(dateStr);
    const permanentRule = permanentRulesMap.get(day);

    let resolvedStatus = 'WORKING_DAY';
    let title = 'Working Day';
    let reason = '';
    let overrideId = null;
    let isPermanent = false;
    let isSunday = false;
    let canEdit = isAdminOrSuperAdmin && dayOfWeek !== 0;
    let createdBy = null;

    // STEP 1: Sunday is fixed HOLIDAY (locked)
    if (dayOfWeek === 0) {
      resolvedStatus = 'SUNDAY';
      title = 'Sunday';
      reason = 'Fixed Weekly Holiday';
      isSunday = true;
      canEdit = false;
    }
    // STEP 2: Company Holiday (Specific date override or Permanent Rule)
    else if (specificOverride && specificOverride.status === 'HOLIDAY') {
      resolvedStatus = 'HOLIDAY';
      title = specificOverride.title || 'Company Holiday';
      reason = specificOverride.reason || 'Company Holiday';
      overrideId = specificOverride.id;
      isPermanent = specificOverride.isPermanent;
      createdBy = specificOverride.createdBy?.name || null;
    } else if (!specificOverride && permanentRule && permanentRule.status === 'HOLIDAY') {
      resolvedStatus = 'HOLIDAY';
      title = permanentRule.title || 'Company Holiday';
      reason = permanentRule.reason || 'Annual Permanent Holiday';
      overrideId = permanentRule.id;
      isPermanent = true;
      createdBy = permanentRule.createdBy?.name || null;
    }
    // STEP 3: User Approved Leave (for non-admin users on non-company-holiday days)
    else if (
      isNonAdminUser &&
      approvedLeaves.some((leave) => {
        const lStart = new Date(leave.startDate).toISOString().split('T')[0];
        const lEnd = new Date(leave.endDate).toISOString().split('T')[0];
        return dateStr >= lStart && dateStr <= lEnd;
      })
    ) {
      const userLeave = approvedLeaves.find((leave) => {
        const lStart = new Date(leave.startDate).toISOString().split('T')[0];
        const lEnd = new Date(leave.endDate).toISOString().split('T')[0];
        return dateStr >= lStart && dateStr <= lEnd;
      });

      resolvedStatus = 'MY_LEAVE';
      title = userLeave.leaveType ? `${userLeave.leaveType.toUpperCase()} LEAVE` : userLeave.subject || 'Approved Leave';
      reason = userLeave.reason || 'User Approved Leave';
      canEdit = false;
    }
    // STEP 4: Manual WFH or Working Day Specific Override
    else if (specificOverride) {
      resolvedStatus = specificOverride.status;
      title = specificOverride.title || (specificOverride.status === 'WFH' ? 'Work From Home' : 'Working Day');
      reason = specificOverride.reason || '';
      overrideId = specificOverride.id;
      isPermanent = specificOverride.isPermanent;
      createdBy = specificOverride.createdBy?.name || null;
    }
    // STEP 5: Saturday Default -> WFH
    else if (dayOfWeek === 6) {
      resolvedStatus = 'WFH';
      title = 'Work From Home';
      reason = 'Saturday Default WFH';
    }
    // STEP 6: Mon-Fri Default -> WORKING_DAY
    else {
      resolvedStatus = 'WORKING_DAY';
      title = 'Working Day';
      reason = 'Standard Working Day';
    }

    resolvedDays.push({
      date: dateStr,
      dayOfWeek,
      status: resolvedStatus,
      title,
      reason,
      overrideId,
      isPermanent,
      isSunday,
      canEdit,
      createdBy: isAdminOrSuperAdmin ? createdBy : undefined
    });
  }

  return resolvedDays;
};

module.exports = {
  resolveMonthlyCalendar,
  formatDateStr
};
