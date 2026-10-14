# Gera os ícones do app a partir do logo da tela de boas-vindas (quadrado arredondado verde neon + "B").
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$font = Join-Path $root 'node_modules\@expo-google-fonts\space-grotesk\700Bold\SpaceGrotesk_700Bold.ttf'
$pfc = New-Object System.Drawing.Text.PrivateFontCollection
$pfc.AddFontFile($font)
$ff = $pfc.Families[0]
$green = [System.Drawing.Color]::FromArgb(255, 0x2B, 0xFF, 0x88)

function New-Logo([int]$size, [double]$box, [bool]$opaque, [string]$out) {
    # $box = lado do quadrado do logo como fração do canvas
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
    if ($opaque) { $g.Clear([System.Drawing.Color]::FromArgb(255, 5, 6, 13)) } else { $g.Clear([System.Drawing.Color]::Transparent) }
    $side = $size * $box; $x = ($size - $side) / 2; $y = $x; $rad = $side * 0.285
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $rad * 2
    $path.AddArc($x, $y, $d, $d, 180, 90); $path.AddArc($x + $side - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $side - $d, $y + $side - $d, $d, $d, 0, 90); $path.AddArc($x, $y + $side - $d, $d, $d, 90, 90); $path.CloseFigure()
    # brilho neon: traços largos e translúcidos por baixo da borda
    foreach ($w in 0.075, 0.05, 0.03) {
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(28, $green)), ($side * $w)
        $pen.LineJoin = 'Round'; $g.DrawPath($pen, $path)
    }
    $fill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 3, 12, 8)); $g.FillPath($fill, $path)
    $pen = New-Object System.Drawing.Pen $green, ($side * 0.052); $pen.LineJoin = 'Round'; $g.DrawPath($pen, $path)
    # "B" centralizado
    $fs = $side * 0.74
    $f = New-Object System.Drawing.Font $ff, $fs, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF $x, ($y + $side * 0.045), $side, $side
    $g.DrawString('B', $f, (New-Object System.Drawing.SolidBrush $green), $rect, $sf)
    $g.Dispose(); $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
New-Logo 1024 0.62 $true  (Join-Path $PSScriptRoot 'icon.png')
New-Logo 1024 0.46 $false (Join-Path $PSScriptRoot 'adaptive-icon.png')   # dentro da zona segura do ícone adaptativo (66%)
New-Logo 1024 0.46 $false (Join-Path $PSScriptRoot 'splash-icon.png')
New-Logo 96   0.80 $true  (Join-Path $PSScriptRoot 'favicon.png')
Write-Host 'ícones gerados'
