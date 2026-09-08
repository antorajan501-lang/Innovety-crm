const prisma = require('../utils/db');
const { getOrganizationWhere, getProjectWhere, getTaskWhere } = require('../utils/organizationScope');

/**
 * GET /api/dashboard/team-performance
 *
 * Returns ranked team performance metrics calculated from live database data.
 * Aggregates across ALL active projects assigned to each team + direct team tasks.
 */
const getTeamPerformance = async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    let where = {};
    if (role === 'TEAM_LEADER') {
      where = {
        OR: [
          { leaderId: userId },
          { members: { some: { userId } } }
        ]
      };
    } else if (role === 'INTERN' || role === 'EMPLOYEE') {
      where = {
        members: { some: { userId } }
      };
    } else if (role !== 'SUPER_ADMIN') {
      where = {
        OR: [
          { leader: { organizationId: req.user.organizationId } },
          { members: { some: { user: { organizationId: req.user.organizationId } } } }
        ]
      };
    }

    const teams = await prisma.team.findMany({
      where,
      select: {
        id: true,
        name: true,
        leader: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { members: true }
        },
        projects: {
          where: getProjectWhere(req, { isDeleted: false }),
          select: {
            id: true,
            status: true,
            tasks: {
              select: {
                id: true,
                status: true
              }
            }
          }
        },
        tasks: {
          where: getTaskWhere(req),
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const ranked = teams.map((team) => {
      const totalProjects = team.projects.length;
      const activeProjects = team.projects.filter(p => p.status === 'ACTIVE').length;

      const taskMap = new Map();

      (team.tasks || []).forEach(t => {
        taskMap.set(t.id, t);
      });

      (team.projects || []).forEach(p => {
        (p.tasks || []).forEach(t => {
          taskMap.set(t.id, t);
        });
      });

      const allTasks = Array.from(taskMap.values());
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === 'APPROVED' || t.status === 'COMPLETED').length;
      const pendingTasks = allTasks.filter(t => t.status === 'PENDING').length;
      const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
      const reviewTasks = allTasks.filter(t => t.status === 'WAITING_FOR_REVIEW').length;

      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const hasWork = totalProjects > 0 || totalTasks > 0;

      return {
        teamId: team.id,
        teamName: team.name,
        leader: team.leader ? team.leader.name : null,
        members: team._count.members,
        totalProjects,
        activeProjects,
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        reviewTasks,
        progress,
        hasWork,
        rank: 0
      };
    });

    ranked.sort((a, b) => {
      const aWork = a.hasWork ? 1 : 0;
      const bWork = b.hasWork ? 1 : 0;
      if (bWork !== aWork) return bWork - aWork;

      if (b.progress !== a.progress) return b.progress - a.progress;
      if (b.completedTasks !== a.completedTasks) return b.completedTasks - a.completedTasks;
      if (b.activeProjects !== a.activeProjects) return b.activeProjects - a.activeProjects;
      if (b.totalTasks !== a.totalTasks) return b.totalTasks - a.totalTasks;
      if (a.pendingTasks !== b.pendingTasks) return a.pendingTasks - b.pendingTasks;
      if (a.reviewTasks !== b.reviewTasks) return a.reviewTasks - b.reviewTasks;

      return a.teamName.localeCompare(b.teamName);
    });

    ranked.forEach((team, idx) => {
      team.rank = idx + 1;
    });

    res.json(ranked);
  } catch (error) {
    console.error('Get team performance error:', error);
    res.status(500).json({ message: 'Failed to fetch team performance data.', error: error.message });
  }
};

/**
 * GET /api/dashboard/overview
 * Returns real CRM metrics calculated directly from database records.
 * Each metric calculation is isolated so a failure in one does not break the entire response.
 */
