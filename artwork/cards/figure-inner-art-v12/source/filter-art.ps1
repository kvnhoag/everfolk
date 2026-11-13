param(
  [Parameter(Mandatory=$true)][string]$Slug,
  [Parameter(Mandatory=$true)][int]$FaceX,
  [Parameter(Mandatory=$true)][int]$FaceY,
  [int]$RadiusX = 82,
  [int]$RadiusY = 96
)
$ErrorActionPreference = 'Stop'
$artRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = 'C:/Users/Legion/.codex/runtimes/nature-skills/venv/Scripts/python.exe'
$runtimeDir = 'D:/Hustle/Games/Historical Lives/artifacts/pixeloe-runtime/site-packages'
$skillScripts = 'C:/Users/Legion/.codex/skills/everfolk-asset-workflow/scripts'
$painting = Join-Path $PSScriptRoot ($Slug + '.png')
$coarse = Join-Path $artRoot ('assets/' + $Slug + '-coarse.png')
$coarseQa = Join-Path $artRoot ('qa/' + $Slug + '-coarse.json')
$regionalConfig = Join-Path $PSScriptRoot ($Slug + '-face.json')
$final = Join-Path $artRoot ('assets/' + $Slug + '-pixel.png')
$qa = Join-Path $artRoot ('qa/' + $Slug + '-pixel.json')
if (-not (Test-Path -LiteralPath $painting)) { throw ('Missing source: ' + $painting) }
@{
  base_pixel_size = 3; detail_pixel_size = 2; detail_outline_thickness = 0
  regions = @(@{name='face-eyes';center=@($FaceX,$FaceY);radius=@($RadiusX,$RadiusY);inner_scale=0.82})
  critical_boxes = @()
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $regionalConfig -Encoding utf8
# Restrict this task-owned Python process's CPU thread counts during parallel art production.
$env:OMP_NUM_THREADS = '2'
$env:MKL_NUM_THREADS = '2'
& $pythonExe (Join-Path $skillScripts 'pixelate.py') --input $painting --output $coarse --runtime $runtimeDir --logical-width 280 --logical-height 350 --scale 3 --qa $coarseQa
if ($LASTEXITCODE -ne 0) { throw ('Coarse PixelOE failed: ' + $Slug) }
& $pythonExe (Join-Path $skillScripts 'pixelate_regions.py') --input $painting --base $coarse --base-qa $coarseQa --config $regionalConfig --runtime $runtimeDir --output $final --qa $qa --mask (Join-Path $artRoot ('qa/' + $Slug + '-face-mask.png'))
if ($LASTEXITCODE -ne 0) { throw ('Face-detail PixelOE failed: ' + $Slug) }
Write-Output ('FINISHED ' + $Slug)
