const prisma = require('../utils/db');
const socketManager = require('../socket');

const createNotification = async ({ userId, title, message, type }) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        isRead: false
      }
    });

    // Send real-time notification via Socket.io
    socketManager.sendNotificationToUser(userId, notification);
    return notification;
  } catch (error) {
    console.error('Error creating database notification:', error);
  }
};

module.exports = {
  createNotification
};
