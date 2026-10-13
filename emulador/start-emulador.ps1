# Inicia o Android de teste e (opcional) instala o APK.
# Uso:  powershell -ExecutionPolicy Bypass -File start-emulador.ps1 [-Apk C:\caminho\app.apk]
param([string]$Apk)
$Root = 'C:\android-lite'
$Sdk  = "$Root\sdk"
$env:JAVA_HOME = "$Root\jdk"
$env:ANDROID_SDK_ROOT = $Sdk
$env:ANDROID_AVD_HOME = "$Root\avd"
$adb = "$Sdk\platform-tools\adb.exe"

Start-Process "$Sdk\emulator\emulator.exe" -ArgumentList @(
    '-avd','hotwallet_test','-memory','2048','-no-snapshot','-no-audio','-no-boot-anim',
    '-no-metrics','-gpu','auto','-netdelay','none','-netspeed','full'
)

Write-Host 'Aguardando o boot do Android...'
& $adb wait-for-device
do { Start-Sleep 3 } until ((& $adb shell getprop sys.boot_completed 2>$null).Trim() -eq '1')
Write-Host 'Android pronto.'

if ($Apk) {
    Write-Host "Instalando $Apk ..."
    & $adb install -r $Apk
}
