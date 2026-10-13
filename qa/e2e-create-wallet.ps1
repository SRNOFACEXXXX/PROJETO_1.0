# E2E 1: criar carteira. Roda no emulador, com toques visíveis. Carteira de TESTE;
# as palavras da frase nunca são impressas.
#
# Confirmação das 3 palavras (o ponto mais crítico do onboarding): cada caso abaixo
# prova que o botão Confirmar só habilita quando as 3 palavras estão certas, nos
# campos certos. Se o botão não for encontrado, o teste FALHA (não adivinha).
. "$PSScriptRoot\adb-driver.ps1"
$ErrorActionPreference = 'Stop'
$results = [ordered]@{}
$script:words = @()
$script:fields = @()

function Step([string]$name, [scriptblock]$body) {
    Write-Host "`n▶ $name" -ForegroundColor Cyan
    try { & $body; $results[$name] = 'PASSOU' }
    catch { $results[$name] = "FALHOU: $($_.Exception.Message)"; Write-Host "  ✖ $($_.Exception.Message)" -ForegroundColor Red }
}

function Fill-Fields([string[]]$values) {
    $f = @(Get-ConfirmFields)
    for ($k = 0; $k -lt 3; $k++) { Set-Field $f[$k].Node $values[$k] }
}

function Right([int]$k) { $script:words[$script:fields[$k].Number - 1] }

function Expect-Confirm([bool]$enabled, [string]$because) {
    $actual = Test-Enabled 'Confirmar'
    if ($actual -ne $enabled) {
        $want = if ($enabled) { 'HABILITADO' } else { 'DESABILITADO' }
        throw "Confirmar deveria estar $want ($because)"
    }
    Write-Host "  OK  $because" -ForegroundColor Green
}

# Começa do zero: limpa só os dados do app NOVO.
& $script:Adb shell pm clear $script:Pkg | Out-Null
& $script:Adb shell monkey -p $script:Pkg -c android.intent.category.LAUNCHER 1 | Out-Null

Step 'Tela inicial: aviso de testnet' {
    Assert-Text 'Criar carteira' 'botão Criar carteira visível'
    Assert-Text 'Versão de testes. Rede padrão: testnet. Não use com dinheiro real.' 'aviso de testnet'
}

Step 'Frase oculta até o usuário pedir' {
    Tap-Text 'Criar carteira'
    Assert-Text 'Frase de recuperação' 'tela da frase abre'
    Assert-Text 'Mostrar palavras' 'botão revelar presente'
    if (@(Read-SeedWords).Count -ne 0) { throw 'palavras visíveis antes de pedir' }
    Write-Host '  OK  nenhuma palavra visível antes de revelar' -ForegroundColor Green
    if (Test-Enabled 'Continuar') { throw 'Continuar deveria estar desabilitado antes de anotar' }
    Write-Host '  OK  Continuar desabilitado antes de anotar' -ForegroundColor Green
}

Step 'Revelar mostra 12 palavras válidas e distintas' {
    Tap-Text 'Mostrar palavras'
    Start-Sleep 1
    $script:words = @(Read-SeedWords)
    if ($script:words.Count -ne 12) { throw "esperava 12 palavras, vieram $($script:words.Count)" }
    if (($script:words | Sort-Object -Unique).Count -lt 9) { throw 'palavras suspeitas (repetição demais)' }
    Write-Host '  OK  12 palavras exibidas (não impressas)' -ForegroundColor Green
}

Step 'Continuar só libera depois de "Anotei"' {
    Tap-Text 'Anotei as palavras'
    if (-not (Test-Enabled 'Continuar')) { throw 'Continuar deveria habilitar após anotar' }
    Write-Host '  OK  Continuar habilitado' -ForegroundColor Green
    Tap-Text 'Continuar'
    Assert-Text 'Confirme a frase' 'tela de confirmação abre'
}

Step 'Confirmação: 3 campos, números distintos e em ordem crescente' {
    $script:fields = @(Get-ConfirmFields)
    if ($script:fields.Count -ne 3) { throw "esperava 3 campos, vieram $($script:fields.Count)" }
    $n = @($script:fields | ForEach-Object { $_.Number })
    if (($n | Sort-Object -Unique).Count -ne 3) { throw 'números repetidos' }
    if (($n | Where-Object { $_ -lt 1 -or $_ -gt 12 }).Count -gt 0) { throw 'número fora de 1..12' }
    if (($n -join ',') -ne (($n | Sort-Object) -join ',')) { throw 'campos fora de ordem' }
    Write-Host "  OK  campos pedem as palavras nº $($n -join ', ')" -ForegroundColor Green
}

