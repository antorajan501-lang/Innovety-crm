const fs = require('fs');
const path = require('path');
const prisma = require('../utils/db');
const { updateOrganizationStorage } = require('./storageService');
const { logOrganizationAction } = require('./organizationAuditService');

/**
 * Recalculates storage for all tenant organizations
 */
async function recalculateAllStorage(progressCb) {
  const orgs = await prisma.organization.findMany();
  let count = 0;

  for (const org of orgs) {
    await updateOrganizationStorage(org.id);
    count++;
    if (progressCb) progressCb(Math.round((count / orgs.length) * 100));
  }

  return { success: true, processedCount: count };
}

/**
 * Rebuilds organization statistics
 */
async function rebuildOrganizationStatistics() {
  const orgs = await prisma.organization.findMany();
  const results = [];

  for (const org of orgs) {
    const [users, projects, attendances, workLogs] = await Promise.all([
      prisma.user.count({ where: { organizationId: org.id } }),
      prisma.project.count({ where: { organizationId: org.id } }),
      prisma.attendance.count({ where: { organizationId: org.id } }),
      prisma.workLog.count({ where: { organizationId: org.id } })
    ]);

    results.push({
      organizationId: org.id,
      name: org.name,
      users,
      projects,
      attendances,
      workLogs
    });
  }

  return { success: true, count: results.length, details: results };
}

/**
 * Clears orphaned upload files with no corresponding DB record
 */
async function clearOrphanUploads() {
  const uploadsDir = path.join(__dirname, '../../uploads');
  let clearedCount = 0;
  let clearedBytes = 0;

  // Safe scan: check profile photos that do not exist in User table
  try {
    const profileDir = path.join(uploadsDir, 'profiles');
    if (fs.existsSync(profileDir)) {
      const files = fs.readdirSync(profileDir);
      const activeUsers = await prisma.user.findMany({ select: { profilePic: true } });
      const activePicPaths = new Set(activeUsers.map(u => u.profilePic).filter(Boolean));

      for (const file of files) {
        const fullPath = path.join(profileDir, file);
        const relPath = `/uploads/profiles/${file}`;
        if (!activePicPaths.has(relPath) && fs.statSync(fullPath).isFile()) {
          const stat = fs.statSync(fullPath);
          clearedBytes += stat.size;
          fs.unlinkSync(fullPath);
          clearedCount++;
        }
      }
    }
  } catch (err) {
    console.warn('Error during orphan cleanup scan:', err.message);
  }

  return {
    success: true,
    clearedFilesCount: clearedCount,
    freedMB: (clearedBytes / (1024 * 1024)).toFixed(2)
  };
}

/**
 * Toggles maintenance mode for a specific tenant
 */
async function setTenantMaintenanceMode(organizationId, enabled, message = null) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new Error('Organization not found.');

  if ((org.slug === 'innoveity' || org.companyCode === 'INN001') && enabled) {
    throw new Error('The default INNOVEITY organization cannot be put into maintenance mode.');
  }

  const updatedOrg = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      maintenanceMode: Boolean(enabled),
      maintenanceMessage: message || (enabled ? 'Company portal is under scheduled maintenance.' : null)
    }
  });

  await logOrganizationAction(
    organizationId,
    'SYSTEM',
    'admin@platform.com',
    enabled ? 'TENANT_MAINTENANCE_ENABLED' : 'TENANT_MAINTENANCE_DISABLED',
    { maintenanceMessage: updatedOrg.maintenanceMessage }
  );

  return updatedOrg;
}

module.exports = {
  recalculateAllStorage,
  rebuildOrganizationStatistics,
  clearOrphanUploads,
  setTenantMaintenanceMode
};
