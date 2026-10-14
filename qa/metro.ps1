# Liga o Metro (servidor de desenvolvimento) em segundo plano, com ou sem o servidor de testes da testnet.
#   -Mode normal : o app usa o mempool.space de verdade.
#   -Mode test   : a TESTNET aponta para o servidor local qa/fake-mempool.mjs (a mainnet nunca é redirecionada).
param([ValidateSet('normal', 'test')][string]$Mode = 'normal', [int]$FakePort = 3999)
$ErrorActionPreference = 'Stop'
$app = Join-Path (Split-Path $PSScriptRoot) 'app'

$old = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
if ($old) { Stop-Process -Id $old -Force; Start-Sleep 2 }

$envLine = if ($Mode -eq 'test') { "`$env:EXPO_PUBLIC_TESTNET_EXPLORER_URL='http://localhost:$FakePort/api';" } else { "`$env:EXPO_PUBLIC_TESTNET_EXPLORER_URL=`$null;" }
$cmd = "$envLine `$env:CI=`$null; Set-Location '$app'; npx expo start --dev-client --port 8081 --clear *> C:\android-lite\metro.log"
Start-Process -FilePath powershell -ArgumentList '-NoProfile', '-Command', $cmd -WindowStyle Hidden

$end = (Get-Date).AddSeconds(120)
while (-not (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue) -and (Get-Date) -lt $end) { Start-Sleep -Milliseconds 800 }
if (-not (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue)) { throw 'Metro não subiu em 120 s' }

# Aquece o cache para o app não esperar o primeiro empacotamento.
$t = Get-Date
$null = Invoke-WebRequest -UseBasicParsing 'http://localhost:8081/index.bundle?platform=android&dev=true&minify=false' -TimeoutSec 290
Write-Host ("Metro pronto (modo {0}); bundle aquecido em {1}s" -f $Mode, [int]((Get-Date) - $t).TotalSeconds)
