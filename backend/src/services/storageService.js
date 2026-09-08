const fs = require('fs');
const path = require('path');
const prisma = require('../utils/db');

/**
 * Helper to recursively calculate directory size in bytes
 */
function getDirSizeBytes(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;

  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        size += getDirSizeBytes(filePath);
      } else {
        size += stat.size;
      }
    }
  } catch (err) {
    console.warn(`Failed to measure folder size at ${dirPath}:`, err.message);
  }

  return size;
}

/**
 * Calculates total storage used by an organization across all upload folders in MB
 */
async function calculateOrganizationStorage(organizationId) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId }
  });

  if (!org) return 0;

  const folderName = (org.companyCode || org.slug).toLowerCase();
  const uploadsBase = path.join(__dirname, '../../uploads');
  const subfolders = ['logos', 'profiles', 'chat', 'worklogs', 'documents'];

  let totalBytes = 0;
  for (const sf of subfolders) {
    const tenantFolder = path.join(uploadsBase, sf, folderName);
    totalBytes += getDirSizeBytes(tenantFolder);
  }

  const totalMB = Math.ceil(totalBytes / (1024 * 1024));
  return totalMB;
}

/**
 * Calculates and updates storageUsedMB in Organization record
 */
async function updateOrganizationStorage(organizationId) {
  try {
    const totalMB = await calculateOrganizationStorage(organizationId);
    await prisma.organization.update({
      where: { id: organizationId },
      data: { storageUsedMB: totalMB }
    });
    return totalMB;
  } catch (err) {
    console.error(`Error updating storage for org ${organizationId}:`, err.message);
    return 0;
  }
}

module.exports = {
  calculateOrganizationStorage,
  updateOrganizationStorage
};
