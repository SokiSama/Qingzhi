$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'extension\manifest.json') -Raw | ConvertFrom-Json
$version = $manifest.version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid extension version' }
$distRoot = Join-Path $projectRoot 'dist'
$stageRoot = [System.IO.Path]::GetFullPath((Join-Path $distRoot ('package-v' + $version)))
$distPrefix = [System.IO.Path]::GetFullPath($distRoot) + [System.IO.Path]::DirectorySeparatorChar
if (-not $stageRoot.StartsWith($distPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Package staging path must stay inside dist'
}
if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
$packageRoot = Join-Path $stageRoot '轻知'
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'extension') -Destination $packageRoot -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'README.md') -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs') -Destination $packageRoot -Recurse
$archivePath = Join-Path $distRoot ('轻知-' + $version + '.zip')
Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath -Force

# Check every file, including screenshots, against its archived bytes.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    foreach ($sourceFile in Get-ChildItem -LiteralPath $packageRoot -Recurse -File) {
        $relativePath = [System.IO.Path]::GetRelativePath($packageRoot, $sourceFile.FullName).Replace('\', '/')
        $entry = $archive.GetEntry('轻知/' + $relativePath)
        if (-not $entry) { throw ('Missing archive entry: ' + $relativePath) }
        $stream = $entry.Open()
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $entryHash = [System.Convert]::ToHexString($sha.ComputeHash($stream)) }
        finally { $sha.Dispose(); $stream.Dispose() }
        if ($entryHash -ne (Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash) {
            throw ('Archive content mismatch: ' + $relativePath)
        }
    }
    Write-Output ('Verified package entries: ' + $archive.Entries.Count)
} finally { $archive.Dispose() }
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$checksumPath = $archivePath + '.sha256'
Set-Content -LiteralPath $checksumPath -Value ($archiveHash + '  ' + [System.IO.Path]::GetFileName($archivePath)) -Encoding utf8NoBOM
Write-Output $archivePath
Write-Output $checksumPath
