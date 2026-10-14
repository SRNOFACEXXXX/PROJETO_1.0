# Robô de teste de ponta a ponta: toca nas telas do emulador (visível) e lê a tela por
# uiautomator dump. Uso (dot-source):  . .\qa\adb-driver.ps1
# A saída do adb é UTF-8; sem isto o PowerShell 5.1 decodifica errado os acentos.
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$OutputEncoding = [Text.Encoding]::UTF8
$script:Adb = 'C:\android-lite\sdk\platform-tools\adb.exe'
$script:Pkg = 'com.brbit.hotwallet'   # app NOVO. Nunca com.brbit.wallet (app antigo).

function Get-Ui {
    # Apaga o arquivo antes: se o dump falhar (ex.: "null root node" enquanto o app abre), nunca lemos
    # a tela ANTIGA como se fosse a atual. Confere que o dump aconteceu e tenta de novo.
    # O erro do uiautomator sai em stderr; com ErrorActionPreference='Stop' (usado pelos testes) isso viraria
    # exceção e pularia as tentativas. Aqui dentro, stderr é só texto para conferir.
    $ErrorActionPreference = 'Continue'
    for ($i = 0; $i -lt 8; $i++) {
        $o = (& $script:Adb shell 'rm -f /sdcard/ui.xml; uiautomator dump /sdcard/ui.xml' 2>&1 | ForEach-Object { "$_" }) -join ' '
        if ($o -match 'dumped') {
            $xml = & $script:Adb exec-out cat /sdcard/ui.xml 2>$null
            try { $doc = [xml]($xml -join "`n"); if ($doc.hierarchy) { return $doc } } catch { }
        }
        Start-Sleep -Milliseconds 700
    }
    throw 'o uiautomator não devolveu a tela (8 tentativas)'
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

# ───────── Vigia: o teste nunca fica "olhando" uma tela parada ─────────
# Mensagens de erro do app que, se aparecerem enquanto esperamos outra coisa, encerram a espera NA HORA.
$script:ErrorPatterns = @(
    '^Explorador respondeu', '^Explorador indispon', '^Falha ', '^Erro ', 'Sem resposta do servidor',
    'servidor de blockchain est', 'Falha de rede', '^Carteira apagada'
)
$script:OutDir = Join-Path $PSScriptRoot 'out'

function Get-ScreenTexts([xml]$ui) {
    @($ui.SelectNodes('//node') | ForEach-Object { if ($_.text) { $_.text } elseif ($_.'content-desc') { $_.'content-desc' } } | Where-Object { $_ })
}

# Escreve o que estava acontecendo (tela, foco, log do app, Metro) e devolve o caminho do arquivo.
# Nunca grava telas com a frase secreta.
function Save-Diagnostics([string]$expected, [string[]]$texts) {
    New-Item -ItemType Directory -Force $script:OutDir | Out-Null
    $file = Join-Path $script:OutDir ('diagnostico-{0:yyyyMMdd-HHmmss}.txt' -f (Get-Date))
    $pairs = 0
    for ($i = 0; $i -lt $texts.Count - 1; $i++) { if ($texts[$i] -match '^\d{1,2}$' -and $texts[$i + 1] -match '^[a-z]{3,8}$') { $pairs++ } }
    $lines = @("ESPERADO: $expected", ('HORA: ' + (Get-Date -Format s)), '--- TELA ---')
    $lines += if ($pairs -ge 6) { '[tela com a frase secreta: conteúdo omitido]' } else { $texts }
    $lines += '--- FOCO ---'
    $lines += @(& $script:Adb shell dumpsys window 2>$null | Select-String 'mCurrentFocus' | Select-Object -Last 1 | ForEach-Object { $_.Line.Trim() })
    $lines += '--- LOGCAT (app, JS, rede) ---'
    $lines += @(& $script:Adb logcat -d -t 500 2>$null | Select-String 'ReactNativeJS|AndroidRuntime|okhttp|FATAL' | Select-Object -Last 25 | ForEach-Object { $_.Line })
    $lines += '--- METRO ---'
    if (Test-Path C:\android-lite\metro.log) { $lines += @(Get-Content C:\android-lite\metro.log -Tail 8) }
    Set-Content -Path $file -Value $lines -Encoding UTF8
    $file
}

# Espera uma condição na tela, com três proteções:
#  1) mensagem de erro conhecida na tela -> falha imediata, dizendo qual (FailOn);
#  2) tela parada (mesmo conteúdo) por $Stall segundos sem a condição -> falha (Stall > 0 liga isto);
#  3) tempo esgotado -> falha com diagnóstico em arquivo.
# Também dispensa sozinho os diálogos "X não está respondendo" do Android.
# $Condition recebe ($ui, $texts) e devolve algo verdadeiro quando o objetivo foi atingido.
function Wait-Until([scriptblock]$Condition, [string]$Name, [int]$Timeout = 20, [string[]]$FailOn = $null, [int]$Stall = 0) {
    if ($null -eq $FailOn) { $FailOn = $script:ErrorPatterns }
    $end = (Get-Date).AddSeconds($Timeout)
    $lastSig = $null
    $lastChange = Get-Date
    while ($true) {
        $ui = Get-Ui
        $texts = Get-ScreenTexts $ui
        if (($texts -contains 'Wait') -and ($texts | Where-Object { $_ -match "isn't responding|not responding" })) {
            Tap-Node (Find-Node $ui 'Wait'); Start-Sleep 2; continue
        }
        $hit = & $Condition $ui $texts
        if ($hit) { return $hit }
        $err = $texts | Where-Object { $t = $_; $FailOn | Where-Object { $t -match $_ } } | Select-Object -First 1
        if ($err) {
            $f = Save-Diagnostics $Name $texts
            throw "a tela mostrou um erro enquanto esperava '$Name': «$err». Diagnóstico: $f"
        }
        $sig = ($texts -join '|') -replace '\d+\s?(s|min)\b', 'N'   # contagens regressivas não contam como mudança
        if ($sig -ne $lastSig) { $lastSig = $sig; $lastChange = Get-Date }
        elseif ($Stall -gt 0 -and ((Get-Date) - $lastChange).TotalSeconds -ge $Stall) {
            $f = Save-Diagnostics $Name $texts
            throw "tela parada há ${Stall}s sem '$Name'. Diagnóstico: $f"
        }
        if ((Get-Date) -ge $end) {
            $f = Save-Diagnostics $Name $texts
            throw "tempo esgotado (${Timeout}s) esperando '$Name'. Diagnóstico: $f"
        }
        Start-Sleep -Milliseconds 700
    }
}

function Tap-Node($node) {
    $c = Get-Center $node
    & $script:Adb shell input tap $c.X $c.Y
    Start-Sleep -Milliseconds 600
}

function Wait-Text([string]$needle, [int]$seconds = 20, [string[]]$FailOn = $null, [switch]$Scroll) {
    # Se o texto esperado é, ele mesmo, uma mensagem de erro conhecida, não falha por ela.
    if ($null -eq $FailOn) { $FailOn = @($script:ErrorPatterns | Where-Object { $needle -notmatch $_ }) }
    $state = @{ misses = 0 }
    $adb = $script:Adb   # o bloco abaixo é um closure: ele não enxerga $script:*, então capturamos aqui
    $cond = {
        param($ui, $t)
        $n = Find-Node $ui $needle
        if (-not $n -and $Scroll) {
            # Depois de 2 tentativas sem achar, rola a tela para baixo (elemento pode estar fora da vista).
            $state.misses++
            if ($state.misses -ge 2) { & $adb shell input swipe 360 1000 360 520 250; Start-Sleep -Milliseconds 400 }
        }
        $n
    }.GetNewClosure()
    Wait-Until $cond "texto '$needle'" $seconds $FailOn
}

# A Home é reconhecida pelos botões fixos "Bloquear" + "Ajustes". Os textos do saldo mudam
# ("Saldo disponível" / "Último saldo conhecido" / "Sincronizando…") conforme o estado da rede.
function Test-OnHome([string[]]$texts) { ($texts -contains 'Bloquear') -and ($texts -contains 'Ajustes') -and ($texts -contains 'Receber') }

function Wait-Home([int]$seconds = 60) {
    Wait-Until ({ param($ui, $t) Test-OnHome $t }) 'Home (botões Bloquear e Ajustes)' $seconds
}

function Tap-Text([string]$needle, [int]$seconds = 20) {
    $n = Wait-Text $needle $seconds -Scroll
    if (-not $n) { throw "Elemento não encontrado na tela: '$needle'" }
    $c = Get-Center $n
    & $script:Adb shell input tap $c.X $c.Y
    Start-Sleep -Milliseconds 600
}

# Digita o PIN lendo o teclado UMA vez e disparando todos os toques numa única chamada ao adb
# (antes: uma leitura de tela por dígito, ~1,5 s cada, o que gastava o bloqueio de 30 s do app).
function Tap-Pin([string]$digits) {
    $ui = Wait-Until { param($ui, $t) if (Find-Node $ui '5') { $ui } } 'teclado numérico do PIN' 15
    $taps = foreach ($d in $digits.ToCharArray()) {
        $n = Find-Node $ui "$d"
        if (-not $n) { throw "tecla '$d' não encontrada no teclado" }
        $c = Get-Center $n
        "input tap $($c.X) $($c.Y)"
    }
    & $script:Adb shell (($taps -join '; sleep 0.15; ') + '; sleep 0.3')
    $script:LastPinAt = Get-Date   # instante em que o PIN foi enviado (os testes de bloqueio medem a janela por ele)
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
function Set-Field($fieldNode, [string]$text, [int]$clear = 80) {
    $c = Get-Center $fieldNode
    & $script:Adb shell input tap $c.X $c.Y
    Start-Sleep -Milliseconds 300
    & $script:Adb shell input keyevent KEYCODE_MOVE_END
    # `$clear` "apagar" numa única chamada (um endereço tem 42 caracteres; uma frase de 24 palavras, ~200).
    # Em campos de várias linhas "ir ao fim" só vai ao fim da LINHA: apaga para os dois lados do cursor
    # (112 = apagar adiante, 67 = apagar para trás).
    & $script:Adb shell ('input keyevent ' + (((1..$clear | ForEach-Object { '112' }) + (1..$clear | ForEach-Object { '67' })) -join ' '))
    if ($text) {
        # `input text` perde caracteres em textos longos com o emulador ocupado: digita em pedaços de 32
        # caracteres, numa única chamada ao adb, com uma pausa curta entre eles.
        $safe = $text -replace ' ', '%s'
        $chunks = @()
        $i = 0
        while ($i -lt $safe.Length) {
            $len = [Math]::Min(32, $safe.Length - $i)
            # nunca corta entre o '%' e o 's' do código de espaço (senão sai "%s" literal na tela)
            if ($len -gt 1 -and $safe[$i + $len - 1] -eq '%') { $len-- }
            $chunks += 'input text ' + $safe.Substring($i, $len)
            $i += $len
        }
        & $script:Adb shell ($chunks -join '; sleep 0.25; ')
    }
    Start-Sleep -Milliseconds 300
}

function Assert-NoText([string]$needle, [string]$because) {
    if (Find-Node (Get-Ui) $needle) { throw "FALHOU: não deveria ver '$needle' ($because)" }
    Write-Host "  OK  $because" -ForegroundColor Green
}
