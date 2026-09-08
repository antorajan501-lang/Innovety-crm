const fs = require('fs');
const path = require('path');
const prisma = require('../utils/db');

const exportsDir = path.join(__dirname, '../../../backups/exports');
if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

/**
 * Converts array of objects to CSV string
 */
function convertToCSV(dataArray) {
  if (!dataArray || dataArray.length === 0) return '';
  const headers = Object.keys(dataArray[0]);
  const csvRows = [headers.join(',')];

  for (const row of dataArray) {
    const values = headers.map(h => {
      const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
      const escaped = val.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Asynchronously generates audit log export file in CSV or JSON format
 */
async function generateAuditExport(targetType, organizationId, format = 'CSV') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `export_${targetType.toLowerCase()}_${timestamp}.${format.toLowerCase()}`;
  const filePath = path.join(exportsDir, fileName);

  let data = [];

  if (targetType === 'ATTENDANCE') {
    data = await prisma.attendance.findMany({
      where: organizationId ? { organizationId } : {},
      take: 1000,
      orderBy: { date: 'desc' }
    });
  } else if (targetType === 'ORGANIZATION_ACTIVITY') {
    data = await prisma.organizationAuditLog.findMany({
      where: organizationId ? { organizationId } : {},
      take: 1000,
      orderBy: { createdAt: 'desc' }
    });
  } else if (targetType === 'SECURITY_EVENTS') {
    data = await prisma.organizationAuditLog.findMany({
      where: {
        action: { in: ['LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'SESSION_REVOKED', 'ADMIN_PASSWORD_RESET'] },
        ...(organizationId ? { organizationId } : {})
      },
      take: 1000,
      orderBy: { createdAt: 'desc' }
    });
  } else {
    data = await prisma.organizationAuditLog.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' }
    });
  }

  const sanitizedData = JSON.parse(JSON.stringify(data));

  if (format.toUpperCase() === 'CSV') {
    const csvContent = convertToCSV(sanitizedData);
    fs.writeFileSync(filePath, csvContent);
  } else {
    fs.writeFileSync(filePath, JSON.stringify(sanitizedData, null, 2));
  }

  return {
    fileName,
    filePath,
    downloadUrl: `/api/maintenance/exports/download/${fileName}`,
    format,
    recordCount: sanitizedData.length,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  generateAuditExport
};
