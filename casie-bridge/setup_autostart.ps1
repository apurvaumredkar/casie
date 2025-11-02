# CASIE Bridge - Task Scheduler Setup Script
# Creates a scheduled task to start CASIE Bridge on user login

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CASIE Bridge Autostart Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$taskName = "CASIE Bridge"
$scriptPath = Join-Path $PSScriptRoot "casie.ps1"
$scriptArgs = "-Action start"

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Task '$taskName' already exists" -ForegroundColor Yellow
    $response = Read-Host "Do you want to recreate it? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Setup cancelled" -ForegroundColor Gray
        exit 0
    }
    Write-Host "Removing existing task..." -ForegroundColor Cyan
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the scheduled task
Write-Host "Creating scheduled task '$taskName'..." -ForegroundColor Cyan

# Define the action (what to run)
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`" $scriptArgs"

# Define the trigger (when to run)
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Define the principal (run with highest privileges)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive `
    -RunLevel Highest

# Define settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)  # No time limit

# Register the task
try {
    Register-ScheduledTask -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description "Automatically starts CASIE Bridge (FastAPI + Cloudflare Tunnel) on user login" `
        -Force | Out-Null

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   Autostart Setup Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  - Task Name: $taskName" -ForegroundColor White
    Write-Host "  - Trigger: At user logon" -ForegroundColor White
    Write-Host "  - Script: $scriptPath" -ForegroundColor White
    Write-Host "  - Privileges: Highest (Administrator)" -ForegroundColor White
    Write-Host ""
    Write-Host "CASIE Bridge will now start automatically when you log in!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To verify the task, run:" -ForegroundColor Yellow
    Write-Host "  Get-ScheduledTask -TaskName '$taskName' | Select-Object *" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To remove autostart, run:" -ForegroundColor Yellow
    Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false" -ForegroundColor Gray
}
catch {
    Write-Host ""
    Write-Host "ERROR: Failed to create scheduled task" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
