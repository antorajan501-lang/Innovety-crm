const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const shiftService = require('./shiftService');

/**
 * Team Leader Performance & Workforce View (Restricted to TL's team)
 */
const getTeamPerformance = async (teamLeaderId, organizationId) => {
  if (!teamLeaderId || !organizationId) throw new Error('teamLeaderId and organizationId are required');

  // 1. Resolve Teams led by this user
  const teams = await prisma.team.findMany({
    where: {
      organizationId,
      leaderId: teamLeaderId
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, department: true, role: true, status: true }
          }
        }
      }
    }
  });

  const memberMap = new Map();
  teams.forEach(team => {
    team.members.forEach(tm => {
      if (tm.user && tm.user.status === 'ACTIVE') {
        memberMap.set(tm.user.id, tm.user);
      }
    });
  });

  const teamMembers = Array.from(memberMap.values());
  const memberIds = teamMembers.map(m => m.id);

  if (memberIds.length === 0) {
    return {
      teamName: teams[0]?.name || 'My Team',
      totalMembers: 0,
      attendanceRateToday: 0,
      presentCount: 0,
      lateMembers: [],
      missingClockOuts: [],
      upcomingLeaves: [],
      shiftCoverage: []
    };
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
  const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);

  // 2. Attendances Today
  const todayAttendances = await prisma.attendance.findMany({
    where: {
      userId: { in: memberIds },
      date: { gte: todayStart, lte: todayEnd }
    }
  });

  const attUserMap = new Map();
  todayAttendances.forEach(a => attUserMap.set(a.userId, a));

  const presentCount = todayAttendances.filter(a => a.clockIn && a.status !== 'ABSENT').length;
  const attendanceRateToday = Math.round((presentCount / memberIds.length) * 100);

  // 3. Late Employees Today
  const lateMembers = [];
  todayAttendances.forEach(a => {
    if ((a.lateMinutes || 0) > 0) {
      const user = memberMap.get(a.userId);
      lateMembers.push({
        id: a.id,
        userId: a.userId,
        name: user?.name || 'Unknown',
        department: user?.department || 'General',
        lateMinutes: a.lateMinutes,
        clockInTime: a.clockIn ? new Date(a.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
      });
    }
  });

  // 4. Missing Clock-Out (clocked in earlier without clocking out)
  const missingClockOuts = [];
  const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);

  const pastUnclosed = await prisma.attendance.findMany({
    where: {
      userId: { in: memberIds },
      clockIn: { not: null, lte: tenHoursAgo },
      clockOut: null
    },
    include: {
      user: { select: { id: true, name: true, department: true } }
    }
  });

  pastUnclosed.forEach(a => {
    missingClockOuts.push({
      id: a.id,
      userId: a.userId,
      name: a.user.name,
      department: a.user.department || 'General',
      date: a.date.toISOString().split('T')[0],
      clockInTime: new Date(a.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      hoursElapsed: Number(((Date.now() - new Date(a.clockIn).getTime()) / (1000 * 60 * 60)).toFixed(1))
    });
  });

  // 5. Upcoming Leaves
  const upcomingLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: memberIds },
      status: 'APPROVED',
      endDate: { gte: todayStart }
    },
    include: {
      user: { select: { id: true, name: true, department: true } }
    },
    orderBy: { startDate: 'asc' },
    take: 6
  });

  // 6. Shift Coverage Today
  const shiftCoverageMap = {};
  for (const member of teamMembers) {
    let s = null;
    try {
      s = await shiftService.getEmployeeShift(member.id, prisma, today);
    } catch {
      // Fallback
    }

    const sName = s?.name || 'Company Default';
    if (!shiftCoverageMap[sName]) {
      shiftCoverageMap[sName] = {
        shiftName: sName,
        timings: s ? `${s.startTime} - ${s.endTime}` : 'Standard',
        assignedCount: 0,
        presentCount: 0,
        members: []
      };
    }

    const isPresent = attUserMap.has(member.id) && attUserMap.get(member.id).clockIn;
    shiftCoverageMap[sName].assignedCount += 1;
    if (isPresent) shiftCoverageMap[sName].presentCount += 1;
    shiftCoverageMap[sName].members.push({
      id: member.id,
      name: member.name,
      isPresent: Boolean(isPresent)
    });
  }

  return {
    teamName: teams[0]?.name || 'My Team',
    totalMembers: memberIds.length,
    attendanceRateToday,
    presentCount,
    lateMembers,
    missingClockOuts,
    upcomingLeaves: upcomingLeaves.map(l => ({
      id: l.id,
      userId: l.userId,
      name: l.user.name,
      startDate: l.startDate.toISOString().split('T')[0],
      endDate: l.endDate.toISOString().split('T')[0],
      reason: l.reason
    })),
    shiftCoverage: Object.values(shiftCoverageMap)
  };
};

module.exports = {
  getTeamPerformance
};
