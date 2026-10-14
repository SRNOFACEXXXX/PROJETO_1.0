# E2E 1: criar carteira no visual novo. Roda no emulador, com toques visíveis.
# Carteira de TESTE; as palavras da frase nunca são impressas.
#
# Quiz de backup (o ponto mais crítico do onboarding): prova que o botão só libera com a palavra
# certa, que as 4 opções são distintas e vêm da própria frase, e que o "Voltar" mantém as palavras.
. "$PSScriptRoot\flows.ps1"
$ErrorActionPreference = 'Stop'
$results = [ordered]@{}
$script:words = @()
$PIN = '482916'

function Step([string]$name, [scriptblock]$body) {
    Write-Host "`n▶ $name" -ForegroundColor Cyan
    try { & $body; $results[$name] = 'PASSOU' }
    catch { $results[$name] = "FALHOU: $($_.Exception.Message)"; Write-Host "  ✖ $($_.Exception.Message)" -ForegroundColor Red }
}

function Ok([string]$msg) { Write-Host "  OK  $msg" -ForegroundColor Green }

# Opções do quiz: botões cujo nome é uma das 12 palavras.
function Get-QuizOptions {
    @((Get-Ui).SelectNodes('//node') | Where-Object { $_.clickable -eq 'true' -and ($script:words -contains $_.'content-desc') } | ForEach-Object { $_.'content-desc' })
}

Start-FreshApp

Step 'Boas-vindas' {
    Assert-Text 'Criar nova carteira' 'botão Criar nova carteira'
    Assert-Text 'Importar carteira' 'botão Importar carteira'
    Assert-Text 'Versão de testes. Rede padrão: testnet. Não use com dinheiro real.' 'aviso de testnet'
}

Step 'Aviso da frase (etapa 1/4)' {
    Tap-Text 'Criar nova carteira'
    Assert-Text 'Suas 12 palavras são a única chave.' 'título do aviso'
    Assert-Text 'TESTNET · SEM VALOR' 'selo da rede'
    Assert-Text 'Anote em papel, na ordem exata' 'regra 1'
    Assert-Text 'Nunca compartilhe, nem com o suporte' 'regra 3'
    Assert-Text '1/4' 'indicador de etapa'
}

Step 'Frase oculta até pedir (etapa 2/4)' {
    Tap-Text 'Entendi, continuar'
    Assert-Text 'Anote suas 12 palavras' 'tela da frase'
    Assert-Text '2/4' 'indicador de etapa'
    if (@(Read-SeedWords).Count -ne 0) { throw 'palavras visíveis antes de pedir' }
    $masked = @(Screen-Texts | Where-Object { $_ -eq '••••••' }).Count
    if ($masked -ne 12) { throw "esperava 12 máscaras, vieram $masked" }
    Ok '12 máscaras no lugar das palavras'
    if (Test-Enabled 'Já anotei as palavras') { throw 'Já anotei deveria estar desabilitado antes de revelar' }
    Ok 'Já anotei desabilitado antes de revelar'
}

Step 'Revelar mostra 12 palavras válidas' {
    Tap-Text 'Mostrar palavras'
    Start-Sleep 1
    $script:words = @(Read-SeedWords)
    if ($script:words.Count -ne 12) { throw "esperava 12 palavras, vieram $($script:words.Count)" }
    if (($script:words | Sort-Object -Unique).Count -lt 9) { throw 'palavras suspeitas (repetição demais)' }
    Ok '12 palavras exibidas (não impressas)'
    if (-not (Test-Enabled 'Já anotei as palavras')) { throw 'Já anotei deveria habilitar após revelar' }
    Ok 'Já anotei habilitado'
}

Step 'Quiz: opções distintas, todas da própria frase, botão travado' {
    Tap-Text 'Já anotei as palavras'
    Assert-Text 'Confirme o backup' 'tela do quiz'
    Assert-Text '3/4' 'indicador de etapa'
    $num = Read-QuizNumber
    $opts = Get-QuizOptions
    if ($opts.Count -ne 4) { throw "esperava 4 opções, vieram $($opts.Count)" }
    if (($opts | Sort-Object -Unique).Count -ne 4) { throw 'opções repetidas' }
    if ($opts -notcontains $script:words[$num - 1]) { throw 'a palavra certa não está entre as opções' }
    Ok "4 opções distintas; a certa (nº $num) está entre elas"
    if (Test-Enabled 'Escolha uma palavra') { throw 'botão deveria estar travado sem resposta' }
    Ok 'botão travado antes de responder'
}

Step 'Quiz: resposta errada é recusada, certa libera' {
    $num = Read-QuizNumber
    $right = $script:words[$num - 1]
    $wrong = (Get-QuizOptions) | Where-Object { $_ -ne $right } | Select-Object -First 1
    Tap-Text $wrong
    Assert-Text 'Não é essa. Confira o papel e tente de novo.' 'mensagem de erro'
    if (Test-Enabled 'Escolha uma palavra') { throw 'botão liberou com resposta errada!' }
    Ok 'resposta errada não libera'
    Tap-Text $right
    Assert-Text 'Correto.' 'mensagem de acerto'
    if (-not (Test-Enabled 'Próxima pergunta')) { throw 'botão deveria liberar com a resposta certa' }
    Ok 'resposta certa libera'
}

