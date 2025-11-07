# Vermillion System - Start All Services (Background Mode)
# This script starts all services in the background

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " VERMILLION - STARTING ALL SERVICES " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$jobs = @()

# Function to start a background job
function Start-BackgroundService {
    param(
        [string]$Name,
        [string]$Path,
        [string]$Command
    )
    
    $fullPath = Join-Path $rootDir $Path
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "ERROR: Directory not found: $fullPath" -ForegroundColor Red
        return $null
    }
    
    Write-Host "Starting $Name..." -ForegroundColor Green
    
    $job = Start-Job -ScriptBlock {
        param($path, $command)
        Set-Location $path
        Invoke-Expression $command
    } -ArgumentList $fullPath, $Command -Name $Name
    
    return $job
}

Write-Host "Starting Backend APIs..." -ForegroundColor Yellow

# Start all backend services
$jobs += Start-BackgroundService -Name "AuthAPI" -Path "backend\AuthAPI" -Command "dotnet run"
Start-Sleep -Seconds 2

$jobs += Start-BackgroundService -Name "AttendanceAPI" -Path "backend\AttendanceAPI" -Command "dotnet run"
Start-Sleep -Seconds 2

$jobs += Start-BackgroundService -Name "EntryExitAPI" -Path "backend\EntryExitAPI" -Command "dotnet run"
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Starting Frontend Applications..." -ForegroundColor Yellow

# Start frontend services
$jobs += Start-BackgroundService -Name "WebApp" -Path "frontend" -Command "ng serve"
Start-Sleep -Seconds 2

$jobs += Start-BackgroundService -Name "MobileApp" -Path "frontend-mobile" -Command "ng serve --port 8100"

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  ALL SERVICES STARTED!              " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services:" -ForegroundColor White
Write-Host "  • AuthAPI:        http://localhost:5275" -ForegroundColor Magenta
Write-Host "  • AttendanceAPI:  http://localhost:5000" -ForegroundColor Blue
Write-Host "  • EntryExitAPI:   http://localhost:5001" -ForegroundColor Cyan
Write-Host "  • Web App:        http://localhost:4200" -ForegroundColor Green
Write-Host "  • Mobile App:     http://localhost:8100" -ForegroundColor Yellow
Write-Host ""
Write-Host "Login:" -ForegroundColor White
Write-Host "  Admin:  admin1 / Admin@123" -ForegroundColor Green
Write-Host "  Guard:  guard1 / Guard@123" -ForegroundColor Yellow
Write-Host ""
Write-Host "Commands:" -ForegroundColor Gray
Write-Host "  Get-Job                - View running jobs" -ForegroundColor Gray
Write-Host "  Receive-Job -Id <id>   - View job output" -ForegroundColor Gray
Write-Host "  Stop-Job -Id <id>      - Stop a specific job" -ForegroundColor Gray
Write-Host "  Remove-Job *           - Remove all stopped jobs" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring. Jobs will continue running." -ForegroundColor Yellow
Write-Host "To stop all services, close this window or run: Get-Job | Stop-Job" -ForegroundColor Yellow
Write-Host ""

# Monitor jobs
try {
    while ($true) {
        Start-Sleep -Seconds 10
        $runningJobs = Get-Job | Where-Object { $_.State -eq 'Running' }
        Write-Host "Running services: $($runningJobs.Count)/5" -ForegroundColor Cyan
        
        # Check for failed jobs
        $failedJobs = Get-Job | Where-Object { $_.State -eq 'Failed' }
        if ($failedJobs) {
            Write-Host "WARNING: Some services failed!" -ForegroundColor Red
            $failedJobs | ForEach-Object {
                Write-Host "  • $($_.Name) - $($_.State)" -ForegroundColor Red
            }
        }
    }
}
finally {
    Write-Host ""
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    Write-Host "All services stopped." -ForegroundColor Green
}
