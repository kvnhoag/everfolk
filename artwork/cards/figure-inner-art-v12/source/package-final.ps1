$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$artRoot = Split-Path -Parent $PSScriptRoot
$catalogue = Get-Content -LiteralPath (Join-Path $artRoot 'catalog.json') -Raw | ConvertFrom-Json
$verification = Get-Content -LiteralPath (Join-Path $artRoot 'qa/library-verification.json') -Raw | ConvertFrom-Json
if ($catalogue.complete -ne 83 -or $catalogue.pairedRoles -ne 35 -or -not $verification.allComplete) { throw 'All83 assets and35 gender pairs must pass verification first.' }
$archivePath = Join-Path $artRoot 'everfolk-inner-art-v12.zip'
if (Test-Path -LiteralPath $archivePath) { throw 'Preserve the existing archive and choose a new version.' }
$zip = [System.IO.Compression.ZipFile]::Open($archivePath,[System.IO.Compression.ZipArchiveMode]::Create)
$addedEntries = New-Object 'System.Collections.Generic.HashSet[string]'
function Add-Entry([string]$relative) {
  if (-not $addedEntries.Add($relative)) { return }
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $artRoot $relative),$relative,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
try {
  foreach ($asset in $catalogue.assets) {
    $actual = (Get-FileHash -LiteralPath (Join-Path $artRoot $asset.final) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $asset.finalSha256) { throw ('Image changed after verification: ' + $asset.slug) }
    foreach ($entry in @($asset.final,$asset.source,$asset.prompt,$asset.qa,$asset.coarseQa,$asset.faceConfig)) { Add-Entry $entry }
  }
  foreach ($entry in @('catalog.json','reuse-manifest.json','scholarly-manifest.json','craft-civic-manifest.json','command-service-manifest.json','REFERENCE-NOTES.txt','qa/library-verification.json','qa/combined-visual-review.json','source/filter-art.ps1','review/index.html')) { Add-Entry $entry }
  foreach ($image in Get-ChildItem -LiteralPath (Join-Path $artRoot 'review') -Filter '*.png') { Add-Entry ('review/' + $image.Name) }
  foreach ($image in Get-ChildItem -LiteralPath (Join-Path $artRoot 'references') -Filter '*.png') { Add-Entry ('references/' + $image.Name) }
  foreach ($report in Get-ChildItem -LiteralPath (Join-Path $artRoot 'qa') -Filter '*.json') { Add-Entry ('qa/' + $report.Name) }
} finally { $zip.Dispose() }
$reader = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $finals = @($reader.Entries | Where-Object { $_.FullName -like 'assets/*-pixel.png' })
  $male = @($finals | Where-Object { $_.FullName -like '*-male-pixel.png' })
  $female = @($finals | Where-Object { $_.FullName -like '*-female-pixel.png' })
  if ($finals.Count -ne 83 -or $male.Count -ne 35 -or $female.Count -ne 35) { throw 'Archive role/gender readback failed.' }
  [pscustomobject]@{Archive=$archivePath;FinalImages=$finals.Count;MaleSubcards=$male.Count;FemaleSubcards=$female.Count;Entries=$reader.Entries.Count;Bytes=(Get-Item -LiteralPath $archivePath).Length} | ConvertTo-Json
} finally { $reader.Dispose() }
