const prisma = require('../utils/db');
const { sendAnnouncement } = require('../socket');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../services/notification');

const createAnnouncement = async (req, res) => {
  try {
    const { title, content, targetTeamId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required.' });
    }

    // Role verification
    if (req.user.role === 'TEAM_LEADER') {
      if (!targetTeamId) {
        return res.status(403).json({ message: 'Team leaders can only send team-specific announcements.' });
      }
      // Verify they lead this team
      const team = await prisma.team.findUnique({ where: { id: targetTeamId } });
      if (!team || team.leaderId !== req.user.id) {
        return res.status(403).json({ message: 'You can only post announcements to your own team.' });
      }
    } else if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      return res.status(403).json({ message: 'Interns/Employees cannot post announcements.' });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        creatorId: req.user.id,
        targetTeamId: targetTeamId || null
      },
      include: {
        creator: { select: { id: true, name: true, role: true } }
      }
    });

    // Send real-time announcement signal
    sendAnnouncement(announcement);

    // Persist standard notification rows for targeted users
    let notifyUserIds = [];
    if (targetTeamId) {
      const members = await prisma.teamMember.findMany({ where: { teamId: targetTeamId } });
      notifyUserIds = members.map((m) => m.userId);
    } else {
      // Global announcement - notify all interns & leaders
      const activeUsers = await prisma.user.findMany({
        where: {
          role: { in: ['INTERN', 'TEAM_LEADER', 'EMPLOYEE'] },
          status: 'ACTIVE'
        }
      });
      notifyUserIds = activeUsers.map((u) => u.id);
    }

    // Write notifications in bulk
    for (let uId of notifyUserIds) {
      await createNotification({
        userId: uId,
        title: 'New Announcement Posted',
        message: `Title: "${title}". Check announcements board for details.`,
        type: 'NEW_ANNOUNCEMENT'
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'ANNOUNCEMENT_CREATE',
      details: `Created announcement "${title}". Target: ${targetTeamId ? 'Team ' + targetTeamId : 'Global'}`
    });

    res.status(201).json(announcement);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ message: 'Failed to post announcement.' });
  }
};

const getAnnouncements = async (req, res) => {
  try {
    const where = {};

    // Filter based on user's team membership
    if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      const memberRecord = await prisma.teamMember.findFirst({
        where: { userId: req.user.id }
      });
      const teamId = memberRecord ? memberRecord.teamId : null;

      where.OR = [
        { targetTeamId: null }, // Global
        ...(teamId ? [{ targetTeamId: teamId }] : [])
      ];
    } else if (req.user.role === 'TEAM_LEADER') {
      // Leader sees global, and teams they lead
      const ledTeams = await prisma.team.findMany({ where: { leaderId: req.user.id } });
      const teamIds = ledTeams.map((t) => t.id);

      where.OR = [
        { targetTeamId: null },
        { targetTeamId: { in: teamIds } }
      ];
    }

    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, role: true, profilePic: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(announcements);
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ message: 'Failed to fetch announcements.' });
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements
};
