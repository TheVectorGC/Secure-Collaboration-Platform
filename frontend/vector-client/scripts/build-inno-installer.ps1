$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$packageJsonPath = Join-Path $projectRoot 'package.json'
$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$appVersion = $packageJson.version
$sourceDirectory = Join-Path $projectRoot 'release\win-unpacked'
$installerScriptPath = Join-Path $projectRoot 'installer\vector.iss'

if (-not (Test-Path (Join-Path $sourceDirectory 'Vector.exe'))) {
    throw "Packaged application was not found at $sourceDirectory. Run npm run package:win first."
}

if (-not (Test-Path $installerScriptPath)) {
    throw "Inno Setup script was not found at $installerScriptPath."
}

$candidateCompilerPaths = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe')
)

$compilerPath = $candidateCompilerPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $compilerPath) {
    $compilerCommand = Get-Command 'iscc' -ErrorAction SilentlyContinue

    if ($compilerCommand) {
        $compilerPath = $compilerCommand.Source
    }
}

if (-not $compilerPath) {
    throw 'Inno Setup compiler was not found. Install Inno Setup 6 first.'
}

Write-Host "Using Inno Setup compiler: $compilerPath"

& $compilerPath "/DAppVersion=$appVersion" "/DSourceDir=$sourceDirectory" $installerScriptPath

Write-Host "Vector installer created in release directory."
