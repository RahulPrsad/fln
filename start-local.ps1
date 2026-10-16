$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$runDir = Join-Path $root '.local/run'
New-Item -ItemType Directory -Force $runDir | Out-Null

# Reuse the installed local model and the verified frontend/backend builds.
$env:NODE_ENV = 'production'
$env:SMARTFLN_MODEL_SERVICE_URL = 'http://127.0.0.1:8090'
$env:SMARTFLN_MODEL_HOST = '127.0.0.1'
$env:SMARTFLN_MODEL_PORT = '8090'
$env:SMARTFLN_MODEL_OCR_PROVIDER = 'trocr'
$env:SMARTFLN_TROCR_LOCAL_FILES_ONLY = 'true'
$env:SMARTFLN_TROCR_MODEL = 'C:\fln-trocr\hf-cache\hub\models--microsoft--trocr-base-handwritten\snapshots\eaacaf452b06415df8f10bb6fad3a4c11e609406'
$env:SMARTFLN_TROCR_CACHE_DIR = Join-Path $root 'services/model/models'
$env:PYTHONPATH = Join-Path $root '.local/python-packages'
$env:PYTHONDONTWRITEBYTECODE = '1'

function Start-LocalService($name, $port, $executable, $arguments, $directory) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $client.Connect('127.0.0.1', $port)
        Write-Host "$name already has a listener on port $port."
        return
    } catch {
        # No listener: start this service.
    } finally {
        $client.Dispose()
    }
    $env:PORT = "$port"
    $process = Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDir "$name.out.log") -RedirectStandardError (Join-Path $runDir "$name.err.log")
    Set-Content -LiteralPath (Join-Path $runDir "$name.pid") -Value $process.Id
    Write-Host "Started $name (PID $($process.Id)). Logs: $runDir"
}

$node = (Get-Command node.exe).Source
Start-LocalService 'model' 8090 'C:\fln-trocr\Scripts\python.exe' @('-B', '-m', 'app.main') (Join-Path $root 'services/model')
Start-LocalService 'levels' 4000 $node @('server.js') (Join-Path $root 'backend/fln-backend')
Start-LocalService 'web-api' 3000 $node @('dist/server.cjs') (Join-Path $root 'backend')
Write-Host 'App: http://localhost:3000/  Model: http://127.0.0.1:8090/health'
