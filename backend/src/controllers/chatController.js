const prisma = require('../utils/db');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../services/notification');
const { ensureCompanyChatRoom } = require('../services/companyChatService');
const path = require('path');
const fs = require('fs');

// Ensure uploads/chat directory exists
const chatUploadDir = path.join(__dirname, '../../uploads/chat');
if (!fs.existsSync(chatUploadDir)) {
  fs.mkdirSync(chatUploadDir, { recursive: true });
}

// 1. Get unified WhatsApp-style chat list for current user (Company Room ALWAYS #1, followed by Teams & Users)
const getRooms = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // A. Ensure default Company Chat Room exists and user is a member
    const companyRoomRecord = await ensureCompanyChatRoom();
    if (companyRoomRecord) {
      await prisma.chatRoomMember.upsert({
        where: { roomId_userId: { roomId: companyRoomRecord.id, userId } },
        update: {},
        create: { roomId: companyRoomRecord.id, userId }
      }).catch(() => { });
    }

    // B. Fetch DB ChatRooms where user is a member (including archived project rooms for history browsing)
    const roomsList = await prisma.chatRoom.findMany({
      where: {
        type: { not: 'TEAM' },
        members: { some: { userId } },
        OR: [
          { isArchived: false, status: 'ACTIVE' },
          { type: 'PROJECT' }
        ]
      },
      include: {
        team: {
          include: {
            leader: { select: { id: true, name: true, email: true, role: true, profilePic: true } }
          }
        },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            deadline: true,
            createdAt: true,
            attachments: true
          }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true, profilePic: true, employeeId: true }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: {
            sender: { select: { id: true, name: true } }
          }
        }
      }
    });

    const formattedRooms = [];
    const existingDirectUserIds = new Set();

    for (const room of roomsList) {
      const userMemberRecord = room.members.find(m => m.userId === userId);
      const lastReadAt = userMemberRecord ? userMemberRecord.lastReadAt : new Date(0);

      const unreadCount = await prisma.chatMessage.count({
        where: {
          roomId: room.id,
          senderId: { not: userId },
          createdAt: { gt: lastReadAt },
          isDeleted: false
        }
      });

      let lastMsg = room.messages.find(m => {
        if (m.deletedForUsers) {
          const uIds = m.deletedForUsers.split(',').map(id => id.trim());
          if (uIds.includes(userId)) return false;
        }
        return true;
      }) || null;

      let lastMessageSnippet = null;
      if (lastMsg) {
        if (lastMsg.isDeleted) {
          lastMessageSnippet = 'This message was deleted';
        } else if (lastMsg.messageType === 'FILE' || lastMsg.messageType === 'IMAGE') {
          lastMessageSnippet = `📁 ${lastMsg.fileName || 'Attachment'}`;
        } else {
          lastMessageSnippet = lastMsg.message;
        }
      }

      let displayName = room.name;
      let displayPic = null;
      let otherUser = null;

      if (room.type === 'DIRECT') {
        const otherMember = room.members.find(mem => mem.userId !== userId);
        if (otherMember && otherMember.user) {
          otherUser = otherMember.user;
          displayName = otherUser.name;
          displayPic = otherUser.profilePic;
          existingDirectUserIds.add(otherUser.id);
        }
      } else if (room.type === 'COMPANY') {
        displayName = room.name || 'Innoviety Community';
      } else if (room.type === 'PROJECT') {
        displayName = room.name || room.task?.title || 'Project Chat';
      }

      const isRoomArchived = room.isArchived || room.status === 'ARCHIVED';

      formattedRooms.push({
        id: room.id,
        name: displayName,
        type: room.type,
        teamId: room.teamId,
        taskId: room.taskId,
        projectId: room.projectId,
        team: room.team,
        task: room.task,
        isDefault: room.isDefault || false,
        isArchived: isRoomArchived,
        status: room.status || (isRoomArchived ? 'ARCHIVED' : 'ACTIVE'),
        displayPic,
        otherUser,
        members: room.members.map(mem => mem.user),
        unreadCount,
        lastActivityAt: room.lastActivityAt || room.createdAt,
        lastMessage: lastMsg ? {
          id: lastMsg.id,
          senderName: lastMsg.sender?.name || 'Unknown',
          senderId: lastMsg.senderId,
          text: lastMessageSnippet,
          createdAt: lastMsg.createdAt
        } : null,
        isVirtual: false
      });
    }

    // User Synchronization: Fetch all active CRM users not in existingDirectUserIds
    const allUsers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        id: { not: userId }
      },
      select: { id: true, name: true, email: true, role: true, profilePic: true, employeeId: true, createdAt: true }
    });

    for (const u of allUsers) {
      if (!existingDirectUserIds.has(u.id)) {
        formattedRooms.push({
          id: `virtual_${u.id}`,
          targetUserId: u.id,
          name: u.name,
          type: 'DIRECT',
          displayPic: u.profilePic,
          otherUser: u,
          members: [req.user, u],
          unreadCount: 0,
          lastActivityAt: u.createdAt || new Date(0),
          lastMessage: null,
          isVirtual: true
        });
      }
    }

    // Strict Ordering per Requirement 9:
    // Section 1: Company Group (💬 Innoviety Community) -> ALWAYS #1 (index 0)
    // Section 2: Active Project Groups (PROJECT/TEAM) -> ordered by lastActivityAt desc
    // Section 3: Direct Messages (DIRECT) -> ordered by lastActivityAt desc
    const companyRoom = formattedRooms.find(r => r.type === 'COMPANY');
    const projectRooms = formattedRooms.filter(r => r.type === 'PROJECT' || r.type === 'TEAM');
    const directRooms = formattedRooms.filter(r => r.type === 'DIRECT');

    projectRooms.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
    directRooms.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));

    const finalResult = [];
    if (companyRoom) finalResult.push(companyRoom);
    finalResult.push(...projectRooms);
    finalResult.push(...directRooms);

    res.json(finalResult);
  } catch (error) {
    console.error('Get chat rooms error:', error);
    res.status(500).json({ message: 'Failed to retrieve chat rooms.' });
  }
};

