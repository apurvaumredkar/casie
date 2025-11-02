# CASIE Bridge - Stop Script
# Gracefully stops all CASIE Bridge services (FastAPI and Cloudflare tunnel)

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   Stopping CASIE Bridge" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Find and stop Python processes (FastAPI server)
Write-Host "Stopping FastAPI server..." -ForegroundColor Cyan
$pythonProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue

if ($pythonProcesses) {
    $pythonProcesses | ForEach-Object {
        Write-Host "  - Stopping Python process (PID: $($_.Id))" -ForegroundColor Yellow
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "FastAPI server stopped" -ForegroundColor Green
} else {
    Write-Host "No FastAPI server process found" -ForegroundColor Gray
}

Write-Host ""

# Find and stop cloudflared processes
Write-Host "Stopping Cloudflare tunnel..." -ForegroundColor Cyan
$cloudflaredProcesses = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue

if ($cloudflaredProcesses) {
    $cloudflaredProcesses | ForEach-Object {
        Write-Host "  - Stopping cloudflared process (PID: $($_.Id))" -ForegroundColor Yellow
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Cloudflare tunnel stopped" -ForegroundColor Green
} else {
    Write-Host "No Cloudflare tunnel process found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   CASIE Bridge Stopped" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To restart services, run: D:\casie\casie-bridge\start_casie.ps1" -ForegroundColor Cyan
