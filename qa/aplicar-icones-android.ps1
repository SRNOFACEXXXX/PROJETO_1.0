# Aplica os ícones de app/assets no projeto Android da cópia de build (C:\hb\app\android).
# O ícone adaptativo usa a cor de fundo do app.json; o legado e o redondo usam icon.png.
param([string]$Res = 'C:\hb\app\android\app\src\main\res')
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$assets = Join-Path (Split-Path $PSScriptRoot) 'app\assets'
$dens = [ordered]@{ mdpi = 1.0; hdpi = 1.5; xhdpi = 2.0; xxhdpi = 3.0; xxxhdpi = 4.0 }

function Resize([string]$src, [int]$px, [string]$out, [bool]$round) {
    $img = [System.Drawing.Image]::FromFile($src)
    $bmp = New-Object System.Drawing.Bitmap $px, $px, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
    if ($round) { $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $p.AddEllipse(0, 0, $px, $px); $g.SetClip($p) }
    $g.DrawImage($img, 0, 0, $px, $px); $g.Dispose(); $img.Dispose()
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}
function Put([string]$dir, [string]$name, [scriptblock]$make) {
    Get-ChildItem $dir -Filter "$name.*" -ErrorAction SilentlyContinue | Remove-Item -Force   # evita recurso duplicado (.webp antigo)
    & $make
}
foreach ($d in $dens.Keys) {
    $s = $dens[$d]; $mip = Join-Path $Res "mipmap-$d"
    Put $mip 'ic_launcher_foreground' { Resize (Join-Path $assets 'adaptive-icon.png') ([int](108 * $s)) (Join-Path $mip 'ic_launcher_foreground.png') $false }
    Put $mip 'ic_launcher'            { Resize (Join-Path $assets 'icon.png')          ([int](48 * $s))  (Join-Path $mip 'ic_launcher.png') $false }
    Put $mip 'ic_launcher_round'      { Resize (Join-Path $assets 'icon.png')          ([int](48 * $s))  (Join-Path $mip 'ic_launcher_round.png') $true }
}
# splash: mantém o tamanho do arquivo existente em cada densidade
foreach ($d in $dens.Keys) {
    $f = Join-Path $Res "drawable-$d\splashscreen_logo.png"
    if (Test-Path $f) { $w = ([System.Drawing.Image]::FromFile($f)); $px = $w.Width; $w.Dispose(); Resize (Join-Path $assets 'splash-icon.png') $px $f $false }
}
Write-Host 'ícones aplicados em' $Res
