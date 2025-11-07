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

Write-Host "Stopping Backend APIs..." -ForegroundColor Yellow
Stop-ProcessByPort -Port 5275 -Name "AuthAPI"
Stop-ProcessByPort -Port 5000 -Name "AttendanceAPI"
Stop-ProcessByPort -Port 5001 -Name "EntryExitAPI"

Write-Host ""
Write-Host "Stopping Frontend Applications..." -ForegroundColor Yellow
Stop-ProcessByPort -Port 4200 -Name "Web App"
Stop-ProcessByPort -Port 8100 -Name "Mobile App"

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
