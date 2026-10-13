# E2E 3: o endereço que o APP mostra na tela é válido na blockchain?
#  1) cria uma carteira DESCARTÁVEL de teste no emulador (testnet);
#  2) lê o endereço de recebimento da tela;
#  3) confere (a) no scanner mempool.space testnet4, (b) com uma implementação independente
#     (bitcoinjs-lib) e (c) que a mainnet o rejeita;
#  4) troca o app para MAINNET (só para GERAR o endereço; nada é movimentado, nenhum fundo
#     existe nessa seed) e repete a verificação na mainnet real;
#  5) volta para a testnet.
. "$PSScriptRoot\flows.ps1"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$results = [ordered]@{}
$PIN = '482916'
$core = Join-Path (Split-Path $PSScriptRoot) 'wallet-core'

function Step([string]$name, [scriptblock]$body) {
    Write-Host "`n▶ $name" -ForegroundColor Cyan
    try { & $body; $results[$name] = 'PASSOU' }
    catch { $results[$name] = "FALHOU: $($_.Exception.Message)"; Write-Host "  ✖ $($_.Exception.Message)" -ForegroundColor Red }
}

function Api([string]$url) {
    for ($try = 1; $try -le 5; $try++) {
        Start-Sleep -Milliseconds 500
        try { $r = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 30; return [pscustomobject]@{ Status = [int]$r.StatusCode; Json = ($r.Content | ConvertFrom-Json) } }
        catch {
            $resp = $_.Exception.Response
            if (-not $resp) { if ($try -eq 5) { throw }; Start-Sleep 2; continue }
            if ([int]$resp.StatusCode -eq 429 -and $try -lt 5) { Write-Host "  (scanner pediu calma: HTTP 429, tentativa $try/5)" -ForegroundColor Yellow; Start-Sleep (3 * $try); continue }
            return [pscustomobject]@{ Status = [int]$resp.StatusCode; Json = $null }
        }
    }
}

function Independent([string]$net) {
    Push-Location $core
    try { $env:TEST_WORDS = $script:TestWords; (node scripts/derive-independent.mjs $net 0 0).Trim() } finally { $env:TEST_WORDS = $null; Pop-Location }
}

function Tap-Match([string]$pattern, [int]$seconds = 15) {
    $end = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $end) {
        $n = (Get-Ui).SelectNodes('//node') | Where-Object { $_.text -match $pattern -or $_.'content-desc' -match $pattern } | Select-Object -First 1
        if ($n) { $c = Get-Center $n; & $script:Adb shell input tap $c.X $c.Y; Start-Sleep -Milliseconds 700; return }
        Start-Sleep -Milliseconds 600
    }
    throw "Não achei na tela algo parecido com: $pattern"
}

function Read-Address([string]$prefix) {
    # O endereço é calculado no aparelho: deve aparecer em segundos, com ou sem rede.
    Wait-Match "^$prefix[0-9a-z]{30,}$" 25
}

function Verify-OnChain([string]$net, [string]$address) {
    $base = if ($net -eq 'mainnet') { 'https://mempool.space/api' } else { 'https://mempool.space/testnet4/api' }
    $other = if ($net -eq 'mainnet') { 'https://mempool.space/testnet4/api' } else { 'https://mempool.space/api' }
    $v = Api "$base/v1/validate-address/$address"
    if (-not $v.Json.isvalid) { throw "o nó da $net recusou o endereço" }
    Write-Host "  OK  nó da $net validou o endereço (witness v$($v.Json.witness_version))" -ForegroundColor Green
    $a = Api "$base/address/$address"
    if ($a.Status -ne 200 -or $a.Json.address -ne $address) { throw 'scanner não reconheceu o endereço' }
    if ($a.Json.chain_stats.tx_count -ne 0) { throw "endereço novo com histórico? ($($a.Json.chain_stats.tx_count) tx)" }
    Write-Host '  OK  scanner reconhece o endereço; sem histórico (é novo, como esperado)' -ForegroundColor Green
    $x = Api "$other/address/$address"
    if ($x.Status -ne 400) { throw "a rede oposta deveria rejeitar o endereço (HTTP $($x.Status))" }
    Write-Host '  OK  a rede oposta rejeita o endereço (prefixo não se mistura)' -ForegroundColor Green
    $ind = Independent $net
    if ($ind -ne $address) { throw 'o endereço do app DIFERE da derivação independente' }
    Write-Host '  OK  igual à derivação independente (bitcoinjs-lib)' -ForegroundColor Green
}

