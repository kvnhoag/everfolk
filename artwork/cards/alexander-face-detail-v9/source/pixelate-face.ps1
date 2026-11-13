param([switch]$Overwrite)
$ErrorActionPreference = 'Stop'
$cardRoot = Split-Path -Parent $PSScriptRoot
$filterArgs = @(
  '--input', (Join-Path $cardRoot 'source/alexander-painting.png'),
  '--base', (Join-Path $cardRoot 'assets/alexander-card-pixel-coarse.png'),
  '--base-qa', (Join-Path $cardRoot 'qa/coarse-base.json'),
  '--config', (Join-Path $cardRoot 'source/face-detail-config.json'),
  '--runtime', 'D:/Hustle/Games/Historical Lives/artifacts/pixeloe-runtime/site-packages',
  '--output', (Join-Path $cardRoot 'assets/alexander-card-pixel.png'),
  '--qa', (Join-Path $cardRoot 'qa/face-detail.json'),
  '--mask', (Join-Path $cardRoot 'qa/face-detail-mask.png'),
  '--detail-output', (Join-Path $cardRoot 'qa/portrait-detail-pass.png')
)
if ($Overwrite) { $filterArgs += '--overwrite' }
& 'C:/Users/Legion/.codex/runtimes/nature-skills/venv/Scripts/python.exe' 'C:/Users/Legion/.codex/skills/everfolk-asset-workflow/scripts/pixelate_regions.py' @filterArgs
if ($LASTEXITCODE -ne 0) { throw 'Regional face-detail calibration failed.' }
