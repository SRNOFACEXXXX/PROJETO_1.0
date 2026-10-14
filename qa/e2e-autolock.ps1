# E2E 7: bloqueio automático ao ir para segundo plano (limite do app: 30 s).
# Carteira de TESTE. Prova: fora por pouco tempo volta direto; fora por mais de 30 s volta BLOQUEADO.
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
function Go-Background { & $script:Adb shell input keyevent KEYCODE_HOME; Start-Sleep -Milliseconds 800 }
function Come-Back { & $script:Adb shell monkey -p $script:Pkg -c android.intent.category.LAUNCHER 1 | Out-Null }

Step 'Cria carteira de teste e chega na Home' {
    New-TestWallet $PIN | Out-Null
    Wait-Home 30 | Out-Null
    Ok 'Home aberta'
}

Step 'Fora por pouco tempo (~6 s): volta direto para a Home, sem pedir PIN' {
    Go-Background
    Start-Sleep 6
    Come-Back
    Wait-Home 20 | Out-Null
    Ok 'continua desbloqueada'
}

Step 'Fora por mais de 30 s: volta BLOQUEADA e a Home não aparece' {
    Go-Background
    Write-Host '  aguardando 36 s em segundo plano...'
    Start-Sleep 36
    Come-Back
    Assert-Text 'Digite seu PIN' 'o app voltou na tela de bloqueio'
    if (Test-OnHome @(Screen-Texts)) { throw 'a Home apareceu mesmo após mais de 30 s fora' }
    Ok 'nenhum dado da carteira visível'
}

Step 'Depois de bloqueada, o PIN correto reabre a carteira' {
    $r = Try-Unlock $PIN 90
    if ($r -ne 'home') { throw "não abriu: $r" }
    Ok 'Home reaberta'
}

Step 'Receber (rota sensível) também bloqueia ao ficar fora por mais de 30 s' {
    Tap-Text 'Receber'; Wait-Text 'Copiar' 20 | Out-Null
    Go-Background
    Write-Host '  aguardando 36 s em segundo plano na tela Receber...'
    Start-Sleep 36
    Come-Back
    Assert-Text 'Digite seu PIN' 'bloqueou mesmo estando na tela Receber'
    if ((Screen-Texts) -match '^tb1q') { throw 'o endereço ficou visível na tela de bloqueio' }
    Ok 'o endereço não ficou exposto'
}

Write-Host "`n══════ RESULTADO ══════" -ForegroundColor Cyan
$results.GetEnumerator() | ForEach-Object { $c = if ($_.Value -eq 'PASSOU') { 'Green' } else { 'Red' }; Write-Host ("{0,-78} {1}" -f $_.Key, $_.Value) -ForegroundColor $c }
$failed = @($results.Values | Where-Object { $_ -ne 'PASSOU' }).Count
Write-Host "`n$($results.Count - $failed)/$($results.Count) etapas passaram"
exit $failed