// 2. Transparent getOrCreateConversation / createDirectRoom
const createDirectRoom = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID is required.' });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: 'Cannot create direct room with yourself.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true, profilePic: true, employeeId: true }
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const existingRooms = await prisma.chatRoom.findMany({
      where: {
        type: 'DIRECT',
        isArchived: false,
        members: {
          every: {
            userId: { in: [currentUserId, targetUserId] }
          }
        }
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, profilePic: true, employeeId: true } }
          }
        }
      }
    });

    let room = existingRooms.find(r => r.members.length === 2);

    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          type: 'DIRECT',
          name: `${req.user.name} & ${targetUser.name}`,
          lastActivityAt: new Date(),
          members: {
            create: [
              { userId: currentUserId },
              { userId: targetUserId }
            ]
          }
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true, profilePic: true, employeeId: true } }
            }
          }
        }
      });

      await logActivity({
        userId: currentUserId,
        action: 'CHAT_ROOM_CREATE',
        details: `Started direct conversation with ${targetUser.name}`
      });
    }

    res.json({
      id: room.id,
      name: targetUser.name,
      type: 'DIRECT',
      displayPic: targetUser.profilePic,
      otherUser: targetUser,
      members: room.members.map(m => m.user),
      unreadCount: 0,
      lastActivityAt: room.lastActivityAt,
      isVirtual: false
    });
  } catch (error) {
    console.error('Create direct room error:', error);
    res.status(500).json({ message: 'Failed to create direct chat room.' });
  }
};

