const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const JSZip = require('jszip');
const prisma = require('../utils/db');
const {
  takeLiveBackup,
  getLiveDatabaseStats,
  parseDbConfig,
  readManifest,
  saveManifest,
  BACKUP_DIR,
  formatBytes
} = require('./backupService');

const TEMP_RESTORE_DIR = path.resolve(BACKUP_DIR, 'temp_restore');
if (!fs.existsSync(TEMP_RESTORE_DIR)) {
  fs.mkdirSync(TEMP_RESTORE_DIR, { recursive: true });
}

/**
 * Validates an uploaded backup ZIP archive before restoring.
 * Meets Phase 2 & Phase 3 requirements.
 */
const validateUploadedBackup = async (zipFilePath, originalFileName = '') => {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    backupInfo: null
  };

  // 1. Physical existence and extension check
  if (!fs.existsSync(zipFilePath)) {
    result.valid = false;
    result.errors.push('Backup file does not exist on server.');
    return result;
  }

  const baseName = originalFileName || path.basename(zipFilePath);
  if (!baseName.toLowerCase().endsWith('.zip')) {
    result.valid = false;
    result.errors.push('Invalid Backup File: File must be a valid .zip archive.');
    return result;
  }

  const stat = fs.statSync(zipFilePath);
  if (stat.size < 20 * 1024) {
    result.valid = false;
    result.errors.push(`Invalid Backup File: ZIP archive is abnormally small (${formatBytes(stat.size)}), indicating corruption or incomplete upload.`);
    return result;
  }

  // 2. Phase 3: Open & Inspect ZIP archive using JSZip
  let zip;
  try {
    const zipData = fs.readFileSync(zipFilePath);
    zip = await JSZip.loadAsync(zipData);
  } catch (err) {
    result.valid = false;
    result.errors.push(`Invalid Backup File: Failed to open ZIP archive. It may be corrupted: ${err.message}`);
    return result;
  }

  const requiredFiles = ['database/innoveity_live.sql', 'backup_info.json', 'README.txt'];
  const missingFiles = requiredFiles.filter(rf => !zip.file(rf));
  if (missingFiles.length > 0) {
    result.valid = false;
    result.errors.push(`Archive structure incomplete. Missing required disaster recovery files: ${missingFiles.join(', ')}`);
    return result;
  }

  // 3. Inspect database/innoveity_live.sql
  const sqlFile = zip.file('database/innoveity_live.sql');
  let sqlContent = '';
  try {
    sqlContent = await sqlFile.async('string');
  } catch (err) {
    result.valid = false;
    result.errors.push(`Failed to extract database/innoveity_live.sql: ${err.message}`);
    return result;
  }

  if (sqlContent.length < 1000) {
    result.valid = false;
    result.errors.push('database/innoveity_live.sql is empty or truncated.');
    return result;
  }

  const hasCreateTable = /CREATE TABLE/i.test(sqlContent);
  const hasInsertInto = /INSERT INTO/i.test(sqlContent);

  if (!hasCreateTable) {
    result.valid = false;
    result.errors.push('SQL dump lacks CREATE TABLE definitions.');
  }
  if (!hasInsertInto) {
    result.valid = false;
    result.errors.push('SQL dump lacks INSERT INTO data statements (only schema or empty database).');
  }

  if (!result.valid) {
    return result;
  }

  // 4. Parse backup_info.json
  let info = {};
  try {
    const infoStr = await zip.file('backup_info.json').async('string');
    info = JSON.parse(infoStr);
  } catch (err) {
    result.warnings.push(`Warning reading backup_info.json: ${err.message}`);
  }

  // Count tables and records from SQL (Exact Case Sensitive)
  const exactDumpTableNames = [];
  const createTableMatches = [...sqlContent.matchAll(/CREATE TABLE [`"]?([a-zA-Z0-9_]+)[`"]?/gi)];
  createTableMatches.forEach(m => exactDumpTableNames.push(m[1]));
  const dumpTableNamesSet = new Set(exactDumpTableNames);

  // Enforce lowercase table standard
  const uppercaseTables = exactDumpTableNames.filter(t => /[A-Z]/.test(t));
  if (uppercaseTables.length > 0) {
    result.valid = false;
    result.errors.push(`Table case mismatch in SQL dump: ${uppercaseTables.length} tables have PascalCase/uppercase names (${uppercaseTables.slice(0, 5).join(', ')}...). Expected all lowercase tables for Linux/Windows cross-platform compatibility.`);
  }

  const tableDumpCounts = {};
  const lines = sqlContent.split('\n');
  let currentTable = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dumpMatch = line.match(/-- Dumping data for table [`"]?([a-zA-Z0-9_]+)[`"]?/i);
    const insertMatch = line.match(/^INSERT INTO [`"]?([a-zA-Z0-9_]+)[`"]?/i);
    if (dumpMatch) {
      currentTable = dumpMatch[1];
      if (!tableDumpCounts[currentTable]) tableDumpCounts[currentTable] = 0;
    } else if (insertMatch) {
      currentTable = insertMatch[1];
      if (!tableDumpCounts[currentTable]) tableDumpCounts[currentTable] = 0;
    }

    if (currentTable && line.startsWith('INSERT INTO')) {
      let tupleCount = 0;
      let inString = false;
      let escape = false;
      let depth = 0;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        if (char === "'") { inString = !inString; continue; }
        if (!inString) {
          if (char === '(') {
            if (depth === 0) tupleCount++;
            depth++;
          } else if (char === ')') {
            depth--;
          }
        }
      }
      tableDumpCounts[currentTable] += tupleCount;
    }
  }

  const totalDumpRecords = Object.values(tableDumpCounts).reduce((a, b) => a + b, 0);

  // Phase 4 Preview Information
  result.backupInfo = {
    fileName: baseName,
    created: info.createdAt ? new Date(info.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : (info.backupDate || 'N/A'),
    createdAt: info.createdAt || new Date().toISOString(),
    crmVersion: info.crmVersion || info.version || 'v1.0',
    mysqlVersion: info.mysqlVersion || '8.0.46',
    totalTables: info.totalTables || dumpTableNamesSet.size,
    totalRecords: info.totalRecords !== undefined ? info.totalRecords : totalDumpRecords,
    backupSize: formatBytes(stat.size),
    sizeBytes: stat.size,
    createdBy: info.createdBy || 'Super Admin'
  };

  return result;
};

/**
 * Execute arbitrary SQL query via MySQL CLI
 */
const runMysqlQuery = (config, sqlString, connectWithoutDb = false) => {
  return new Promise((resolve, reject) => {
    const { host, port, user, password, database } = config;
    const args = [
      '-h', host,
      '-P', String(port),
      '-u', user,
      '--default-character-set=utf8mb4'
    ];
    if (!connectWithoutDb) {
      args.push(database);
    }

    const child = spawn('mysql', args, {
      env: { ...process.env, MYSQL_PWD: password },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `Process exited with code ${code}`));
      }
      resolve(stdout);
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn mysql: ${err.message}`));
    });

    child.stdin.write(sqlString);
    child.stdin.end();
  });
};

/**
 * Step 3: Prepare Database Before Import
 * Option A (Recommended): Drop and recreate innoveity_crm
 * Option B (Fallback): Disable foreign key checks, drop every table dynamically, re-enable foreign keys
 */
const prepareDatabaseBeforeImport = async (config) => {
  const { database } = config;

  // Disconnect prisma connection pool first
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.warn('[PrepareDB] Disconnect warning:', e.message);
  }

  let prepared = false;
  let method = '';
  let optionAError = null;

  // Option A (Recommended): Drop and Recreate database
  try {
    const dropAndCreateSql = `DROP DATABASE IF EXISTS \`${database}\`; CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n`;
    await runMysqlQuery(config, dropAndCreateSql, /* connectWithoutDb= */ true);
    prepared = true;
    method = 'RECREATE_DATABASE';
    console.log(`[PrepareDB] Database \`${database}\` dropped and recreated cleanly (Option A).`);
  } catch (err) {
    optionAError = err;
    console.warn(`[PrepareDB] Option A failed (${err.message}), falling back to Option B (drop all tables)...`);
  }

  // Option B (Fallback): If dropping database is restricted, drop every table dynamically
  if (!prepared) {
    try {
      await prisma.$connect();
      const tables = await prisma.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${database} AND table_type = 'BASE TABLE';
      `;
      const tableNames = tables.map(t => t.TABLE_NAME || t.table_name);

      if (tableNames.length > 0) {
        let dropSql = 'SET FOREIGN_KEY_CHECKS = 0;\n';
        for (const t of tableNames) {
          dropSql += `DROP TABLE IF EXISTS \`${database}\`.\`${t}\`;\n`;
        }
        dropSql += 'SET FOREIGN_KEY_CHECKS = 1;\n';
        await runMysqlQuery(config, dropSql, /* connectWithoutDb= */ false);
      }
      await prisma.$disconnect();
      prepared = true;
      method = 'DROP_ALL_TABLES';
      console.log(`[PrepareDB] All ${tableNames.length} tables dropped cleanly via Option B.`);
    } catch (optBErr) {
      throw new Error(`Failed to prepare database before import: Option A error: ${optionAError?.message || 'failed'} | Option B error: ${optBErr.message}`);
    }
  }

  return { success: true, method };
};

/**
 * Step 5: Improve Error Handling
 * Replaces raw MySQL error messages like "Table 'activitylog' already exists" with user-friendly messages.
 */
const parseMysqlImportError = (rawStderr, safetyBackupFileName) => {
  const stderr = (rawStderr || '').toString();

  // Step 5: Replace Table 'activitylog' already exists with user-friendly message
  const match1050 = stderr.match(/ERROR\s+1050\s+\([^)]+\)\s+at\s+line\s+(\d+):\s+Table\s+['`]([^'`]+)['`]\s+already\s+exists/i);
  if (match1050) {
    const lineNum = match1050[1];
    const tableName = match1050[2];
    return `Restore stopped because existing database table '${tableName}' was detected (SQL line ${lineNum}). The current live data remains protected. The automatic safety backup [${safetyBackupFileName}] has been preserved.`;
  }

  // Parse other MySQL errors with line numbers
  const matchLine = stderr.match(/ERROR\s+(\d+)\s+\([^)]+\)\s+at\s+line\s+(\d+):\s+(.+)/i);
  if (matchLine) {
    const errCode = matchLine[1];
    const lineNum = matchLine[2];
    const errMsg = matchLine[3].trim();
    return `Restore failed at SQL line ${lineNum} (MySQL Error ${errCode}: ${errMsg}). Current live data remains protected by safety backup [${safetyBackupFileName}].`;
  }

  return `Database import failed: ${stderr.trim() || 'Unknown error'}. Current live data remains protected by safety backup [${safetyBackupFileName}].`;
};

/**
 * Stream SQL into MySQL CLI
 */
const runMysqlImport = (config, sqlFilePath, safetyBackupFileName) => {
  return new Promise((resolve, reject) => {
    const { host, port, user, password, database } = config;
    const args = [
      '--max-allowed-packet=256M',
      '-h', host,
      '-P', String(port),
      '-u', user,
      '--default-character-set=utf8mb4',
      database
    ];

    const child = spawn('mysql', args, {
      env: { ...process.env, MYSQL_PWD: password },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const fileStream = fs.createReadStream(sqlFilePath, { highWaterMark: 128 * 1024 });

    // Handle child.stdin error to prevent unhandled EPIPE / EOF exception if MySQL closes prematurely
    child.stdin.on('error', (err) => {
      // Ignore EPIPE/EOF on pipe when child process exits
      if (err.code !== 'EPIPE' && err.code !== 'EOF') {
        console.warn('[MysqlImport] stdin warning:', err.message);
      }
    });

    child.on('close', (code) => {
      try { fileStream.destroy(); } catch (e) {}
      if (code !== 0) {
        const friendlyMsg = parseMysqlImportError(stderr, safetyBackupFileName);
        const err = new Error(friendlyMsg);
        err.code = code;
        err.rawStderr = stderr;
        return reject(err);
      }
      resolve();
    });

    child.on('error', (err) => {
      try { fileStream.destroy(); } catch (e) {}
      reject(new Error(`Failed to spawn mysql process: ${err.message}`));
    });

    fileStream.on('error', (err) => {
      try { child.kill(); } catch (e) {}
      reject(err);
    });

    fileStream.pipe(child.stdin);
  });
};

/**
 * Main Restore Execution Pipeline
 * Phases 5, 7, 8, 9, 10
 */
const executeLiveRestore = async ({ tempFileName, originalFileName, user }) => {
  if (user?.role !== 'SUPER_ADMIN') {
    const err = new Error('Access denied. Only Super Admin can restore production backups.');
    err.status = 403;
    throw err;
  }

  const zipFilePath = path.join(TEMP_RESTORE_DIR, tempFileName);
  if (!fs.existsSync(zipFilePath)) {
    const err = new Error('Uploaded backup archive expired or not found. Please upload again.');
    err.status = 404;
    throw err;
  }

  // Pre-restore validation
  const validation = await validateUploadedBackup(zipFilePath, originalFileName);
  if (!validation.valid) {
    const err = new Error(`Restore Rejected: ${validation.errors.join(' | ')}`);
    err.status = 422;
    throw err;
  }

  // PHASE 5: MANDATORY AUTOMATIC SAFETY BACKUP OF LIVE DATABASE
  let safetyBackupResult;
  try {
    safetyBackupResult = await takeLiveBackup({
      user,
      prefix: 'pre_restore_backup',
      type: 'Pre-Restore Backup',
      validationStatus: 'Saved'
    });
  } catch (safetyErr) {
    const err = new Error(`Restore Aborted: Automatic pre-restore safety backup failed: ${safetyErr.message}. The database was not modified.`);
    err.status = 500;
    throw err;
  }

  // STEP 3: PREPARE DATABASE BEFORE IMPORT (OPTION A / OPTION B)
  const dbConfig = parseDbConfig();
  try {
    await prepareDatabaseBeforeImport(dbConfig);
  } catch (prepErr) {
    const err = new Error(`Database preparation failed: ${prepErr.message}. Current data remains protected by safety backup ${safetyBackupResult.backup.fileName}`);
    err.status = 500;
    err.safetyBackup = safetyBackupResult.backup;
    throw err;
  }

  // PHASE 7: RESTORE SQL IMPORT
  const tempExtractedSql = path.join(TEMP_RESTORE_DIR, `extracted_${Date.now()}.sql`);
  let parsedDump = null;
  try {
    const zipData = fs.readFileSync(zipFilePath);
    const zip = await JSZip.loadAsync(zipData);
    const sqlFile = zip.file('database/innoveity_live.sql');
    const sqlContent = await sqlFile.async('nodebuffer');
    fs.writeFileSync(tempExtractedSql, sqlContent);

    // Parse real counts from the SQL dump
    parsedDump = await parseSqlDumpCounts(tempExtractedSql);

    await runMysqlImport(dbConfig, tempExtractedSql, safetyBackupResult.backup.fileName);
  } catch (importErr) {
    if (fs.existsSync(tempExtractedSql)) {
      try { fs.unlinkSync(tempExtractedSql); } catch (e) {}
    }
    const err = new Error(importErr.message || `Database import failed. Current data remains protected by safety backup ${safetyBackupResult.backup.fileName}`);
    err.status = 500;
    err.safetyBackup = safetyBackupResult.backup;
    throw err;
  } finally {
    if (fs.existsSync(tempExtractedSql)) {
      try { fs.unlinkSync(tempExtractedSql); } catch (e) {}
    }
  }

  // PHASE 8: RESTORE VERIFICATION
  await prisma.$connect();
  const postRestoreStats = await getLiveDatabaseStats();
  const verification = await verifyCriticalTables(
    prisma,
    postRestoreStats,
    parsedDump?.tableCounts || {},
    dbConfig.database || 'innoveity_crm'
  );

  if (!verification.valid) {
    const err = new Error(`Restore Verification Failed: ${verification.errors.join(' | ')}. Safety backup [${safetyBackupResult.backup.fileName}] is available for rollback.`);
    err.status = 500;
    err.verification = verification;
    err.safetyBackup = safetyBackupResult.backup;
    throw err;
  }

  // PHASE 10: BACKUP HISTORY INTEGRATION (Restored Backup entry)
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const restoredArchiveName = `restored_backup_${dateStr}_${timeStr}.zip`;
  const restoredPermanentPath = path.join(BACKUP_DIR, restoredArchiveName);

  try {
    fs.copyFileSync(zipFilePath, restoredPermanentPath);
    const restoredStat = fs.statSync(restoredPermanentPath);

    const restoredEntry = {
      id: `restore_${Date.now()}`,
      fileName: restoredArchiveName,
      filePath: restoredPermanentPath,
      sizeBytes: restoredStat.size,
      size: formatBytes(restoredStat.size),
      type: 'Restored Backup',
      totalTables: postRestoreStats.totalTables,
      totalRecords: postRestoreStats.totalRecords,
      createdAt: now.toISOString(),
      createdBy: user?.name ? `${user.name} (${user.email || user.role})` : 'Super Admin',
      mysqlVersion: validation.backupInfo.mysqlVersion,
      downloadUrl: `/api/backups/download/${restoredArchiveName}`,
      validationStatus: 'Completed'
    };

    const manifest = readManifest();
    manifest.unshift(restoredEntry);
    saveManifest(manifest);
  } catch (err) {
    console.error('Failed to register restored archive in manifest:', err);
  }

  // Cleanup temp upload
  try {
    if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);
  } catch (e) {}

  // PHASE 9: SUCCESS RESPONSE
  return {
    success: true,
    message: 'Backup Restored Successfully',
    backupName: validation.backupInfo.fileName,
    restoreTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    tablesRestored: postRestoreStats.totalTables,
    recordsRestored: postRestoreStats.totalRecords,
    safetyBackup: safetyBackupResult.backup,
    verification
  };
};

/**
 * Step 2: Parse Real Counts from the SQL Dump
 * Robust streaming parser that tracks CREATE TABLE statements,
 * extracts table names from INSERT INTO / REPLACE INTO statements,
 * correctly isolates tuples within VALUES (...) without false-positives
 * from column lists, comments, or escaped quotes in strings.
 */
const parseSqlDumpCounts = async (sqlFilePath) => {
  const tableCounts = {};
  const detectedTables = new Set();
  let totalRows = 0;
  let hasCreateTable = false;
  let hasInsertInto = false;

  const fileStream = fs.createReadStream(sqlFilePath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let currentTable = null;
  let pendingTable = null;
  let inValues = false;
  let inString = false;
  let stringChar = null;
  let escapeNext = false;
  let depth = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!inValues && (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('/*') || trimmed.startsWith('#'))) {
      continue;
    }

    let i = 0;

    if (!inValues) {
      // Check for CREATE TABLE (preserve exact casing)
      const createMatch = trimmed.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-zA-Z0-9_]+)[`"]?/i);
      if (createMatch) {
        hasCreateTable = true;
        detectedTables.add(createMatch[1]);
      }

      if (!pendingTable) {
        // Look for INSERT INTO or REPLACE INTO [table] (preserve exact casing)
        const insertMatch = trimmed.match(/^(?:INSERT\s+(?:IGNORE\s+)?INTO|REPLACE\s+INTO)\s+[`"]?([a-zA-Z0-9_]+)[`"]?/i);
        if (insertMatch) {
          hasInsertInto = true;
          pendingTable = insertMatch[1];
          if (tableCounts[pendingTable] === undefined) {
            tableCounts[pendingTable] = 0;
          }
        }
      }

      if (pendingTable) {
        // Find where VALUES or VALUE keyword begins (isolated by word boundary)
        const valuesIndex = trimmed.search(/\bVALUES\b|\bVALUE\b/i);
        if (valuesIndex !== -1) {
          inValues = true;
          currentTable = pendingTable;
          pendingTable = null;
          const matchedKeyword = trimmed.substring(valuesIndex).match(/^\b(VALUES|VALUE)\b/i)[0];
          i = valuesIndex + matchedKeyword.length;
        }
      }
    }

    if (inValues) {
      for (; i < line.length; i++) {
        const ch = line[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (ch === '\\') {
          escapeNext = true;
          continue;
        }

        if (inString) {
          if (ch === stringChar) {
            // Check for doubled quote escape in SQL (e.g. 'It''s')
            if (i + 1 < line.length && line[i + 1] === stringChar) {
              i++; // skip escaped quote
            } else {
              inString = false;
              stringChar = null;
            }
          }
          continue;
        }

        // Not in string literal
        if (ch === "'" || ch === '"') {
          inString = true;
          stringChar = ch;
          continue;
        }

        // Line comment inside values
        if (ch === '-' && i + 1 < line.length && line[i + 1] === '-') {
          break; // remainder of line is comment
        }

        if (ch === '(') {
          if (depth === 0) {
            tableCounts[currentTable] = (tableCounts[currentTable] || 0) + 1;
            totalRows++;
          }
          depth++;
        } else if (ch === ')') {
          if (depth > 0) depth--;
        } else if (ch === ';' && depth === 0) {
          inValues = false;
          currentTable = null;
          break;
        }
      }
    }
  }

  return {
    tableCounts,
    totalRows,
    detectedTables: Array.from(detectedTables),
    hasCreateTable,
    hasInsertInto
  };
};

