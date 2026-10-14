# E2E 8: apagar a carteira deste aparelho (Ajustes). Carteira de TESTE.
# Prova: cancelar não apaga; confirmar apaga; depois de reabrir o app não há cofre nem tela de PIN.
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

Step 'Cria carteira de teste e chega na Home' {
    New-TestWallet $PIN | Out-Null
    Wait-Home 30 | Out-Null
    Ok 'Home aberta'
}

Step 'Cancelar o diálogo NÃO apaga a carteira' {
    Tap-Text 'Ajustes'
    Tap-Text 'Apagar carteira deste aparelho'
    Assert-Text 'Apagar a carteira deste aparelho?' 'diálogo de confirmação com o aviso'
    Tap-Text 'Cancelar'
    Start-Sleep 1
    if ((Screen-Texts) -match 'Criar nova carteira') { throw 'a carteira foi apagada ao cancelar' }
    Ok 'continua em Ajustes, carteira intacta'
}

Step 'Confirmar apaga e volta às Boas-vindas' {
    Tap-Text 'Apagar carteira deste aparelho'
    Assert-Text 'Apagar a carteira deste aparelho?' 'diálogo de confirmação'
    Tap-Text 'Apagar'
    Assert-Text 'Criar nova carteira' 'voltou às Boas-vindas'
    Ok 'carteira apagada'
}

Step 'Reabrir o app: sem cofre, sem tela de PIN, sem dados antigos' {
    Restart-App
    Assert-Text 'Criar nova carteira' 'o app abre nas Boas-vindas'
    $s = Screen-Texts
    if ($s -match 'Digite seu PIN') { throw 'o app pediu PIN: o cofre sobreviveu ao apagar' }
    if ($s -match '^tb1q|^bc1q') { throw 'um endereço antigo apareceu' }
    Ok 'nenhum resquício da carteira'
}

Step 'O PIN antigo não abre nada: criar uma carteira nova começa do zero' {
    Tap-Text 'Importar carteira'
    Assert-Text 'Importar carteira' 'tela de importação, não de desbloqueio'
    Ok 'fluxo limpo'
}

Write-Host "`n══════ RESULTADO ══════" -ForegroundColor Cyan
$results.GetEnumerator() | ForEach-Object { $c = if ($_.Value -eq 'PASSOU') { 'Green' } else { 'Red' }; Write-Host ("{0,-78} {1}" -f $_.Key, $_.Value) -ForegroundColor $c }
$failed = @($results.Values | Where-Object { $_ -ne 'PASSOU' }).Count
Write-Host "`n$($results.Count - $failed)/$($results.Count) etapas passaram"
exit $failed
