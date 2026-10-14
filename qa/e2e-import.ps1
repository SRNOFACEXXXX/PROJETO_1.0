# E2E 6: importar uma carteira existente. Usa SÓ vetores públicos de teste do BIP39 (nunca uma seed real).
. "$PSScriptRoot\flows.ps1"
$ErrorActionPreference = 'Stop'
$results = [ordered]@{}
$PIN = '482916'
$core = Join-Path (Split-Path $PSScriptRoot) 'wallet-core'
# Vetor público do BIP39/BIP84 (12 palavras) e o de 24 palavras.
$V12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
$V24 = ('abandon ' * 23) + 'art'

function Step([string]$name, [scriptblock]$body) {
    Write-Host "`n▶ $name" -ForegroundColor Cyan
    try { & $body; $results[$name] = 'PASSOU' }
    catch { $results[$name] = "FALHOU: $($_.Exception.Message)"; Write-Host "  ✖ $($_.Exception.Message)" -ForegroundColor Red }
}
function Ok([string]$msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Back { & $script:Adb shell input keyevent KEYCODE_BACK; Start-Sleep -Milliseconds 900 }
function Type-Phrase([string]$phrase) {
    $n = Wait-Until { param($ui, $t) Find-Node $ui 'import-input' } 'campo da frase' 20
    Set-Field $n $phrase 300   # frases de até 24 palavras (~200 caracteres): limpa com folga
    Hide-Keyboard
}
function Independent-Address([string]$words) {
    Push-Location $core
    try { $env:TEST_WORDS = $words; (node scripts/derive-independent.mjs testnet 0 0).Trim() } finally { $env:TEST_WORDS = $null; Pop-Location }
}

Start-FreshApp

Step 'Tela de importar: botão travado e contador de palavras' {
    Tap-Text 'Importar carteira' 90
    Assert-Text 'Importar carteira' 'tela de importar'
    if (Test-Enabled 'Importar e criar PIN') { throw 'o botão deveria estar travado sem palavras' }
    Ok 'botão travado sem palavras'
    Assert-Text '0/12' 'contador em 0/12'
    Type-Phrase 'abandon abandon abandon'
    Assert-Text '3/12' 'contador em 3/12'
    if (-not (Test-Enabled 'Importar e criar PIN')) { throw 'o botão deveria liberar com algum texto' }
    Ok 'botão libera ao digitar'
}

Step 'Frase inválida é recusada com mensagem clara (e sem avançar)' {
    Tap-Text 'Importar e criar PIN'
    Wait-Match '^Frase inválida\.' 15 -FailOn @() | Out-Null; Ok 'mensagem de frase inválida'
    Assert-Text 'Importar carteira' 'continua na tela de importar'
    Type-Phrase ($V12 -replace 'about$', 'abandon')
    Tap-Text 'Importar e criar PIN'
    Wait-Match '^Frase inválida\.' 15 -FailOn @() | Out-Null; Ok 'checksum errado recusado'
    Type-Phrase ($V12 -replace 'about$', 'zzzzzz')
    Tap-Text 'Importar e criar PIN'
    Wait-Match '^Frase inválida\.' 15 -FailOn @() | Out-Null; Ok 'palavra fora da lista BIP39 recusada'
}

Step 'Frase de 24 palavras válida é aceita (contador 24/24) e Voltar do Android volta' {
    Type-Phrase $V24
    Assert-Text '24/24' 'contador em 24/24'
    Tap-Text 'Importar e criar PIN'
    Assert-Text 'Crie seu PIN' 'seguiu para o PIN'
    Assert-Text '4/4' 'etapa 4/4'
    Back
    Assert-Text 'Importar carteira' 'Voltar do Android volta à tela de importar'
}

Step 'Importar o vetor de 12 palavras (com maiúsculas e espaços extras) cria a carteira' {
    Type-Phrase ('  ' + $V12.ToUpper().Replace(' ', '   ') + ' ')
    Assert-Text '12/12' 'contador em 12/12'
    Tap-Text 'Importar e criar PIN'
    Create-Pin $PIN
    Wait-Text 'Acessar carteira' 120 | Out-Null
    Assert-Text 'Carteira importada' 'título da tela final'
    Ok 'carteira importada'
}

Step 'O endereço importado é o da derivação independente; XP só do PIN' {
    $expected = Independent-Address $V12
    $shown = Wait-Match '^tb1q[0-9a-z]{30,}$' 20
    if ($shown -ne $expected) { throw "endereço $shown difere da derivação independente $expected" }
    Ok "endereço $($shown.Substring(0, 12))… idêntico à derivação independente"
    Assert-Text '+50 XP' 'importar não ganha o XP do backup (só o do PIN)'
    Tap-Text 'Acessar carteira'
    Wait-Home 60 | Out-Null
    $r = Read-ReceiveAddress 'tb1q'
    if ($r -ne $expected) { throw 'Receber mostra outro endereço' }
    Ok 'Receber mostra o mesmo endereço'
}

Write-Host "`n══════ RESULTADO ══════" -ForegroundColor Cyan
$results.GetEnumerator() | ForEach-Object { $c = if ($_.Value -eq 'PASSOU') { 'Green' } else { 'Red' }; Write-Host ("{0,-78} {1}" -f $_.Key, $_.Value) -ForegroundColor $c }
$failed = @($results.Values | Where-Object { $_ -ne 'PASSOU' }).Count
Write-Host "`n$($results.Count - $failed)/$($results.Count) etapas passaram"
exit $failed
