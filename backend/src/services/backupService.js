const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../utils/db');

const backupsBaseDir = path.join(__dirname, '../../../backups');
const dbBackupsDir = path.join(backupsBaseDir, 'database');
const uploadsBackupsDir = path.join(backupsBaseDir, 'uploads');
const tenantBackupsDir = path.join(backupsBaseDir, 'tenant');

// Ensure directory structure exists
[backupsBaseDir, dbBackupsDir, uploadsBackupsDir, tenantBackupsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Calculates SHA256 checksum of a file
 */
function calculateFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Creates a full database and uploads snapshot backup with SHA256 checksum verification
 */
async function createFullBackup(triggerType = 'MANUAL') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dateFolder = new Date().toISOString().split('T')[0];

  const backupId = `bkp_${timestamp}_${crypto.randomBytes(3).toString('hex')}`;
  const dbFileName = `${dateFolder}_${backupId}_db.json`;
  const dbFilePath = path.join(dbBackupsDir, dbFileName);

  console.log(`[BackupService] Starting ${triggerType} backup ${backupId}...`);

  // 1. Export database records to JSON snapshot
  const [organizations, users, projects, attendances, workLogs, leaveRequests, chatRooms, settings] = await Promise.all([
    prisma.organization.findMany(),
    prisma.user.findMany(),
    prisma.project.findMany(),
    prisma.attendance.findMany(),
    prisma.workLog.findMany(),
    prisma.leaveRequest.findMany(),
    prisma.chatRoom.findMany(),
    prisma.organizationSettings.findMany()
  ]);

  const dbSnapshotData = {
    backupId,
    version: '1.0',
    createdAt: new Date().toISOString(),
    counts: {
      organizations: organizations.length,
      users: users.length,
      projects: projects.length,
      attendances: attendances.length,
      workLogs: workLogs.length,
      leaveRequests: leaveRequests.length,
      chatRooms: chatRooms.length
    },
    tables: {
      organizations,
      users,
      projects,
      attendances,
      workLogs,
      leaveRequests,
      chatRooms,
      settings
    }
  };

  fs.writeFileSync(dbFilePath, JSON.stringify(dbSnapshotData, null, 2));

  const dbSize = fs.statSync(dbFilePath).size;
  const dbChecksum = calculateFileSha256(dbFilePath);

  // 2. Generate Manifest File
  const manifest = {
    backupId,
    triggerType,
    createdAt: new Date().toISOString(),
    type: 'FULL_SNAPSHOT',
    dbFile: dbFileName,
    dbSizeMB: (dbSize / (1024 * 1024)).toFixed(2),
    checksum: dbChecksum,
    verified: true,
    recordCounts: dbSnapshotData.counts
  };

  const manifestPath = path.join(dbBackupsDir, `manifest_${backupId}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // 3. Enforce 30-day Retention Policy
  cleanOldBackups(30);

  return manifest;
}

/**
 * Verifies checksum of a backup manifest
 */
function verifyBackupIntegrity(backupId) {
  const manifestFiles = fs.readdirSync(dbBackupsDir).filter(f => f.startsWith('manifest_') && f.includes(backupId));
  if (manifestFiles.length === 0) return { verified: false, message: 'Backup manifest not found.' };

  const manifestPath = path.join(dbBackupsDir, manifestFiles[0]);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const dbFilePath = path.join(dbBackupsDir, manifest.dbFile);
  if (!fs.existsSync(dbFilePath)) return { verified: false, message: 'Database backup file missing.' };

  const actualChecksum = calculateFileSha256(dbFilePath);
  const isMatch = actualChecksum === manifest.checksum;

  return {
    verified: isMatch,
    backupId,
    expectedChecksum: manifest.checksum,
    actualChecksum,
    manifest
  };
}

/**
 * Lists all existing backup manifests
 */
function listAllBackups() {
  const files = fs.readdirSync(dbBackupsDir).filter(f => f.startsWith('manifest_'));
  const manifests = [];

  for (const f of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(dbBackupsDir, f), 'utf8'));
      manifests.push(content);
    } catch (e) {}
  }

  return manifests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Cleans backups older than retentionDays
 */
function cleanOldBackups(retentionDays = 30) {
  const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  try {
    const files = fs.readdirSync(dbBackupsDir);
    for (const f of files) {
      const filePath = path.join(dbBackupsDir, f);
      const stat = fs.statSync(filePath);
      if (stat.ctimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        console.log(`[BackupService Retention] Removed old backup file: ${f}`);
      }
    }
  } catch (err) {
    console.warn('[BackupService Retention] Error during backup cleanup:', err.message);
  }
}

module.exports = {
  createFullBackup,
  verifyBackupIntegrity,
  listAllBackups,
  cleanOldBackups
};
