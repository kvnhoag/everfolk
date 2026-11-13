$ErrorActionPreference = 'Stop'
$cardRoot = Split-Path -Parent $PSScriptRoot
& 'C:/Users/Legion/.codex/runtimes/nature-skills/venv/Scripts/python.exe' 'C:/Users/Legion/.codex/skills/everfolk-asset-workflow/scripts/pixelate.py' --input (Join-Path $cardRoot 'source/alexander-blade-only.png') --output (Join-Path $cardRoot 'assets/alexander-card-pixel.png') --runtime 'D:/Hustle/Games/Historical Lives/artifacts/pixeloe-runtime/site-packages' --logical-width 280 --logical-height 350 --scale 3 --qa (Join-Path $cardRoot 'qa/portrait-pixel.json')
if ($LASTEXITCODE -ne 0) { throw 'Coarse PixelOE finish failed.' }
