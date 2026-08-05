const socketIo = require('socket.io');

const onlineUsers = new Map(); // userId -> { socketId, name, role, teamId }

let io;

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
      socket.userId = userId;
      socket.userName = name;
      socket.role = role;
      socket.teamId = teamId;

      onlineUsers.set(userId, { socketId: socket.id, name, role, teamId, online: true });

      // Join standard rooms
      socket.join('global');
      socket.join(`user_${userId}`);
      if (teamId) {
        socket.join(`team_${teamId}`);
      }
      if (role === 'ADMIN') {
        socket.join('admins');
      } else if (role === 'TEAM_LEADER') {
        socket.join('leaders');
      }

      // Broadcast list of active users to all
      io.emit('online_users', Array.from(onlineUsers.entries()).map(([id, info]) => ({ id, name: info.name, role: info.role })));
      console.log(`User registered: ${userId} (${role})`);
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

    // Handle manual disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit('online_users', Array.from(onlineUsers.entries()).map(([id, info]) => ({ id, name: info.name, role: info.role })));
        console.log(`User unregistered: ${socket.userId}`);
      }
    });
  });

  return io;
};

// Send direct notification to active user
const sendNotificationToUser = (userId, notification) => {
  if (!io) return;
  io.to(`user_${userId}`).emit('notification', notification);
  const userRecord = onlineUsers.get(userId);
  if (userRecord && userRecord.socketId) {
    io.to(userRecord.socketId).emit('notification', notification);
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
  if (!io) return;
  const userRecord = onlineUsers.get(userId);
  if (userRecord && userRecord.socketId) {
    const socket = io.sockets.sockets.get(userRecord.socketId);
    if (socket) {
      socket.disconnect(true);
    }
  }
  onlineUsers.delete(userId);
  io.emit('online_users', Array.from(onlineUsers.entries()).map(([id, info]) => ({ id, name: info.name, role: info.role })));
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

