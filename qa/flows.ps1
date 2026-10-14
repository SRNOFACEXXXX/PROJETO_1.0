# Fluxos reutilizáveis pelos testes E2E. Só carteiras de TESTE; nunca imprime as palavras.
. "$PSScriptRoot\adb-driver.ps1"

# Primeiro texto da tela que casa com a expressão regular (falha com diagnóstico se não aparecer).
function Wait-Match([string]$pattern, [int]$seconds = 15, [string[]]$FailOn = $null) {
    Wait-Until ({ param($ui, $t) $t | Where-Object { $_ -match $pattern } | Select-Object -First 1 }.GetNewClosure()) "texto /$pattern/" $seconds $FailOn
}

function Start-FreshApp {
    & $script:Adb shell pm clear $script:Pkg | Out-Null
    & $script:Adb shell monkey -p $script:Pkg -c android.intent.category.LAUNCHER 1 | Out-Null
}

function Restart-App {
    & $script:Adb shell am force-stop $script:Pkg
    Start-Sleep 1
    & $script:Adb shell monkey -p $script:Pkg -c android.intent.category.LAUNCHER 1 | Out-Null
}

# Lê a pergunta atual do quiz: número da palavra pedida (content-desc "Palavra número N").
function Read-QuizNumber {
    $n = Wait-Until ({ param($ui, $t) $ui.SelectNodes('//node') | Where-Object { $_.'content-desc' -match '^Palavra número \d+$' } | Select-Object -First 1 }) 'pergunta do quiz' 20
    [int]($n.'content-desc' -replace '\D', '')
}

# Responde as 3 perguntas do quiz de backup (só acerta; os casos de erro ficam em e2e-create-wallet).
function Complete-Quiz([string[]]$words) {
    for ($q = 1; $q -le 3; $q++) {
        $num = Read-QuizNumber
        Tap-Text $words[$num - 1]
        $next = if ($q -lt 3) { 'Próxima pergunta' } else { 'Continuar · +100 XP' }
        Tap-Text $next
    }
}

# Cria o PIN (duas digitações, botão a cada etapa). Termina na tela "Carteira criada".
function Create-Pin([string]$pin) {
    Assert-Text 'Crie seu PIN' 'tela de PIN'
    Tap-Pin $pin
    Tap-Text 'Continuar'
    Assert-Text 'Repita o PIN' 'pede repetição'
    Tap-Pin $pin
    Tap-Text 'Criar minha carteira'
}

# Cria uma carteira de teste do zero até a Home. Devolve os segundos gastos em proteger com o PIN.
function New-TestWallet([string]$pin = '482916') {
    Start-FreshApp
    Tap-Text 'Criar nova carteira' 90
    Tap-Text 'Entendi, continuar'
    Tap-Text 'Mostrar palavras'
    Start-Sleep 1
    $words = @(Read-SeedWords)
    if ($words.Count -ne 12) { throw "criação: esperava 12 palavras, vieram $($words.Count)" }
    $script:TestWords = $words -join ' '   # carteira DESCARTÁVEL de teste; nunca é impressa
    Tap-Text 'Já anotei as palavras'
    Complete-Quiz $words
    $t0 = $null
    Assert-Text 'Crie seu PIN' 'tela de PIN'
    Tap-Pin $pin
    Tap-Text 'Continuar'
    Assert-Text 'Repita o PIN' 'pede repetição'
    Tap-Pin $pin
    Tap-Text 'Criar minha carteira'
    $t0 = Get-Date
    Wait-Text 'Acessar carteira' 120 | Out-Null
    $secs = [int]((Get-Date) - $t0).TotalSeconds
    Tap-Text 'Acessar carteira'
    Wait-Home 60 | Out-Null
    $secs
}

# Digita o PIN na tela de bloqueio e devolve o que apareceu: 'home' | texto do aviso | motivo da falha.
function Try-Unlock([string]$pin, [int]$seconds = 60) {
    Tap-Pin $pin
    $start = Get-Date   # o tempo do cofre conta a partir do ÚLTIMO toque (os toques do robô não são do app)
    $end = $start.AddSeconds($seconds)
    while ((Get-Date) -lt $end) {
        $t = @(Screen-Texts)
        if (Test-OnHome $t) { $script:LastUnlockSecs = [int]((Get-Date) - $start).TotalSeconds; return 'home' }
        $msg = $t | Where-Object { $_ -match '^PIN incorreto|^Bloqueado por|^Muitas tentativas' } | Select-Object -First 1
        if ($msg) { return $msg }
        Start-Sleep -Milliseconds 700
    }
    $f = Save-Diagnostics 'resultado do desbloqueio (Home ou aviso de PIN)' @(Screen-Texts)
    "SEM RESPOSTA em ${seconds}s (diagnóstico: $f)"
}

# Abre a tela Receber e devolve o endereço mostrado (calculado no aparelho; deve aparecer em segundos).
function Read-ReceiveAddress([string]$prefix) {
    Tap-Text 'Receber'
    $a = Wait-Match "^$prefix[0-9a-z]{30,}$" 25
    $a
}
