const prisma = require('../utils/db');
const socketManager = require('../socket');

/**
 * Creates a shift-specific notification and pushes via socket
 */
const createShiftNotification = async ({
  organizationId,
  userId,
  type,
  title,
  message,
  metadata = null
}) => {
  try {
    if (!organizationId || !userId || !type || !title || !message) {
      return null;
    }

    // Check organization automation setting
    const setting = await prisma.shiftAutomationSetting.findUnique({
      where: { organizationId }
    });

    if (setting) {
      if (type === 'SHIFT_START_1H' && setting.shiftReminder1h === false) return null;
      if (type === 'TOMORROW_SUMMARY' && setting.tomorrowReminder === false) return null;
      if (type === 'LATE_ALERT' && setting.lateAlert === false) return null;
    }

    const notif = await prisma.shiftNotification.create({
      data: {
        organizationId,
        userId,
        type,
        title,
        message,
        metadata: metadata || undefined,
        isRead: false
      }
    });

    // Real-time socket emission
    try {
      socketManager.sendNotificationToUser(userId, {
        id: notif.id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        isRead: false,
        createdAt: notif.createdAt,
        isShiftNotification: true
      });
    } catch (sockErr) {
      // Non-blocking socket error
    }

    return notif;
  } catch (error) {
    console.error('[NotificationService] Error creating shift notification:', error);
    return null;
  }
};

/**
 * Get shift notifications for user
 */
const getUserShiftNotifications = async (userId, organizationId, options = {}) => {
  const { limit = 30, unreadOnly = false } = options;

  const where = { userId };
  if (organizationId) where.organizationId = organizationId;
  if (unreadOnly) where.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    prisma.shiftNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    }),
    prisma.shiftNotification.count({
      where: { userId, ...(organizationId ? { organizationId } : {}), isRead: false }
    })
  ]);

  return { notifications, unreadCount };
};

/**
 * Mark a single shift notification as read
 */
const markShiftNotificationRead = async (id, userId) => {
  return await prisma.shiftNotification.updateMany({
    where: { id, userId },
    data: { isRead: true }
  });
};

/**
 * Mark all shift notifications as read for a user
 */
const markAllShiftNotificationsRead = async (userId, organizationId) => {
  const where = { userId, isRead: false };
  if (organizationId) where.organizationId = organizationId;

  const res = await prisma.shiftNotification.updateMany({
    where,
    data: { isRead: true }
  });

  return res.count;
};

/**
 * Send 1-hour reminders to users whose shift starts in 1 hour
 */
const send1HourReminders = async (organizationId) => {
  try {
    const shiftService = require('./shiftService');
    const now = new Date();
    
    // Find active members in organization
    const users = await prisma.user.findMany({
      where: {
        organizationId,
        status: 'ACTIVE'
      },
      select: { id: true, name: true, employeeId: true }
    });

    const sent = [];
    for (const user of users) {
      const shiftData = await shiftService.getEmployeeShift(user.id, prisma, now);
      if (!shiftData || shiftData.todayStatus !== 'Working') continue;

      const [sHour, sMin] = (shiftData.startTime || '09:00').split(':').map(Number);
      const shiftStartToday = new Date(now);
      shiftStartToday.setHours(sHour, sMin, 0, 0);

      const diffMs = shiftStartToday.getTime() - now.getTime();
      const diffMinutes = Math.round(diffMs / (1000 * 60));

      // If shift starts within 45 to 75 minutes
      if (diffMinutes >= 45 && diffMinutes <= 75) {
        // Ensure not already sent today
        const existing = await prisma.shiftNotification.findFirst({
          where: {
            userId: user.id,
            type: 'SHIFT_START_1H',
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
          }
        });

        if (!existing) {
          const notif = await createShiftNotification({
            organizationId,
            userId: user.id,
            type: 'SHIFT_START_1H',
            title: 'Shift Starts in 1 Hour',
            message: `Hi ${user.name}, your ${shiftData.name} shift starts at ${shiftData.startTime} (${diffMinutes} mins remaining). Remember to clock in!`,
            metadata: { shiftId: shiftData.id, startTime: shiftData.startTime }
          });
          if (notif) sent.push(user.id);
        }
      }
    }

    return { sentCount: sent.length, userIds: sent };
  } catch (err) {
    console.error('[NotificationService] send1HourReminders error:', err);
    return { sentCount: 0, error: err.message };
  }
};

/**
 * Send tomorrow's shift summary to all active employees
 */
const sendTomorrowShiftSummaries = async (organizationId) => {
  try {
    const shiftService = require('./shiftService');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const users = await prisma.user.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { id: true, name: true }
    });

    const sent = [];
    for (const user of users) {
      const shiftData = await shiftService.getEmployeeShift(user.id, prisma, tomorrow);
      if (!shiftData) continue;

      const notif = await createShiftNotification({
        organizationId,
        userId: user.id,
        type: 'TOMORROW_SUMMARY',
        title: "Tomorrow's Shift Summary",
        message: `Tomorrow (${tomorrow.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}): You are scheduled for ${shiftData.name} (${shiftData.startTime || '--:--'} – ${shiftData.endTime || '--:--'}). Status: ${shiftData.todayStatus}.`,
        metadata: {
          shiftId: shiftData.id,
          shiftName: shiftData.name,
          startTime: shiftData.startTime,
          endTime: shiftData.endTime,
          status: shiftData.todayStatus
        }
      });
      if (notif) sent.push(user.id);
    }

    return { sentCount: sent.length, userIds: sent };
  } catch (err) {
    console.error('[NotificationService] sendTomorrowShiftSummaries error:', err);
    return { sentCount: 0, error: err.message };
  }
};

module.exports = {
  createShiftNotification,
  getUserShiftNotifications,
  markShiftNotificationRead,
  markAllShiftNotificationsRead,
  send1HourReminders,
  sendTomorrowShiftSummaries
};
