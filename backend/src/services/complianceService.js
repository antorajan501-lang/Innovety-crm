const prisma = require('../utils/db');

/**
 * Calculates workforce compliance metrics for an organization
 */
const getComplianceMetrics = async ({
  organizationId,
  department = null,
  startDate = null,
  endDate = null
}) => {
  const now = new Date();
  
  // Default to past 30 days
  const eDate = endDate ? new Date(endDate) : new Date(now);
  const sDate = startDate ? new Date(startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const userWhere = { organizationId, status: 'ACTIVE' };
  if (department) userWhere.department = department;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      employeeId: true,
      email: true,
      department: true
    }
  });

  const attendances = await prisma.attendance.findMany({
    where: {
      date: { gte: sDate, lte: eDate },
      user: userWhere
    },
    orderBy: { date: 'asc' }
  });

  // Group by user
  const userLogsMap = new Map();
  attendances.forEach(a => {
    if (!userLogsMap.has(a.userId)) userLogsMap.set(a.userId, []);
    userLogsMap.get(a.userId).push(a);
  });

  const flaggedEmployees = [];
  let totalWeeklyHoursViolations = 0;
  let totalOvertimeHoursViolations = 0;
  let totalConsecutiveDaysViolations = 0;
  let totalRestDayViolations = 0;

  users.forEach(user => {
    const logs = userLogsMap.get(user.id) || [];
    const issues = [];

    // 1. Weekly Hours calculation (past 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(l => new Date(l.date) >= sevenDaysAgo);
    const weeklyHours = recentLogs.reduce((acc, l) => acc + (l.workingHours || 0), 0);
    const weeklyOvertime = recentLogs.reduce((acc, l) => acc + Math.max(0, (l.workingHours || 0) - 8), 0);

    if (weeklyHours > 48) {
      issues.push({
        type: 'WEEKLY_HOURS',
        title: 'Excessive Weekly Hours',
        description: `Logged ${weeklyHours.toFixed(1)}h in last 7 days (Limit: 48h)`,
        severity: 'HIGH'
      });
      totalWeeklyHoursViolations++;
    }

    if (weeklyOvertime > 10) {
      issues.push({
        type: 'OVERTIME_EXCESS',
        title: 'Excessive Overtime',
        description: `Logged ${weeklyOvertime.toFixed(1)}h overtime this week (Limit: 10h)`,
        severity: 'MEDIUM'
      });
      totalOvertimeHoursViolations++;
    }

    // 2. Monthly Hours calculation (past 30 days)
    const monthlyHours = logs.reduce((acc, l) => acc + (l.workingHours || 0), 0);

    // 3. Consecutive Working Days calculation
    // Sort unique dates worked
    const workedDates = Array.from(new Set(logs.map(l => l.date.toISOString().split('T')[0]))).sort();
    let maxConsecutive = 0;
    let currentStreak = 0;
    let lastDate = null;

    workedDates.forEach(dStr => {
      const curD = new Date(dStr);
      if (lastDate) {
        const diffDays = Math.round((curD - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      if (currentStreak > maxConsecutive) maxConsecutive = currentStreak;
      lastDate = curD;
    });

    if (maxConsecutive > 6) {
      issues.push({
        type: 'CONSECUTIVE_DAYS',
        title: 'Consecutive Days Without Rest',
        description: `Worked ${maxConsecutive} consecutive days without a mandatory rest day (Limit: 6 days)`,
        severity: 'HIGH'
      });
      totalConsecutiveDaysViolations++;
    }

    // 4. Rest Day Compliance: check if at least 1 day off in past 7 days
    const daysWorkedInLast7 = recentLogs.length;
    if (daysWorkedInLast7 >= 7) {
      issues.push({
        type: 'REST_DAY_VIOLATION',
        title: 'No Rest Day in 7-Day Window',
        description: `Zero rest days observed in the past 7 days.`,
        severity: 'HIGH'
      });
      totalRestDayViolations++;
    }

    if (issues.length > 0) {
      flaggedEmployees.push({
        userId: user.id,
        name: user.name,
        employeeId: user.employeeId,
        department: user.department || 'General',
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        monthlyHours: Math.round(monthlyHours * 10) / 10,
        maxConsecutiveDays: maxConsecutive,
        issues
      });
    }
  });

  const totalEmployees = users.length;
  const compliantCount = Math.max(0, totalEmployees - flaggedEmployees.length);
  const complianceRate = totalEmployees > 0 ? Math.round((compliantCount / totalEmployees) * 100) : 100;

  return {
    kpis: {
      totalEmployees,
      compliantEmployees: compliantCount,
      flaggedEmployees: flaggedEmployees.length,
      complianceRate,
      weeklyHoursViolations: totalWeeklyHoursViolations,
      overtimeViolations: totalOvertimeHoursViolations,
      consecutiveDaysViolations: totalConsecutiveDaysViolations,
      restDayViolations: totalRestDayViolations
    },
    flaggedEmployees
  };
};

module.exports = {
  getComplianceMetrics
};