// 3. Get Messages for a Room
const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    if (roomId.startsWith('virtual_')) {
      return res.json({
        room: null,
        messages: []
      });
    }

    const room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        team: {
          include: {
            leader: { select: { id: true, name: true, email: true, role: true, profilePic: true } }
          }
        },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            deadline: true,
            createdAt: true,
            attachments: true
          }
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, profilePic: true, employeeId: true, status: true, department: true, college: true, phone: true, joiningDate: true, createdAt: true } }
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ message: 'Chat room not found.' });
    }

    // Auto-join if user is authorized for Company room
    let isMember = room.members.some(m => m.userId === userId);
    if (!isMember && (room.type === 'COMPANY' || room.type === 'GLOBAL')) {
      await prisma.chatRoomMember.create({ data: { roomId, userId } }).catch(() => { });
      isMember = true;
    }

    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this chat room.' });
    }

    await prisma.chatRoomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      update: { lastReadAt: new Date() },
      create: { roomId, userId, lastReadAt: new Date() }
    });

    const messages = await prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, profilePic: true, employeeId: true }
        },
        replyTo: {
          include: {
            sender: { select: { id: true, name: true } }
          }
        },
        reads: {
          select: { userId: true, readAt: true }
        }
      }
    });

    // Extract shared files from messages + task attachments
    const sharedFiles = [];
    if (room.task && room.task.attachments) {
      room.task.attachments.forEach(att => {
        const fileName = att.split('/').pop();
        sharedFiles.push({
          name: fileName,
          url: att,
          type: att.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'IMAGE' : 'FILE',
          source: 'Project Task'
        });
      });
    }

    const filteredMessages = messages.filter(msg => {
      if (msg.deletedForUsers) {
        const userIds = msg.deletedForUsers.split(',').map(id => id.trim());
        if (userIds.includes(userId)) return false;
      }
      return true;
    });

    const formattedMessages = filteredMessages.map(msg => {
      if (msg.attachmentUrl && !msg.isDeleted) {
        sharedFiles.push({
          name: msg.fileName || msg.attachmentUrl.split('/').pop(),
          url: msg.attachmentUrl,
          size: msg.fileSize,
          type: msg.messageType,
          senderName: msg.sender?.name,
          createdAt: msg.createdAt,
          source: 'Chat Attachment'
        });
      }

      if (msg.isDeleted) {
        return {
          ...msg,
          message: 'This message was deleted',
          attachmentUrl: null,
          fileName: null,
          fileSize: null,
          messageType: 'TEXT'
        };
      }
      if (msg.replyTo && msg.replyTo.isDeleted) {
        msg.replyTo.message = 'This message was deleted';
      }
      return msg;
    });

    let otherUser = null;
    if (room.type === 'DIRECT') {
      const otherMember = room.members.find(m => m.userId !== userId);
      if (otherMember) {
        otherUser = otherMember.user;
      }
    }

    res.json({
      room: {
        id: room.id,
        name: room.type === 'DIRECT' && otherUser ? otherUser.name : room.name,
        type: room.type,
        teamId: room.teamId,
        taskId: room.taskId,
        team: room.team,
        task: room.task,
        otherUser,
        isDefault: room.isDefault || false,
        isArchived: room.isArchived || false,
        members: room.members.map(m => m.user),
        sharedFiles
      },
      messages: formattedMessages
    });
  } catch (error) {
    console.error('Get room messages error:', error);
    res.status(500).json({ message: 'Failed to retrieve chat messages.' });
  }
};

