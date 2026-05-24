$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$releaseDirectory = Join-Path $projectRoot 'release'
$outputDirectory = Join-Path $releaseDirectory 'win-unpacked'
$electronDirectory = Join-Path $projectRoot 'node_modules\electron\dist'
$applicationDirectory = Join-Path $outputDirectory 'resources\app'
$packageJsonPath = Join-Path $projectRoot 'package.json'
$sourcePackage = Get-Content $packageJsonPath -Raw | ConvertFrom-Json

if (-not (Test-Path $electronDirectory)) {
    throw "Electron runtime was not found at $electronDirectory. Run npm install first."
}

if (-not (Test-Path (Join-Path $projectRoot 'dist\index.html'))) {
    throw 'Frontend build was not found. Run npm run build first.'
}

if (Test-Path $outputDirectory) {
    Remove-Item -Recurse -Force $outputDirectory
}

New-Item -ItemType Directory -Force $outputDirectory | Out-Null
Copy-Item -Path (Join-Path $electronDirectory '*') -Destination $outputDirectory -Recurse -Force

$electronExecutablePath = Join-Path $outputDirectory 'electron.exe'
$vectorExecutablePath = Join-Path $outputDirectory 'Vector.exe'

if (Test-Path $vectorExecutablePath) {
    Remove-Item -Force $vectorExecutablePath
}

if (Test-Path $electronExecutablePath) {
    Rename-Item -Path $electronExecutablePath -NewName 'Vector.exe'
}
else {
    throw "Electron executable was not found at $electronExecutablePath."
}

New-Item -ItemType Directory -Force $applicationDirectory | Out-Null

Copy-Item -Path (Join-Path $projectRoot 'dist') -Destination $applicationDirectory -Recurse -Force
Copy-Item -Path (Join-Path $projectRoot 'electron') -Destination $applicationDirectory -Recurse -Force
Copy-Item -Path (Join-Path $projectRoot 'resources') -Destination $applicationDirectory -Recurse -Force
Copy-Item -Path (Join-Path $projectRoot 'node_modules') -Destination $applicationDirectory -Recurse -Force

$runtimePackage = [ordered]@{
    name = $sourcePackage.name
    version = $sourcePackage.version
    main = $sourcePackage.main
    type = $sourcePackage.type
    description = $sourcePackage.description
    author = $sourcePackage.author
}

$runtimePackage | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $applicationDirectory 'package.json') -Encoding UTF8

Write-Host "Vector application package created: $outputDirectory"
