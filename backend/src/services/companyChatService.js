const prisma = require('../utils/db');

/**
 * Ensures the default Company Chat Room (e.g. "[Company Name] Community") exists
 * for a specific organization and all active users of that organization are added.
 */
const ensureCompanyChatRoom = async (organizationId) => {
  try {
    let targetOrgId = organizationId;
    if (!targetOrgId) {
      const defaultOrg = await prisma.organization.findUnique({ where: { slug: 'innoveity' } });
      targetOrgId = defaultOrg?.id || null;
    }
    if (!targetOrgId) return null;

    const org = await prisma.organization.findUnique({ where: { id: targetOrgId } });
    if (!org) return null;

    const roomName = `${org.name} Community`;

    let companyRoom = await prisma.chatRoom.findFirst({
      where: {
        organizationId: targetOrgId,
        type: 'COMPANY',
        isDefault: true,
        isArchived: false
      }
    });

    const activeUsers = await prisma.user.findMany({
      where: { organizationId: targetOrgId, status: 'ACTIVE' },
      select: { id: true }
    });
    const activeUserIds = activeUsers.map(u => u.id);

    if (!companyRoom) {
      companyRoom = await prisma.chatRoom.create({
        data: {
          name: roomName,
          type: 'COMPANY',
          organizationId: targetOrgId,
          isDefault: true,
          isArchived: false,
          lastActivityAt: new Date(),
          members: {
            create: activeUserIds.map(userId => ({ userId }))
          }
        }
      });
      console.log(`[ChatService] Created Company Group "${roomName}" for Org ${org.companyCode} with ${activeUserIds.length} members.`);
    } else {
      const existingMembers = await prisma.chatRoomMember.findMany({
        where: { roomId: companyRoom.id },
        select: { userId: true }
      });
      const existingUserIds = new Set(existingMembers.map(m => m.userId));

      const missingUserIds = activeUserIds.filter(id => !existingUserIds.has(id));
      if (missingUserIds.length > 0) {
        await prisma.chatRoomMember.createMany({
          data: missingUserIds.map(userId => ({ roomId: companyRoom.id, userId })),
          skipDuplicates: true
        });
      }

      // Automatically remove any members who are no longer active in this organization
      const activeUserIdSet = new Set(activeUserIds);
      const inactiveUserIds = Array.from(existingUserIds).filter(id => !activeUserIdSet.has(id));
      if (inactiveUserIds.length > 0) {
        await prisma.chatRoomMember.deleteMany({
          where: { roomId: companyRoom.id, userId: { in: inactiveUserIds } }
        });
      }
    }

    return companyRoom;
  } catch (error) {
    console.error('[ChatService] Error ensuring company chat room:', error);
  }
};

/**
 * Adds a user to their organization's default Company Chat Room
 */
const addUserToCompanyChat = async (userId, organizationId) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
    const targetOrgId = organizationId || user?.organizationId;
    const companyRoom = await ensureCompanyChatRoom(targetOrgId);
    if (!companyRoom) return;

    await prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId: companyRoom.id, userId } },
      update: {},
      create: { roomId: companyRoom.id, userId }
    });
  } catch (error) {
    console.error(`[ChatService] Failed to add user ${userId} to company chat:`, error);
  }
};

/**
 * Removes a user from their organization's default Company Chat Room (e.g. on deactivation/delete)
 */
const removeUserFromCompanyChat = async (userId, organizationId) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
    const targetOrgId = organizationId || user?.organizationId;
    if (!targetOrgId) return;

    const companyRoom = await prisma.chatRoom.findFirst({
      where: { organizationId: targetOrgId, type: 'COMPANY', isDefault: true, isArchived: false }
    });
    if (!companyRoom) return;

    await prisma.chatRoomMember.deleteMany({
      where: { roomId: companyRoom.id, userId }
    });
  } catch (error) {
    console.error(`[ChatService] Failed to remove user ${userId} from company chat:`, error);
  }
};

module.exports = {
  ensureCompanyChatRoom,
  addUserToCompanyChat,
  removeUserFromCompanyChat
};