// 4. Send Message to a Room
const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    let { roomId, targetUserId, message, messageType, attachmentUrl, fileName, fileSize, replyToMessageId } = req.body;

    if (!message && !attachmentUrl) {
      return res.status(400).json({ message: 'Message content or attachment is required.' });
    }

    if (roomId && roomId.startsWith('virtual_')) {
      targetUserId = roomId.replace('virtual_', '');
      roomId = null;
    }

    if (!roomId && targetUserId) {
      let room = await prisma.chatRoom.findFirst({
        where: {
          type: 'DIRECT',
          isArchived: false,
          members: {
            every: {
              userId: { in: [userId, targetUserId] }
            }
          }
        },
        include: { members: true }
      });

      if (!room) {
        room = await prisma.chatRoom.create({
          data: {
            type: 'DIRECT',
            lastActivityAt: new Date(),
            members: {
              create: [
                { userId },
                { userId: targetUserId }
              ]
            }
          },
          include: { members: true }
        });
      }
      roomId = room.id;
    }

    if (!roomId) {
      return res.status(400).json({ message: 'Room ID or Target User ID is required.' });
    }

    let room = await prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { members: true }
    });

    if (!room) {
      return res.status(404).json({ message: 'Chat room not found.' });
    }

    if (room.isArchived || room.status === 'ARCHIVED') {
      return res.status(403).json({ message: 'This project chat group is archived and read-only. Sending new messages is not allowed.' });
    }

    let isMember = room.members.some(m => m.userId === userId);
    if (!isMember) {
      await prisma.chatRoomMember.create({
        data: { roomId, userId }
      }).catch(() => { });
    }

    const createdMsg = await prisma.chatMessage.create({
      data: {
        roomId,
        senderId: userId,
        message: message || '',
        messageType: messageType || (attachmentUrl ? (attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'IMAGE' : 'FILE') : 'TEXT'),
        attachmentUrl: attachmentUrl || null,
        fileName: fileName || null,
        fileSize: fileSize ? parseInt(fileSize, 10) : null,
        replyToMessageId: replyToMessageId || null
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, role: true, profilePic: true, employeeId: true }
        },
        replyTo: {
          include: {
            sender: { select: { id: true, name: true } }
          }
        },
        reads: true
      }
    });

    await prisma.messageRead.create({
      data: { messageId: createdMsg.id, userId }
    }).catch(() => { });

    await prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        lastActivityAt: new Date(),
        lastMessageId: createdMsg.id
      }
    });

    const otherMembers = room.members.filter(m => m.userId !== userId);
    const snippet = createdMsg.message ? (createdMsg.message.length > 50 ? createdMsg.message.substring(0, 47) + '...' : createdMsg.message) : `📁 ${fileName || 'Attachment'}`;

    if (room.type === 'DIRECT') {
      for (const m of otherMembers) {
        await createNotification({
          userId: m.userId,
          type: 'NEW_CHAT_MESSAGE',
          title: `New message from ${req.user.name}`,
          message: snippet
        });
      }
    } else if (room.type === 'TEAM' || room.type === 'COMPANY') {
      for (const m of otherMembers) {
        await createNotification({
          userId: m.userId,
          type: 'NEW_TEAM_CHAT_MESSAGE',
          title: `New message in ${room.name || 'Chat'}`,
          message: `${req.user.name}: ${snippet}`
        });
      }
    }

    if (message && message.includes('@')) {
      const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
      for (const u of allUsers) {
        if (u.id !== userId && message.toLowerCase().includes(`@${u.name.toLowerCase()}`)) {
          await createNotification({
            userId: u.id,
            type: 'CHAT_MENTION',
            title: `Mentioned by ${req.user.name} in chat`,
            message: snippet
          });
        }
      }
    }

    if (replyToMessageId) {
      const originalMsg = await prisma.chatMessage.findUnique({
        where: { id: replyToMessageId },
        select: { senderId: true }
      });
      if (originalMsg && originalMsg.senderId !== userId) {
        await createNotification({
          userId: originalMsg.senderId,
          type: 'CHAT_REPLY',
          title: `${req.user.name} replied to your message`,
          message: snippet
        });
      }
    }

    res.status(201).json(createdMsg);
  } catch (error) {
    console.error('Send chat message error:', error);
    res.status(500).json({ message: 'Failed to send chat message.' });
  }
};

