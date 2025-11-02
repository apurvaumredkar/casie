# CASIE Bridge - Cloudflare Tunnel Launcher
# Launches Cloudflare quick tunnel, captures URL, and uploads to Cloudflare KV
# This creates a public HTTPS endpoint that routes to the local FastAPI server

Write-Host "Starting Cloudflare Tunnel..." -ForegroundColor Cyan

# Load configuration from .env file
$envPath = "D:\casie\casie-bridge\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: .env file not found at $envPath" -ForegroundColor Red
    Write-Host "Please create the .env file with your Cloudflare credentials" -ForegroundColor Yellow
    exit 1
}

# Parse .env file
$envVars = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Extract configuration
$kvNamespace = $envVars['KV_NAMESPACE_ID']

# Validate configuration
if ([string]::IsNullOrWhiteSpace($kvNamespace)) {
    Write-Host "ERROR: KV_NAMESPACE_ID is not set in .env file" -ForegroundColor Red
    Write-Host "Please run setup_api_token.ps1 to configure credentials" -ForegroundColor Yellow
    exit 1
}

$tunnelLog = "D:\casie\casie-bridge\tunnel.log"

# Start cloudflared tunnel in background
Write-Host "Launching cloudflared tunnel..." -ForegroundColor Cyan
$tunnelProcess = Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel", "--url", "http://127.0.0.1:8000" `
    -RedirectStandardError $tunnelLog `
    -NoNewWindow `
    -PassThru

if (-not $tunnelProcess) {
    Write-Host "Failed to start cloudflared" -ForegroundColor Red
    exit 1
}

Write-Host "Tunnel process started (PID: $($tunnelProcess.Id))" -ForegroundColor Green
Write-Host "Waiting for tunnel URL to be generated..." -ForegroundColor Cyan

# Wait for the tunnel to start and capture the URL
Start-Sleep -Seconds 5

# Extract the tunnel URL from the log file
$url = Select-String -Path $tunnelLog -Pattern "https://[-A-Za-z0-9.]*trycloudflare.com" |
       Select-Object -First 1 |
       ForEach-Object { $_.Matches.Value }

if ($url) {
    Write-Host "Tunnel URL detected: $url" -ForegroundColor Green

    # Upload the URL to Cloudflare KV using wrangler
    Write-Host "Uploading URL to Cloudflare KV..." -ForegroundColor Cyan

    try {
        # Create a temporary file with the URL
        $tempFile = "D:\casie\casie-bridge\tunnel_url.txt"
        Set-Content -Path $tempFile -Value $url -NoNewline

        # Use wrangler to upload to KV (uses existing authentication)
        # --remote flag writes to Cloudflare KV (not local)
        $wranglerResult = npx wrangler kv key put --namespace-id=$kvNamespace --remote "current_tunnel_url" $url 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully uploaded tunnel URL to Cloudflare KV" -ForegroundColor Green
            Write-Host "Key: current_tunnel_url" -ForegroundColor Cyan
            Write-Host "Value: $url" -ForegroundColor Cyan
        } else {
            Write-Host "Failed to upload URL to Cloudflare KV" -ForegroundColor Red
            Write-Host $wranglerResult -ForegroundColor Gray
            Write-Host "Tunnel is still running, but URL was not uploaded" -ForegroundColor Yellow
        }

        # Clean up temp file
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -ErrorAction SilentlyContinue
        }
    }
    catch {
        Write-Host "Failed to upload URL to Cloudflare KV: $_" -ForegroundColor Red
        Write-Host "Tunnel is still running, but URL was not uploaded" -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: Tunnel URL not found in log file" -ForegroundColor Red
    Write-Host "Check D:\casie\casie-bridge\tunnel.log for details" -ForegroundColor Yellow
    Write-Host "The tunnel may still be starting up..." -ForegroundColor Yellow
}

# Exit successfully (tunnel is running even if URL upload failed)
exit 0
