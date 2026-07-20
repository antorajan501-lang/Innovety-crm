const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');

const createTeam = async (req, res) => {
  try {
    const { name, description, leaderId } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Team name is required.' });
    }

    const existingTeam = await prisma.team.findUnique({ where: { name } });
    if (existingTeam) {
      return res.status(400).json({ message: 'Team name already exists.' });
    }

    const newTeam = await prisma.team.create({
      data: {
        name,
        description,
        ...(leaderId && { leaderId })
      },
      include: { leader: true }
    });

    await logActivity({
      userId: req.user.id,
      action: 'TEAM_CREATE',
      details: `Created team: ${newTeam.name}`
    });

    res.status(201).json(newTeam);
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ message: 'Failed to create team.' });
  }
};

const getAllTeams = async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'TEAM_LEADER') {
      where.OR = [
        { leaderId: req.user.id },
        { members: { some: { userId: req.user.id } } }
      ];
    } else if (req.user.role === 'INTERN') {
      where.members = { some: { userId: req.user.id } };
    }

    const teams = await prisma.team.findMany({
      where,
      include: {
        leader: {
          select: { id: true, name: true, email: true, employeeId: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, employeeId: true }
            }
          }
        },
        tasks: {
          select: { status: true }
        }
      }
    });

    // Append counts/stats
    const mappedTeams = teams.map((team) => {
      const activeTasks = team.tasks.filter((t) => ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_REVIEW'].includes(t.status)).length;
      const completedTasks = team.tasks.filter((t) => t.status === 'APPROVED').length;
      
      const totalTasks = team.tasks.length;
      const performance = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        ...team,
        activeTasks,
        completedTasks,
        performance
      };
    });

    res.json(mappedTeams);
  } catch (error) {
    console.error('Get all teams error:', error);
    res.status(500).json({ message: 'Failed to fetch teams.' });
  }
};

const getTeamDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        leader: {
          select: { id: true, name: true, email: true, employeeId: true, profilePic: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, employeeId: true, college: true, status: true, profilePic: true }
            }
          }
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, employeeId: true }
            }
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    // RBAC: Team Leaders and Interns can only view their own team details
    if (req.user.role === 'TEAM_LEADER' || req.user.role === 'INTERN') {
      const isLeader = team.leaderId === req.user.id;
      const isMember = team.members.some((m) => m.userId === req.user.id);
      if (!isLeader && !isMember) {
        return res.status(403).json({ message: 'Access denied: You can only view details for your own team.' });
      }
    }

    const activeTasks = team.tasks.filter((t) => ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_REVIEW'].includes(t.status));
    const completedTasks = team.tasks.filter((t) => t.status === 'APPROVED');
    
    const performance = team.tasks.length > 0 ? Math.round((completedTasks.length / team.tasks.length) * 100) : 0;

    res.json({
      ...team,
      activeTasksCount: activeTasks.length,
      completedTasksCount: completedTasks.length,
      performance,
      activeTasks,
      completedTasks
    });
  } catch (error) {
    console.error('Get team details error:', error);
    res.status(500).json({ message: 'Failed to fetch team details.' });
  }
};

const editTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, leaderId } = req.body;

    const existingName = await prisma.team.findFirst({
      where: {
        name,
        id: { not: id }
      }
    });

    if (existingName) {
      return res.status(400).json({ message: 'Team name is already taken by another team.' });
    }

    const updatedTeam = await prisma.team.update({
      where: { id },
      data: {
        name,
        description,
        leaderId: leaderId || null
      },
      include: { leader: true }
    });

    await logActivity({
      userId: req.user.id,
      action: 'TEAM_EDIT',
      details: `Updated team info for: ${updatedTeam.name}`
    });

    res.json(updatedTeam);
  } catch (error) {
    console.error('Edit team error:', error);
    res.status(500).json({ message: 'Failed to update team.' });
  }
};

const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const team = await prisma.team.findUnique({ where: { id } });

    if (!team) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    await prisma.team.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      action: 'TEAM_DELETE',
      details: `Deleted team: ${team.name}`
    });

    res.json({ message: 'Team deleted successfully.' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ message: 'Failed to delete team.' });
  }
};

const assignMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberIds } = req.body;

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: 'memberIds must be an array.' });
    }

    await prisma.$transaction([
      prisma.teamMember.deleteMany({
        where: {
          teamId: id,
          userId: { notIn: memberIds }
        }
      }),
      ...memberIds.map((userId) =>
        prisma.teamMember.upsert({
          where: {
            teamId_userId: {
              teamId: id,
              userId
            }
          },
          update: {},
          create: { teamId: id, userId }
        })
      )
    ]);

    await logActivity({
      userId: req.user.id,
      action: 'TEAM_MEMBER_ASSIGN',
      details: `Updated team members of team ID: ${id}`
    });

    res.json({ message: 'Team members updated successfully.' });
  } catch (error) {
    console.error('Assign team members error:', error);
    res.status(500).json({ message: 'Failed to assign team members.' });
  }
};

module.exports = {
  createTeam,
  getAllTeams,
  getTeamDetails,
  editTeam,
  deleteTeam,
  assignMembers
};
