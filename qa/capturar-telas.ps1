# Captura o app de ponta a ponta no emulador (carteira de TESTE, testnet) para o portfólio.
# Telas com a frase de recuperação, o quiz e o PIN têm captura bloqueada (FLAG_SECURE): NÃO são capturadas, por segurança.
. "$PSScriptRoot\flows.ps1"
function Back { & $script:Adb shell input keyevent KEYCODE_BACK; Start-Sleep -Milliseconds 900 }
$ErrorActionPreference = 'Stop'
$out = Join-Path (Split-Path $PSScriptRoot) 'docs\screens'
New-Item -ItemType Directory -Force $out | Out-Null
$PIN = '482916'

function Shot([string]$name) {
    Start-Sleep -Milliseconds 900
    $f = Join-Path $out "$name.png"
    cmd /c "`"$script:Adb`" exec-out screencap -p > `"$f`""
    $kb = [int]((Get-Item $f).Length / 1KB)
    if ($kb -lt 15) { Write-Host "  ⚠ $name parece em branco ($kb KB): tela protegida?" -ForegroundColor Yellow; Remove-Item $f; return }
    Write-Host "  ✔ $name ($kb KB)" -ForegroundColor Green
}

Start-FreshApp
Wait-Text 'Criar nova carteira' 90 | Out-Null
Shot '01-boas-vindas'
Tap-Text 'Importar carteira'; Wait-Text 'Importar carteira' 20 | Out-Null; Shot '02-importar'
Back
Tap-Text 'Criar nova carteira'; Wait-Text 'Entendi, continuar' 20 | Out-Null; Shot '03-aviso-de-seguranca'

New-TestWallet $PIN | Out-Null
Wait-Home 40 | Out-Null
Start-Sleep 6   # deixa o preço/saldo carregarem
Shot '04-inicio'
Tap-Text 'Receber'; Wait-Text 'Copiar' 20 | Out-Null; Start-Sleep 2; Shot '05-receber'; Back; Wait-Home 15 | Out-Null
Tap-Text 'Enviar'; Wait-Text 'Revisar envio' 20 | Out-Null; Shot '06-enviar'; Back; Wait-Home 15 | Out-Null

Tap-Text 'Mercado'; Wait-Text 'AO VIVO' 120 | Out-Null
Wait-Until { param($ui, $t) $n = Find-Node $ui 'compare-chart'; if ($n -and $n.'content-desc' -match '^Comparativo') { $n } } 'gráfico comparativo' 90 | Out-Null
Shot '07-mercado'
1..2 | ForEach-Object { & $script:Adb shell input swipe 360 900 360 400 200; Start-Sleep -Milliseconds 400 }
Shot '08-mercado-lista'
1..4 | ForEach-Object { & $script:Adb shell input swipe 360 500 360 1100 200; Start-Sleep -Milliseconds 300 }
Tap-Text 'market-row-BTC'; Wait-Text 'detail-price' 30 | Out-Null
Wait-Until { param($ui, $t) $n = Find-Node $ui 'chart'; if ($n -and $n.'content-desc' -match '^Bitcoin, janela') { $n } } 'gráfico do Bitcoin' 90 | Out-Null
Shot '09-detalhe-linha'
Tap-Text 'Velas'; Start-Sleep 2
$c = Get-Center (Find-Node (Get-Ui) 'chart')
& $script:Adb shell input swipe $c.X $c.Y $c.X $c.Y 150
Wait-Text 'btn-clear-selection' 15 | Out-Null
Shot '10-detalhe-velas-mira'
Back; Wait-Text 'AO VIVO' 20 | Out-Null; Back; Wait-Home 15 | Out-Null

Tap-Text 'Atividade'; Wait-Text 'Nenhuma atividade ainda' 60 | Out-Null; Shot '11-atividade'
Tap-Text 'Ajustes'; Wait-Text 'CONQUISTAS' 30 | Out-Null; Shot '12-ajustes'
& $script:Adb shell input swipe 360 1000 360 400 250; Start-Sleep 1; Shot '13-ajustes-seguranca'
Write-Host "`nCapturas em $out" -ForegroundColor Cyan
