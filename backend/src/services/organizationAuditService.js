const prisma = require('../utils/db');

/**
 * Logs a tenant governance or lifecycle event to OrganizationAuditLog
 */
async function logOrganizationAction(organizationId, actorId, actorEmail, action, metadata = {}) {
  try {
    const logEntry = await prisma.organizationAuditLog.create({
      data: {
        organizationId: organizationId || null,
        actorId: actorId || null,
        actorEmail: actorEmail || 'SYSTEM',
        action,
        metadata
      }
    });
    return logEntry;
  } catch (err) {
    console.error('Failed to write OrganizationAuditLog entry:', err.message);
  }
}

module.exports = {
  logOrganizationAction
};
