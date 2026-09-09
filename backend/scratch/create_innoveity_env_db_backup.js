const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const BACKUP_DIR = 'D:\\Backups';
const TEMP_DIR = path.join(BACKUP_DIR, 'temp_innoveity_backup');

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

function findEnvFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build' || item === 'temp_innoveity_backup' || item === 'brain') {
      continue;
    }
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findEnvFiles(fullPath, fileList);
    } else if (stat.isFile() && (item === '.env' || item.startsWith('.env.'))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function createBackup() {
  console.log('====================================================');
  console.log('CREATE BACKUP ZIP (ENVIRONMENT + DATABASE ONLY)');
  console.log('====================================================\n');

  try {
    // 1. Ensure D:\Backups exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`Created backup directory: ${BACKUP_DIR}`);
    }

    // Clean any prior temp folder
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    const tempEnvDir = path.join(TEMP_DIR, 'env');
    const tempDbDir = path.join(TEMP_DIR, 'database');
    fs.mkdirSync(tempEnvDir, { recursive: true });
    fs.mkdirSync(tempDbDir, { recursive: true });

    // 2. Find and copy all .env files
    const envFiles = findEnvFiles(PROJECT_ROOT);
    console.log(`Found ${envFiles.length} environment file(s):`);
    
    for (const envFile of envFiles) {
      const relPath = path.relative(PROJECT_ROOT, envFile);
      console.log(`  - ${relPath}`);
      const targetPath = path.join(tempEnvDir, relPath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(envFile, targetPath);
    }

    // 3. PostgreSQL Database Backup
    console.log('\nStarting PostgreSQL database backup of "mrf_crm"...');
    const dbDumpFile = path.join(tempDbDir, 'mrf_crm.backup');

    const pgDumpCmd = `pg_dump -h localhost -p 5432 -U postgres -d mrf_crm -Fc -f "${dbDumpFile}"`;
    execSync(pgDumpCmd, {
      env: { ...process.env, PGPASSWORD: '123' },
      stdio: 'inherit'
    });

    if (!fs.existsSync(dbDumpFile)) {
      throw new Error('Database dump file was not created!');
    }

    const dbStat = fs.statSync(dbDumpFile);
    console.log(`✅ Database dump created successfully: ${dbDumpFile} (${(dbStat.size / 1024 / 1024).toFixed(2)} MB)`);

    // 4. Create ZIP archive
    const timestamp = getTimestamp();
    const zipName = `InnoveityCRM_Backup_${timestamp}.zip`;
    const zipPath = path.join(BACKUP_DIR, zipName);

    console.log(`\nCompressing backup archive to: ${zipPath}...`);
    
    // Powershell Compress-Archive
    const psCmd = `powershell -Command "Compress-Archive -Path '${TEMP_DIR}\\env', '${TEMP_DIR}\\database' -DestinationPath '${zipPath}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });

    if (!fs.existsSync(zipPath)) {
      throw new Error(`Failed to create ZIP file at ${zipPath}`);
    }

    const zipStat = fs.statSync(zipPath);
    const zipSizeMB = (zipStat.size / 1024 / 1024).toFixed(2);

    // 5. Verify ZIP contents using PowerShell
    console.log('\n--- VERIFYING ZIP ARCHIVE CONTENTS ---');
    const verifyCmd = `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${zipPath}').Entries | Select-Object FullName, Length"`;
    const zipEntriesOutput = execSync(verifyCmd).toString();
    console.log(zipEntriesOutput);

    // 6. Clean temporary directory
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    console.log('Cleaned temporary folder.');

    console.log('\n====================================================');
    console.log('BACKUP COMPLETED SUCCESSFULLY');
    console.log('====================================================');
    console.log(`ZIP Path: ${zipPath}`);
    console.log(`ZIP Size: ${zipSizeMB} MB (${zipStat.size} bytes)`);

  } catch (err) {
    console.error('Backup Error:', err);
    process.exit(1);
  }
}

createBackup();
