$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = Split-Path -Parent $PSScriptRoot
$reviewRoot = Join-Path $assetRoot 'review'
$art = [System.Drawing.Image]::FromFile((Join-Path $assetRoot 'alexander-inner-art-v10.png'))
$armour = [System.Drawing.Image]::FromFile((Join-Path $assetRoot 'references/aigai-cuirass-dagli-orti.jpg'))
$sword = [System.Drawing.Image]::FromFile((Join-Path $assetRoot 'references/iron-xiphos-thessaloniki-johnhoplite.jpg'))
$sheet = New-Object System.Drawing.Bitmap 1440,1220
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::FromArgb(245,243,238))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$title = New-Object System.Drawing.Font 'Segoe UI',25,([System.Drawing.FontStyle]::Bold)
$heading = New-Object System.Drawing.Font 'Segoe UI',16,([System.Drawing.FontStyle]::Bold)
$body = New-Object System.Drawing.Font 'Segoe UI',13
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(38,40,40))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(85,87,85))
function Draw-Text([string]$text,[System.Drawing.Font]$font,[System.Drawing.Brush]$ink,[int]$x,[int]$y,[int]$w,[int]$h) {
  $g.DrawString($text,$font,$ink,(New-Object System.Drawing.RectangleF $x,$y,$w,$h))
}
function Draw-Fit([System.Drawing.Image]$img,[int]$x,[int]$y,[int]$w,[int]$h) {
  $ratio = [Math]::Min($w/$img.Width,$h/$img.Height)
  $dw = [int]($img.Width*$ratio)
  $dh = [int]($img.Height*$ratio)
  $g.DrawImage($img,($x+[int](($w-$dw)/2)),($y+[int](($h-$dh)/2)),$dw,$dh)
}
try {
  Draw-Text 'ALEXANDER / INNER ART V10' $title $brush 30 20 1380 52
  Draw-Text 'Reference-led armour, longer straight blade, revised grip and blade perspective' $body $muted 32 76 1360 34
  Draw-Text 'GENERATED CANDIDATE' $heading $brush 32 120 700 36
  Draw-Fit $art 32 164 704 880
  Draw-Text 'ACTUAL SURVIVING CUIRASS' $heading $brush 780 120 620 36
  Draw-Fit $armour 780 164 620 510
  Draw-Text 'Aigai Tomb II; traditionally attributed to Philip II.' $body $brush 780 686 620 28
  Draw-Text 'Photo: G. Dagli Orti / DEA / Getty Images, via National Geographic Portugal. Full photograph, proportionally resized.' $body $muted 780 718 620 64
  Draw-Text 'ACTUAL XIPHOS / TYPE COMPARISON' $heading $brush 780 800 620 36
  Draw-Fit $sword 780 842 620 349
  Draw-Text 'Thessaloniki museum, foreground sword; late 6th c. BCE. Johnhoplite / CC BY-SA 4.0. Full photograph resized.' $body $muted 32 1124 704 64
  Draw-Text 'Interpretations: serviceable metal surface, lower skirt, fit to riding pose and enlarged blade. Sources and complete prompt are saved with the artwork.' $body $muted 32 1058 704 64
  $sheet.Save((Join-Path $reviewRoot 'reference-comparison.png'),[System.Drawing.Imaging.ImageFormat]::Png)
  $thumb = New-Object System.Drawing.Bitmap 420,525
  $tg = [System.Drawing.Graphics]::FromImage($thumb)
  try {
    $tg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $tg.DrawImage($art,0,0,420,525)
    $thumb.Save((Join-Path $reviewRoot 'card-size-420.png'),[System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $tg.Dispose(); $thumb.Dispose() }
  Write-Output ('Final image: {0} x {1}; reference comparison and 420 x 525 preview saved.' -f $art.Width,$art.Height)
} finally {
  $g.Dispose(); $sheet.Dispose(); $art.Dispose(); $armour.Dispose(); $sword.Dispose()
  $title.Dispose(); $heading.Dispose(); $body.Dispose(); $brush.Dispose(); $muted.Dispose()
}
