param(
    [switch]$KillNode
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Stopping Vector / Electron processes..." -ForegroundColor Cyan
taskkill /IM Vector.exe /F 2>$null
taskkill /IM electron.exe /F 2>$null

if ($KillNode) {
    Write-Host "Stopping Node processes because -KillNode was specified..." -ForegroundColor Yellow
    taskkill /IM node.exe /F 2>$null
}

Write-Host "Cleaning Vector local user data..." -ForegroundColor Cyan

$paths = @(
    "$env:APPDATA\Vector",
    "$env:LOCALAPPDATA\Vector",

    "$env:APPDATA\vector-client",
    "$env:LOCALAPPDATA\vector-client",

    "$env:APPDATA\vector-client-admin-device",
    "$env:APPDATA\vector-client-ivan-device",
    "$env:APPDATA\vector-client-petr-device",

    "$env:LOCALAPPDATA\vector-client-admin-device",
    "$env:LOCALAPPDATA\vector-client-ivan-device",
    "$env:LOCALAPPDATA\vector-client-petr-device",

    "$env:APPDATA\Electron",
    "$env:LOCALAPPDATA\Electron"
) | Where-Object { $_ -and $_.Trim() -ne "" } | Select-Object -Unique

$removedCount = 0

foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) {
        Write-Host "Removing: $path"
        Remove-Item -LiteralPath $path -Recurse -Force
        $removedCount += 1
    }
}

Write-Host "Done. Removed profile directories: $removedCount" -ForegroundColor Green
Write-Host "The installed application folder was not removed." -ForegroundColor DarkGray
