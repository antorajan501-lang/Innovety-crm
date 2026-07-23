const socketIo = require('socket.io');

const onlineUsers = new Map(); // userId -> { socketId, name, role }

let io;

const init = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Client registers their identity
    socket.on('register', ({ userId, name, role, teamId }) => {
      socket.userId = userId;
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
  // Emit to user room (works across multiple connections/devices)
  io.to(`user_${userId}`).emit('notification', notification);

  // Fallback direct socket emit if user socket is tracked
  const userRecord = onlineUsers.get(userId);
  if (userRecord && userRecord.socketId) {
    io.to(userRecord.socketId).emit('notification', notification);
  }
};

// Broadcast announcement
const sendAnnouncement = (announcement) => {
  if (!io) return;
  if (announcement.targetTeamId) {
    // Send to specific team room
    io.to(`team_${announcement.targetTeamId}`).emit('announcement', announcement);
  } else {
    // Send to all
    io.to('global').emit('announcement', announcement);
  }
};

// Get list of online user IDs
const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

module.exports = {
  init,
  sendNotificationToUser,
  sendAnnouncement,
  getOnlineUsers
};
