const prisma = require('./db');

const logActivity = async ({ userId, action, details, ipAddress = null, organizationId = null, req = null }) => {
  try {
    let orgId = organizationId;
    if (!orgId && req) {
      const { getEffectiveOrgId } = require('./organizationScope');
      orgId = getEffectiveOrgId(req);
    }
    if (!orgId && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true }
      });
      orgId = user?.organizationId || null;
    }

    const log = await prisma.activityLog.create({
      data: {
        userId,
        organizationId: orgId,
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
