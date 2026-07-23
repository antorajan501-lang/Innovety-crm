const prisma = require('../utils/db');
const { sendAnnouncement } = require('../socket');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../services/notification');

const createAnnouncement = async (req, res) => {
  try {
    const { title, content, targetType = 'ALL', targetTeamId, targetUserId } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required.' });
    }

    if (!['ALL', 'TEAM', 'INDIVIDUAL'].includes(targetType)) {
      return res.status(400).json({ message: 'Invalid recipient type.' });
    }

    if (targetType === 'TEAM' && !targetTeamId) {
      return res.status(400).json({ message: 'Target team must be selected.' });
    }

    if (targetType === 'INDIVIDUAL' && !targetUserId) {
      return res.status(400).json({ message: 'Target user must be selected.' });
    }

    // Role verification
    if (req.user.role === 'TEAM_LEADER') {
      if (targetType === 'ALL') {
        return res.status(403).json({ message: 'Team leaders cannot send public broadcast announcements.' });
      }
      if (targetType === 'TEAM') {
        // Verify they lead this team
        const team = await prisma.team.findUnique({ where: { id: targetTeamId } });
        if (!team || team.leaderId !== req.user.id) {
          return res.status(403).json({ message: 'You can only post announcements to your own team.' });
        }
      } else if (targetType === 'INDIVIDUAL') {
        // Verify target user is in one of the leader's teams
        const ledTeams = await prisma.team.findMany({
          where: { leaderId: req.user.id },
          select: { id: true }
        });
        const ledTeamIds = ledTeams.map(t => t.id);
        const member = await prisma.teamMember.findFirst({
          where: { userId: targetUserId, teamId: { in: ledTeamIds } }
        });
        if (!member && targetUserId !== req.user.id) {
          return res.status(403).json({ message: 'You can only post targeted announcements to members of your team.' });
        }
      }
    } else if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      return res.status(403).json({ message: 'Interns/Employees cannot post announcements.' });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        creatorId: req.user.id,
        targetType,
        targetTeamId: targetType === 'TEAM' ? targetTeamId : null,
        targetUserId: targetType === 'INDIVIDUAL' ? targetUserId : null
      },
      include: {
        creator: { select: { id: true, name: true, role: true, profilePic: true } },
        targetTeam: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true, employeeId: true, role: true } }
      }
    });

    // Send real-time announcement signal
    sendAnnouncement(announcement);

    // Determine target users to send notifications
    let notifyUserIds = [];
    if (targetType === 'TEAM' && targetTeamId) {
      const members = await prisma.teamMember.findMany({ where: { teamId: targetTeamId } });
      notifyUserIds = members.map((m) => m.userId);
    } else if (targetType === 'INDIVIDUAL' && targetUserId) {
      notifyUserIds = [targetUserId];
    } else {
      // Global broadcast - notify all active users except creator
      const activeUsers = await prisma.user.findMany({
        where: {
          id: { not: req.user.id },
          status: 'ACTIVE'
        }
      });
      notifyUserIds = activeUsers.map((u) => u.id);
    }

    // Filter out duplicate user IDs if any
    notifyUserIds = Array.from(new Set(notifyUserIds));

    // Write notifications in bulk
    for (let uId of notifyUserIds) {
      await createNotification({
        userId: uId,
        title: 'New Announcement Posted',
        message: `Title: "${title}". Check announcements board for details.`,
        type: 'NEW_ANNOUNCEMENT'
      });
    }

    let logTargetDetails = 'Public Broadcast';
    if (targetType === 'TEAM') logTargetDetails = `Team: ${announcement.targetTeam?.name || targetTeamId}`;
    if (targetType === 'INDIVIDUAL') logTargetDetails = `User: ${announcement.targetUser?.name || targetUserId}`;

    await logActivity({
      userId: req.user.id,
      action: 'ANNOUNCEMENT_CREATE',
      details: `Created announcement "${title}". Audience: ${logTargetDetails}`
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

    if (req.user.role === 'ADMIN') {
      // Admin sees all announcements
    } else if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      const memberRecords = await prisma.teamMember.findMany({
        where: { userId: req.user.id },
        select: { teamId: true }
      });
      const teamIds = memberRecords.map(m => m.teamId);

      where.OR = [
        { targetType: 'ALL' },
        { targetUserId: req.user.id },
        { creatorId: req.user.id },
        ...(teamIds.length > 0 ? [{ targetTeamId: { in: teamIds } }] : [])
      ];
      // Never show INDIVIDUAL announcements meant for someone else
      where.NOT = {
        AND: [
          { targetType: 'INDIVIDUAL' },
          { targetUserId: { not: req.user.id } }
        ]
      };
    } else if (req.user.role === 'TEAM_LEADER') {
      const ledTeams = await prisma.team.findMany({ where: { leaderId: req.user.id }, select: { id: true } });
      const ledTeamIds = ledTeams.map((t) => t.id);

      const memberRecords = await prisma.teamMember.findMany({
        where: { userId: req.user.id },
        select: { teamId: true }
      });
      const memberTeamIds = memberRecords.map(m => m.teamId);
      const allTeamIds = Array.from(new Set([...ledTeamIds, ...memberTeamIds]));

      where.OR = [
        { targetType: 'ALL' },
        { targetUserId: req.user.id },
        { creatorId: req.user.id },
        ...(allTeamIds.length > 0 ? [{ targetTeamId: { in: allTeamIds } }] : [])
      ];
      // Never show INDIVIDUAL announcements meant for someone else
      where.NOT = {
        AND: [
          { targetType: 'INDIVIDUAL' },
          { targetUserId: { not: req.user.id } }
        ]
      };
    }

    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, role: true, profilePic: true } },
        targetTeam: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true, employeeId: true, role: true } }
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