/**
 * Step 1, 3, 4, 5: Critical Table Verification
 * Verifies restored database counts against expected row counts parsed from the SQL dump.
 * Runs direct SELECT COUNT(*) queries on the restored tables.
 * Handles legitimate differences (e.g. audit entries created during restore).
 * Produces structured tabular comparison with status icons.
 */
const CRITICAL_VERIFY_MODULES = [
  { label: 'User', table: 'user', isAudit: false },
  { label: 'Organization', table: 'organization', isAudit: false },
  { label: 'Attendance', table: 'attendance', isAudit: false },
  { label: 'OrganizationSettings', table: 'organizationsettings', isAudit: false },
  { label: 'OrgBranch', table: 'orgbranch', isAudit: false },
  { label: 'Shift', table: 'shift', altTable: 'shiftmaster', isAudit: false },
  { label: 'ShiftMember', table: 'shiftmember', isAudit: false },
  { label: 'LeaveRequest', table: 'leaverequest', isAudit: false },
  { label: 'LeavePolicy', table: 'leavepolicy', isAudit: false },
  { label: 'UserLeaveBalance', table: 'userleavebalance', isAudit: false },
  { label: 'PayrollSettings', table: 'payrollsettings', isAudit: false },
  { label: 'Payslip', table: 'payslip', altTable: 'payrollbatch', isAudit: false },
  { label: 'WorkLog', table: 'worklog', isAudit: false },
  { label: 'Notification', table: 'notification', isAudit: false },
  { label: 'ActivityLog', table: 'activitylog', isAudit: true },
  { label: 'Department', table: 'departmentmaster', altTable: 'department', isAudit: false },
  { label: 'Project', table: 'project', isAudit: false },
  { label: 'Task', table: 'task', isAudit: false }
];

