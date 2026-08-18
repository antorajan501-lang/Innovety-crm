const socketIo = require('socket.io');

const onlineUsers = new Map(); // userId (string) -> { name, role, teamId, socketIds: Set(socketId) }

let io;

const getOnlineUsersPayload = () => {
  return Array.from(onlineUsers.entries()).map(([id, info]) => ({
    id: String(id),
    name: info.name,
    role: info.role
  }));
};

const broadcastOnlineUsers = () => {
  if (!io) return;
  io.emit('online_users', getOnlineUsersPayload());
};

const init = (server) => {
  io = socketIo(server, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Client registers their identity
    socket.on('register', ({ userId, name, role, teamId }) => {
      if (!userId) return;
      const strUserId = String(userId);
      socket.userId = strUserId;
      socket.userName = name;
      socket.role = role;
      socket.teamId = teamId;

      if (!onlineUsers.has(strUserId)) {
        onlineUsers.set(strUserId, {
          name,
          role,
          teamId,
          socketIds: new Set([socket.id])
        });
      } else {
        const userEntry = onlineUsers.get(strUserId);
        userEntry.socketIds.add(socket.id);
        userEntry.name = name || userEntry.name;
        userEntry.role = role || userEntry.role;
        userEntry.teamId = teamId || userEntry.teamId;
      }

      // Join standard rooms
      socket.join('global');
      socket.join(`user_${strUserId}`);
      if (teamId) {
        socket.join(`team_${teamId}`);
      }
      if (role === 'ADMIN') {
        socket.join('admins');
      } else if (role === 'TEAM_LEADER') {
        socket.join('leaders');
      }

      const activeList = getOnlineUsersPayload();
      socket.emit('online_users', activeList);
      io.emit('online_users', activeList);
      console.log(`User registered: ${strUserId} (${role}) [socket: ${socket.id}]`);
    });

    // ─── CHAT MODULE EVENT HANDLERS ──────────────────────────────
    
    // Join specific chat room (Global, Team, or Direct)
    socket.on('join_chat_room', (roomId) => {
      if (roomId) {
        socket.join(`chat_room_${roomId}`);
        console.log(`Socket ${socket.id} joined chat_room_${roomId}`);
      }
    });

    // Leave specific chat room
    socket.on('leave_chat_room', (roomId) => {
      if (roomId) {
        socket.leave(`chat_room_${roomId}`);
        console.log(`Socket ${socket.id} left chat_room_${roomId}`);
      }
    });

    // Real-time chat message dispatch
    socket.on('send_chat_message', (messageData) => {
      if (messageData && messageData.roomId) {
        // Broadcast to all sockets in this chat room
        io.to(`chat_room_${messageData.roomId}`).emit('receive_chat_message', messageData);
        // Also emit room activity refresh signal globally for room ordering
        io.emit('chat_room_activity', { roomId: messageData.roomId, lastMessage: messageData });
      }
    });

    // Real-time typing indicators
    socket.on('typing', ({ roomId, userId, userName }) => {
      if (roomId) {
        socket.to(`chat_room_${roomId}`).emit('user_typing', { roomId, userId, userName: userName || socket.userName });
      }
    });

    socket.on('stop_typing', ({ roomId, userId }) => {
      if (roomId) {
        socket.to(`chat_room_${roomId}`).emit('user_stop_typing', { roomId, userId });
      }
    });

    // Real-time message edit / delete events
    socket.on('message_edited', (messageData) => {
      if (messageData && messageData.roomId) {
        io.to(`chat_room_${messageData.roomId}`).emit('message_edited', messageData);
      }
    });

    socket.on('message_deleted', (messageData) => {
      if (messageData && messageData.roomId) {
        io.to(`chat_room_${messageData.roomId}`).emit('message_deleted', messageData);
        io.emit('chat_room_activity', { roomId: messageData.roomId, lastMessage: messageData });
      }
    });

    // Real-time message read receipts
    socket.on('message_read', ({ roomId, userId }) => {
      if (roomId) {
        io.to(`chat_room_${roomId}`).emit('room_messages_read', { roomId, userId, readAt: new Date() });
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} (reason: ${reason})`);
      if (socket.userId) {
        const strUserId = String(socket.userId);
        const userEntry = onlineUsers.get(strUserId);
        if (userEntry) {
          userEntry.socketIds.delete(socket.id);
          if (userEntry.socketIds.size === 0) {
            onlineUsers.delete(strUserId);
            broadcastOnlineUsers();
            console.log(`User unregistered (offline): ${strUserId}`);
          }
        }
      }
    });
  });

  return io;
};

// Send direct notification to active user
const sendNotificationToUser = (userId, notification) => {
  if (!io || !userId) return;
  const strUserId = String(userId);
  io.to(`user_${strUserId}`).emit('notification', notification);
  const userRecord = onlineUsers.get(strUserId);
  if (userRecord && userRecord.socketIds) {
    for (const socketId of userRecord.socketIds) {
      io.to(socketId).emit('notification', notification);
    }
  }
};

// Broadcast announcement
const sendAnnouncement = (announcement) => {
  if (!io) return;
  if (announcement.targetTeamId) {
    io.to(`team_${announcement.targetTeamId}`).emit('announcement', announcement);
  } else {
    io.to('global').emit('announcement', announcement);
  }
};

// Disconnect active socket connection for a user
const disconnectUserSocket = (userId) => {
  if (!io || !userId) return;
  const strUserId = String(userId);
  const userRecord = onlineUsers.get(strUserId);
  if (userRecord && userRecord.socketIds) {
    for (const socketId of userRecord.socketIds) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        sock.disconnect(true);
      }
    }
  }
  onlineUsers.delete(strUserId);
  broadcastOnlineUsers();
};

// Get list of online user IDs
const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

// Get the io instance
const getIo = () => {
  return io;
};

// Broadcast attendance real-time event
const broadcastAttendanceEvent = (eventName, data) => {
  if (!io) return;
  io.emit(eventName, data);
};

// Broadcast team performance update signal (triggers ranking refresh on all dashboards)
const broadcastTeamPerformanceUpdate = () => {
  if (!io) return;
  io.emit('team_performance_updated');
};

module.exports = {
  init,
  getIo,
  sendNotificationToUser,
  sendAnnouncement,
  getOnlineUsers,
  disconnectUserSocket,
  broadcastAttendanceEvent,
  broadcastTeamPerformanceUpdate
};

