const prisma = require('./db');

const logActivity = async ({ userId, action, details, ipAddress = null }) => {
  try {
    const log = await prisma.activityLog.create({
      data: {
        userId,
        action,
        details,
        ipAddress
      }
    });
    return log;
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

module.exports = {
  logActivity
};