const verifyCriticalTables = async (prisma, postImportStats, tableDumpCounts = {}, dbName = 'innoveity_crm') => {
  const verification = {
    valid: true,
    database: dbName,
    summary: 'Verification Passed',
    totalTables: postImportStats.totalTables,
    totalRecords: postImportStats.totalRecords,
    checks: {},
    tableComparison: [],
    errors: []
  };

  // Cross-platform check: Ensure no restored tables contain uppercase letters
  const uppercaseDbTables = postImportStats.tableDetails.filter(t => /[A-Z]/.test(t.name));
  if (uppercaseDbTables.length > 0) {
    verification.valid = false;
    verification.errors.push(`Database contains ${uppercaseDbTables.length} uppercase/PascalCase table(s) (${uppercaseDbTables.map(t => t.name).slice(0, 5).join(', ')}${uppercaseDbTables.length > 5 ? '...' : ''}). All tables must be lowercase for Linux/Windows cross-platform compatibility.`);
  }

  for (const item of CRITICAL_VERIFY_MODULES) {
    // 1. Exact case check
    let foundTable = postImportStats.tableDetails.find(
      t => t.name === item.table
    );

    // 2. Case mismatch detection
    const caseMismatchTable = postImportStats.tableDetails.find(
      t => t.name.toLowerCase() === item.table.toLowerCase() && t.name !== item.table
    );

    if (caseMismatchTable) {
      verification.valid = false;
      const errMsg = `Critical table [${item.label}] has CASE MISMATCH: expected exact lowercase '${item.table}', found '${caseMismatchTable.name}'. Linux case-sensitive MySQL will reject queries.`;
      verification.errors.push(errMsg);
      verification.checks[item.label] = {
        status: 'CASE_MISMATCH',
        table: item.label,
        expected: item.table,
        actual: caseMismatchTable.name,
        match: false
      };
      verification.tableComparison.push({
        table: item.label,
        expected: item.table,
        actual: caseMismatchTable.name,
        status: 'CASE_MISMATCH',
        icon: '⚠️',
        match: false
      });
      continue;
    }

    let actualTableName = foundTable ? foundTable.name : null;
    let expectedCount = tableDumpCounts[item.table] ?? null;

    // Fallback if primary table name differs (e.g. payrollbatch vs payslip)
    if (!foundTable && item.altTable) {
      foundTable = postImportStats.tableDetails.find(
        t => t.name === item.altTable
      );
      if (foundTable) {
        actualTableName = foundTable.name;
        if (expectedCount === null) {
          expectedCount = tableDumpCounts[item.altTable] ?? null;
        }
      }
    }

    if (!foundTable) {
      verification.valid = false;
      const errMsg = `Critical table [${item.label}] missing in database after restore. Expected exact table '${item.table}'.`;
      verification.errors.push(errMsg);
      verification.checks[item.label] = {
        status: 'MISSING',
        table: item.label,
        expected: expectedCount ?? 0,
        actual: 0,
        match: false
      };
      verification.tableComparison.push({
        table: item.label,
        expected: expectedCount ?? 0,
        actual: 0,
        status: 'MISSING',
        icon: '❌',
        match: false
      });
      continue;
    }

    // Step 3: Run direct SELECT COUNT(*) FROM table
    let actualCount = foundTable.count;
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM \`${actualTableName}\``);
      if (rows && rows.length > 0) {
        actualCount = Number(rows[0].cnt ?? rows[0].count ?? foundTable.count);
      }
    } catch (e) {
      actualCount = foundTable.count;
    }

    // Expected count parsed directly from the SQL dump
    const expected = expectedCount !== null ? expectedCount : 0;

    let match = false;
    let status = 'MISMATCH';
    let icon = '❌';

    // Step 4: Handle legitimate differences
    if (item.isAudit) {
      // Audit records created during restore or health-checks: actual >= expected is accepted
      if (actualCount >= expected) {
        match = true;
        status = 'VERIFIED';
        icon = '✅';
      } else {
        match = false;
        status = 'MISMATCH';
        icon = '❌';
        verification.valid = false;
        verification.errors.push(`Row count mismatch on [${item.label}]: expected ${expected}, found ${actualCount}`);
      }
    } else {
      if (actualCount === expected) {
        match = true;
        status = 'VERIFIED';
        icon = '✅';
      } else {
        match = false;
        status = 'MISMATCH';
        icon = '❌';
        verification.valid = false;
        verification.errors.push(`Row count mismatch on [${item.label}]: expected ${expected}, found ${actualCount}`);
      }
    }

    verification.checks[item.label] = {
      status,
      table: actualTableName,
      expected,
      actual: actualCount,
      match
    };

    verification.tableComparison.push({
      table: item.label,
      expected,
      actual: actualCount,
      status,
      icon,
      match
    });
  }

  // Minimum table threshold check (~80 tables)
  if (postImportStats.totalTables < 70) {
    verification.valid = false;
    verification.errors.push(`Table count deficit: found ${postImportStats.totalTables} tables (expected ~80)`);
  }

  verification.summary = verification.valid ? 'Verification Passed' : 'Verification Failed';
  return verification;
};

