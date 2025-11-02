# CASIE Bridge - FastAPI Launcher
# Starts the FastAPI server silently in background
# The server will listen on http://127.0.0.1:8000

Write-Host "Starting CASIE Bridge FastAPI server..." -ForegroundColor Cyan

# Ensure the casie-bridge directory exists
New-Item -ItemType Directory -Force -Path "D:\casie\casie-bridge" | Out-Null

# Change to the casie-bridge directory
Set-Location "D:\casie\casie-bridge"

# Start FastAPI server in background (hidden window)
# Using uvicorn as the ASGI server
$fastApiProcess = Start-Process -FilePath "python" `
    -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WindowStyle Hidden `
    -PassThru

if ($fastApiProcess) {
    Write-Host "FastAPI server started successfully (PID: $($fastApiProcess.Id))" -ForegroundColor Green
    Write-Host "Server listening on http://127.0.0.1:8000" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Failed to start FastAPI server" -ForegroundColor Red
    exit 1
}