Step 'Voltar do quiz mantém as MESMAS 12 palavras' {
    Tap-Text 'Voltar'
    Assert-Text 'Anote suas 12 palavras' 'voltou à frase'
    Tap-Text 'Mostrar palavras'
    Start-Sleep 1
    $again = @(Read-SeedWords)
    if (($again -join ' ') -ne ($script:words -join ' ')) { throw 'as palavras mudaram ao voltar (usuário perderia o que anotou)' }
    Ok 'mesmas palavras após voltar'
    Tap-Text 'Já anotei as palavras'
}

Step 'Quiz: 3 perguntas com posições distintas e crescentes' {
    $seen = @()
    for ($q = 1; $q -le 3; $q++) {
        Wait-Match "Pergunta $q de 3\." 15 | Out-Null; Ok "pergunta $q de 3"
        $num = Read-QuizNumber
        $seen += $num
        Tap-Text $script:words[$num - 1]
        $next = if ($q -lt 3) { 'Próxima pergunta' } else { 'Continuar · +100 XP' }
        Assert-Text $(if ($q -lt 3) { 'Correto.' } else { 'Correto. Backup validado.' }) 'acerto'
        Tap-Text $next
    }
    if (($seen | Sort-Object -Unique).Count -ne 3) { throw "posições repetidas: $($seen -join ',')" }
    if (($seen -join ',') -ne (($seen | Sort-Object) -join ',')) { throw 'posições fora de ordem' }
    Ok "perguntas sobre as palavras nº $($seen -join ', ')"
}

Step 'PIN: botão travado, fraco recusado, divergente recusado' {
    Assert-Text 'Crie seu PIN' 'tela de PIN'
    Assert-Text '4/4' 'indicador de etapa'
    if (Test-Enabled 'Digite os 6 dígitos') { throw 'botão deveria estar travado sem os 6 dígitos' }
    Ok 'botão travado sem os 6 dígitos'
    Tap-Pin '123456'; Tap-Text 'Continuar'
    Assert-Text 'O PIN não pode ser uma sequência.' 'sequência recusada'
    Tap-Pin '111111'; Tap-Text 'Continuar'
    Assert-Text 'O PIN não pode repetir o mesmo dígito.' 'repetição recusada'
    Tap-Pin $PIN; Tap-Text 'Continuar'
    Assert-Text 'Repita o PIN' 'pede repetição'
    Tap-Pin '482917'; Tap-Text 'Criar minha carteira'
    Assert-Text 'Os PINs não conferem. Comece de novo.' 'divergência detectada'
    Assert-Text 'Crie seu PIN' 'voltou ao primeiro passo'
}

Step 'PIN forte cria a carteira' {
    Tap-Pin $PIN; Tap-Text 'Continuar'
    Assert-Text 'Repita o PIN' 'pede repetição'
    Tap-Pin $PIN; Tap-Text 'Criar minha carteira'
    Wait-Text 'Acessar carteira' 120 | Out-Null
    Ok 'carteira criada'
}

Step 'Tela "Carteira criada": endereço, Solana em breve, nível e XP reais' {
    Assert-Text 'Carteira criada' 'título'
    $addr = Wait-Match '^tb1q[0-9a-z]{30,}$' 20
    Ok "endereço testnet exibido ($($addr.Substring(0, 10))…)"
    Assert-Text "m/84'/1'/0'/0/0" 'caminho BIP84 testnet'
    Assert-Text 'em breve' 'Solana marcada como em breve (sem fingir suporte)'
    Assert-Text 'Nível 1 · Guardião' 'nível 1'
    Assert-Text '+150 XP' 'XP real: 100 do backup + 50 do PIN'
}

Step 'Home: rede, nível, sequência e atalhos' {
    Tap-Text 'Acessar carteira'
    Wait-Home 60 | Out-Null
    Assert-Text 'TESTNET' 'selo de rede'
    Assert-Text 'Carteira Principal' 'nome da carteira'
    Assert-Text '1 dia' 'sequência de 1 dia'
    Assert-Text 'Enviar' 'botão Enviar'
    Assert-Text 'Receber' 'botão Receber'
    Assert-Text 'Bitcoin' 'linha do ativo'
    Assert-Text 'Mercado' 'aba Mercado'
    Assert-Text 'Atividade' 'aba Atividade'
}

Write-Host "`n══════ RESULTADO ══════" -ForegroundColor Cyan
$results.GetEnumerator() | ForEach-Object { $c = if ($_.Value -eq 'PASSOU') { 'Green' } else { 'Red' }; Write-Host ("{0,-70} {1}" -f $_.Key, $_.Value) -ForegroundColor $c }
$failed = @($results.Values | Where-Object { $_ -ne 'PASSOU' }).Count
Write-Host "`n$($results.Count - $failed)/$($results.Count) etapas passaram"
exit $failed
