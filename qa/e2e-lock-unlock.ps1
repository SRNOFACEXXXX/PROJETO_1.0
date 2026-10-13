# E2E 2: bloqueio, PIN errado e bloqueio exponencial. Carteira de TESTE no emulador.
# O apagamento após 10 falhas NÃO é exercitado aqui (levaria ~15 min de espera por causa do
# bloqueio exponencial); ele é coberto pelos testes unitários de wallet-core/test/vault-pin.test.ts.
. "$PSScriptRoot\flows.ps1"
$ErrorActionPreference = 'Stop'
$results = [ordered]@{}
$PIN = '482916'
$WRONG = '000001'

function Step([string]$name, [scriptblock]$body) {
    Write-Host "`n▶ $name" -ForegroundColor Cyan
    try { & $body; $results[$name] = 'PASSOU' }
    catch { $results[$name] = "FALHOU: $($_.Exception.Message)"; Write-Host "  ✖ $($_.Exception.Message)" -ForegroundColor Red }
}

Step 'Cria carteira de teste e mede o custo do PIN (scrypt no Hermes)' {
    $secs = New-TestWallet $PIN
    Write-Host "  OK  carteira criada; proteger com o PIN levou ~${secs}s" -ForegroundColor Green
    if ($secs -gt 60) { Write-Host "  ⚠  lento (>60s): avaliar reduzir o custo do scrypt ou mover para thread nativa" -ForegroundColor Yellow }
}

Step 'Bloquear leva à tela de PIN' {
    Tap-Text 'Bloquear'
    Assert-Text 'Digite seu PIN' 'tela de bloqueio'
    if (Test-OnHome @(Screen-Texts)) { throw 'a Home apareceu com a carteira bloqueada' }; Write-Host '  OK  Home não aparece com a carteira bloqueada' -ForegroundColor Green
}

Step 'PIN correto abre a carteira (e mede o tempo de desbloqueio)' {
    $t0 = Get-Date
    $r = Try-Unlock $PIN 90
    if ($r -ne 'home') { throw "esperava abrir a Home, veio: $r" }
    Write-Host ("  OK  desbloqueou em ~{0}s" -f [int]((Get-Date) - $t0).TotalSeconds) -ForegroundColor Green
    Tap-Text 'Bloquear'; Assert-Text 'Digite seu PIN' 'bloqueou de novo'
}

Step 'PIN errado: mensagem e contagem de erros' {
    $r = Try-Unlock $WRONG;  if ($r -ne 'PIN incorreto (1 erro).')  { throw "1º erro: veio '$r'" }
    Write-Host '  OK  1º erro contado' -ForegroundColor Green
    Start-Sleep 1
    $r = Try-Unlock $WRONG;  if ($r -ne 'PIN incorreto (2 erros).') { throw "2º erro: veio '$r'" }
    Write-Host '  OK  2º erro contado (plural)' -ForegroundColor Green
}

Step 'Acertar o PIN zera a contagem de erros' {
    $r = Try-Unlock $PIN 90; if ($r -ne 'home') { throw "esperava abrir, veio: $r" }
    Tap-Text 'Bloquear'; Assert-Text 'Digite seu PIN' 'bloqueou de novo'
    $r = Try-Unlock $WRONG;  if ($r -ne 'PIN incorreto (1 erro).') { throw "após acerto, o erro deveria voltar a '1 erro', veio '$r'" }
    Write-Host '  OK  contagem reiniciou após acerto' -ForegroundColor Green
}

Step 'Após 5 erros seguidos, o app bloqueia as tentativas' {
    1..3 | ForEach-Object { Try-Unlock $WRONG | Out-Null; Start-Sleep 1 }   # chega a 4 erros
    $r = Try-Unlock $WRONG
    if ($r -notmatch '^Bloqueado por|^Muitas tentativas') { throw "5º erro deveria bloquear, veio: '$r'" }
    Write-Host "  OK  bloqueio ativado ('$r')" -ForegroundColor Green
}

Step 'Durante o bloqueio, nem o PIN correto abre' {
    Tap-Pin $PIN
    Start-Sleep 6
    if (Test-OnHome @(Screen-Texts)) { throw 'PIN correto abriu a carteira durante o bloqueio!' }
    Assert-Text 'Digite seu PIN' 'continua na tela de bloqueio'
}

Step 'O bloqueio sobrevive a fechar e reabrir o app' {
    Restart-App
    Assert-Text 'Digite seu PIN' 'app reabre pedindo PIN' | Out-Null
    $r = Try-Unlock $PIN 20
    if ($r -eq 'home') { throw 'reabrir o app burlou o bloqueio (contador não persistiu)' }
    Write-Host "  OK  continua bloqueado após reabrir ('$r')" -ForegroundColor Green
}

Step 'Passado o tempo do bloqueio, o PIN correto volta a funcionar' {
    Write-Host '  aguardando o bloqueio de 30 s expirar...'
    Start-Sleep 35
    Restart-App
    Assert-Text 'Digite seu PIN' 'app reabre pedindo PIN' | Out-Null
    $r = Try-Unlock $PIN 90
    if ($r -ne 'home') { throw "após expirar, o PIN correto deveria abrir; veio: $r" }
}

Write-Host "`n══════ RESULTADO ══════" -ForegroundColor Cyan
$results.GetEnumerator() | ForEach-Object { $c = if ($_.Value -eq 'PASSOU') { 'Green' } else { 'Red' }; Write-Host ("{0,-70} {1}" -f $_.Key, $_.Value) -ForegroundColor $c }
$failed = @($results.Values | Where-Object { $_ -ne 'PASSOU' }).Count
Write-Host "`n$($results.Count - $failed)/$($results.Count) etapas passaram"
exit $failed
