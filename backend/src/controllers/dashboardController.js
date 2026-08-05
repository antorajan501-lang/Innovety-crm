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

module.exports = { getTeamPerformance };