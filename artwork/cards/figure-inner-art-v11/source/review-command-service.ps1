$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$artRoot=Split-Path -Parent $PSScriptRoot
$items=(Get-Content -LiteralPath (Join-Path $artRoot 'command-service-manifest.json') -Raw | ConvertFrom-Json).assets
$sheet=New-Object System.Drawing.Bitmap 2140,1690
$g=[System.Drawing.Graphics]::FromImage($sheet)
$font=New-Object System.Drawing.Font 'Segoe UI',13
$brush=New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(230,224,212))
try {
  $g.Clear([System.Drawing.Color]::FromArgb(25,26,25))
  $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::Half
  for($i=0;$i -lt $items.Count;$i++) {
    $x=10+($i%5)*426;$y=10+[Math]::Floor($i/5)*558
    $img=[System.Drawing.Image]::FromFile((Join-Path $artRoot $items[$i].final))
    try{$g.DrawImage($img,[int]$x,[int]$y,420,525)}finally{$img.Dispose()}
    $g.DrawString($items[$i].title,$font,$brush,(New-Object System.Drawing.RectangleF $x,($y+529),420,28))
  }
  $sheet.Save((Join-Path $artRoot 'review/command-service-card-size.png'),[System.Drawing.Imaging.ImageFormat]::Png)
}finally{$g.Dispose();$sheet.Dispose();$font.Dispose();$brush.Dispose()}
