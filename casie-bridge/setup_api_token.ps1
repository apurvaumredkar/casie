# CASIE Bridge - API Token Setup Helper
# This script helps you create and configure a Cloudflare API token

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Cloudflare API Token Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "You need to create a Cloudflare API token with KV write permissions." -ForegroundColor Yellow
Write-Host ""
Write-Host "Steps to create the token:" -ForegroundColor Cyan
Write-Host "1. Go to: https://dash.cloudflare.com/profile/api-tokens" -ForegroundColor White
Write-Host "2. Click 'Create Token'" -ForegroundColor White
Write-Host "3. Select 'Create Custom Token'" -ForegroundColor White
Write-Host "4. Token name: CASIE_BRIDGE_KV" -ForegroundColor White
Write-Host "5. Permissions:" -ForegroundColor White
Write-Host "   - Account > Workers KV Storage > Edit" -ForegroundColor Gray
Write-Host "6. Account Resources:" -ForegroundColor White
Write-Host "   - Include > Specific account > (Select your account)" -ForegroundColor Gray
Write-Host "7. Click 'Continue to summary' > 'Create Token'" -ForegroundColor White
Write-Host ""

# Open the browser to the API tokens page
Write-Host "Opening Cloudflare API tokens page in your browser..." -ForegroundColor Cyan
Start-Process "https://dash.cloudflare.com/profile/api-tokens"
Start-Sleep -Seconds 2

Write-Host ""
$token = Read-Host "Paste your API token here"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "No token provided. Exiting." -ForegroundColor Red
    exit 1
}

# Update the .env file
$envPath = "D:\casie\casie-bridge\.env"
$envContent = Get-Content $envPath -Raw

if ($envContent -match "CLOUDFLARE_API_TOKEN=.*") {
    $envContent = $envContent -replace "CLOUDFLARE_API_TOKEN=.*", "CLOUDFLARE_API_TOKEN=$token"
} else {
    $envContent += "`nCLOUDFLARE_API_TOKEN=$token"
}

Set-Content -Path $envPath -Value $envContent -NoNewline

Write-Host ""
Write-Host "✓ API token saved to .env file" -ForegroundColor Green
Write-Host ""

# Test the token
Write-Host "Testing the API token..." -ForegroundColor Cyan
$env:CLOUDFLARE_API_TOKEN = $token

try {
    $result = npx wrangler whoami 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ API token is valid!" -ForegroundColor Green
        Write-Host $result
    } else {
        Write-Host "✗ API token validation failed" -ForegroundColor Red
        Write-Host $result
    }
} catch {
    Write-Host "✗ Error testing token: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Setup complete! You can now run:" -ForegroundColor Cyan
Write-Host "  D:\casie\casie-bridge\start_casie.ps1" -ForegroundColor White
