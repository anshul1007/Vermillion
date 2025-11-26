# Vermillion System - Stop All Services
# This script stops all running services

Write-Host "=====================================" -ForegroundColor Red
Write-Host "  VERMILLION - STOPPING SERVICES    " -ForegroundColor Red
Write-Host "=====================================" -ForegroundColor Red
Write-Host ""

# Function to kill processes by port
function Stop-ProcessByPort {
    param(
        [int]$Port,
        [string]$Name
    )
    
    Write-Host "Stopping $Name (port $Port)..." -ForegroundColor Yellow
    
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        
        if ($connections) {
            $connections | ForEach-Object {
                $processId = $_.OwningProcess
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                
                if ($process) {
                    Write-Host "  Killing process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Gray
                    Stop-Process -Id $processId -Force
                    Write-Host "  ✓ $Name stopped" -ForegroundColor Green
                }
            }
        } else {
            Write-Host "  ℹ $Name not running" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "  ⚠ Could not stop $Name" -ForegroundColor Yellow
    }
}

# Fallback: stop PowerShell windows by window title (useful if services were started with Start-Process powershell -WindowTitle)
function Stop-ProcessByWindowTitle {
    param(
        [string]$TitlePattern,
        [string]$Name
    )

    Write-Host "Attempting to stop $Name by window title matching '$TitlePattern'..." -ForegroundColor Yellow

    $pwshProcesses = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -in @('powershell','pwsh') -and $_.MainWindowTitle -like $TitlePattern }

    if ($pwshProcesses) {
        foreach ($p in $pwshProcesses) {
            try {
                Write-Host "  Stopping window process: $($p.ProcessName) (PID: $($p.Id)) - Title: $($p.MainWindowTitle)" -ForegroundColor Gray
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
                Write-Host "  ✓ $Name stopped (by window title)" -ForegroundColor Green
            }
            catch {
                Write-Host "  ⚠ Failed to stop process PID $($p.Id)" -ForegroundColor Yellow
            }
        }
        return $true
    }

    Write-Host "  ℹ No matching windows found for $Name" -ForegroundColor Gray
    return $false
}

Write-Host "Stopping Backend APIs..." -ForegroundColor Yellow
$stopped = Stop-ProcessByPort -Port 5000 -Name "Vermillion.API"
if (-not $stopped) { Stop-ProcessByWindowTitle -TitlePattern '*Vermillion.API*' -Name 'Vermillion.API' }

Write-Host ""
Write-Host "Stopping Frontend Applications..." -ForegroundColor Yellow
Stop-ProcessByPort -Port 4200 -Name "Web App"
if (-not (Stop-ProcessByPort -Port 8100 -Name "Mobile App")) {
    # Try by window title as fallback
    Stop-ProcessByWindowTitle -TitlePattern '*Mobile App*' -Name 'Mobile App'
}

Write-Host ""
Write-Host "Stopping any background jobs..." -ForegroundColor Yellow
$jobs = Get-Job -ErrorAction SilentlyContinue
if ($jobs) {
    $jobs | Stop-Job
    $jobs | Remove-Job
    Write-Host "  ✓ Background jobs stopped" -ForegroundColor Green
} else {
    Write-Host "  ℹ No background jobs found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  ALL SERVICES STOPPED!              " -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
