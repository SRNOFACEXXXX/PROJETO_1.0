# Gera docs/banner.png (capa do README) e docs/brand/icon-256.png a partir das capturas reais e do ícone.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$docs = $PSScriptRoot; $root = Split-Path $docs
$pfc = New-Object System.Drawing.Text.PrivateFontCollection
$fd = Join-Path $root 'app\node_modules\@expo-google-fonts\space-grotesk'
$pfc.AddFontFile((Join-Path $fd '700Bold\SpaceGrotesk_700Bold.ttf')); $pfc.AddFontFile((Join-Path $fd '500Medium\SpaceGrotesk_500Medium.ttf'))
$bold = $pfc.Families | ? Name -eq 'Space Grotesk' | Select -First 1
$green = [System.Drawing.Color]::FromArgb(255, 43, 255, 136)

# ícone para README
$ic = [System.Drawing.Image]::FromFile((Join-Path $root 'app\assets\icon.png'))
$b = New-Object System.Drawing.Bitmap 256, 256; $g = [System.Drawing.Graphics]::FromImage($b); $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($ic, 0, 0, 256, 256); $g.Dispose()
$b.Save((Join-Path $docs 'brand\icon-256.png'), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()

$W = 1600; $H = 700
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.Color]::FromArgb(255, 0, 0, 0))
# brilho verde de fundo
$gp = New-Object System.Drawing.Drawing2D.GraphicsPath; $gp.AddEllipse(700, 160, 1100, 900)
$pb = New-Object System.Drawing.Drawing2D.PathGradientBrush $gp
$pb.CenterColor = [System.Drawing.Color]::FromArgb(70, 43, 255, 136); $pb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$g.FillPath($pb, $gp)

function RoundPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90); $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90); $p.CloseFigure(); $p
}
function Phone([string]$file, [float]$x, [float]$y, [float]$w) {
    $img = [System.Drawing.Image]::FromFile($file); $h = $w * $img.Height / $img.Width
    foreach ($k in 14, 8, 4) { $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(22, $green)), ($k * 2); $g.DrawPath($pen, (RoundPath ($x - 2) ($y - 2) ($w + 4) ($h + 4) 34)) }
    $path = RoundPath $x $y $w $h 32
    $g.SetClip($path); $g.DrawImage($img, $x, $y, $w, $h); $g.ResetClip()
    $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, $green)), 2.5), $path); $img.Dispose()
}
$s = Join-Path $docs 'screens'
Phone (Join-Path $s '10-detalhe-velas-mira.png') 1330 70 250
Phone (Join-Path $s '07-mercado.png') 1040 130 250
Phone (Join-Path $s '04-inicio.png') 750 50 250   # frente
# marca + texto
$ic2 = [System.Drawing.Image]::FromFile((Join-Path $root 'app\assets\icon.png')); $g.DrawImage($ic2, 90, 110, 96, 96)
$fBrand = New-Object System.Drawing.Font $bold, 40, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('BR Bit', $fBrand, [System.Drawing.Brushes]::White, 204, 134)
$f1 = New-Object System.Drawing.Font $bold, 84, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('Bitcoin sob', $f1, [System.Drawing.Brushes]::White, 84, 270)
$g.DrawString('o seu controle.', $f1, (New-Object System.Drawing.SolidBrush $green), 84, 360)
$f2 = New-Object System.Drawing.Font $bold, 27, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$grey = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 150, 156, 168))
$g.DrawString('Carteira Bitcoin mobile com núcleo', $f2, $grey, 90, 492)
$g.DrawString('TypeScript próprio, mercado ao vivo e', $f2, $grey, 90, 530)
$g.DrawString('testes de ponta a ponta num Android real.', $f2, $grey, 90, 568)
$g.Dispose(); $bmp.Save((Join-Path $docs 'banner.png'), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
Write-Host 'banner gerado'