// 5. Edit Message
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    const existing = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!existing) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    if (existing.senderId !== userId) {
      return res.status(403).json({ message: 'Only the sender can edit this message.' });
    }

    if (existing.isDeleted) {
      return res.status(400).json({ message: 'Cannot edit a deleted message.' });
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        message,
        isEdited: true,
        editedAt: new Date(),
        editedBy: userId
      },
      include: {
        sender: { select: { id: true, name: true, role: true, profilePic: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Edit chat message error:', error);
    res.status(500).json({ message: 'Failed to edit message.' });
  }
};

// 6. Soft Delete / Permanent Delete Message
const softDeleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const { deleteMode } = req.body || {}; // 'EVERYONE', 'ME', 'PERMANENT_EVERYONE', 'PERMANENT_ME'

    const existing = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!existing) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    const isSender = existing.senderId === userId;
    const isSuperAdmin = req.user.role === 'ADMIN';

    if (deleteMode === 'PERMANENT_EVERYONE') {
      if (!isSender && !isSuperAdmin) {
        return res.status(403).json({ message: 'Permission denied: Only the sender can permanently delete for everyone.' });
      }

      await prisma.chatMessage.delete({ where: { id: messageId } });

      await logActivity({
        userId,
        action: 'CHAT_MESSAGE_PERMANENT_DELETE_EVERYONE',
        details: `Permanently deleted message for everyone in room ${existing.roomId}`
      });

      return res.json({
        id: messageId,
        roomId: existing.roomId,
        deleteMode: 'PERMANENT_EVERYONE',
        isPermanentlyDeleted: true,
        message: 'Message permanently deleted for everyone.'
      });
    }

    if (deleteMode === 'PERMANENT_ME') {
      const currentUsers = existing.deletedForUsers ? existing.deletedForUsers.split(',').map(id => id.trim()) : [];
      if (!currentUsers.includes(userId)) {
        currentUsers.push(userId);
      }

      await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          deletedForUsers: currentUsers.join(',')
        }
      });

      await logActivity({
        userId,
        action: 'CHAT_MESSAGE_PERMANENT_DELETE_ME',
        details: `Permanently deleted message placeholder for self in room ${existing.roomId}`
      });

      return res.json({
        id: messageId,
        roomId: existing.roomId,
        deleteMode: 'PERMANENT_ME',
        isPermanentlyDeleted: true,
        userId,
        message: 'Message permanently deleted for you.'
      });
    }

    if (deleteMode === 'EVERYONE') {
      if (!isSender && !isSuperAdmin) {
        return res.status(403).json({ message: 'Permission denied: Only the sender can delete for everyone.' });
      }

      const updated = await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          message: 'This message was deleted',
          attachmentUrl: null,
          fileName: null,
          fileSize: null
        },
        include: {
          sender: { select: { id: true, name: true, email: true, role: true, profilePic: true } },
          reads: { select: { userId: true, readAt: true } }
        }
      });

      await logActivity({
        userId,
        action: 'CHAT_MESSAGE_DELETE_EVERYONE',
        details: `Deleted message for everyone in room ${existing.roomId}`
      });

      return res.json({
        ...updated,
        deleteMode: 'EVERYONE',
        isDeleted: true,
        message: 'This message was deleted'
      });
    } else {
      // Delete for Me
      const currentUsers = existing.deletedForUsers ? existing.deletedForUsers.split(',').map(id => id.trim()) : [];
      if (!currentUsers.includes(userId)) {
        currentUsers.push(userId);
      }

      const updated = await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          deletedForUsers: currentUsers.join(',')
        }
      });

      await logActivity({
        userId,
        action: 'CHAT_MESSAGE_DELETE_ME',
        details: `Deleted message for self in room ${existing.roomId}`
      });

      return res.json({
        id: messageId,
        roomId: existing.roomId,
        deleteMode: 'ME',
        message: 'Message deleted for you.'
      });
    }
  } catch (error) {
    console.error('Delete chat message error:', error);
    res.status(500).json({ message: 'Failed to delete message.' });
  }
};

// 7. Toggle Pin Message
const togglePinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    if (!['ADMIN', 'TEAM_LEADER'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Admins can pin/unpin messages.' });
    }

    const existing = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!existing) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        isPinned: !existing.isPinned,
        pinnedAt: !existing.isPinned ? new Date() : null,
        pinnedById: !existing.isPinned ? userId : null
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Toggle pin message error:', error);
    res.status(500).json({ message: 'Failed to toggle pin state.' });
  }
};

