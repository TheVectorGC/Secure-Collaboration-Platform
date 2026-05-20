$ErrorActionPreference = "SilentlyContinue"

Write-Host "Stopping Electron / Node processes..." -ForegroundColor Cyan
taskkill /IM electron.exe /F 2>$null
taskkill /IM node.exe /F 2>$null

Write-Host "Cleaning Vector Electron profiles..." -ForegroundColor Cyan

$paths = @(
    "$env:APPDATA\vector-client-admin-device",
    "$env:APPDATA\vector-client-ivan-device",
    "$env:APPDATA\vector-client-petr-device",

    "$env:LOCALAPPDATA\vector-client-admin-device",
    "$env:LOCALAPPDATA\vector-client-ivan-device",
    "$env:LOCALAPPDATA\vector-client-petr-device",

    "$env:APPDATA\vector-client",
    "$env:LOCALAPPDATA\vector-client"
)

foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) {
        Write-Host "Removing: $path"
        Remove-Item -LiteralPath $path -Recurse -Force
    }
}

Write-Host "Cleaning possible Electron default storage..." -ForegroundColor Cyan

$electronPaths = @(
    "$env:APPDATA\Electron",
    "$env:LOCALAPPDATA\Electron"
)

foreach ($path in $electronPaths) {
    if (Test-Path -LiteralPath $path) {
        Write-Host "Removing: $path"
        Remove-Item -LiteralPath $path -Recurse -Force
    }
}

Write-Host "Done. Electron local storage has been cleaned." -ForegroundColor Green