# E2E 4: navegação, botão Voltar do Android, Mercado (gráficos), Atividade e Ver frase.
# Pré-requisito: uma carteira de TESTE já criada neste emulador com o PIN abaixo (e2e-create-wallet).
. "$PSScriptRoot\flows.ps1"
$ErrorActionPreference = 'Stop'
$results = [ordered]@{}
$PIN = '482916'

function Step([string]$name, [scriptblock]$body) {
    Write-Host "`n▶ $name" -ForegroundColor Cyan
    try { & $body; $results[$name] = 'PASSOU' }
    catch { $results[$name] = "FALHOU: $($_.Exception.Message)"; Write-Host "  ✖ $($_.Exception.Message)" -ForegroundColor Red }
}
function Ok([string]$msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Back { & $script:Adb shell input keyevent KEYCODE_BACK; Start-Sleep -Milliseconds 900 }
function Chart-Label([string]$id) { (Find-Node (Get-Ui) $id).'content-desc' }
function Focus-Package { (& $script:Adb shell dumpsys window 2>$null | Select-String 'mCurrentFocus' | Select-Object -Last 1).Line }

Step 'Abrir o app e desbloquear com o PIN' {
    Restart-App
    Assert-Text 'Digite seu PIN' 'tela de bloqueio'
    $r = Try-Unlock $PIN 90
    if ($r -ne 'home') { throw "não abriu a Home: $r" }
    Ok 'Home aberta'
}

Step 'Voltar do Android: Receber e Enviar voltam para o Início' {
    Tap-Text 'Receber'; Wait-Text 'Copiar' 20 | Out-Null
    Back; Wait-Home 15 | Out-Null; Ok 'Receber -> Voltar -> Início'
    Tap-Text 'Enviar'; Wait-Text 'Revisar envio' 20 | Out-Null
    Back; Wait-Home 15 | Out-Null; Ok 'Enviar -> Voltar -> Início'
}

Step 'Mercado: preço ao vivo, gráfico comparativo e legenda' {
    Tap-Text 'Mercado'
    Wait-Text 'AO VIVO' 120 | Out-Null; Ok 'selo AO VIVO'
    $price = Wait-Match '^R\$ [\d.]+$' 60
    Ok "preço do Bitcoin: $price"
    $label = Wait-Until { param($ui, $t) $n = Find-Node $ui 'compare-chart'; if ($n -and $n.'content-desc' -match '^Comparativo') { $n.'content-desc' } } 'gráfico comparativo carregado' 90
    if ($label -notmatch 'BTC [+−]\d') { throw "gráfico sem a série do BTC: $label" }
    Ok "gráfico: $label"
    foreach ($b in 'BTC', 'ETH', 'SOL', 'BNB') { if (-not (Find-Node (Get-Ui) "legend-$b")) { throw "legenda $b ausente" } }
    Ok 'legenda com BTC, ETH, SOL e BNB'
}

Step 'Mercado: ligar/desligar ativo e trocar a janela de tempo' {
    Tap-Text 'legend-ETH'
    Start-Sleep 1
    if ((Chart-Label 'compare-chart') -match 'ETH') { throw 'ETH continua no gráfico após desligar' }
    Ok 'ETH removido do gráfico'
    Tap-Text 'legend-ETH'
    Wait-Until { param($ui, $t) (Find-Node $ui 'compare-chart').'content-desc' -match 'ETH' } 'ETH volta ao gráfico' 15 | Out-Null
    Ok 'ETH de volta'
    Tap-Text 'Janela 7D'
    Wait-Until { param($ui, $t) (Find-Node $ui 'compare-chart').'content-desc' -match 'em 7D' } 'gráfico na janela 7D' 90 | Out-Null
    Ok 'janela 7D aplicada'
    Tap-Text 'Janela 24H'
}

Step 'Mercado: lista com os 8 ativos' {
    foreach ($b in 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'LTC') {
        Wait-Text "market-row-$b" 30 -Scroll | Out-Null
    }
    Ok '8 ativos listados'
}

Step 'Detalhe do ativo: gráfico, velas e mira' {
    # A lista foi rolada até o fim no passo anterior: volta ao topo antes de procurar a linha do BTC.
    1..4 | ForEach-Object { & $script:Adb shell input swipe 360 500 360 1100 200; Start-Sleep -Milliseconds 300 }
    Tap-Text 'market-row-BTC'
    Wait-Text 'detail-price' 30 | Out-Null
    $chart = Wait-Until { param($ui, $t) $n = Find-Node $ui 'chart'; if ($n -and $n.'content-desc' -match '^Bitcoin, janela') { $n } } 'gráfico do Bitcoin carregado' 90
    Ok "rótulo: $($chart.'content-desc')"
    Tap-Text 'Velas'; Start-Sleep 2; Ok 'modo velas'
    $c = Get-Center (Find-Node (Get-Ui) 'chart')
    & $script:Adb shell input swipe $c.X $c.Y $c.X $c.Y 150
    Wait-Text 'btn-clear-selection' 15 | Out-Null; Ok 'tocar no gráfico seleciona uma vela'
    $sel = (Find-Node (Get-Ui) 'chart').'content-desc'
    if ($sel -notmatch 'Vela de') { throw 'rótulo do gráfico não descreve a vela selecionada' }
    Tap-Text 'btn-clear-selection'
    Start-Sleep 1
    if (Find-Node (Get-Ui) 'btn-clear-selection') { throw 'seleção não foi limpa' }
    Ok 'Limpar remove a seleção'
    Tap-Text 'Janela 1M'
    Wait-Until { param($ui, $t) (Find-Node $ui 'chart').'content-desc' -match 'janela 1M' } 'janela 1M' 60 | Out-Null
    Ok 'janela 1M'
}

Step 'Voltar do Android: detalhe -> Mercado -> Início' {
    Back; Wait-Text 'AO VIVO' 20 | Out-Null; Ok 'Detalhe -> Mercado'
    Back; Wait-Home 15 | Out-Null; Ok 'Mercado -> Início'
}

Step 'Atividade: carteira nova mostra estado vazio claro' {
    Tap-Text 'Atividade'
    Wait-Text 'Nenhuma atividade ainda' 60 | Out-Null; Ok 'estado vazio'
    foreach ($f in 'Tudo', 'Enviado', 'Recebido') { Tap-Text $f; Start-Sleep -Milliseconds 400 }
    Ok 'filtros respondem sem travar'
}

Step 'Ajustes: nível, conquistas reais e segurança' {
    Tap-Text 'Ajustes'
    Wait-Text 'CONQUISTAS' 20 -Scroll | Out-Null
    Assert-Text 'Backup confirmado' 'conquista de backup'
    Assert-Text 'PIN criado' 'conquista do PIN'
    Assert-Text 'Ver frase de recuperação' 'item de segurança'
}

Step 'Ver frase de recuperação: PIN errado recusa, certo mostra 12 palavras' {
    Tap-Text 'Ver frase de recuperação'
    Assert-Text 'Confirme seu PIN' 'pede o PIN'
    Tap-Pin '000001'
    Wait-Match '^PIN incorreto \(1 erro\)\.$' 60 | Out-Null; Ok 'PIN errado recusado'
    Tap-Pin $PIN
    $t0 = Get-Date
    Wait-Text 'Sua frase de recuperação' 120 | Out-Null
    Ok ("PIN certo abre o cofre em ~{0}s" -f [int]((Get-Date) - $t0).TotalSeconds)
    $w = @(Read-SeedWords)
    if ($w.Count -ne 12) { throw "esperava 12 palavras, vieram $($w.Count)" }
    Ok '12 palavras exibidas (não impressas)'
    Back
    Assert-Text 'CONQUISTAS' 'voltou para Ajustes'
}

Step 'Voltar do Android: Ajustes -> Início -> sai do app' {
    Back; Wait-Home 15 | Out-Null; Ok 'Ajustes -> Início'
    Back; Start-Sleep 2
    if ((Focus-Package) -match 'com\.brbit\.hotwallet') { throw 'o app deveria ter fechado ao voltar na tela Início' }
    Ok 'Voltar no Início fecha o app (padrão do Android)'
}

Write-Host "`n══════ RESULTADO ══════" -ForegroundColor Cyan
$results.GetEnumerator() | ForEach-Object { $c = if ($_.Value -eq 'PASSOU') { 'Green' } else { 'Red' }; Write-Host ("{0,-72} {1}" -f $_.Key, $_.Value) -ForegroundColor $c }
$failed = @($results.Values | Where-Object { $_ -ne 'PASSOU' }).Count
Write-Host "`n$($results.Count - $failed)/$($results.Count) etapas passaram"
exit $failed