// 8. Mark Room as Read
const markRoomAsRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    if (roomId && !roomId.startsWith('virtual_')) {
      await prisma.chatRoomMember.upsert({
        where: { roomId_userId: { roomId, userId } },
        update: { lastReadAt: new Date() },
        create: { roomId, userId, lastReadAt: new Date() }
      });
    }

    res.json({ success: true, roomId, lastReadAt: new Date() });
  } catch (error) {
    console.error('Mark room read error:', error);
    res.status(500).json({ message: 'Failed to mark room as read.' });
  }
};

// 9. Unified Global Chat Search
const searchChat = async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query) {
      return res.json({ users: [], rooms: [], messages: [], files: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { employeeId: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true, email: true, role: true, profilePic: true, employeeId: true },
      take: 10
    });

    const rooms = await prisma.chatRoom.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
        isArchived: false
      },
      take: 10
    });

    const messages = await prisma.chatMessage.findMany({
      where: {
        message: { contains: query, mode: 'insensitive' },
        isDeleted: false
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        room: { select: { id: true, name: true, type: true } }
      },
      take: 15
    });

    res.json({ users, rooms, messages });
  } catch (error) {
    console.error('Search chat error:', error);
    res.status(500).json({ message: 'Failed to search chat.' });
  }
};

// 10. Create Team Room On Demand
const createTeamRoom = async (req, res) => {
  try {
    const { teamId } = req.body;
    const userId = req.user.id;

    if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required.' });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true }
    });

    if (!team) {
      return res.status(404).json({ message: 'Team not found.' });
    }

    let room = await prisma.chatRoom.findFirst({
      where: { type: 'TEAM', teamId, isArchived: false }
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          name: `${team.name}`,
          type: 'TEAM',
          teamId,
          lastActivityAt: new Date(),
          members: {
            create: [
              { userId },
              ...(team.leaderId && team.leaderId !== userId ? [{ userId: team.leaderId }] : []),
              ...team.members.filter(m => m.userId !== userId).map(m => ({ userId: m.userId }))
            ]
          }
        }
      });
    }

    res.json(room);
  } catch (error) {
    console.error('Create team room error:', error);
    res.status(500).json({ message: 'Failed to create team room.' });
  }
};

const downloadAttachment = async (req, res) => {
  try {
    const { messageId } = req.params;
    const msg = await prisma.chatMessage.findUnique({
      where: { id: messageId }
    });

    if (!msg || !msg.attachmentUrl) {
      return res.status(404).json({ message: 'Attachment not found.' });
    }

    let relPath = msg.attachmentUrl.trim();
    if (relPath.startsWith('/') || relPath.startsWith('\\')) {
      relPath = relPath.substring(1);
    }

    if (/^uploads[/\\]/i.test(relPath)) {
      relPath = relPath.replace(/^uploads[/\\]/i, '');
    }

    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const physicalPath = path.resolve(uploadsDir, relPath);

    if (!physicalPath.startsWith(uploadsDir) || !fs.existsSync(physicalPath)) {
      return res.status(404).json({ message: 'File not found on server.' });
    }

    const downloadFileName = msg.fileName || msg.originalFileName || path.basename(physicalPath);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFileName)}"; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`);

    res.download(physicalPath, downloadFileName, (err) => {
      if (err && !res.headersSent) {
        console.error('Download attachment stream error:', err);
        res.status(500).json({ message: 'Download failed.' });
      }
    });
  } catch (error) {
    console.error('Download attachment controller error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = {
  getRooms,
  createDirectRoom,
  createTeamRoom,
  getRoomMessages,
  sendMessage,
  editMessage,
  softDeleteMessage,
  togglePinMessage,
  markRoomAsRead,
  searchChat,
  downloadAttachment
};
