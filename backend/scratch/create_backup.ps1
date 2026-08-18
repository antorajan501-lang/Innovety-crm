$env:PGPASSWORD = '123'
$pgDumpPath = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"

Write-Host "1. Exporting PostgreSQL database to D:\mrf_crm_backup.sql..."
& $pgDumpPath -U postgres -h localhost -p 5432 -d mrf_crm -f D:\mrf_crm_backup.sql

if (Test-Path D:\mrf_crm_backup.sql) {
    $sqlSize = (Get-Item D:\mrf_crm_backup.sql).Length
    Write-Host "Database export succeeded! File size: $sqlSize bytes."
} else {
    Write-Error "Database export failed!"
    exit 1
}

$backupFolder = "D:\MRF_CRM_LIVE_BACKUP"
Write-Host "2. Creating temporary backup directory: $backupFolder..."
if (Test-Path $backupFolder) {
    Remove-Item $backupFolder -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $backupFolder | Out-Null

Write-Host "3. Copying Backend & Frontend configuration and lock files..."
Copy-Item backend\.env $backupFolder
Copy-Item backend\prisma\schema.prisma $backupFolder
Copy-Item backend\package.json $backupFolder
Copy-Item backend\package-lock.json $backupFolder

if (Test-Path frontend\.env) {
    Copy-Item frontend\.env $backupFolder -ErrorAction SilentlyContinue
}
Copy-Item frontend\package.json $backupFolder
Copy-Item frontend\package-lock.json $backupFolder

Copy-Item D:\mrf_crm_backup.sql $backupFolder

$timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$zipPath = "D:\MRF_CRM_LIVE_BACKUP_$timestamp.zip"

Write-Host "4. Creating production backup ZIP: $zipPath..."
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path "$backupFolder\*" -DestinationPath $zipPath -Force

if (Test-Path $zipPath) {
    $zipItem = Get-Item $zipPath
    Write-Host "`n========================================================"
    Write-Host "SUCCESS: Production Backup ZIP Created Successfully!"
    Write-Host "File Name: $($zipItem.Name)"
    Write-Host "Full Path: $($zipItem.FullName)"
    Write-Host "File Size: $($zipItem.Length) bytes"
    Write-Host "Created At: $($zipItem.CreationTime)"
    Write-Host "========================================================"

    Write-Host "`n5. Verifying ZIP contents:"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    foreach ($entry in $zip.Entries) {
        Write-Host "  - $($entry.FullName) ($($entry.Length) bytes)"
    }
    $zip.Dispose()
} else {
    Write-Error "ZIP creation failed!"
    exit 1
}
