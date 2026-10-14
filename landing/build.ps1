# Monta landing/index.html: troca {{IMG:nome}} por imagens JPEG leves embutidas (data URI) a partir de docs/screens.
param([string]$Out = (Join-Path $PSScriptRoot 'index.html'))
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | ? MimeType -eq 'image/jpeg'
$prm = New-Object System.Drawing.Imaging.EncoderParameters 1
$prm.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 80L
function Shrink([string]$file, [int]$w) {
    $img = [System.Drawing.Image]::FromFile($file); $h = [int]($img.Height * $w / $img.Width)
    $bmp = New-Object System.Drawing.Bitmap $w, $h; $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($img, 0, 0, $w, $h); $g.Dispose(); $img.Dispose()
    $ms = New-Object IO.MemoryStream; $bmp.Save($ms, $jpeg, $prm); $bmp.Dispose()
    'data:image/jpeg;base64,' + [Convert]::ToBase64String($ms.ToArray())
}
$html = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'template.html'))
foreach ($name in ([regex]::Matches($html, '\{\{IMG:([^}]+)\}\}') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)) {
    $html = $html.Replace('{{IMG:' + $name + '}}', (Shrink (Join-Path $root "docs\screens\$name.png") 330))
}
$ic = [System.Drawing.Image]::FromFile((Join-Path $root 'docs\brand\icon-256.png')); $ms = New-Object IO.MemoryStream
$b = New-Object System.Drawing.Bitmap 128, 128; $g = [System.Drawing.Graphics]::FromImage($b); $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($ic, 0, 0, 128, 128); $g.Dispose(); $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$html = $html.Replace('{{ICON}}', 'data:image/png;base64,' + [Convert]::ToBase64String($ms.ToArray()))
$html = $html.Replace('{{SHA256}}', (Get-FileHash (Join-Path $root 'download\HotWalletBTC-arm64.apk') -Algorithm SHA256).Hash.ToLower())
[IO.File]::WriteAllText($Out, $html, (New-Object Text.UTF8Encoding $false))
Write-Host ("landing gerada: {0:N0} KB" -f ((Get-Item $Out).Length / 1KB))
