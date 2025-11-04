# CASIE Bridge - Unified Service Manager
# Manages FastAPI server and Cloudflare tunnel as a single unit
#
# Usage:
#   casie.ps1 -Action start    # Start both services (FastAPI → Tunnel)
#   casie.ps1 -Action stop     # Stop both services
#   casie.ps1 -Action restart  # Restart both services
#   casie.ps1 -Action status   # Check service status

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action
)

# Get script directory for portable paths
$scriptRoot = $PSScriptRoot

# Load configuration from .env file
function Get-EnvVars {
    $envPath = Join-Path $scriptRoot ".env"
    $envVars = @{}

    if (Test-Path $envPath) {
        Get-Content $envPath | ForEach-Object {
            if ($_ -match '^([^#=]+)=(.*)$') {
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                $envVars[$key] = $value
            }
        }
    }

    return $envVars
}

# Check if FastAPI is running
function Test-FastAPI {
    # Simply test if the health endpoint responds with auth
    try {
        $envVars = Get-EnvVars
        $apiToken = $envVars['API_AUTH_TOKEN']
        $headers = @{}
        if ($apiToken) {
            $headers['Authorization'] = "Bearer $apiToken"
        }

        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" `
                                     -Method GET `
                                     -Headers $headers `
                                     -TimeoutSec 2 `
                                     -ErrorAction Stop

        if ($response.StatusCode -eq 200) {
            # Get any Python process as a placeholder for PID display
            $process = Get-Process -Name "python" -ErrorAction SilentlyContinue | Select-Object -First 1
            return $process
        }
    } catch {
        return $null
    }
    return $null
}

# Check if Cloudflare tunnel is running
function Test-Tunnel {
    $process = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    return $process
}

# Wait for FastAPI health check
function Wait-FastAPIHealth {
    param([int]$TimeoutSeconds = 30)

    $elapsed = 0
    $interval = 1

    Write-Host "Waiting for FastAPI to be healthy..." -ForegroundColor Cyan

    # Get API token from .env
    $envVars = Get-EnvVars
    $apiToken = $envVars['API_AUTH_TOKEN']

    while ($elapsed -lt $TimeoutSeconds) {
        try {
            $headers = @{}
            if ($apiToken) {
                $headers['Authorization'] = "Bearer $apiToken"
            }

            $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" `
                                         -Method GET `
                                         -Headers $headers `
                                         -TimeoutSec 2 `
                                         -ErrorAction SilentlyContinue

            if ($response.StatusCode -eq 200) {
                Write-Host "FastAPI is healthy!" -ForegroundColor Green
                return $true
            }
        } catch {
            # Connection refused or timeout - service not ready yet
        }

        Start-Sleep -Seconds $interval
        $elapsed += $interval
        Write-Host "." -NoNewline -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "FastAPI health check timed out after $TimeoutSeconds seconds" -ForegroundColor Red
    return $false
}

# Start FastAPI server
function Start-FastAPI {
    Write-Host "Starting FastAPI server..." -ForegroundColor Cyan

    $existing = Test-FastAPI
    if ($existing) {
        Write-Host "FastAPI is already running (PID: $($existing.Id))" -ForegroundColor Yellow
        return $true
    }

    # Start FastAPI server in background
    Set-Location $scriptRoot
    $process = Start-Process -FilePath "python" `
                            -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000" `
                            -WindowStyle Hidden `
                            -PassThru

    if ($process) {
        Write-Host "FastAPI server started (PID: $($process.Id))" -ForegroundColor Green

        # Wait for health check
        if (Wait-FastAPIHealth -TimeoutSeconds 15) {
            Write-Host "Server listening on http://127.0.0.1:8000" -ForegroundColor Green
            return $true
        } else {
            Write-Host "FastAPI started but health check failed" -ForegroundColor Yellow
            return $false
        }
    } else {
        Write-Host "Failed to start FastAPI server" -ForegroundColor Red
        return $false
    }
}

# Start Cloudflare tunnel
function Start-Tunnel {
    Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Cyan

    $existing = Test-Tunnel
    if ($existing) {
        Write-Host "Cloudflare tunnel is already running (PID: $($existing.Id))" -ForegroundColor Yellow
        return $true
    }

    # Load configuration
    $envVars = Get-EnvVars
    $kvNamespace = $envVars['KV_NAMESPACE_ID']

    if ([string]::IsNullOrWhiteSpace($kvNamespace)) {
        Write-Host "ERROR: KV_NAMESPACE_ID not set in .env file" -ForegroundColor Red
        return $false
    }

    $tunnelLog = Join-Path $scriptRoot "tunnel.log"

    # Start cloudflared tunnel in background
    $tunnelProcess = Start-Process -FilePath "cloudflared" `
                                   -ArgumentList "tunnel", "--url", "http://127.0.0.1:8000" `
                                   -RedirectStandardError $tunnelLog `
                                   -NoNewWindow `
                                   -PassThru

    if (-not $tunnelProcess) {
        Write-Host "Failed to start cloudflared" -ForegroundColor Red
        return $false
    }

    Write-Host "Tunnel process started (PID: $($tunnelProcess.Id))" -ForegroundColor Green
    Write-Host "Waiting for tunnel URL..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5

    # Extract tunnel URL from log
    $url = Select-String -Path $tunnelLog -Pattern "https://[-A-Za-z0-9.]*trycloudflare.com" |
           Select-Object -First 1 |
           ForEach-Object { $_.Matches.Value }

    if ($url) {
        Write-Host "Tunnel URL: $url" -ForegroundColor Green

        # Upload URL to KV
        Write-Host "Uploading URL to Cloudflare KV..." -ForegroundColor Cyan
        $wranglerResult = npx wrangler kv key put --namespace-id=$kvNamespace --remote "current_tunnel_url" $url 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully uploaded tunnel URL to KV" -ForegroundColor Green

            # Also upload location data if available
            $locationFile = Join-Path $scriptRoot "location.json"
            if (Test-Path $locationFile) {
                Write-Host "Uploading location data to KV..." -ForegroundColor Cyan
                $locationData = Get-Content $locationFile -Raw | ConvertFrom-Json
                $locationJson = $locationData.location | ConvertTo-Json -Compress
                $locationResult = npx wrangler kv key put --namespace-id=$kvNamespace --remote "location_cache" $locationJson 2>&1

                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Successfully uploaded location data to KV" -ForegroundColor Green
                }
            }
        } else {
            Write-Host "Failed to upload URL to KV (tunnel still running)" -ForegroundColor Yellow
        }

        return $true
    } else {
        Write-Host "WARNING: Tunnel URL not found in log file" -ForegroundColor Yellow
        Write-Host "Check $tunnelLog for details" -ForegroundColor Yellow
        return $false
    }
}

# Stop FastAPI server
function Stop-FastAPI {
    Write-Host "Stopping FastAPI server..." -ForegroundColor Cyan

    $processes = Get-Process -Name "python" -ErrorAction SilentlyContinue |
                 Where-Object { $_.CommandLine -like "*uvicorn main:app*" }

    if ($processes) {
        $processes | ForEach-Object {
            Write-Host "  Stopping Python process (PID: $($_.Id))" -ForegroundColor Yellow
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
        Write-Host "FastAPI server stopped" -ForegroundColor Green
        return $true
    } else {
        Write-Host "No FastAPI server process found" -ForegroundColor Gray
        return $false
    }
}

# Stop Cloudflare tunnel
function Stop-Tunnel {
    Write-Host "Stopping Cloudflare tunnel..." -ForegroundColor Cyan

    $processes = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue

    if ($processes) {
        $processes | ForEach-Object {
            Write-Host "  Stopping cloudflared process (PID: $($_.Id))" -ForegroundColor Yellow
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
        Write-Host "Cloudflare tunnel stopped" -ForegroundColor Green
        return $true
    } else {
        Write-Host "No Cloudflare tunnel process found" -ForegroundColor Gray
        return $false
    }
}

# Show service status
function Show-Status {
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "   CASIE Bridge Status" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""

    # Check FastAPI
    $fastapi = Test-FastAPI
    if ($fastapi) {
        Write-Host "FastAPI Server: Running" -ForegroundColor Green
        Write-Host "  PID: $($fastapi.Id)" -ForegroundColor Cyan
        Write-Host "  URL: http://127.0.0.1:8000" -ForegroundColor Cyan

        # Try to get health status with authentication
        try {
            $envVars = Get-EnvVars
            $apiToken = $envVars['API_AUTH_TOKEN']
            $headers = @{}
            if ($apiToken) {
                $headers['Authorization'] = "Bearer $apiToken"
            }

            $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Headers $headers -TimeoutSec 2
            Write-Host "  Health: OK" -ForegroundColor Green
        } catch {
            Write-Host "  Health: ERROR (not responding or auth failed)" -ForegroundColor Red
        }
    } else {
        Write-Host "FastAPI Server: Not running" -ForegroundColor Red
    }

    Write-Host ""

    # Check Tunnel
    $tunnel = Test-Tunnel
    if ($tunnel) {
        Write-Host "Cloudflare Tunnel: Running" -ForegroundColor Green
        Write-Host "  PID: $($tunnel.Id)" -ForegroundColor Cyan

        # Try to read tunnel URL from log
        $tunnelLog = Join-Path $scriptRoot "tunnel.log"
        if (Test-Path $tunnelLog) {
            $url = Select-String -Path $tunnelLog -Pattern "https://[-A-Za-z0-9.]*trycloudflare.com" |
                   Select-Object -First 1 |
                   ForEach-Object { $_.Matches.Value }

            if ($url) {
                Write-Host "  URL: $url" -ForegroundColor Cyan
            }
        }
    } else {
        Write-Host "Cloudflare Tunnel: Not running" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
}

# Main execution logic
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   CASIE Bridge Manager" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

switch ($Action) {
    "start" {
        # Always start FastAPI first
        $fastAPIStarted = Start-FastAPI
        Write-Host ""

        # Verify FastAPI is healthy before starting tunnel
        if ($fastAPIStarted) {
            Write-Host "Verifying FastAPI is ready before starting tunnel..." -ForegroundColor Cyan
            $fastAPIReady = Test-FastAPI
            if (-not $fastAPIReady) {
                Write-Host "ERROR: FastAPI started but health check failed" -ForegroundColor Red
                Write-Host "Cannot start tunnel without healthy FastAPI backend" -ForegroundColor Red
                exit 1
            }
            Write-Host "FastAPI is ready!" -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host "ERROR: Failed to start FastAPI" -ForegroundColor Red
            Write-Host "Cannot start tunnel without FastAPI backend" -ForegroundColor Red
            exit 1
        }

        # Now start the tunnel
        $tunnelStarted = Start-Tunnel
        Write-Host ""

        if ($fastAPIStarted -and $tunnelStarted) {
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "   Services Started Successfully" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "========================================" -ForegroundColor Red
            Write-Host "   Some Services Failed to Start" -ForegroundColor Red
            Write-Host "========================================" -ForegroundColor Red
            exit 1
        }
    }

    "stop" {
        # Stop tunnel first, then FastAPI
        Stop-Tunnel
        Write-Host ""
        Stop-FastAPI
        Write-Host ""

        Write-Host "========================================" -ForegroundColor Green
        Write-Host "   Services Stopped" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        exit 0
    }

    "restart" {
        Write-Host "Restarting services..." -ForegroundColor Cyan
        Write-Host ""

        # Stop both services (tunnel first)
        Stop-Tunnel
        Stop-FastAPI
        Write-Host ""
        Start-Sleep -Seconds 2

        # Start FastAPI first
        $fastAPIStarted = Start-FastAPI
        Write-Host ""

        # Verify FastAPI is healthy before starting tunnel
        if ($fastAPIStarted) {
            Write-Host "Verifying FastAPI is ready before starting tunnel..." -ForegroundColor Cyan
            $fastAPIReady = Test-FastAPI
            if (-not $fastAPIReady) {
                Write-Host "ERROR: FastAPI started but health check failed" -ForegroundColor Red
                exit 1
            }
            Write-Host "FastAPI is ready!" -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host "ERROR: Failed to start FastAPI" -ForegroundColor Red
            exit 1
        }

        # Now start the tunnel
        $tunnelStarted = Start-Tunnel
        Write-Host ""

        if ($fastAPIStarted -and $tunnelStarted) {
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "   Services Restarted Successfully" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "========================================" -ForegroundColor Red
            Write-Host "   Restart Failed" -ForegroundColor Red
            Write-Host "========================================" -ForegroundColor Red
            exit 1
        }
    }

    "status" {
        Show-Status
        exit 0
    }
}
