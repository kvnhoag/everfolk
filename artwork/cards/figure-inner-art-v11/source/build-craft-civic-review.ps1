$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot=Split-Path -Parent $PSScriptRoot
$manifest=Get-Content -LiteralPath (Join-Path $assetRoot 'craft-civic-manifest.json') -Raw | ConvertFrom-Json
foreach($figure in @('lysippos','pytheas','menander','cleomenes')) {
  $sheet=New-Object System.Drawing.Bitmap 900,1220
  $g=[System.Drawing.Graphics]::FromImage($sheet)
  $font=New-Object System.Drawing.Font 'Segoe UI',13
  $title=New-Object System.Drawing.Font 'Segoe UI',19,([System.Drawing.FontStyle]::Bold)
  $brush=New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235,231,219))
  try {
    $g.Clear([System.Drawing.Color]::FromArgb(24,26,27))
    $g.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.DrawString(($figure.ToUpper()+' / FILTERED INNER ART'),$title,$brush,20,8)
    $i=0
    foreach($asset in ($manifest.assets | Where-Object {$_.figureId -eq $figure})) {
      $x=20+($i%2)*440
      $y=52+[Math]::Floor($i/2)*578
      $img=[System.Drawing.Image]::FromFile((Join-Path $assetRoot $asset.final))
      try {$g.DrawImage($img,[int]$x,[int]$y,420,525)} finally {$img.Dispose()}
      $g.DrawString($asset.title,$font,$brush,(New-Object System.Drawing.RectangleF $x,($y+530),420,40))
      $i++
    }
    $sheet.Save((Join-Path $assetRoot ('review/craft-civic-'+$figure+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
  } finally {$g.Dispose();$sheet.Dispose();$font.Dispose();$title.Dispose();$brush.Dispose()}
}
Write-Output 'Built four review sheets; each artwork shown at 420 x 525 with nearest-neighbour review scaling.'