Step 'Confirmação A: campos vazios -> desabilitado' {
    Expect-Confirm $false 'vazio não confirma'
}

Step 'Confirmação B: só 1 de 3 certa -> desabilitado' {
    Fill-Fields @((Right 0), '', '')
    Expect-Confirm $false 'apenas a 1ª certa'
}

Step 'Confirmação C: 2 certas e 1 errada -> desabilitado' {
    Fill-Fields @((Right 0), (Right 1), 'zzzzz')
    Expect-Confirm $false 'duas certas, uma errada'
}

Step 'Confirmação D: palavras certas nos campos trocados -> desabilitado' {
    Fill-Fields @((Right 1), (Right 2), (Right 0))
    Expect-Confirm $false 'ordem errada'
}

Step 'Confirmação E: palavra da frase, mas de outra posição -> desabilitado' {
    $other = $script:words[($script:fields[0].Number) % 12]   # posição seguinte à pedida
    if ($other -eq (Right 0)) { Write-Host '  (palavra repetida na frase; caso ignorado)' } else {
        Fill-Fields @($other, (Right 1), (Right 2))
        Expect-Confirm $false 'palavra de outra posição'
    }
}

Step 'Confirmação F: certas com espaços e maiúsculas -> habilitado' {
    Fill-Fields @(('  ' + (Right 0).ToUpper() + ' '), (Right 1), (Right 2))
    Expect-Confirm $true 'o app normaliza maiúsculas e espaços'
}

Step 'Voltar da confirmação mantém as MESMAS 12 palavras' {
    Tap-Text 'Voltar'
    Assert-Text 'Frase de recuperação' 'voltou para a frase'
    Tap-Text 'Mostrar palavras'
    Start-Sleep 1
    $again = @(Read-SeedWords)
    if (($again -join ' ') -ne ($script:words -join ' ')) { throw 'as palavras mudaram ao voltar (usuário perderia o que anotou)' }
    Write-Host '  OK  mesmas palavras após voltar' -ForegroundColor Green
    Tap-Text 'Anotei as palavras'; Tap-Text 'Continuar'
    Assert-Text 'Confirme a frase' 'confirmação abre de novo'
    # A cada visita o app sorteia 3 posições novas: releia quais são.
    $script:fields = @(Get-ConfirmFields)
    if ($script:fields.Count -ne 3) { throw 'campos da confirmação não encontrados após voltar' }
}

Step 'Confirmação G: 3 certas -> habilitado e avança para o PIN' {
    Fill-Fields @((Right 0), (Right 1), (Right 2))
    Expect-Confirm $true 'três palavras certas'
    $n = Find-Scrolling 'Confirmar'
    $c = Get-Center $n
    & $script:Adb shell input tap $c.X $c.Y
    Assert-Text 'Crie seu PIN' 'tela de PIN abre'
}

Step 'PIN fraco é recusado' {
    Tap-Pin '123456'
    Assert-Text 'O PIN não pode ser uma sequência.' 'sequência recusada'
    Tap-Pin '111111'
    Assert-Text 'O PIN não pode repetir o mesmo dígito.' 'repetição recusada'
}

Step 'PINs diferentes não passam' {
    Tap-Pin '482916'; Assert-Text 'Repita o PIN' 'pede repetição'
    Tap-Pin '482917'
    Assert-Text 'Os PINs não conferem. Comece de novo.' 'divergência detectada'
}

Step 'PIN forte cria a carteira e abre a Home' {
    Tap-Pin '482916'; Assert-Text 'Repita o PIN' 'pede repetição'
    Tap-Pin '482916'
    if (-not (Wait-Text 'Saldo disponível' 90)) { throw 'Home não abriu' }
    Assert-Text 'TESTNET' 'rede testnet ativa'
    Assert-Text 'Receber' 'botão Receber'
}

Write-Host "`n══════ RESULTADO ══════" -ForegroundColor Cyan
$results.GetEnumerator() | ForEach-Object { $c = if ($_.Value -eq 'PASSOU') { 'Green' } else { 'Red' }; Write-Host ("{0,-62} {1}" -f $_.Key, $_.Value) -ForegroundColor $c }
$failed = @($results.Values | Where-Object { $_ -ne 'PASSOU' }).Count
Write-Host "`n$($results.Count - $failed)/$($results.Count) etapas passaram"
exit $failed