const getDashboardOverview = async (req, res) => {
  try {
    const { getSystemTimeZone, getTodayZonedDate } = require('../utils/attendanceUtils');
    const now = new Date();

    let settings = null;
    try {
      settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
    } catch (e) {
      console.error('[Dashboard Overview] Failed to fetch settings:', e.message);
    }
    const timeZone = getSystemTimeZone(settings);

    // 1. TOTAL WORKFORCE
    let totalWorkforce = 0;
    let workforceChangeText = '+0% vs last mo';
    try {
      totalWorkforce = await prisma.user.count({
        where: getOrganizationWhere(req, {
          role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] },
          status: 'ACTIVE'
        })
      });

      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonthWorkforce = await prisma.user.count({
        where: getOrganizationWhere(req, {
          role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] },
          status: 'ACTIVE',
          createdAt: { lt: startOfCurrentMonth }
        })
      });

      let workforceChangePercent = 0;
      if (previousMonthWorkforce > 0) {
        workforceChangePercent = Math.round(
          ((totalWorkforce - previousMonthWorkforce) / previousMonthWorkforce) * 100
        );
      }
      workforceChangeText = `${workforceChangePercent >= 0 ? '+' : ''}${workforceChangePercent}% vs last mo`;
    } catch (e) {
      console.error('[Dashboard Overview] Failed to compute workforce:', e.message);
    }

    // 2. PRESENT TODAY & LATE BADGE
    let totalAttending = 0;
    let lateCount = 0;
    let lateBadgeText = '0 late';
    try {
      const startOfToday = getTodayZonedDate(now, timeZone);
      const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

      const activeUserIds = (await prisma.user.findMany({
        where: getOrganizationWhere(req, {
          role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] },
          status: 'ACTIVE'
        }),
        select: { id: true }
      })).map(u => u.id);

      if (activeUserIds.length > 0) {
        const todayAttendances = await prisma.attendance.findMany({
          where: {
            date: { gte: startOfToday, lte: endOfToday },
            userId: { in: activeUserIds }
          }
        });

        const presentCount = todayAttendances.filter(a => a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME').length;
        lateCount = todayAttendances.filter(a => a.status === 'LATE').length;
        const halfDayCount = todayAttendances.filter(a => a.status === 'HALF_DAY').length;

        totalAttending = presentCount + lateCount + halfDayCount;
        lateBadgeText = `${lateCount}\u00A0late`;
      }
    } catch (e) {
      console.error('[Dashboard Overview] Failed to compute attendance:', e.message);
    }

    // 3. ACTIVE DELIVERABLES & COMPLETED BADGE
    let activeProjectsCount = 0;
    let completedProjectsCount = 0;
    let completedBadgeText = '0 completed';
    try {
      activeProjectsCount = await prisma.project.count({
        where: getProjectWhere(req, {
          isDeleted: false,
          status: 'ACTIVE'
        })
      });

      completedProjectsCount = await prisma.project.count({
        where: getProjectWhere(req, {
          isDeleted: false,
          status: 'COMPLETED'
        })
      });
      completedBadgeText = `${completedProjectsCount} completed`;
    } catch (e) {
      console.error('[Dashboard Overview] Failed to compute deliverables:', e.message);
    }

    // 4. OPEN SUPPORT TICKETS
    let openSupportTickets = 0;
    let supportBadgeText = 'All clear';
    try {
      openSupportTickets = await prisma.ticket.count({
        where: getOrganizationWhere(req, {
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] }
        })
      });
      supportBadgeText = openSupportTickets > 0 ? 'Needs attention' : 'All clear';
    } catch (e) {
      console.error('[Dashboard Overview] Failed to compute tickets:', e.message);
    }

    // 5. TASK VELOCITY
    let taskVelocity = {
      total: 0,
      completed: 0,
      completionPercentage: 0,
      completedBadgeText: '0 completed (0%)',
      statusCounts: { pending: 0, inProgress: 0, review: 0, approved: 0, rejected: 0 }
    };
    try {
      const projectTasks = await prisma.task.findMany({
        where: getTaskWhere(req, {
          projectId: { not: null },
          project: { isDeleted: false }
        }),
        select: {
          id: true,
          status: true
        }
      });

      const totalProjectTasks = projectTasks.length;
      const pendingTasksCount = projectTasks.filter(t => t.status === 'PENDING').length;
      const inProgressTasksCount = projectTasks.filter(t => t.status === 'IN_PROGRESS').length;
      const reviewTasksCount = projectTasks.filter(t => t.status === 'WAITING_FOR_REVIEW').length;
      const approvedTasksCount = projectTasks.filter(t => t.status === 'APPROVED' || t.status === 'COMPLETED').length;
      const rejectedTasksCount = projectTasks.filter(t => t.status === 'REJECTED').length;

      const taskCompletionPercent = totalProjectTasks > 0 ? Math.round((approvedTasksCount / totalProjectTasks) * 100) : 0;
      const taskCompletedBadgeText = `${approvedTasksCount} completed (${taskCompletionPercent}%)`;

      taskVelocity = {
        total: totalProjectTasks,
        completed: approvedTasksCount,
        completionPercentage: taskCompletionPercent,
        completedBadgeText: taskCompletedBadgeText,
        statusCounts: {
          pending: pendingTasksCount,
          inProgress: inProgressTasksCount,
          review: reviewTasksCount,
          approved: approvedTasksCount,
          rejected: rejectedTasksCount
        }
      };
    } catch (e) {
      console.error('[Dashboard Overview] Failed to compute task velocity:', e.message);
    }

    return res.json({
      success: true,
      stats: {
        totalWorkforce,
        workforceChangeText,
        presentToday: totalAttending,
        lateToday: lateCount,
        lateBadgeText,
        activeDeliverables: activeProjectsCount,
        completedBadgeText,
        completedDeliverables: completedProjectsCount,
        openSupportTickets,
        supportBadgeText,
        taskVelocity
      }
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard overview data.',
      error: error.message
    });
  }
};

module.exports = {
  getTeamPerformance,
  getDashboardOverview
};