# Instala um Android EMULADO ultraleve (AOSP puro, sem Google/Play Store) em C:\android-lite
# Uso:  powershell -ExecutionPolicy Bypass -File setup-emulador.ps1
$ErrorActionPreference = 'Stop'
$Root   = 'C:\android-lite'
$Sdk    = "$Root\sdk"
$Jdk    = "$Root\jdk"
$Avd    = "$Root\avd"
$Image  = 'system-images;android-30;default;x86_64'   # AOSP, sem apps Google
New-Item -ItemType Directory -Force $Root, $Sdk, $Avd | Out-Null

# 1) JDK 17 portátil (necessário para o sdkmanager)
if (-not (Test-Path "$Jdk\bin\java.exe")) {
    Write-Host '[1/4] Baixando JDK 17 (Temurin)...'
    $zip = "$Root\jdk.zip"
    Invoke-WebRequest 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile $zip
    Expand-Archive $zip "$Root\jdk_tmp" -Force
    Move-Item (Get-ChildItem "$Root\jdk_tmp" | Select-Object -First 1).FullName $Jdk
    Remove-Item "$Root\jdk_tmp", $zip -Recurse -Force
}
$env:JAVA_HOME = $Jdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:ANDROID_AVD_HOME = $Avd

# 2) Command-line tools
if (-not (Test-Path "$Sdk\cmdline-tools\latest\bin\sdkmanager.bat")) {
    Write-Host '[2/4] Baixando Android command-line tools...'
    $zip = "$Root\cmdtools.zip"
    Invoke-WebRequest 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' -OutFile $zip
    Expand-Archive $zip "$Root\cmd_tmp" -Force
    New-Item -ItemType Directory -Force "$Sdk\cmdline-tools" | Out-Null
    Move-Item "$Root\cmd_tmp\cmdline-tools" "$Sdk\cmdline-tools\latest"
    Remove-Item "$Root\cmd_tmp", $zip -Recurse -Force
}
$sm = "$Sdk\cmdline-tools\latest\bin\sdkmanager.bat"

# 3) Emulator + platform-tools (adb) + imagem
Write-Host '[3/4] Instalando emulator, platform-tools e imagem AOSP (~1 GB)...'
(1..30 | ForEach-Object { 'y' }) | & $sm --licenses | Out-Null
& $sm 'platform-tools' 'emulator' $Image

# 4) Cria o AVD leve: 2 GB RAM, tela 720x1280, sem câmera/áudio/sensores extras
Write-Host '[4/4] Criando AVD "hotwallet_test"...'
$avdm = "$Sdk\cmdline-tools\latest\bin\avdmanager.bat"
'no' | & $avdm create avd -n hotwallet_test -k $Image -d pixel_2 --force
$ini = "$Avd\hotwallet_test.avd\config.ini"
$extra = @'
hw.ramSize=2048
vm.heapSize=256
hw.lcd.width=720
hw.lcd.height=1280
hw.lcd.density=280
hw.camera.back=none
hw.camera.front=none
hw.audioInput=no
hw.audioOutput=no
hw.gps=no
hw.sensors.orientation=no
hw.sensors.proximity=no
hw.gpu.enabled=yes
hw.gpu.mode=auto
disk.dataPartition.size=2048M
showDeviceFrame=no
'@
$cfg = (Get-Content $ini) | Where-Object { $_ -notmatch '^(hw\.ramSize|vm\.heapSize|hw\.lcd\.(width|height|density)|hw\.camera\.|hw\.audio|hw\.gps|hw\.sensors\.|hw\.gpu\.|disk\.dataPartition\.size|showDeviceFrame)' }
Set-Content $ini ($cfg + $extra)

Write-Host "`nPronto. Verificando aceleração..."
& "$Sdk\emulator\emulator.exe" -accel-check
Write-Host 'Agora rode: start-emulador.ps1 [caminho-do-app.apk]'
