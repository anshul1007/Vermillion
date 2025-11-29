# Vermillion System - Stop All Services
Write-Host "=====================================" -ForegroundColor Red
Write-Host "  VERMILLION - STOPPING SERVICES    " -ForegroundColor Red
Write-Host "=====================================" -ForegroundColor Red
Write-Host ""

function Stop-ProcessByPort {
    param([int]$Port, [string]$Name)
    Write-Host "Stopping $Name (port $Port)..." -ForegroundColor Yellow
    $stopped = $false
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -Property OwningProcess -Unique
        if ($connections) {
            foreach ($conn in $connections) {
                $processId = $conn.OwningProcess
                if (-not $processId) { continue }
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "  Killing process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Gray
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    Write-Host "   $Name stopped" -ForegroundColor Green
                    $stopped = $true
                }
            }
        } else {
            Write-Host "  ℹ $Name not running" -ForegroundColor Gray
        }
    } catch {
        Write-Host "   Could not stop $Name" -ForegroundColor Yellow
    }
    return $stopped
}

function Stop-ProcessByWindowTitle {
    param([string]$TitlePattern, [string]$Name)
    Write-Host "Attempting to stop $Name by window title..." -ForegroundColor Yellow
    $pwshProcesses = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -in @('powershell','pwsh') -and $_.MainWindowTitle -like $TitlePattern }
    if ($pwshProcesses) {
        foreach ($p in $pwshProcesses) {
            try {
                Write-Host "  Stopping window process PID $($p.Id)" -ForegroundColor Gray
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
                Write-Host "   $Name stopped" -ForegroundColor Green
            } catch {
                Write-Host "   Failed to stop PID $($p.Id)" -ForegroundColor Yellow
            }
        }
        return $true
    }
    Write-Host "  ℹ No matching windows found" -ForegroundColor Gray
    return $false
}

function Stop-ProcessByCommandPattern {
    param([string]$Pattern, [string]$Name)
    Write-Host "Attempting to stop $Name by command line..." -ForegroundColor Yellow
    try {
        $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -and $_.CommandLine -like $Pattern }
        if ($processes) {
            foreach ($proc in $processes) {
                try {
                    Write-Host "  Stopping process PID $($proc.ProcessId)" -ForegroundColor Gray
                    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
                    Write-Host "   $Name stopped" -ForegroundColor Green
                } catch {
                    Write-Host "   Failed to stop PID $($proc.ProcessId)" -ForegroundColor Yellow
                }
            }
            return $true
        }
        Write-Host "  ℹ No matching process found" -ForegroundColor Gray
    } catch {
        Write-Host "   Could not query processes" -ForegroundColor Yellow
    }
    return $false
}

Write-Host "Stopping Backend APIs..." -ForegroundColor Yellow
$stopped = Stop-ProcessByPort -Port 5000 -Name "Vermillion.API"
if (-not $stopped) {
    if (-not (Stop-ProcessByWindowTitle -TitlePattern '*Vermillion.API*' -Name 'Vermillion.API')) {
        Stop-ProcessByCommandPattern -Pattern '*backend\Vermillion.API*' -Name 'Vermillion.API'
    }
}

Write-Host ""
Write-Host "Stopping Frontend Applications..." -ForegroundColor Yellow
$stoppedWeb = Stop-ProcessByPort -Port 4200 -Name "Web App"
if (-not $stoppedWeb) {
    if (-not (Stop-ProcessByWindowTitle -TitlePattern '*Web App*' -Name 'Web App')) {
        Stop-ProcessByCommandPattern -Pattern '*frontend*ng*' -Name 'Web App'
    }
}

$stoppedMobile = Stop-ProcessByPort -Port 4300 -Name "Mobile App"
if (-not $stoppedMobile) {
    if (-not (Stop-ProcessByWindowTitle -TitlePattern '*Mobile App*' -Name 'Mobile App')) {
        Stop-ProcessByCommandPattern -Pattern '*frontend-mobile*ng*' -Name 'Mobile App'
    }
}

Write-Host ""
Write-Host "Stopping Storage Emulator..." -ForegroundColor Yellow
$azuriteStopped = $false
foreach ($port in @(10000, 10001, 10002)) {
    if (Stop-ProcessByPort -Port $port -Name "Azurite (port $port)") {
        $azuriteStopped = $true
    }
}
if (-not $azuriteStopped) {
    Stop-ProcessByCommandPattern -Pattern '*azurite*' -Name 'Azurite Storage Emulator'
}

Write-Host ""
Write-Host "Stopping any background jobs..." -ForegroundColor Yellow
$jobs = Get-Job -ErrorAction SilentlyContinue
if ($jobs) {
    $jobs | Stop-Job
    $jobs | Remove-Job
    Write-Host "   Background jobs stopped" -ForegroundColor Green
} else {
    Write-Host "  ℹ No background jobs found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  ALL SERVICES STOPPED!              " -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
