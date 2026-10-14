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
    $secs = $script:LastUnlockSecs   # do último toque do PIN até a Home aparecer
    Write-Host "  OK  desbloqueou ~${secs}s depois do último dígito" -ForegroundColor Green
    # Trava de desempenho: a seed vem pronta do cofre, então só o scrypt pesa (~5 s no emulador).
    if ($secs -gt 20) { throw "desbloqueio lento demais: ${secs}s (esperado < 20 s). A seed está sendo recalculada?" }
    Write-Host '  OK  desbloqueio dentro do limite de 20 s' -ForegroundColor Green
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
    $script:lockAt = Get-Date   # o bloqueio começou um instante ANTES deste ponto (margem a favor do app)
}

Step 'Durante o bloqueio, nem o PIN correto abre' {
    Tap-Pin $PIN
    Start-Sleep 2
    if (Test-OnHome @(Screen-Texts)) { throw 'PIN correto abriu a carteira durante o bloqueio!' }
    Assert-Text 'Digite seu PIN' 'continua na tela de bloqueio'
}

Step 'O bloqueio dobra no erro seguinte (30 s -> 60 s)' {
    # Espera o 1º bloqueio acabar e erra de novo: o próximo bloqueio deve ser o dobro.
    $wait = 31 - [int]((Get-Date) - $script:lockAt).TotalSeconds
    if ($wait -gt 0) { Write-Host "  aguardando o 1º bloqueio expirar (${wait}s)..."; Start-Sleep $wait }
    $r = Try-Unlock $WRONG 30
    if ($r -notmatch '^Bloqueado por (?:(\d+)min )?(\d+)s') { throw "esperava um 2º bloqueio, veio: '$r'" }
    $secs = 60 * [int]($Matches[1] + 0) + [int]$Matches[2]
    if ($secs -lt 50 -or $secs -gt 61) { throw "o 2º bloqueio deveria ser ~60 s, veio ${secs}s ('$r')" }
    Write-Host "  OK  2º bloqueio de ~${secs}s (dobrou)" -ForegroundColor Green
    $script:lockAt = Get-Date
    $script:lockSecs = 60
}

Step 'O bloqueio sobrevive a fechar e reabrir o app' {
    Restart-App
    Assert-Text 'Digite seu PIN' 'app reabre pedindo PIN' | Out-Null
    $r = Try-Unlock $PIN 20
    $elapsed = [int]($script:LastPinAt - $script:lockAt).TotalSeconds
    if ($r -eq 'home') {
        # O PIN foi enviado a $elapsed s do início do bloqueio (60 s). Dentro da janela = falha de segurança real;
        # perto do fim = o emulador foi lento demais para este teste concluir (resultado inconclusivo, mas FALHA).
        if ($elapsed -lt 50) { throw "FALHA DE SEGURANÇA: reabrir o app burlou o bloqueio (PIN enviado a ${elapsed}s de 60s)" }
        throw "inconclusivo: o robô só enviou o PIN a ${elapsed}s do bloqueio de 60s (o emulador está lento); rode de novo"
    }
    Write-Host "  OK  continua bloqueado após reabrir (PIN enviado a ${elapsed}s do bloqueio de 60s): '$r'" -ForegroundColor Green
}

Step 'Passado o tempo do bloqueio, o PIN correto volta a funcionar' {
    $left = 63 - [int]((Get-Date) - $script:lockAt).TotalSeconds
    Write-Host "  aguardando o bloqueio de 60 s expirar (${left}s)..."
    if ($left -gt 0) { Start-Sleep $left }
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
