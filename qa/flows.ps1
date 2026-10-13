# Fluxos reutilizáveis pelos testes E2E. Só carteiras de TESTE; nunca imprime as palavras.
. "$PSScriptRoot\adb-driver.ps1"

# Primeiro texto da tela que casa com a expressão regular (ou $null).
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

# Cria uma carteira de teste do zero até a Home. Devolve o tempo (s) gasto em proteger com o PIN.
function New-TestWallet([string]$pin = '482916') {
    Start-FreshApp
    Tap-Text 'Criar carteira' 90
    Tap-Text 'Mostrar palavras'
    Start-Sleep 1
    $words = @(Read-SeedWords)
    if ($words.Count -ne 12) { throw "criação: esperava 12 palavras, vieram $($words.Count)" }
    $script:TestWords = $words -join ' '   # carteira DESCARTÁVEL de teste; nunca é impressa
    Tap-Text 'Anotei as palavras'
    Tap-Text 'Continuar'
    Assert-Text 'Confirme a frase' 'confirmação abre'
    $fields = @(Get-ConfirmFields)
    for ($k = 0; $k -lt 3; $k++) { Set-Field @(Get-ConfirmFields)[$k].Node $words[$fields[$k].Number - 1] }
    $n = Find-Scrolling 'Confirmar'
    $c = Get-Center $n
    & $script:Adb shell input tap $c.X $c.Y
    Assert-Text 'Crie seu PIN' 'tela de PIN'
    Tap-Pin $pin
    Assert-Text 'Repita o PIN' 'pede repetição'
    $t0 = Get-Date
    Tap-Pin $pin
    Wait-Home 120 | Out-Null
    [int]((Get-Date) - $t0).TotalSeconds
}

# Digita o PIN na tela de bloqueio e devolve o que apareceu: 'home' | texto do aviso | $null.
function Try-Unlock([string]$pin, [int]$seconds = 60) {
    Tap-Pin $pin
    $end = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $end) {
        $t = @(Screen-Texts)
        if (Test-OnHome $t) { return 'home' }
        $msg = $t | Where-Object { $_ -match '^PIN incorreto|^Bloqueado por|^Muitas tentativas' } | Select-Object -First 1
        if ($msg) { return $msg }
        Start-Sleep -Milliseconds 700
    }
    $f = Save-Diagnostics 'resultado do desbloqueio (Home ou aviso de PIN)' @(Screen-Texts)
    "SEM RESPOSTA em ${seconds}s (diagnóstico: $f)"
}
