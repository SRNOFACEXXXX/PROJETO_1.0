# E2E 5: ENVIAR de ponta a ponta, com um servidor de testes que imita o mempool.space (só testnet).
# Prova: validações do formulário, MAX, revisão, "segure para enviar", PIN, assinatura REAL (verificada
# por outra biblioteca), troco no endereço certo, taxa coerente, e que uma falha de rede no envio
# NÃO transmite nada nem duplica a transação.
. "$PSScriptRoot\flows.ps1"
$ErrorActionPreference = 'Stop'
$results = [ordered]@{}
$PIN = '482916'
$FAKE = 'http://localhost:3999'
$core = Join-Path (Split-Path $PSScriptRoot) 'wallet-core'
$MAINNET_ADDR = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'
$fakeProc = $null

function Step([string]$name, [scriptblock]$body) {
    Write-Host "`n▶ $name" -ForegroundColor Cyan
    try { & $body; $results[$name] = 'PASSOU' }
    catch { $results[$name] = "FALHOU: $($_.Exception.Message)"; Write-Host "  ✖ $($_.Exception.Message)" -ForegroundColor Red }
}
function Ok([string]$msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Back { & $script:Adb shell input keyevent KEYCODE_BACK; Start-Sleep -Milliseconds 900 }
function Fake-State { Invoke-RestMethod "$FAKE/_state" }
function Fake-Post([string]$path, $body) { Invoke-RestMethod -Method Post -Uri "$FAKE$path" -Body ($body | ConvertTo-Json) -ContentType 'application/json' | Out-Null }

# Endereço testnet independente (bitcoinjs-lib) para uma seed qualquer.
function Independent-Address([string]$words, [string]$chain, [string]$index) {
    Push-Location $core
    try { $env:TEST_WORDS = $words; (node scripts/derive-independent.mjs testnet $chain $index).Trim() } finally { $env:TEST_WORDS = $null; Pop-Location }
}

function Fill-Send([string]$to, [string]$amount) {
    $n = Wait-Until { param($ui, $t) Find-Node $ui 'send-to' } 'campo Para' 20
    Set-Field $n $to
    $a = Find-Node (Get-Ui) 'send-amount'
    Set-Field $a $amount
    Hide-Keyboard
}
function Send-Error([string]$pattern) {
    Tap-Text 'Revisar envio'
    Wait-Match $pattern 15 -FailOn @() | Out-Null
}
function Amount-Text { (Find-Node (Get-Ui) 'send-amount').text }

try {
    Step 'Prepara: servidor de testes, Metro em modo teste e carteira financiada' {
        # O caminho tem espaços: precisa de aspas, senão o node recebe pedaços do caminho.
        $fakeProc = Start-Process -FilePath node -ArgumentList ('"' + (Join-Path $PSScriptRoot 'fake-mempool.mjs') + '"'), '3999' -WindowStyle Hidden -PassThru
        Start-Sleep 2
        & $script:Adb reverse tcp:3999 tcp:3999 | Out-Null
        & $script:Adb reverse tcp:8081 tcp:8081 | Out-Null
        powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'metro.ps1') -Mode test | Out-Null
        Ok 'servidor falso e Metro (modo teste) no ar'
        New-TestWallet $PIN | Out-Null
        $script:addr = Read-ReceiveAddress 'tb1q'
        Fake-Post '/_fund' @{ address = $script:addr; sats = 100000 }
        Tap-Text 'Voltar'; Wait-Home 30 | Out-Null
        Tap-Text 'Atualizar'
        Wait-Match '^0,00100000' 60 -FailOn @() | Out-Null
        Ok 'saldo de 0,00100000 tBTC aparece depois de financiar'
    }

    Step 'Formulário: validações bloqueiam entradas ruins' {
        Tap-Text 'Enviar'
        Wait-Text 'Revisar envio' 20 | Out-Null
        if (Test-Enabled 'Revisar envio') { throw 'Revisar deveria estar desabilitado com campos vazios' }
        Ok 'Revisar desabilitado com campos vazios'
        $good = Independent-Address 'legal winner thank year wave sausage worth useful legal winner thank yellow' '0' '0'
        $script:dest = $good
        Fill-Send 'isto-nao-e-um-endereco' '0,0004'
        Send-Error 'Endereço de destino inválido para esta rede\.'; Ok 'endereço lixo recusado'
        Fill-Send $MAINNET_ADDR '0,0004'
        Send-Error 'Endereço de destino inválido para esta rede\.'; Ok 'endereço da MAINNET recusado na testnet'
        Fill-Send $good '0,01'
        Send-Error '^Saldo insuficiente\.'; Ok 'valor acima do saldo recusado, com o valor necessário'
        Fill-Send $good '0,000001'
        Send-Error 'abaixo do limite mínimo'; Ok 'valor em poeira recusado'
        Fill-Send $good '0,123456789'
        Send-Error 'Valor inválido\. Use até 8 casas decimais\.'; Ok 'mais de 8 casas decimais recusado'
    }

    Step 'MAX: usa o saldo inteiro menos a taxa, sem troco' {
        Fill-Send $script:dest ''
        Tap-Text 'Usar o valor máximo'
        $max = (Wait-Until { param($ui, $t) $v = (Find-Node $ui 'send-amount').text; if ($v -match '^0,0\d{7}$') { $v } } 'valor máximo preenchido' 15)
        if ($max -ne '0,00099560') { throw "MAX deveria ser 0,00099560 (100000 - 440 de taxa a 4 sat/vB), veio $max" }
        Ok "MAX = $max (100000 sats − 440 de taxa)"
        Tap-Text 'Revisar envio'
        Wait-Text 'Revisar envio' 20 | Out-Null
        Wait-Match '^0,00100000 tBTC$' 15 -FailOn @() | Out-Null; Ok 'total debitado = saldo inteiro (0,00100000 tBTC), sem troco'
        Back; Start-Sleep 1
        Assert-Text 'Revisar envio' 'voltar do Android na revisão volta ao formulário'
    }

    Step 'Revisão: valores, endereço em blocos e botão Voltar do Android' {
        Fill-Send $script:dest '0,0004'
        Tap-Text 'Revisar envio'
        Wait-Text 'Segure para enviar' 20 | Out-Null
        Wait-Match '^0,0004 tBTC$|^0,0004$' 10 -FailOn @() | Out-Null
        Ok 'valor 0,0004 na revisão'
        Wait-Match '^0,00040564 tBTC$' 10 -FailOn @() | Out-Null; Ok 'total = valor + taxa de 564 sats (141 vB a 4 sat/vB)'
        $chips = @(Screen-Texts | Where-Object { $_ -match '^[0-9a-z]{1,4}$' -and $_ -ne '4' })
        if ($chips.Count -lt 8) { throw "endereço deveria aparecer em blocos de 4; vieram $($chips.Count)" }
        Ok "endereço de destino em $($chips.Count) blocos"
    }

    Step 'Segurar de verdade: toque rápido NÃO envia, seguro por 1,2 s abre o PIN' {
        $n = Find-Node (Get-Ui) 'btn-hold-send'
        $c = Get-Center $n
        & $script:Adb shell input tap $c.X $c.Y
        Start-Sleep 2
        if (Find-Node (Get-Ui) 'Autorizar envio') { throw 'um toque rápido não deveria abrir o PIN' }
        Ok 'toque rápido ignorado'
        & $script:Adb shell input swipe $c.X $c.Y $c.X $c.Y 1900
        Wait-Text 'Autorizar envio' 20 | Out-Null; Ok 'segurar por ~2 s abre a autorização por PIN'
    }

    Step 'PIN: errado recusa sem enviar; certo assina e transmite' {
        Tap-Pin '000001'
        Wait-Match '^PIN incorreto' 90 -FailOn @() | Out-Null
        if ((Fake-State).broadcasts.Count -ne 0) { throw 'transmitiu com PIN errado!' }
        Ok 'PIN errado: nada foi transmitido'
        Tap-Pin $PIN
        Wait-Text 'Enviado' 120 | Out-Null
        Ok 'tela Enviado'
        $b = (Fake-State).broadcasts
        if ($b.Count -ne 1) { throw "esperava 1 transmissão, houve $($b.Count)" }
        $script:hex1 = $b[0]
        Ok 'exatamente 1 transação transmitida'
    }

    Step 'A transação assinada é válida (verificação independente)' {
        Push-Location $core
        try { $env:TEST_WORDS = $script:TestWords; $json = node scripts/verify-tx.mjs testnet $script:hex1 100000 } finally { $env:TEST_WORDS = $null; Pop-Location }
        $v = $json | ConvertFrom-Json
        if (-not $v.inputs[0].signatureValid) { throw 'ASSINATURA INVÁLIDA' }
        if (-not $v.inputs[0].hashTypeAll) { throw 'SIGHASH diferente de ALL' }
        if ($v.inputs[0].path -ne "m/84'/1'/0'/0/0") { throw "a entrada deveria vir de m/84'/1'/0'/0/0, veio $($v.inputs[0].path)" }
        Ok 'assinatura ECDSA válida (low-S, SIGHASH_ALL), chave do endereço financiado'
        if ($v.outputs.Count -ne 2) { throw "esperava 2 saídas, vieram $($v.outputs.Count)" }
        $toDest = $v.outputs | Where-Object { $_.address -eq $script:dest }
        if (-not $toDest -or $toDest.value -ne 40000) { throw 'saída do destino ausente ou com valor errado' }
        Ok 'destino recebe exatamente 40.000 sats'
        $changeAddr = Independent-Address $script:TestWords '1' '0'
        $change = $v.outputs | Where-Object { $_.address -eq $changeAddr }
        if (-not $change) { throw 'o troco não foi para o endereço de troco m/84''/1''/0''/1/0 da carteira' }
        if ($change.value -ne (100000 - 40000 - $v.fee)) { throw 'troco não fecha com valor + taxa' }
        Ok "troco de $($change.value) sats volta para a própria carteira"
        if ($v.fee -lt 540 -or $v.fee -gt 590) { throw "taxa fora do esperado (4 sat/vB): $($v.fee)" }
        Ok ("taxa {0} sats = {1:N2} sat/vB em {2} vB" -f $v.fee, $v.feeRate, $v.vsize)
    }

    Step 'Falha de rede ao transmitir: erro claro, nada duplicado, e dá para tentar de novo' {
        Tap-Text 'Concluir'; Wait-Home 30 | Out-Null
        Tap-Text 'Enviar'
        Fill-Send $script:dest '0,0003'
        Tap-Text 'Revisar envio'
        Wait-Text 'Segure para enviar' 20 | Out-Null
        $c = Get-Center (Find-Node (Get-Ui) 'btn-hold-send')
        & $script:Adb shell input swipe $c.X $c.Y $c.X $c.Y 1900
        Wait-Text 'Autorizar envio' 20 | Out-Null
        Fake-Post '/_fail' @{ status = 500; count = 1 }
        Tap-Pin $PIN
        Wait-Match 'HTTP 500' 120 -FailOn @() | Out-Null; Ok 'erro do servidor mostrado com clareza'
        if ((Fake-State).broadcasts.Count -ne 1) { throw 'a falha duplicou ou perdeu uma transmissão' }
        Ok 'nada foi duplicado (continua 1 transação)'
        Tap-Pin $PIN
        Wait-Text 'Enviado' 120 | Out-Null
        if ((Fake-State).broadcasts.Count -ne 2) { throw 'a nova tentativa não transmitiu' }
        Ok 'nova tentativa funciona (2 transações no total)'
    }

    Step 'Voltar do Android percorre o envio passo a passo' {
        Tap-Text 'Concluir'; Wait-Home 30 | Out-Null
        Tap-Text 'Enviar'
        Fill-Send $script:dest '0,0003'
        Tap-Text 'Revisar envio'; Wait-Text 'Segure para enviar' 20 | Out-Null
        $c = Get-Center (Find-Node (Get-Ui) 'btn-hold-send')
        & $script:Adb shell input swipe $c.X $c.Y $c.X $c.Y 1900
        Wait-Text 'Autorizar envio' 20 | Out-Null
        Back; Wait-Text 'Segure para enviar' 15 | Out-Null; Ok 'PIN -> Voltar -> Revisão'
        Back; Wait-Text 'Revisar envio' 15 | Out-Null; Ok 'Revisão -> Voltar -> Formulário'
        Back; Wait-Home 15 | Out-Null; Ok 'Formulário -> Voltar -> Início'
    }
}
finally {
    if ($fakeProc -and -not $fakeProc.HasExited) { Stop-Process -Id $fakeProc.Id -Force }
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'metro.ps1') -Mode normal | Out-Null
    $script:TestWords = $null
}

Write-Host "`n══════ RESULTADO ══════" -ForegroundColor Cyan
$results.GetEnumerator() | ForEach-Object { $c = if ($_.Value -eq 'PASSOU') { 'Green' } else { 'Red' }; Write-Host ("{0,-78} {1}" -f $_.Key, $_.Value) -ForegroundColor $c }
$failed = @($results.Values | Where-Object { $_ -ne 'PASSOU' }).Count
Write-Host "`n$($results.Count - $failed)/$($results.Count) etapas passaram"
exit $failed
