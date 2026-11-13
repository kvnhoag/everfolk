$ErrorActionPreference = 'Stop'
$cardRoot = Split-Path -Parent $PSScriptRoot
& 'C:/Users/Legion/.codex/runtimes/nature-skills/venv/Scripts/python.exe' 'C:/Users/Legion/.codex/skills/everfolk-asset-workflow/scripts/pixelate.py' --input (Join-Path $cardRoot 'source/alexander-blade-revised.png') --output (Join-Path $cardRoot 'assets/alexander-card-pixel.png') --runtime 'D:/Hustle/Games/Historical Lives/artifacts/pixeloe-runtime/site-packages' --logical-width 420 --logical-height 525 --scale 2 --qa (Join-Path $cardRoot 'qa/portrait-pixel.json')
if ($LASTEXITCODE -ne 0) { throw 'PixelOE finish failed.' }
