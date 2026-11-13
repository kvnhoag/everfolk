$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$artRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $artRoot 'scholarly-manifest.json') -Raw | ConvertFrom-Json
$font = New-Object System.Drawing.Font 'Segoe UI',13,([System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225,222,215))
try {
  for ($row=0;$row -lt 4;$row++) {
    $sheet = New-Object System.Drawing.Bitmap 1710,565
    $g = [System.Drawing.Graphics]::FromImage($sheet)
    try {
      $g.Clear([System.Drawing.Color]::FromArgb(30,31,30))
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
      for ($col=0;$col -lt 4;$col++) {
        $a = $manifest.assets[$row*4+$col]
        $img = [System.Drawing.Image]::FromFile((Join-Path $artRoot $a.final))
        try { $g.DrawImage($img,(10+$col*425),10,420,525) } finally { $img.Dispose() }
        $g.DrawString($a.title,$font,$brush,(New-Object System.Drawing.RectangleF (10+$col*425),538,420,27))
      }
      $sheet.Save((Join-Path $artRoot ('review/scholarly-row-'+($row+1)+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $g.Dispose(); $sheet.Dispose() }
  }
} finally { $font.Dispose(); $brush.Dispose() }
