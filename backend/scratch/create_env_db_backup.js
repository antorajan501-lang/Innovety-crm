const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = 'd:\\P R O J E C T S\\Web\\MRF-crm';
const BACKUPS_DIR = 'D:\\Backups';
const TEMP_DIR = path.join(BACKUPS_DIR, 'temp_innoveity_backup');
const ENV_TEMP_DIR = path.join(TEMP_DIR, 'env');
const DB_TEMP_DIR = path.join(TEMP_DIR, 'database');

function getFormattedTimestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

function findEnvFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'temp_innoveity_backup'].includes(item)) {
      continue;
    }
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findEnvFiles(fullPath, fileList);
    } else if (item === '.env' || item.startsWith('.env.')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function runBackupProcess() {
  console.log('================================================================');
  console.log('        INNOVEITY CRM — ENV + DATABASE BACKUP PROCESS           ');
  console.log('================================================================\n');

  // Step 1: Create Backup Directories
  console.log('1. Preparing Backup Folders...');
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log(`  ✓ Created directory: ${BACKUPS_DIR}`);
  }

  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(ENV_TEMP_DIR, { recursive: true });
  fs.mkdirSync(DB_TEMP_DIR, { recursive: true });
  console.log(`  ✓ Temporary backup structure created at: ${TEMP_DIR}`);

  // Step 2: Collect Environment Files
  console.log('\n2. Collecting Environment (.env*) Files...');
  const envFiles = findEnvFiles(PROJECT_ROOT);
  console.log(`  Found ${envFiles.length} env file(s):`);

  const copiedEnvFiles = [];
  for (const envFile of envFiles) {
    const relPath = path.relative(PROJECT_ROOT, envFile);
    const targetPath = path.join(ENV_TEMP_DIR, relPath);
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.copyFileSync(envFile, targetPath);
    console.log(`  - ${relPath} -> env/${relPath.replace(/\\/g, '/')}`);
    copiedEnvFiles.push(relPath);
  }

  // Step 3: Export PostgreSQL Database Dump
  console.log('\n3. Exporting PostgreSQL Database (mrf_crm)...');
  const dbDumpFile = path.join(DB_TEMP_DIR, 'mrf_crm_backup.dump');
  
  // Set PGPASSWORD environment variable
  const envVars = { ...process.env, PGPASSWORD: '123' };
  const dumpCmd = `pg_dump -h localhost -p 5432 -U postgres -d mrf_crm -Fc -f "${dbDumpFile}"`;

  try {
    execSync(dumpCmd, { env: envVars, stdio: 'inherit' });
    const stats = fs.statSync(dbDumpFile);
    console.log(`  ✓ Database dump generated successfully: database/mrf_crm_backup.dump (${(stats.size / 1024).toFixed(2)} KB)`);
  } catch (err) {
    console.error('❌ pg_dump failed:', err.message);
    process.exit(1);
  }

  // Step 4: Create Timestamped ZIP Archive
  const timestamp = getFormattedTimestamp();
  const zipFileName = `Innoveity_CRM_Backup_${timestamp}.zip`;
  const zipFilePath = path.join(BACKUPS_DIR, zipFileName);

  console.log(`\n4. Creating ZIP Archive: ${zipFileName}...`);

  const psCompressCmd = `powershell -Command "Compress-Archive -Path '${path.join(TEMP_DIR, '*')}' -DestinationPath '${zipFilePath}' -Force"`;
  try {
    execSync(psCompressCmd, { stdio: 'inherit' });
    const zipStats = fs.statSync(zipFilePath);
    console.log(`  ✓ ZIP Archive created successfully (${(zipStats.size / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (err) {
    console.error('❌ Compression failed:', err.message);
    process.exit(1);
  }

  // Step 5: Clean Up Temp Folder
  console.log('\n5. Cleaning Up Temporary Files...');
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log(`  ✓ Temporary directory ${TEMP_DIR} removed.`);

  // Final Summary Output
  console.log('\n================================================================');
  console.log('               BACKUP COMPLETED SUCCESSFULLY                    ');
  console.log('================================================================');
  console.log(`\nLocation:\n${zipFilePath}`);
  console.log('\nIncluded:');
  copiedEnvFiles.forEach(f => console.log(`  ✓ ${f}`));
  console.log('  ✓ PostgreSQL Database Dump (database/mrf_crm_backup.dump)');
  console.log('\nTemporary files cleaned up successfully.\n');
}

runBackupProcess();
