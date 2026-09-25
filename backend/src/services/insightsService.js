const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Generate Rule-Based AI Workforce Insights
 */
const generateWorkforceInsights = async (organizationId) => {
  if (!organizationId) throw new Error('organizationId is required');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  fifteenDaysAgo.setHours(0, 0, 0, 0);

  // Fetch attendances with user & shift
  const attendances = await prisma.attendance.findMany({
    where: {
      user: { organizationId },
      date: { gte: thirtyDaysAgo }
    },
    include: {
      user: { select: { id: true, name: true, department: true } }
    }
  });

  const shifts = await prisma.shift.findMany({
    where: { organizationId, status: 'ACTIVE' }
  });

  const generatedInsights = [];

  // --- RULE 1: HIGHEST OVERTIME DEPARTMENT ---
  const deptOtMap = {};
  attendances.forEach(a => {
    const dept = a.user.department || 'General';
    if (!deptOtMap[dept]) deptOtMap[dept] = 0;
    if (a.workingHours && a.workingHours > 8) {
      deptOtMap[dept] += Number((a.workingHours - 8).toFixed(1));
    }
  });

  let topOtDept = null;
  let maxOt = 0;
  Object.entries(deptOtMap).forEach(([dept, ot]) => {
    if (ot > maxOt) {
      maxOt = ot;
      topOtDept = dept;
    }
  });

  if (topOtDept && maxOt > 0) {
    generatedInsights.push({
      type: 'OVERTIME_SPIKE',
      category: 'PRODUCTIVITY',
      severity: maxOt > 30 ? 'WARNING' : 'INFO',
      title: 'Top Overtime Department',
      message: `${topOtDept} team has the highest overtime this month with ${maxOt} hours logged.`,
      metadata: { department: topOtDept, overtimeHours: maxOt }
    });
  }

  // --- RULE 2: ATTENDANCE IMPROVEMENT ---
  const deptRecentPresents = {};
  const deptPriorPresents = {};
  attendances.forEach(a => {
    const dept = a.user.department || 'General';
    const isPresent = a.clockIn && a.status !== 'ABSENT';
    const d = new Date(a.date);

    if (d >= fifteenDaysAgo) {
      deptRecentPresents[dept] = (deptRecentPresents[dept] || 0) + (isPresent ? 1 : 0);
    } else {
      deptPriorPresents[dept] = (deptPriorPresents[dept] || 0) + (isPresent ? 1 : 0);
    }
  });

  let bestImprovementDept = null;
  let maxImprovementPct = 0;
  Object.keys(deptRecentPresents).forEach(dept => {
    const prior = deptPriorPresents[dept] || 0;
    const recent = deptRecentPresents[dept] || 0;
    if (prior > 5) {
      const diffPct = Math.round(((recent - prior) / prior) * 100);
      if (diffPct > maxImprovementPct) {
        maxImprovementPct = diffPct;
        bestImprovementDept = dept;
      }
    }
  });

  if (bestImprovementDept && maxImprovementPct >= 10) {
    generatedInsights.push({
      type: 'ATTENDANCE_IMPROVEMENT',
      category: 'ATTENDANCE',
      severity: 'SUCCESS',
      title: 'Attendance Surge Detected',
      message: `${bestImprovementDept} team attendance improved by ${maxImprovementPct}% compared to previous cycle.`,
      metadata: { department: bestImprovementDept, improvementPct: maxImprovementPct }
    });
  } else if (bestImprovementDept) {
    generatedInsights.push({
      type: 'ATTENDANCE_IMPROVEMENT',
      category: 'ATTENDANCE',
      severity: 'SUCCESS',
      title: 'Steady Attendance Momentum',
      message: `${bestImprovementDept} team maintained steady attendance gains over the recent period.`,
      metadata: { department: bestImprovementDept }
    });
  }

  // --- RULE 3: CONSECUTIVE WORKING DAYS ---
  const userDatesMap = {};
  attendances.forEach(a => {
    if (a.clockIn && a.status !== 'ABSENT') {
      if (!userDatesMap[a.userId]) userDatesMap[a.userId] = [];
      userDatesMap[a.userId].push(new Date(a.date).getTime());
    }
  });

  const consecutiveViolators = new Set();
  Object.entries(userDatesMap).forEach(([uid, timestamps]) => {
    const sorted = Array.from(new Set(timestamps)).sort((a, b) => a - b);
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const diffDays = Math.round((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak += 1;
        if (streak >= 6) {
          consecutiveViolators.add(uid);
          break;
        }
      } else {
        streak = 1;
      }
    }
  });

  if (consecutiveViolators.size > 0) {
    generatedInsights.push({
      type: 'CONSECUTIVE_DAYS',
      category: 'COMPLIANCE',
      severity: 'WARNING',
      title: 'Consecutive Days Fatigue Alert',
      message: `${consecutiveViolators.size} employee(s) worked 6 or more consecutive days without rest.`,
      metadata: { count: consecutiveViolators.size, userIds: Array.from(consecutiveViolators) }
    });
  }

  // --- RULE 4: SHIFT PUNCTUALITY LEADER ---
  const shiftPunctualityMap = {};
  attendances.forEach(a => {
    const sName = a.shiftName || 'Company Default';
    if (!shiftPunctualityMap[sName]) shiftPunctualityMap[sName] = { total: 0, onTime: 0 };
    if (a.clockIn && a.status !== 'ABSENT') {
      shiftPunctualityMap[sName].total += 1;
      if (!a.lateMinutes || a.lateMinutes === 0) {
        shiftPunctualityMap[sName].onTime += 1;
      }
    }
  });

  let topPunctualShift = null;
  let bestPunctualRate = 0;
  Object.entries(shiftPunctualityMap).forEach(([sName, data]) => {
    if (data.total >= 5) {
      const rate = Math.round((data.onTime / data.total) * 100);
      if (rate > bestPunctualRate) {
        bestPunctualRate = rate;
        topPunctualShift = sName;
      }
    }
  });

  if (topPunctualShift) {
    generatedInsights.push({
      type: 'SHIFT_PUNCTUALITY',
      category: 'ATTENDANCE',
      severity: 'SUCCESS',
      title: 'Punctuality Excellence',
      message: `${topPunctualShift} has the lowest late arrivals with an outstanding ${bestPunctualRate}% on-time arrival rate.`,
      metadata: { shiftName: topPunctualShift, onTimeRate: bestPunctualRate }
    });
  }

  // Persist to database while preventing duplicates created in the last 24h
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  for (const ins of generatedInsights) {
    const existing = await prisma.workforceInsight.findFirst({
      where: {
        organizationId,
        type: ins.type,
        createdAt: { gte: oneDayAgo },
        isDismissed: false
      }
    });

    if (!existing) {
      await prisma.workforceInsight.create({
        data: {
          organizationId,
          type: ins.type,
          category: ins.category,
          severity: ins.severity,
          title: ins.title,
          message: ins.message,
          metadata: ins.metadata
        }
      });
    }
  }

  // Return all active insights
  return await prisma.workforceInsight.findMany({
    where: {
      organizationId,
      isDismissed: false
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
};

/**
 * Predictive Alerts (Advisory Only)
 */
const getPredictiveAlerts = async (organizationId) => {
  if (!organizationId) throw new Error('organizationId is required');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] }
    },
    select: { id: true, name: true, department: true }
  });

  const attendances = await prisma.attendance.findMany({
    where: {
      user: { organizationId },
      date: { gte: thirtyDaysAgo }
    },
    select: {
      userId: true,
      date: true,
      clockIn: true,
      workingHours: true,
      lateMinutes: true,
      status: true
    }
  });

  const alerts = [];

  // Group by user
  const userAttMap = {};
  attendances.forEach(a => {
    if (!userAttMap[a.userId]) userAttMap[a.userId] = [];
    userAttMap[a.userId].push(a);
  });

  users.forEach(user => {
    const uAtts = userAttMap[user.id] || [];

    // 1. Excessive Overtime Check
    let otHours = 0;
    uAtts.forEach(a => {
      if (a.workingHours && a.workingHours > 8) {
        otHours += Number((a.workingHours - 8).toFixed(1));
      }
    });
    if (otHours > 15) {
      alerts.push({
        id: `ot_${user.id}`,
        userId: user.id,
        userName: user.name,
        department: user.department || 'General',
        type: 'EXCESSIVE_OVERTIME',
        severity: 'HIGH',
        title: 'Excessive Overtime Accumulated',
        description: `${user.name} logged ${otHours.toFixed(1)} overtime hours in the last 30 days.`,
        recommendation: 'Evaluate workload distribution or offer compensatory time off.'
      });
    }

    // 2. Frequent Late Arrivals
    const lateCount = uAtts.filter(a => (a.lateMinutes || 0) > 0).length;
    if (lateCount >= 4) {
      alerts.push({
        id: `late_${user.id}`,
        userId: user.id,
        userName: user.name,
        department: user.department || 'General',
        type: 'FREQUENT_LATE',
        severity: 'MEDIUM',
        title: 'Recurring Late Arrivals',
        description: `${user.name} arrived late ${lateCount} times in the past 30 days.`,
        recommendation: 'Conduct an informal 1-on-1 check-in or review shift schedule compatibility.'
      });
    }

    // 3. Low Attendance Rate
    const presentCount = uAtts.filter(a => a.clockIn && a.status !== 'ABSENT').length;
    const rate = Math.round((presentCount / 22) * 100);
    if (rate < 70 && uAtts.length > 5) {
      alerts.push({
        id: `att_${user.id}`,
        userId: user.id,
        userName: user.name,
        department: user.department || 'General',
        type: 'LOW_ATTENDANCE',
        severity: 'MEDIUM',
        title: 'Low Attendance Rate',
        description: `Current month attendance is ${rate}%, below organizational benchmark.`,
        recommendation: 'Verify if medical leaves or travel requests are pending approval.'
      });
    }

    // 4. Burnout Risk Check (> 50 hrs in past week)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const pastWeekAtts = uAtts.filter(a => new Date(a.date) >= oneWeekAgo);
    const weekHours = pastWeekAtts.reduce((sum, a) => sum + (a.workingHours || 0), 0);
    if (weekHours > 48) {
      alerts.push({
        id: `burnout_${user.id}`,
        userId: user.id,
        userName: user.name,
        department: user.department || 'General',
        type: 'BURNOUT_RISK',
        severity: 'CRITICAL',
        title: 'Elevated Burnout Risk',
        description: `${user.name} recorded ${weekHours.toFixed(1)} hours over the last 7 days.`,
        recommendation: 'Proactively enforce rest periods and prevent back-to-back shift assignments.'
      });
    }
  });

  return alerts;
};

/**
 * Dismiss an insight
 */
const dismissInsight = async (insightId, organizationId) => {
  return await prisma.workforceInsight.updateMany({
    where: { id: insightId, organizationId },
    data: { isDismissed: true }
  });
};

module.exports = {
  generateWorkforceInsights,
  getPredictiveAlerts,
  dismissInsight
};
