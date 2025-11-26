# Test Azure Blob Storage Setup
# This script tests the photo upload functionality

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Vermillion Photo Storage Test" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Azurite is running
Write-Host "Checking Azurite (Azure Storage Emulator)..." -ForegroundColor Yellow
$azuriteProcess = Get-Process -Name "azurite" -ErrorAction SilentlyContinue

if ($azuriteProcess) {
    Write-Host "✓ Azurite is running (PID: $($azuriteProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "✗ Azurite is NOT running" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start Azurite:" -ForegroundColor Yellow
    Write-Host "  Option 1: npm install -g azurite; azurite" -ForegroundColor Gray
    Write-Host "  Option 2: docker run -p 10000:10000 mcr.microsoft.com/azure-storage/azurite" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y") {
        exit
    }
}

Write-Host ""

# Check if API is running
Write-Host "Checking API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ API is running and healthy" -ForegroundColor Green
} catch {
    Write-Host "✗ API is NOT running or not responding" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start API:" -ForegroundColor Yellow
    Write-Host "  cd backend\Vermillion.API" -ForegroundColor Gray
    Write-Host "  dotnet run" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y") {
        exit
    }
}

Write-Host ""

# Create a test base64 image (1x1 red pixel PNG)
$testImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

Write-Host "Testing photo upload functionality..." -ForegroundColor Yellow
Write-Host ""

# Test visitor registration with photo
$visitorData = @{
    name = "Test Visitor $(Get-Date -Format 'HHmmss')"
    phoneNumber = "9999999999"
    companyName = "Test Company"
    purpose = "Photo Storage Test"
    photoBase64 = "data:image/png;base64,$testImage"
    projectId = 1
} | ConvertTo-Json

try {
    Write-Host "Sending visitor registration request..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/entryexit/visitors" `
        -Method POST `
        -Body $visitorData `
        -ContentType "application/json" `
        -Headers @{ "X-Tenant" = "entryexit" }
    
    Write-Host "✓ Visitor registered successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host "  ID: $($response.data.id)" -ForegroundColor White
    Write-Host "  Name: $($response.data.name)" -ForegroundColor White
    Write-Host "  Photo URL: $($response.data.photoUrl)" -ForegroundColor White
    
    if ($response.data.photoUrl -like "*blob.core.windows.net*" -or $response.data.photoUrl -like "*127.0.0.1:10000*") {
        Write-Host ""
        Write-Host "✓ Photo was uploaded to blob storage successfully!" -ForegroundColor Green
        Write-Host ""
        
        # Try to open the photo URL
        $openPhoto = Read-Host "Open photo URL in browser? (y/N)"
        if ($openPhoto -eq "y") {
            Start-Process $response.data.photoUrl
        }
    } else {
        Write-Host ""
        Write-Host "✗ Warning: Photo URL doesn't look like blob storage" -ForegroundColor Yellow
        Write-Host "  Expected: *blob.core.windows.net* or *127.0.0.1:10000*" -ForegroundColor Gray
        Write-Host "  Got: $($response.data.photoUrl)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "✗ Failed to register visitor" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails) {
        Write-Host ""
        Write-Host "Details:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Notes:" -ForegroundColor Yellow
Write-Host "  - For local dev, photos are stored in Azurite" -ForegroundColor Gray
Write-Host "  - For production, configure Azure Storage connection string" -ForegroundColor Gray
Write-Host "  - See docs/AZURE-BLOB-STORAGE-SETUP.md for details" -ForegroundColor Gray
Write-Host ""