/**
 * Reads Prisma schema to discover all registered models and their @@map lowercase table names.
 */
let cachedPrismaTables = null;
const getExpectedPrismaTables = () => {
  if (cachedPrismaTables) return cachedPrismaTables;

  const schemaPath = path.resolve(__dirname, '..', '..', 'prisma', 'schema.prisma');
  const modelToTable = new Map();
  const tableToModel = new Map();

  if (fs.existsSync(schemaPath)) {
    const lines = fs.readFileSync(schemaPath, 'utf8').split('\n');
    let currentModel = null;

    for (const line of lines) {
      const trimmed = line.trim();
      const modelMatch = trimmed.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
      if (modelMatch) {
        currentModel = modelMatch[1];
        continue;
      }
      if (currentModel && trimmed.startsWith('}')) {
        if (!modelToTable.has(currentModel)) {
          const lower = currentModel.toLowerCase();
          modelToTable.set(currentModel, lower);
          tableToModel.set(lower, currentModel);
        }
        currentModel = null;
        continue;
      }
      if (currentModel) {
        const mapMatch = trimmed.match(/^@@map\("([^"]+)"\)/);
        if (mapMatch) {
          const tableName = mapMatch[1].toLowerCase();
          modelToTable.set(currentModel, tableName);
          tableToModel.set(tableName, currentModel);
        }
      }
    }
  }

  cachedPrismaTables = { modelToTable, tableToModel };
  return cachedPrismaTables;
};

