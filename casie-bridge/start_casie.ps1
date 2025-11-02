# CASIE Bridge - Combined Startup Script
# This script starts both the FastAPI server and Cloudflare tunnel sequentially
# It should be run on user login via Task Scheduler

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   CASIE Bridge Startup" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Check if services are already running
$existingPython = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*uvicorn*" }
$existingCloudflared = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue

if ($existingPython -or $existingCloudflared) {
    Write-Host "WARNING: CASIE Bridge services are already running" -ForegroundColor Yellow
    if ($existingPython) {
        Write-Host "  - FastAPI server (PID: $($existingPython.Id))" -ForegroundColor Yellow
    }
    if ($existingCloudflared) {
        Write-Host "  - Cloudflare tunnel (PID: $($existingCloudflared.Id))" -ForegroundColor Yellow
    }
    Write-Host ""
    $response = Read-Host "Stop existing services and restart? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "Stopping existing services..." -ForegroundColor Cyan
        & "D:\casie\casie-bridge\stop_casie.ps1"
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Keeping existing services running" -ForegroundColor Green
        exit 0
    }
}

# Step 1: Start FastAPI server
Write-Host "[1/2] Starting FastAPI server..." -ForegroundColor Cyan
& "D:\casie\casie-bridge\start_fastapi.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start FastAPI server" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Wait for FastAPI to initialize
Write-Host "Waiting for FastAPI to initialize..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# Step 2: Start Cloudflare tunnel
Write-Host "[2/2] Starting Cloudflare tunnel..." -ForegroundColor Cyan
& "D:\casie\casie-bridge\start_tunnel.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start Cloudflare tunnel" -ForegroundColor Red
    Write-Host "FastAPI server is still running. Use stop_casie.ps1 to stop it." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   CASIE Bridge Started Successfully" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services running:" -ForegroundColor Cyan
Write-Host "  - FastAPI: http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  - Tunnel URL: Check D:\casie\casie-bridge\tunnel.log" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop services, run: D:\casie\casie-bridge\stop_casie.ps1" -ForegroundColor Yellow
