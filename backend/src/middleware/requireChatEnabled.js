const prisma = require('../utils/db');

/**
 * Middleware to check if Chat module is enabled for the current user's organization and role.
 * Hierarchy:
 * 1. SUPER_ADMIN: Always allowed.
 * 2. ADMIN: PlatformSettings.chatEnabledForAdmins AND OrganizationSettings.chatEnabledForAdmins
 * 3. TEAM_LEADER / EMPLOYEE / INTERN: PlatformSettings.chatEnabledForUsers AND OrganizationSettings.chatEnabledForUsers
 */
const requireChatEnabled = async (req, res, next) => {
  try {
    const role = req.user?.role;
    const organizationId = req.user?.organizationId || req.user?.organization?.id;

    if (role === 'SUPER_ADMIN') {
      return next();
    }

    const platform = await prisma.platformSettings.findUnique({
      where: { id: 'PLATFORM' }
    }).catch(() => null);

    const platformAdmin = platform?.chatEnabledForAdmins ?? true;
    const platformUser = platform?.chatEnabledForUsers ?? true;

    let tenantAdmin = true;
    let tenantUser = true;

    if (organizationId) {
      const orgSettings = await prisma.organizationSettings.findUnique({
        where: { organizationId }
      }).catch(() => null);
      if (orgSettings) {
        tenantAdmin = orgSettings.chatEnabledForAdmins ?? true;
        tenantUser = orgSettings.chatEnabledForUsers ?? true;
      }
    }

    const canUseAdminChat = platformAdmin && tenantAdmin;
    const canUseUserChat = platformUser && tenantUser;

    if (role === 'ADMIN' && !canUseAdminChat) {
      return res.status(403).json({
        success: false,
        message: 'Chat has been disabled.'
      });
    }

    if (role !== 'ADMIN' && !canUseUserChat) {
      return res.status(403).json({
        success: false,
        message: 'Chat has been disabled.'
      });
    }

    next();
  } catch (error) {
    console.error('requireChatEnabled middleware error:', error);
    return res.status(403).json({
      success: false,
      message: 'Chat has been disabled.'
    });
  }
};

module.exports = { requireChatEnabled };
