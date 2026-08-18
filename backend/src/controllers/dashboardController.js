const prisma = require('../utils/db');

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
    }
    // ADMIN / SUPER_ADMIN -> fetch all teams

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
          where: { isDeleted: false },
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

      // Combine direct team tasks + tasks from all team projects (deduplicated by task ID)
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

    // Priority Sort:
    // 1. hasWork DESC (Teams with projects/tasks always rank above teams with 0 work)
    // 2. progress DESC
    // 3. completedTasks DESC
    // 4. activeProjects DESC
    // 5. totalTasks DESC
    // 6. pendingTasks ASC
    // 7. reviewTasks ASC
    // 8. teamName ASC (alphabetical fallback)
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

    // Assign 1-indexed rank
    ranked.forEach((team, idx) => {
      team.rank = idx + 1;
    });

    res.json(ranked);
  } catch (error) {
    console.error('Get team performance error:', error);
    res.status(500).json({ message: 'Failed to fetch team performance data.' });
  }
};

/**
 * GET /api/dashboard/overview
 * Returns real CRM metrics calculated directly from database records.
 */
const getDashboardOverview = async (req, res) => {
  try {
    const { getSystemTimeZone, getTodayZonedDate } = require('../utils/attendanceUtils');
    const now = new Date();

    let settings = await prisma.systemSettings.findUnique({ where: { id: 'GLOBAL' } });
    const timeZone = getSystemTimeZone(settings);

    // 1. TOTAL WORKFORCE (Active Employees + Active Interns + Active Team Leaders)
    const totalWorkforce = await prisma.user.count({
      where: {
        role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] },
        status: 'ACTIVE'
      }
    });

    // Month-over-Month workforce change baseline calculation
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthWorkforce = await prisma.user.count({
      where: {
        role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] },
        status: 'ACTIVE',
        createdAt: { lt: startOfCurrentMonth }
      }
    });

    let workforceChangePercent = 0;
    if (previousMonthWorkforce > 0) {
      workforceChangePercent = Math.round(
        ((totalWorkforce - previousMonthWorkforce) / previousMonthWorkforce) * 100
      );
    }
    const workforceChangeText = `${workforceChangePercent >= 0 ? '+' : ''}${workforceChangePercent}% vs last mo`;

    // 2. PRESENT TODAY & LATE BADGE (Using Asia/Kolkata timezone & Attendance rules)
    const startOfToday = getTodayZonedDate(now, timeZone);
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

    const activeUserIds = (await prisma.user.findMany({
      where: {
        role: { in: ['EMPLOYEE', 'INTERN', 'TEAM_LEADER'] },
        status: 'ACTIVE'
      },
      select: { id: true }
    })).map(u => u.id);

    const todayAttendances = await prisma.attendance.findMany({
      where: {
        date: { gte: startOfToday, lte: endOfToday },
        userId: { in: activeUserIds }
      }
    });

    const presentCount = todayAttendances.filter(a => a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME').length;
    const lateCount = todayAttendances.filter(a => a.status === 'LATE').length;
    const halfDayCount = todayAttendances.filter(a => a.status === 'HALF_DAY').length;

    // Total attending = PRESENT + WORK_FROM_HOME + LATE + HALF_DAY
    const totalAttending = presentCount + lateCount + halfDayCount;
    const lateBadgeText = `${lateCount}\u00A0late`;

    // 3. ACTIVE DELIVERABLES (Active Projects) & COMPLETED BADGE (Completed Projects)
    const activeProjectsCount = await prisma.project.count({
      where: {
        isDeleted: false,
        status: 'ACTIVE'
      }
    });

    const completedProjectsCount = await prisma.project.count({
      where: {
        isDeleted: false,
        status: 'COMPLETED'
      }
    });
    const completedBadgeText = `${completedProjectsCount} completed`;

    // 4. OPEN SUPPORT TICKETS & STATUS BADGE
    const openSupportTickets = await prisma.ticket.count({
      where: {
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] }
      }
    });

    const supportBadgeText = openSupportTickets > 0 ? 'Needs attention' : 'All clear';

    // 5. TASK VELOCITY & DELIVERABLES (Only tasks associated with valid projects)
    const projectTasks = await prisma.task.findMany({
      where: {
        projectId: { not: null },
        project: { isDeleted: false }
      },
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

    const taskVelocity = {
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