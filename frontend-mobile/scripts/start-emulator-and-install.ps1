<#
Usage: 
  .\start-emulator-and-install.ps1 -AvdName Medium_Phone_API_36 -ApkPath ..\app\build\outputs\apk\debug\app-debug.apk

What it does:
  - Finds and kills any process holding TCP port 5037 (ADB daemon port)
  - Stops adb, starts adb
  - Starts the requested AVD (emulator) via emulator.exe
  - Waits until the emulator shows up as `device` in `adb devices`
  - Installs the specified APK with `adb install -r`

Notes:
  - Run from PowerShell. If killing processes requires elevation, run as Administrator.
  - The script tries to locate the Android SDK via `ANDROID_SDK_ROOT`, `ANDROID_HOME`, or your LocalAppData default path.
#>

# Hard-coded configuration (change these values if you need a different AVD or APK)
$AvdName = 'Medium_Phone_API_36'
$ApkPath = 'e:\Vermillion\frontend-mobile\android\app\build\outputs\apk\debug\app-debug.apk'
$WaitSeconds = 600

function Find-AndroidSdkRoot {
    if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) { return $env:ANDROID_SDK_ROOT }
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { return $env:ANDROID_HOME }
    $localSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $localSdk) { return $localSdk }
    return $null
}

$SdkRoot = Find-AndroidSdkRoot
if (-not $SdkRoot) {
    Write-Error "Android SDK not found. Set ANDROID_SDK_ROOT or ANDROID_HOME, or ensure $env:LOCALAPPDATA\\Android\\Sdk exists."
    exit 2
}

$Adb = Join-Path $SdkRoot "platform-tools\adb.exe"
$Emu = Join-Path $SdkRoot "emulator\emulator.exe"

if (-not (Test-Path $Adb)) { Write-Error "adb not found at $Adb"; exit 3 }
if (-not (Test-Path $Emu)) { Write-Error "emulator not found at $Emu"; exit 4 }

Write-Output "Using SDK root: $SdkRoot"
Write-Output "adb: $Adb"
Write-Output "emulator: $Emu"
Write-Output "AVD: $AvdName"
Write-Output "APK: $ApkPath"

# Resolve script/project paths so npm and gradle run in correct locations
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$AndroidDir = Join-Path $ProjectRoot "android"

Write-Output "Building web app (npm run build) in $ProjectRoot..."
Push-Location $ProjectRoot | Out-Null
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Write-Error "npm not found on PATH"; Pop-Location | Out-Null; exit 9 }
& npm run build -- --configuration production

Write-Output "Syncing Capacitor native project (npm run cap:sync:dev) in $ProjectRoot..."
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { Write-Error "npx not found on PATH"; Pop-Location | Out-Null; exit 10 }
& npm run cap:sync:dev

# Build Android debug APK using Gradle wrapper in android subfolder
if (-not (Test-Path $AndroidDir)) { Write-Error "Android directory not found at $AndroidDir"; Pop-Location | Out-Null; exit 12 }
Push-Location $AndroidDir | Out-Null
if (Test-Path "gradlew.bat") {
    Write-Output "Building Android APK (gradlew assembleDebug)..."
    & .\gradlew.bat assembleDebug
} else {
    Write-Output "gradlew.bat not found at $AndroidDir; attempting to run gradle wrapper (gradlew)..."
    & .\gradlew assembleDebug
}
Pop-Location | Out-Null
Pop-Location | Out-Null

# Ensure APK path exists after build
if (-not (Test-Path $ApkPath)) { Write-Error "APK not found at $ApkPath after build. Check Gradle output."; exit 11 }

# Kill any process using port 5037
Write-Output "Checking for processes using port 5037 (ADB)..."
$net = netstat -ano | Select-String ":5037\b" | ForEach-Object { $_.ToString().Trim() }
if ($net.Count -gt 0) {
    # parse unique PIDs and skip PID 0
    $pids = $net | ForEach-Object { (-split $_)[-1] } | Where-Object { $_ -match '^[0-9]+$' -and $_ -ne '0' } | Select-Object -Unique
    foreach ($foundPid in $pids) {
        if ($foundPid -eq $PID) {
            Write-Output "Skipping killing current PowerShell process (PID $PID)."
            continue
        }
        try {
            $proc = Get-Process -Id $foundPid -ErrorAction Stop
            Write-Output "Killing process $($proc.ProcessName) (PID $foundPid) using port 5037"
            Stop-Process -Id $foundPid -Force -ErrorAction Stop
        } catch {
            Write-Warning "Failed to kill PID ${foundPid}: $_"
            # try taskkill as fallback
            taskkill /F /PID $foundPid | Out-Null
        }
    }
} else {
    Write-Output "No process found on port 5037."
}

# Ensure adb is not running
Write-Output "Stopping adb daemon..."
& $Adb kill-server 2>$null
Start-Sleep -Milliseconds 500

# Start emulator
Write-Output "Starting emulator '$AvdName'..."
Start-Process -FilePath $Emu -ArgumentList "-avd $AvdName" -WindowStyle Normal | Out-Null

# Start adb server
Write-Output "Starting adb server..."
& $Adb start-server

# Wait for device to appear as 'device'
$endTime = (Get-Date).AddSeconds($WaitSeconds)
$deviceId = $null
Write-Output "Waiting up to $WaitSeconds seconds for emulator to appear..."
$elapsed = 0
while ((Get-Date) -lt $endTime) {
    Start-Sleep -Seconds 2
    $elapsed += 2
    $lines = & $Adb devices 2>$null | Select-String -Pattern "emulator-\d+\s+(device|offline|unauthorized)" -AllMatches
    if ($lines) {
        foreach ($m in $lines.Matches) {
            $str = $m.Value.Trim()
            $parts = -split $str
            if ($parts.Length -ge 2 -and $parts[1] -eq 'device') {
                $deviceId = $parts[0]
                break
            }
        }
    }
    if ($deviceId) { break }
    Write-Output "Waiting... ($elapsed s)"
}

if (-not $deviceId) {
    Write-Error "Emulator did not become ready within $WaitSeconds seconds. Check emulator window and adb status."; exit 6
}

Write-Output "Emulator is online: $deviceId"

# Wait for system boot to complete (sys.boot_completed == 1)
Write-Output "Waiting for emulator system boot to complete..."
$bootTimeout = (Get-Date).AddSeconds($WaitSeconds)
while ((Get-Date) -lt $bootTimeout) {
    Start-Sleep -Seconds 2
    $boot = (& $Adb -s $deviceId shell getprop sys.boot_completed 2>$null).Trim()
    if ($boot -eq '1') { break }
    Write-Output "Boot not completed yet..."
}
if ($boot -ne '1') { Write-Error "Emulator did not finish boot within timeout."; exit 8 }

# Install APK
Write-Output "Installing APK to $deviceId..."
$install = & $Adb -s $deviceId install -r "$ApkPath" 2>&1
Write-Output $install

if ($install -match 'Success') {
    Write-Output "APK installed successfully."
    exit 0
} else {
    Write-Error "APK install failed. See output above."; exit 7
}
