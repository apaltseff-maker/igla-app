# Auto-restart script for Next.js dev server
$port = 3005
$maxRetries = 5
$retryDelay = 3

function Test-Server {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Start-DevServer {
    Write-Host "Starting dev server on port $port..."
    $process = Start-Process -FilePath "npx" -ArgumentList "next dev -p $port --no-turbopack" -WorkingDirectory "C:\dev\atelier-app" -PassThru -NoNewWindow
    return $process
}

# Kill existing node processes on port 3005
$existing = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($existing) {
    $pid = ($existing | Select-Object -First 1).OwningProcess
    if ($pid) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "Killed existing process on port $port"
        Start-Sleep -Seconds 2
    }
}

# Start server
$proc = Start-DevServer
Start-Sleep -Seconds 8

# Monitor and restart if needed
while ($true) {
    if (-not (Test-Server)) {
        Write-Host "[$(Get-Date)] Server not responding, restarting..."
        if ($proc -and -not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
        $proc = Start-DevServer
        Start-Sleep -Seconds 8
    } else {
        Start-Sleep -Seconds 10
    }
}