$script:homeAddr = $null

Step 'Cria carteira de teste (testnet) e abre a Home' {
    $secs = New-TestWallet $PIN
    Write-Host "  OK  carteira criada (~${secs}s para proteger com o PIN)" -ForegroundColor Green
    Assert-Text 'TESTNET' 'rede testnet'
}

Step 'TESTNET: endereço da Home existe e é válido no scanner' {
    $script:homeAddr = Read-Address 'tb1q'
    Write-Host "  endereço: $($script:homeAddr)"
    Verify-OnChain 'testnet' $script:homeAddr
}

Step 'TESTNET: a tela Receber mostra o MESMO endereço' {
    Tap-Text 'Receber'
    Assert-Text 'Receber' 'tela Receber'
    $r = Read-Address 'tb1q'
    if ($r -ne $script:homeAddr) { throw 'Receber mostra um endereço diferente da Home' }
    Write-Host '  OK  mesmo endereço na Home e em Receber' -ForegroundColor Green
    Tap-Text 'Voltar'
    Wait-Home 30 | Out-Null; Write-Host '  OK  voltou à Home' -ForegroundColor Green
}

Step 'MAINNET (só gerar endereço): trocar de rede exige confirmação' {
    Tap-Text 'Ajustes'
    Tap-Text 'Mudar para mainnet'
    Assert-Text 'Usar a mainnet?' 'aviso de risco aparece'
    Tap-Match '(?i)^cancelar$'
    Assert-Text 'Testnet4 (sem valor)' 'cancelar mantém a testnet'
}

Step 'MAINNET: confirma, desbloqueia e valida o endereço na blockchain real' {
    Tap-Text 'Mudar para mainnet'
    Tap-Match '(?i)entendo o risco'
    Assert-Text 'Digite seu PIN' 'a troca de rede exige novo desbloqueio'
    $r = Try-Unlock $PIN 120
    if ($r -ne 'home') { throw "não abriu após trocar de rede: $r" }
    Assert-Text 'MAINNET' 'selo vermelho de mainnet na Home'
    $addr = Read-Address 'bc1q'
    Write-Host "  endereço: $addr"
    if ($addr -eq $script:homeAddr) { throw 'mesmo endereço nas duas redes' }
    Verify-OnChain 'mainnet' $addr
}

Step 'Volta para a testnet' {
    Tap-Text 'Ajustes'
    Tap-Text 'Voltar para a testnet'
    Assert-Text 'Digite seu PIN' 'exige novo desbloqueio'
    $r = Try-Unlock $PIN 120
    if ($r -ne 'home') { throw "não abriu: $r" }
    Assert-Text 'TESTNET' 'testnet de volta'
    $again = Read-Address 'tb1q'
    if ($again -ne $script:homeAddr) { throw 'o endereço testnet mudou após ida e volta' }
    Write-Host '  OK  endereço testnet idêntico após ida e volta' -ForegroundColor Green
}

$script:TestWords = $null
Write-Host "`n══════ RESULTADO ══════" -ForegroundColor Cyan
$results.GetEnumerator() | ForEach-Object { $c = if ($_.Value -eq 'PASSOU') { 'Green' } else { 'Red' }; Write-Host ("{0,-72} {1}" -f $_.Key, $_.Value) -ForegroundColor $c }
$failed = @($results.Values | Where-Object { $_ -ne 'PASSOU' }).Count
Write-Host "`n$($results.Count - $failed)/$($results.Count) etapas passaram"
exit $failed
