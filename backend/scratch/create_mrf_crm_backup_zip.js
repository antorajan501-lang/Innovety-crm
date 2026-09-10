const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BACKUPS_DIR = 'D:\\Backups';
const TEMP_DIR = path.join(BACKUPS_DIR, 'temp_mrf_crm_backup');
const DB_TEMP_DIR = path.join(TEMP_DIR, 'database');

function getFormattedTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}-${min}`;
}

function findEnvFiles(dir) {
  const results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (['node_modules', '.git', 'dist', 'build', '.next', '.cache'].includes(item)) {
      continue;
    }
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findEnvFiles(fullPath));
    } else if (item === '.env' || item.startsWith('.env.')) {
      results.push(fullPath);
    }
  }
  return results;
}

function runBackupProcess() {
  console.log('================================================================');
  console.log('       MRF CRM — BACKUP GENERATION (ENV + DATABASE DUMP)        ');
  console.log('================================================================\n');

  // Step 1: Ensure D:\Backups exists & prepare temp directory
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log(`[1/5] Created Backups Directory: ${BACKUPS_DIR}`);
  } else {
    console.log(`[1/5] Backups Directory Verified: ${BACKUPS_DIR}`);
  }

  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(DB_TEMP_DIR, { recursive: true });

  // Step 2: Collect & Copy .env files keeping folder structure (e.g. backend/.env, frontend/.env)
  console.log('\n[2/5] Collecting Environment (.env*) Files...');
  const envFiles = findEnvFiles(PROJECT_ROOT);
  const includedEnvFiles = [];

  for (const envFile of envFiles) {
    const relPath = path.relative(PROJECT_ROOT, envFile); // e.g. backend\.env or frontend\.env
    const targetPath = path.join(TEMP_DIR, relPath);
    const targetDir = path.dirname(targetPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.copyFileSync(envFile, targetPath);
    includedEnvFiles.push(relPath.replace(/\\/g, '/'));
    console.log(`  ✓ Added: ${relPath.replace(/\\/g, '/')}`);
  }

  // Step 3: Database Dump Export
  console.log('\n[3/5] Exporting PostgreSQL Database (mrf_crm)...');
  let dbBackupFormat = '.dump';
  let dbBackupFileName = 'mrf_crm_backup.dump';
  let dbDumpFilePath = path.join(DB_TEMP_DIR, dbBackupFileName);

  const envVars = { ...process.env, PGPASSWORD: process.env.DB_PASS || '123' };

  // Attempt custom dump format first (-Fc)
  const dumpFcCmd = `pg_dump -h localhost -p 5432 -U postgres -d mrf_crm -Fc -f "${dbDumpFilePath}"`;
  try {
    execSync(dumpFcCmd, { env: envVars, stdio: 'pipe' });
    const dbStat = fs.statSync(dbDumpFilePath);
    console.log(`  ✓ Exported Custom Dump: database/${dbBackupFileName} (${(dbStat.size / 1024).toFixed(2)} KB)`);
  } catch (errFc) {
    console.log(`  ⚠ pg_dump custom format failed, falling back to plain SQL format...`);
    dbBackupFormat = '.sql';
    dbBackupFileName = 'mrf_crm_backup.sql';
    dbDumpFilePath = path.join(DB_TEMP_DIR, dbBackupFileName);

    const dumpSqlCmd = `pg_dump -h localhost -p 5432 -U postgres -d mrf_crm -f "${dbDumpFilePath}"`;
    try {
      execSync(dumpSqlCmd, { env: envVars, stdio: 'pipe' });
      const dbStat = fs.statSync(dbDumpFilePath);
      console.log(`  ✓ Exported Plain SQL Dump: database/${dbBackupFileName} (${(dbStat.size / 1024).toFixed(2)} KB)`);
    } catch (errSql) {
      console.error('❌ Database dump export failed completely:', errSql.message);
      process.exit(1);
    }
  }

  // Step 4: Create Timestamped ZIP Archive
  const timestamp = getFormattedTimestamp();
  let zipFileName = `MRF_CRM_Backup_${timestamp}.zip`;
  let zipFilePath = path.join(BACKUPS_DIR, zipFileName);

  // If a backup with exact same timestamp exists, append counter
  let counter = 1;
  while (fs.existsSync(zipFilePath)) {
    zipFileName = `MRF_CRM_Backup_${timestamp}_${counter}.zip`;
    zipFilePath = path.join(BACKUPS_DIR, zipFileName);
    counter++;
  }

  console.log(`\n[4/5] Archiving into ZIP: ${zipFileName}...`);

  const psCompressCmd = `powershell -Command "Compress-Archive -Path '${path.join(TEMP_DIR, '*')}' -DestinationPath '${zipFilePath}' -Force"`;
  try {
    execSync(psCompressCmd, { stdio: 'pipe' });
    const zipStat = fs.statSync(zipFilePath);
    console.log(`  ✓ ZIP archive generated successfully: ${zipFilePath} (${(zipStat.size / (1024 * 1024)).toFixed(2)} MB / ${zipStat.size} bytes)`);
  } catch (errZip) {
    console.error('❌ Failed to create ZIP archive:', errZip.message);
    process.exit(1);
  }

  // Step 5: Verify ZIP Integrity using PowerShell expand test
  console.log('\n[5/5] Verifying ZIP File Integrity & Structure...');
  const verifyTempDir = path.join(BACKUPS_DIR, 'temp_verify_mrf_crm');
  if (fs.existsSync(verifyTempDir)) {
    fs.rmSync(verifyTempDir, { recursive: true, force: true });
  }

  const psExpandCmd = `powershell -Command "Expand-Archive -Path '${zipFilePath}' -DestinationPath '${verifyTempDir}' -Force"`;
  try {
    execSync(psExpandCmd, { stdio: 'pipe' });
    console.log(`  ✓ ZIP Archive opened cleanly without corruption.`);

    // Clean up verify temp & process temp
    fs.rmSync(verifyTempDir, { recursive: true, force: true });
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch (errVerify) {
    console.error('❌ ZIP archive verification failed (Corrupted ZIP):', errVerify.message);
    process.exit(1);
  }

  // Final Summary Output (NO SENSITIVE SECRETS DISPLAYED)
  const finalZipStat = fs.statSync(zipFilePath);
  console.log('\n================================================================');
  console.log('             BACKUP COMPLETE & VERIFIED SUCCESSFULLY            ');
  console.log('================================================================');
  console.log(`ZIP File Path   : ${zipFilePath}`);
  console.log(`ZIP File Size   : ${(finalZipStat.size / (1024 * 1024)).toFixed(2)} MB (${finalZipStat.size} bytes)`);
  console.log(`DB Backup Format: ${dbBackupFormat} (database/${dbBackupFileName})`);
  console.log(`Included Files  :`);
  for (const envRel of includedEnvFiles) {
    console.log(`  - ${envRel}`);
  }
  console.log(`  - database/${dbBackupFileName}`);
  console.log('================================================================\n');
}

runBackupProcess();
