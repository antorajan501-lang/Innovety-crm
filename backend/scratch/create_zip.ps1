$stagingDir = "D:\P R O J E C T S\Web\staging_deployment"
$zipPath = "D:\P R O J E C T S\Web\MRF-CRM-Live-Deployment.zip"

if (Test-Path $stagingDir) { Remove-Item -Path $stagingDir -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force }

New-Item -ItemType Directory -Path "$stagingDir\backend" -Force | Out-Null
New-Item -ItemType Directory -Path "$stagingDir\frontend" -Force | Out-Null

# Copy Backend Files
Copy-Item "D:\P R O J E C T S\Web\MRF-crm\backend\.env" -Destination "$stagingDir\backend\.env"
Copy-Item "D:\P R O J E C T S\Web\MRF-crm\backend\package.json" -Destination "$stagingDir\backend\package.json"
Copy-Item "D:\P R O J E C T S\Web\MRF-crm\backend\package-lock.json" -Destination "$stagingDir\backend\package-lock.json"
Copy-Item "D:\P R O J E C T S\Web\MRF-crm\backend\prisma" -Destination "$stagingDir\backend\prisma" -Recurse

# Create Frontend Environment
$frontendEnvContent = "VITE_API_URL=/api`nNODE_ENV=production"
Set-Content -Path "$stagingDir\frontend\.env.production" -Value $frontendEnvContent

# Create ZIP Package
Compress-Archive -Path "$stagingDir\backend", "$stagingDir\frontend" -DestinationPath $zipPath -Force

# Clean up Staging Directory
Remove-Item -Path $stagingDir -Recurse -Force

Write-Host "ZIP created successfully at: $zipPath"