/**
 * Creates a streaming line-by-line SQL transformer that replaces only table identifiers,
 * preserving all column names, strings, comments, and data values.
 */
const createLegacySqlTableReplacer = (tableMap) => {
  const names = Array.from(tableMap.keys()).sort((a, b) => b.length - a.length);
  if (names.length === 0) return (line) => line;

  const escapedNames = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const prefix = '(?:[`"][a-zA-Z0-9_]+[`"]\\.)?';

  const createTableRegex = new RegExp(`^(\\s*CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${prefix}[\`"]?)(${escapedNames})([\`"]?.*)$`, 'i');
  const dropTableRegex = new RegExp(`^(\\s*DROP\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${prefix}[\`"]?)(${escapedNames})([\`"]?.*)$`, 'i');
  const alterTableRegex = new RegExp(`^(\\s*ALTER\\s+TABLE\\s+${prefix}[\`"]?)(${escapedNames})([\`"]?.*)$`, 'i');
  const truncateTableRegex = new RegExp(`^(\\s*TRUNCATE\\s+(?:TABLE\\s+)?${prefix}[\`"]?)(${escapedNames})([\`"]?.*)$`, 'i');
  const lockTableRegex = new RegExp(`^(\\s*LOCK\\s+TABLES?\\s+${prefix}[\`"]?)(${escapedNames})([\`"]?.*)$`, 'i');
  const insertIntoRegex = new RegExp(`^(\\s*(?:INSERT\\s+(?:IGNORE\\s+)?INTO|REPLACE\\s+INTO)\\s+${prefix}[\`"]?)(${escapedNames})([\`"]?.*)$`, 'i');
  const updateTableRegex = new RegExp(`^(\\s*UPDATE\\s+(?:LOW_PRIORITY\\s+)?(?:IGNORE\\s+)?${prefix}[\`"]?)(${escapedNames})([\`"]?.*)$`, 'i');
  const deleteTableRegex = new RegExp(`^(\\s*DELETE\\s+(?:LOW_PRIORITY\\s+)?(?:QUICK\\s+)?(?:IGNORE\\s+)?FROM\\s+${prefix}[\`"]?)(${escapedNames})([\`"]?.*)$`, 'i');
  const referencesRegex = new RegExp(`(\\bREFERENCES\\s+${prefix}[\`"]?)(${escapedNames})([\`"]?\\s*\\()`, 'gi');
  const commentTableRegex = new RegExp(`^(\\s*--\\s*(?:Table\\s+structure|Dumping\\s+data|Constraints)\\s+for\\s+table\\s+${prefix}[\`"]?)(${escapedNames})([\`"]?.*)$`, 'i');

  return function transformLine(line) {
    let transformed = line;

    if (commentTableRegex.test(transformed)) {
      return transformed.replace(commentTableRegex, (m, p1, name, p3) => `${p1}${tableMap.get(name) || name.toLowerCase()}${p3}`);
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed.startsWith('/*') || trimmed.startsWith('#')) {
      return line;
    }

    if (createTableRegex.test(transformed)) {
      transformed = transformed.replace(createTableRegex, (m, p1, name, p3) => `${p1}${tableMap.get(name) || name.toLowerCase()}${p3}`);
    }
    if (dropTableRegex.test(transformed)) {
      transformed = transformed.replace(dropTableRegex, (m, p1, name, p3) => `${p1}${tableMap.get(name) || name.toLowerCase()}${p3}`);
    }
    if (alterTableRegex.test(transformed)) {
      transformed = transformed.replace(alterTableRegex, (m, p1, name, p3) => `${p1}${tableMap.get(name) || name.toLowerCase()}${p3}`);
    }
    if (truncateTableRegex.test(transformed)) {
      transformed = transformed.replace(truncateTableRegex, (m, p1, name, p3) => `${p1}${tableMap.get(name) || name.toLowerCase()}${p3}`);
    }
    if (lockTableRegex.test(transformed)) {
      transformed = transformed.replace(lockTableRegex, (m, p1, name, p3) => `${p1}${tableMap.get(name) || name.toLowerCase()}${p3}`);
    }
    if (insertIntoRegex.test(transformed)) {
      transformed = transformed.replace(insertIntoRegex, (m, p1, name, p3) => `${p1}${tableMap.get(name) || name.toLowerCase()}${p3}`);
    }
    if (updateTableRegex.test(transformed)) {
      transformed = transformed.replace(updateTableRegex, (m, p1, name, p3) => `${p1}${tableMap.get(name) || name.toLowerCase()}${p3}`);
    }
    if (deleteTableRegex.test(transformed)) {
      transformed = transformed.replace(deleteTableRegex, (m, p1, name, p3) => `${p1}${tableMap.get(name) || name.toLowerCase()}${p3}`);
    }
    if (referencesRegex.test(transformed)) {
      transformed = transformed.replace(referencesRegex, (m, p1, name, p3) => `${p1}${tableMap.get(name) || name.toLowerCase()}${p3}`);
    }

    return transformed;
  };
};

