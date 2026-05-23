$ErrorActionPreference = "Stop"

Write-Host "Vector desktop build" -ForegroundColor Cyan
Write-Host "Installing dependencies..." -ForegroundColor DarkCyan
npm install

Write-Host "Building React application..." -ForegroundColor DarkCyan
npm run build

Write-Host "Creating Windows installer..." -ForegroundColor DarkCyan
npx electron-builder --win nsis --x64

Write-Host "Done. Installer is in the release directory." -ForegroundColor Green
