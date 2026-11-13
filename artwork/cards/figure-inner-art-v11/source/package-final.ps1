$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$artRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $artRoot 'catalog.json') -Raw | ConvertFrom-Json
$verification = Get-Content -LiteralPath (Join-Path $artRoot 'qa/library-verification.json') -Raw | ConvertFrom-Json
if ($manifest.complete -ne 48 -or $manifest.assets.Count -ne 48 -or -not $verification.allComplete) { throw 'The full 48-asset set must pass verification before packaging.' }
$archivePath = Join-Path $artRoot 'everfolk-inner-art-v11.zip'
if (Test-Path -LiteralPath $archivePath) { throw 'Archive exists; preserve it and choose a new version.' }
$zip = [System.IO.Compression.ZipFile]::Open($archivePath,[System.IO.Compression.ZipArchiveMode]::Create)
function Add-Entry([string]$relative,[string]$entry) {
  $full = Join-Path $artRoot $relative
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$full,$entry,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
try {
  foreach ($asset in $manifest.assets) {
    $computed = (Get-FileHash -LiteralPath (Join-Path $artRoot $asset.final) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($computed -ne $asset.finalSha256) { throw ('Final image changed after verification: ' + $asset.slug) }
    Add-Entry $asset.final $asset.final
    Add-Entry $asset.source $asset.source
    Add-Entry $asset.prompt $asset.prompt
    Add-Entry $asset.qa $asset.qa
    Add-Entry $asset.coarseQa $asset.coarseQa
    Add-Entry ('source/' + $asset.slug + '-face.json') ('source/' + $asset.slug + '-face.json')
  }
  Add-Entry 'catalog.json' 'catalog.json'
  Add-Entry 'REFERENCE-NOTES.txt' 'REFERENCE-NOTES.txt'
  Add-Entry 'qa/library-verification.json' 'qa/library-verification.json'
  Add-Entry 'qa/combined-visual-review.json' 'qa/combined-visual-review.json'
  Add-Entry 'review/index.html' 'review/index.html'
  Add-Entry 'review/parent-overview.png' 'review/parent-overview.png'
  Add-Entry 'review/alexander-equipment-proof.png' 'review/alexander-equipment-proof.png'
  Add-Entry 'source/filter-art.ps1' 'source/filter-art.ps1'
  foreach ($manifestName in @('scholarly-manifest.json','craft-civic-manifest.json','command-service-manifest.json')) {
    Add-Entry $manifestName $manifestName
  }
  foreach ($sheet in Get-ChildItem -LiteralPath (Join-Path $artRoot 'review') -Filter 'collection-sheet-*.png') {
    Add-Entry ('review/' + $sheet.Name) ('review/' + $sheet.Name)
  }
  Add-Entry 'references/user-alexander-character-armour.png' 'references/user-alexander-character-armour.png'
  Add-Entry 'references/user-military-equipment-sheet.png' 'references/user-military-equipment-sheet.png'
  Add-Entry 'references/prior-mounted-edit-target-v10.png' 'references/prior-mounted-edit-target-v10.png'
} finally { $zip.Dispose() }
$readback = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $images = @($readback.Entries | Where-Object { $_.FullName -like 'assets/*-pixel.png' })
  if ($images.Count -ne 48) { throw 'Archive readback did not find all 48 final PNGs.' }
  [pscustomobject]@{ Archive=$archivePath; FinalImages=$images.Count; Entries=$readback.Entries.Count; Bytes=(Get-Item -LiteralPath $archivePath).Length } | ConvertTo-Json
} finally { $readback.Dispose() }