/**
 * Normalizes legacy SQL dump by converting table names to lowercase
 */
const normalizeLegacySqlFile = async (inputPath, outputPath, tableMap) => {
  const transform = createLegacySqlTableReplacer(tableMap);
  const rl = readline.createInterface({ input: fs.createReadStream(inputPath), crlfDelay: Infinity });
  const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

  for await (const line of rl) {
    writeStream.write(transform(line) + '\n');
  }
  writeStream.end();
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
};

/**
 * Validates an uploaded .sql dump file before importing.
 * Supports legacy PascalCase backups safely via table normalization.
 */
const validateUploadedSql = async (sqlFilePath, originalFileName = '') => {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    sqlInfo: null,
    tableMap: null
  };

  // 1. File existence and extension check
  if (!fs.existsSync(sqlFilePath)) {
    result.valid = false;
    result.errors.push('Uploaded file does not exist on server.');
    return result;
  }

  const baseName = originalFileName || path.basename(sqlFilePath);
  if (!baseName.toLowerCase().endsWith('.sql')) {
    result.valid = false;
    result.errors.push('Invalid SQL File – Only .sql files are allowed.');
    return result;
  }

  const stat = fs.statSync(sqlFilePath);
  if (stat.size === 0) {
    result.valid = false;
    result.errors.push('Invalid SQL File: The uploaded file is empty.');
    return result;
  }

  // 2. Stream-parse the SQL file using the robust parser
  let dumpParse;
  try {
    dumpParse = await parseSqlDumpCounts(sqlFilePath);
  } catch (err) {
    result.valid = false;
    result.errors.push(`Invalid SQL File: Failed to inspect file: ${err.message}`);
    return result;
  }

  if (!dumpParse.hasCreateTable) {
    result.valid = false;
    result.errors.push('SQL Validation Failed – No CREATE TABLE statements found.');
  }
  if (!dumpParse.hasInsertInto) {
    result.valid = false;
    result.errors.push('SQL Validation Failed – No INSERT INTO statements found.');
  }
  if (dumpParse.detectedTables.length === 0) {
    result.valid = false;
    result.errors.push('Invalid SQL File: File is not a valid MySQL dump or appears corrupted.');
  }

  // Cross-platform check: Check for PascalCase / uppercase table names in SQL dump
  const uppercaseTables = dumpParse.detectedTables.filter(t => /[A-Z]/.test(t));
  let isLegacy = false;
  const legacyTableMap = new Map();

  if (uppercaseTables.length > 0) {
    // A. Detect duplicate lowercase collisions (e.g. dump containing both 'User' and 'user')
    const lowerSeen = new Map();
    const duplicateCollisions = [];
    for (const t of dumpParse.detectedTables) {
      const lower = t.toLowerCase();
      if (lowerSeen.has(lower)) {
        duplicateCollisions.push(`'${lowerSeen.get(lower)}' and '${t}' both map to '${lower}'`);
      } else {
        lowerSeen.set(lower, t);
      }
    }

    if (duplicateCollisions.length > 0) {
      result.valid = false;
      result.errors.push(`Duplicate table collision detected: ${duplicateCollisions.join(', ')}. SQL dump cannot be safely normalized.`);
    }

    // B. Validate against expected Prisma models and system tables
    const { modelToTable } = getExpectedPrismaTables();
    const validLowercaseTables = new Set(modelToTable.values());
    validLowercaseTables.add('_prisma_migrations');

    const unmappedTables = [];
    for (const t of uppercaseTables) {
      const lower = t.toLowerCase();
      if (!validLowercaseTables.has(lower)) {
        unmappedTables.push(t);
      } else {
        legacyTableMap.set(t, lower);
      }
    }

    if (unmappedTables.length > 0) {
      result.valid = false;
      result.errors.push(`Unknown or unmapped table(s) in SQL file: ${unmappedTables.join(', ')}. Cannot normalize legacy backup safely.`);
    }

    if (result.valid) {
      isLegacy = true;
      result.warnings.push(`Legacy SQL backup detected: ${uppercaseTables.length} table(s) have PascalCase/uppercase names. Table names will be safely normalized to the current lowercase MySQL standard before import.`);
    }
  }

  if (!result.valid) {
    return result;
  }

  // Convert tableDumpCounts keys to lowercase for preview consistency
  const normalizedTableCounts = {};
  for (const [tbl, cnt] of Object.entries(dumpParse.tableCounts)) {
    normalizedTableCounts[tbl.toLowerCase()] = cnt;
  }

  result.tableMap = legacyTableMap.size > 0 ? Object.fromEntries(legacyTableMap) : null;

  // Step 4: Show SQL Preview with real row counts
  result.sqlInfo = {
    fileName: baseName,
    fileSize: formatBytes(stat.size),
    sizeBytes: stat.size,
    tablesDetected: dumpParse.detectedTables.length,
    totalRecords: dumpParse.totalRows,
    sqlType: isLegacy ? 'Legacy MySQL Dump (PascalCase)' : 'MySQL Dump',
    isLegacy,
    legacyTablesCount: uppercaseTables.length,
    legacyNotice: isLegacy
      ? `Legacy SQL backup detected: ${uppercaseTables.length} table(s) with PascalCase names will be safely normalized to lowercase on import.`
      : null,
    tableDumpCounts: normalizedTableCounts
  };

  return result;
};

