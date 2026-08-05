const prisma = require('../utils/db');

const getTeamPerformance = async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let where = {};
    if (role === 'TEAM_LEADER') {
      where = { OR: [{ leaderId: userId }, { members: { some: { userId } } }] };
    } else if (role === 'INTERN' || role === 'EMPLOYEE') {
      where = { members: { some: { userId } } };
    }
    // ADMIN / SUPER_ADMIN -> no filter
    const teams = await prisma.team.findMany({
      where,
      select: {
        id: true, name: true,
        leader: { select: { id: true, name: true } },
        _count: { select: { members: true } },
        tasks: { select: { status: true } }
      },
      orderBy: { name: 'asc' }
    });
    const ranked = teams.map((team) => {
      const totalTasks      = team.tasks.length;
      const completedTasks  = team.tasks.filter(t => t.status === 'APPROVED').length;
      const pendingTasks    = team.tasks.filter(t => t.status === 'PENDING').length;
      const inProgressTasks = team.tasks.filter(t => t.status === 'IN_PROGRESS').length;
      const reviewTasks     = team.tasks.filter(t => t.status === 'WAITING_FOR_REVIEW').length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        teamId: team.id,
        teamName: team.name,
        leader: team.leader ? team.leader.name : null,
        members: team._count.members,
        totalTasks, completedTasks, pendingTasks, inProgressTasks, reviewTasks,
        progress, rank: 0
      };
    });
    ranked.sort((a, b) => {
      if (b.progress !== a.progress) return b.progress - a.progress;
      if (b.completedTasks !== a.completedTasks) return b.completedTasks - a.completedTasks;
      return a.pendingTasks - b.pendingTasks;
    });
    ranked.forEach((team, idx) => { team.rank = idx + 1; });
    res.json(ranked);
  } catch (error) {
    console.error('Get team performance error:', error);
    res.status(500).json({ message: 'Failed to fetch team performance data.' });
  }
};

module.exports = { getTeamPerformance };