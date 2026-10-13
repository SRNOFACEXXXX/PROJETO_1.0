# Robô de teste de ponta a ponta: toca nas telas do emulador (visível) e lê a tela por
# uiautomator dump. Uso (dot-source):  . .\qa\adb-driver.ps1
# A saída do adb é UTF-8; sem isto o PowerShell 5.1 decodifica errado os acentos.
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8
$script:Adb = 'C:\android-lite\sdk\platform-tools\adb.exe'
$script:Pkg = 'com.brbit.hotwallet'   # app NOVO. Nunca com.brbit.wallet (app antigo).

function Get-Ui {
    & $script:Adb shell uiautomator dump /sdcard/ui.xml 2>$null | Out-Null
    [xml](& $script:Adb exec-out cat /sdcard/ui.xml 2>$null)
}

function Find-Node([xml]$ui, [string]$needle) {
    $ui.SelectNodes('//node') | Where-Object {
        $_.text -eq $needle -or $_.'content-desc' -eq $needle -or $_.'resource-id' -like "*$needle"
    } | Select-Object -First 1
}

function Get-Center($node) {
    if ($node.bounds -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
        [pscustomobject]@{ X = [int](([int]$Matches[1] + [int]$Matches[3]) / 2); Y = [int](([int]$Matches[2] + [int]$Matches[4]) / 2) }
    }
}

function Wait-Text([string]$needle, [int]$seconds = 20) {
    $end = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $end) {
        $n = Find-Node (Get-Ui) $needle
        if ($n) { return $n }
        Start-Sleep -Milliseconds 700
    }
    $null
}

function Tap-Text([string]$needle, [int]$seconds = 20) {
    $n = Wait-Text $needle $seconds
    if (-not $n) { throw "Elemento não encontrado na tela: '$needle'" }
    $c = Get-Center $n
    & $script:Adb shell input tap $c.X $c.Y
    Start-Sleep -Milliseconds 600
}

function Tap-Pin([string]$digits) {
    foreach ($d in $digits.ToCharArray()) { Tap-Text "$d" 8 }
}

function Type-Into([string]$needle, [string]$text) {
    Tap-Text $needle
    $safe = $text -replace ' ', '%s'
    & $script:Adb shell input text $safe
    Start-Sleep -Milliseconds 400
}

function Screen-Texts {
    (Get-Ui).SelectNodes('//node') | ForEach-Object { if ($_.text) { $_.text } elseif ($_.'content-desc') { $_.'content-desc' } } | Where-Object { $_ }
}

function Assert-Text([string]$needle, [string]$because) {
    if (-not (Wait-Text $needle 15)) { throw "FALHOU: esperava ver '$needle' ($because)" }
    Write-Host "  OK  $because" -ForegroundColor Green
}

function Hide-Keyboard {
    if ((& $script:Adb shell dumpsys input_method 2>$null | Select-String 'mInputShown=true')) {
        & $script:Adb shell input keyevent KEYCODE_BACK
        Start-Sleep -Milliseconds 700
    }
}

# Rola a tela até o elemento aparecer (a tela é um ScrollView; o teclado pode escondê-lo).
function Find-Scrolling([string]$needle, [int]$tries = 6) {
    Hide-Keyboard
    for ($i = 0; $i -lt $tries; $i++) {
        $n = Find-Node (Get-Ui) $needle
        if ($n) { return $n }
        & $script:Adb shell input swipe 540 1500 540 600 300
        Start-Sleep -Milliseconds 500
    }
    $null
}

# Estado real do botão: $true/$false. Lança erro se o botão não existir (nunca "adivinha").
function Test-Enabled([string]$needle) {
    $n = Find-Scrolling $needle
    if (-not $n) { throw "Botão '$needle' não encontrado, nem rolando a tela." }
    return ($n.enabled -eq 'true')
}

# Lê as 12/24 palavras da tela da frase (nós de texto alternados: número, palavra).
function Read-SeedWords {
    $t = @(Screen-Texts)
    $words = @()
    for ($i = 0; $i -lt $t.Count - 1; $i++) {
        if ($t[$i] -match '^\d{1,2}$' -and $t[$i + 1] -match '^[a-z]{3,8}$') { $words += $t[$i + 1]; $i++ }
    }
    $words
}

# Campos de texto da tela, na ordem, com o número da palavra pedida ("PALAVRA Nº 5" -> 5).
function Get-ConfirmFields {
    $ui = Get-Ui
    $nodes = @($ui.SelectNodes('//node'))
    $fields = @()
    for ($i = 0; $i -lt $nodes.Count; $i++) {
        if ($nodes[$i].text -match '(?i)^palavra\s*n[º°o]\s*(\d+)$') {
            $num = [int]$Matches[1]
            $edit = $nodes[($i + 1)..([Math]::Min($i + 2, $nodes.Count - 1))] | Where-Object { $_.class -eq 'android.widget.EditText' } | Select-Object -First 1
            if ($edit) { $fields += [pscustomobject]@{ Number = $num; Node = $edit } }
        }
    }
    $fields
}

# Limpa o campo e digita. Funciona mesmo se já houver texto.
function Set-Field($fieldNode, [string]$text) {
    $c = Get-Center $fieldNode
    & $script:Adb shell input tap $c.X $c.Y
    Start-Sleep -Milliseconds 300
    & $script:Adb shell input keyevent KEYCODE_MOVE_END
    1..20 | ForEach-Object { & $script:Adb shell input keyevent KEYCODE_DEL }
    if ($text) { & $script:Adb shell input text ($text -replace ' ', '%s') }
    Start-Sleep -Milliseconds 300
}

function Assert-NoText([string]$needle, [string]$because) {
    if (Find-Node (Get-Ui) $needle) { throw "FALHOU: não deveria ver '$needle' ($because)" }
    Write-Host "  OK  $because" -ForegroundColor Green
}