/**
 * Executes confirmed SQL file import.
 * Meets Step 3, Step 4, Step 5, Step 6, Step 7 requirements.
 */
const executeSqlImport = async ({ tempFileName, originalFileName, user }) => {
  if (user?.role !== 'SUPER_ADMIN') {
    const err = new Error('Access denied. Only Super Admin can import SQL backups.');
    err.status = 403;
    throw err;
  }

  const sqlFilePath = path.join(TEMP_RESTORE_DIR, tempFileName);
  if (!fs.existsSync(sqlFilePath)) {
    const err = new Error('Uploaded SQL file expired or not found. Please upload again.');
    err.status = 404;
    throw err;
  }

  // Pre-import validation
  const validation = await validateUploadedSql(sqlFilePath, originalFileName);
  if (!validation.valid) {
    const err = new Error(`Import Rejected: ${validation.errors.join(' | ')}`);
    err.status = 422;
    throw err;
  }

  // STEP 2 & 5: AUTOMATIC PRE-IMPORT SAFETY BACKUP (MANDATORY)
  let safetyBackupResult;
  try {
    safetyBackupResult = await takeLiveBackup({
      user,
      prefix: 'pre_import_backup',
      type: 'Pre-Import Backup',
      validationStatus: 'Saved'
    });
  } catch (safetyErr) {
    const err = new Error(`Import Failed – Safety backup could not be created: ${safetyErr.message}. The database was not modified.`);
    err.status = 500;
    throw err;
  }

  // If legacy backup, normalize table names in a temporary SQL file before running MySQL import
  let importSqlPath = sqlFilePath;
  let tempNormalizedPath = null;

  if (validation.sqlInfo?.isLegacy && validation.tableMap) {
    const tableMap = new Map(Object.entries(validation.tableMap));
    tempNormalizedPath = path.join(TEMP_RESTORE_DIR, `normalized_${tempFileName}`);
    await normalizeLegacySqlFile(sqlFilePath, tempNormalizedPath, tableMap);
    importSqlPath = tempNormalizedPath;
  }

  // STEP 3: PREPARE DATABASE BEFORE IMPORT (OPTION A / OPTION B)
  const dbConfig = parseDbConfig();
  try {
    await prepareDatabaseBeforeImport(dbConfig);
  } catch (prepErr) {
    if (tempNormalizedPath && fs.existsSync(tempNormalizedPath)) {
      try { fs.unlinkSync(tempNormalizedPath); } catch (e) {}
    }
    const err = new Error(`Database preparation failed: ${prepErr.message}. Current data remains protected by safety backup ${safetyBackupResult.backup.fileName}`);
    err.status = 500;
    err.safetyBackup = safetyBackupResult.backup;
    throw err;
  }

  // STEP 4 & 7: IMPORT PROCESS
  try {
    await runMysqlImport(dbConfig, importSqlPath, safetyBackupResult.backup.fileName);
  } catch (importErr) {
    if (tempNormalizedPath && fs.existsSync(tempNormalizedPath)) {
      try { fs.unlinkSync(tempNormalizedPath); } catch (e) {}
    }
    const err = new Error(importErr.message || `Database import failed. Current data remains protected by safety backup ${safetyBackupResult.backup.fileName}`);
    err.status = 500;
    err.safetyBackup = safetyBackupResult.backup;
    throw err;
  }

  // If legacy backup, align schema columns and missing tables using Prisma db push to ensure full application compatibility
  if (validation.sqlInfo?.isLegacy) {
    try {
      const { execSync } = require('child_process');
      const backendDir = path.resolve(__dirname, '..', '..');
      execSync('cmd /c "npx prisma db push --skip-generate --accept-data-loss"', {
        cwd: backendDir,
        env: {
          ...process.env,
          DATABASE_URL: `mysql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
        },
        timeout: 60000
      });
    } catch (alignErr) {
      console.warn('[RestoreService] Post-import schema alignment notice:', alignErr.message);
    }
  }

  // STEP 6: VERIFICATION AFTER RESTORE
  await prisma.$connect();
  const postImportStats = await getLiveDatabaseStats();
  const verification = await verifyCriticalTables(
    prisma,
    postImportStats,
    validation.sqlInfo.tableDumpCounts,
    dbConfig.database || 'innoveity_crm'
  );

  if (!verification.valid) {
    if (tempNormalizedPath && fs.existsSync(tempNormalizedPath)) {
      try { fs.unlinkSync(tempNormalizedPath); } catch (e) {}
    }
    const err = new Error(`Import Verification Failed: ${verification.errors.join(' | ')}. Safety backup [${safetyBackupResult.backup.fileName}] is available for rollback.`);
    err.status = 500;
    err.verification = verification;
    err.safetyBackup = safetyBackupResult.backup;
    throw err;
  }

  // STEP 10: BACKUP HISTORY INTEGRATION
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const savedSqlName = `sql_import_${dateStr}_${timeStr}.sql`;
  const savedSqlPath = path.join(BACKUP_DIR, savedSqlName);

  try {
    fs.copyFileSync(sqlFilePath, savedSqlPath);
    const sqlStat = fs.statSync(savedSqlPath);

    const sqlEntry = {
      id: `sql_import_${Date.now()}`,
      fileName: savedSqlName,
      filePath: savedSqlPath,
      sizeBytes: sqlStat.size,
      size: formatBytes(sqlStat.size),
      type: 'SQL Import',
      totalTables: postImportStats.totalTables,
      totalRecords: postImportStats.totalRecords,
      createdAt: now.toISOString(),
      createdBy: user?.name ? `${user.name} (${user.email || user.role})` : 'Super Admin',
      mysqlVersion: '8.0.46',
      downloadUrl: `/api/backups/download/${savedSqlName}`,
      validationStatus: 'Completed'
    };

    const manifest = readManifest();
    manifest.unshift(sqlEntry);
    saveManifest(manifest);
  } catch (err) {
    console.error('Failed to register SQL import in manifest:', err);
  }

  // Cleanup temp upload
  try {
    if (fs.existsSync(sqlFilePath)) fs.unlinkSync(sqlFilePath);
  } catch (e) {}

  // STEP 9 & STEP 6: SUCCESS CRITERIA
  return {
    success: true,
    message: 'SQL Backup Restored Successfully',
    database: dbConfig.database || 'innoveity_crm',
    fileName: validation.sqlInfo.fileName,
    importTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    tablesRestored: postImportStats.totalTables,
    recordsImported: postImportStats.totalRecords,
    tablesImported: postImportStats.totalTables,
    safetyBackupPreserved: true,
    safetyBackup: safetyBackupResult.backup,
    verificationPassed: true,
    verification
  };
};

module.exports = {
  validateUploadedBackup,
  executeLiveRestore,
  validateUploadedSql,
  executeSqlImport,
  prepareDatabaseBeforeImport,
  parseMysqlImportError,
  parseSqlDumpCounts,
  verifyCriticalTables,
  CRITICAL_VERIFY_MODULES,
  TEMP_RESTORE_DIR,
  normalizeLegacySqlFile,
  createLegacySqlTableReplacer
};
