# Vermillion System - Start All Services
# This script starts all backend APIs and frontend applications

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  VERMILLION SYSTEM - START ALL     " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Get the root directory
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Function to kill process on a port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $processId = $conn.OwningProcess
                if ($processId -and $processId -gt 0) {
                    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "  Stopping process on port $Port (PID: $processId)..." -ForegroundColor Yellow
                        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        }
    } catch {
        # Port not in use, continue
    }
}

# Kill any existing processes on required ports
Write-Host "Checking for existing processes on ports..." -ForegroundColor Yellow
Stop-ProcessOnPort -Port 5275  # AuthAPI
Stop-ProcessOnPort -Port 5000  # AttendanceAPI
Stop-ProcessOnPort -Port 5001  # EntryExitAPI
Stop-ProcessOnPort -Port 4200  # Web App
Stop-ProcessOnPort -Port 8100  # Mobile App
Write-Host "  Ports cleared." -ForegroundColor Green
Write-Host ""

# Check for required tools
Write-Host "Checking required tools..." -ForegroundColor Yellow
$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
$ng = Get-Command ng -ErrorAction SilentlyContinue
if (-not $dotnet) { Write-Host "WARNING: dotnet not found in PATH" -ForegroundColor Red }
if (-not $ng) { Write-Host "WARNING: ng not found in PATH" -ForegroundColor Yellow }

# Function to start a service
function Start-Service {
    param(
        [string]$Name,
        [string]$Path,
        [string]$Command,
        [string]$Color = "Green"
    )
    
    Write-Host "Starting $Name..." -ForegroundColor $Color
    
    $fullPath = Join-Path $rootDir $Path
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "ERROR: Directory not found: $fullPath" -ForegroundColor Red
        return $false
    }
    
    # Start in a new PowerShell window and set a descriptive title
    # Use $Name as the window title to make it easy to identify running services
    $escapedName = $Name -replace "'","''"
    $scriptBlock = "Set-Location '$fullPath'; `$host.ui.RawUI.WindowTitle = '$escapedName'; Write-Host '=== $Name ===' -ForegroundColor $Color; $Command"
    # Start the new PowerShell window; keep it simple and do not record PIDs
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $scriptBlock
    
    return $true
}

Write-Host "Step 1: Starting Backend APIs..." -ForegroundColor Yellow
Write-Host ""

# Start AuthAPI
$success = Start-Service -Name "AuthAPI (Port 5275)" -Path "backend\AuthAPI" -Command "dotnet run" -Color "Magenta"
if ($success) { 
    Write-Host "  AuthAPI starting..." -ForegroundColor Green 
    Start-Sleep -Seconds 2
}

# Start AttendanceAPI
$success = Start-Service -Name "AttendanceAPI (Port 5000)" -Path "backend\AttendanceAPI" -Command "dotnet run" -Color "Blue"
if ($success) { 
    Write-Host "  AttendanceAPI starting..." -ForegroundColor Green 
    Start-Sleep -Seconds 2
}


# Start EntryExitAPI
$success = Start-Service -Name "EntryExitAPI (Port 5001)" -Path "backend\EntryExitAPI" -Command "dotnet run" -Color "Cyan"
if ($success) { 
    Write-Host "  EntryExitAPI starting..." -ForegroundColor Green 
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "Step 2: Starting Frontend Applications..." -ForegroundColor Yellow
Write-Host ""

# Start Web Frontend
$success = Start-Service -Name "Web App (Port 4200)" -Path "frontend" -Command "npm start" -Color "Green"
if ($success) { 
    Write-Host "  Web App starting..." -ForegroundColor Green 
    Start-Sleep -Seconds 2
}

# Start Mobile Frontend
$success = Start-Service -Name "Mobile App (Port 8100)" -Path "frontend-mobile" -Command "npm start -- --port 8100" -Color "Yellow"
if ($success) { 
    Write-Host "  Mobile App starting..." -ForegroundColor Green 
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  ALL SERVICES STARTED!              " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend APIs:" -ForegroundColor White
Write-Host "  AuthAPI:        http://localhost:5275" -ForegroundColor Magenta
Write-Host "  AttendanceAPI:  http://localhost:5000" -ForegroundColor Blue
Write-Host "  EntryExitAPI:   http://localhost:5001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend Apps:" -ForegroundColor White
Write-Host "  Web App:        http://localhost:4200" -ForegroundColor Green
Write-Host "  Mobile App:     http://localhost:8100" -ForegroundColor Yellow
Write-Host ""
Write-Host "Login Credentials:" -ForegroundColor White
Write-Host "  Web Admin:   admin@vermillion.com / Admin@123" -ForegroundColor Green
Write-Host "  Web Manager: manager.attendance@vermillion.com / Manager@123" -ForegroundColor Green
Write-Host "  Web Employee: employee1@vermillion.com / Employee@123" -ForegroundColor Green
Write-Host "  Mobile Guard: guard1@vermillion.com / Guard@123" -ForegroundColor Yellow
Write-Host ""
Write-Host "Services are running in separate windows." -ForegroundColor Gray
Write-Host "Close those windows to stop the services." -ForegroundColor Gray
